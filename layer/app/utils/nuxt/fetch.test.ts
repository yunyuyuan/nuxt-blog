import { registerEndpoint } from "@nuxt/test-utils/runtime";
import { createError } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ArticleItem } from "../common/types";
import { fetchAny, fetchList, fetchMd, invalidateHeadCache, isReadingFromHead, setHeadReader, setHeadReadingActive } from "./fetch";

registerEndpoint("/rebuild/json/records.json", () => [{ id: 1, title: "static" }]);

// 已部署的 articles 索引和 oid 映射（构建时生成）。undefined 表示站点上没有这两个文件
let deployed: { list: Partial<ArticleItem>[]; oids: Record<string, string> } | undefined;
const notFound = () => createError({ statusCode: 404 });
registerEndpoint("/rebuild/json/articles.json", () => {
  if (!deployed) {
    throw notFound();
  }
  return deployed.list;
});
registerEndpoint("/rebuild/json/articles.oids.json", () => {
  if (!deployed) {
    throw notFound();
  }
  return deployed.oids;
});

afterEach(() => {
  setHeadReader(undefined);
  setHeadReadingActive(false);
  deployed = undefined;
  // 静态文件的缓存
  window.NBCache = {};
});

const articleFile = (id: number, title: string, time: number, body = "body") =>
  `---\ntitle: ${title}\ntime: ${time}\nlen: ${body.length}\n---\n${body}`;
// 测试中的 oid 只需要“内容相同则相同”
const oidOf = (text: string) => `oid(${text})`;

type Files = Record<string, string>;
/** dirs：目录 -> { 文件名: 原文 } */
function makeReader(dirs: Record<string, Files>, files: Files = {}) {
  return {
    file: vi.fn(async (p: string) => {
      if (p in files) {
        return files[p]!;
      }
      throw Object.assign(new Error(`GitHub API 404: ${p}`), { status: 404 });
    }),
    tree: vi.fn(async (d: string) => Object.entries(dirs[d] ?? {}).map(([name, text]) => ({ name, oid: oidOf(text) }))),
    blobs: vi.fn(async (d: string, entries: { name: string; oid: string }[]) => entries.map((e) => {
      const text = dirs[d]?.[e.name];
      if (text === undefined || oidOf(text) !== e.oid) {
        throw new Error(`no blob ${e.oid}`);
      }
      return text;
    }))
  };
}
const blobNames = (reader: ReturnType<typeof makeReader>, call = 0) =>
  reader.blobs.mock.calls[call]![1].map(e => e.name).sort();

describe("reading from HEAD", () => {
  it("reads deployed static files unless the reader is set and the manage layout is active", async () => {
    setHeadReader(makeReader({}));
    expect(isReadingFromHead()).toBe(false);
    const list = await fetchList<ArticleItem>("/records");
    expect(list[0]!.title).toBe("static");
  });

  it("reads every item file when the site has no oid map, and builds the list like the build-time index", async () => {
    const reader = makeReader({
      "public/rebuild/articles": {
        "1.md": articleFile(1, "old", 100),
        "2.md": articleFile(2, "new", 200, "a\n[encrypt]\nU2FsdGVkX1abc\n[/encrypt]\nb"),
        // 不是条目文件：忽略，也不下载
        "notes.txt": "x"
      }
    });
    setHeadReader(reader);
    setHeadReadingActive(true);
    expect(isReadingFromHead()).toBe(true);

    const a = await fetchList<ArticleItem>("/articles");
    expect(reader.tree).toHaveBeenCalledWith("public/rebuild/articles");
    expect(blobNames(reader)).toEqual(["1.md", "2.md"]);
    // 按创建时间倒序；补齐默认字段；计算加密块
    expect(a.map(i => i.id)).toEqual([2, 1]);
    expect(a[1]).toMatchObject({ id: 1, title: "old", tags: [], customSlug: "", encrypt: false, modifyTime: 100 });
    expect(a[0]!.encryptBlocks).toHaveLength(1);
    expect(a[1]!.encryptBlocks).toBeUndefined();

    // 缓存目录和原文，每次返回新对象
    const b = await fetchList<ArticleItem>("/articles");
    expect(reader.tree).toHaveBeenCalledTimes(1);
    expect(reader.blobs).toHaveBeenCalledTimes(1);
    expect(a).not.toBe(b);
    expect(b).toEqual(a);
  });

  it("uses the deployed metadata of unchanged items and downloads only the added and changed items", async () => {
    const same = articleFile(1, "same", 100);
    deployed = {
      // 1 没有改动；2 在部署之后被修改；3 在部署之后被删除
      list: [
        { id: 3, title: "deleted", time: 300 },
        { id: 2, title: "before", time: 200 },
        { id: 1, title: "from the deployed index", time: 100 }
      ],
      oids: { "1.md": oidOf(same), "2.md": oidOf(articleFile(2, "before", 200)), "3.md": oidOf("3") }
    };
    const reader = makeReader({
      "public/rebuild/articles": {
        "1.md": same,
        "2.md": articleFile(2, "after", 200),
        // 部署之后新增
        "4.md": articleFile(4, "added", 400)
      }
    });
    setHeadReader(reader);
    setHeadReadingActive(true);

    const a = await fetchList<ArticleItem>("/articles");
    expect(blobNames(reader)).toEqual(["2.md", "4.md"]);
    expect(a.map(i => [i.id, i.title])).toEqual([[4, "added"], [2, "after"], [1, "from the deployed index"]]);

    // 调用方修改返回的条目（例如解密），不影响已部署索引的缓存
    a[2]!.title = "changed by the caller";
    const b = await fetchList<ArticleItem>("/articles");
    expect(b[2]!.title).toBe("from the deployed index");
    expect(reader.blobs).toHaveBeenCalledTimes(1);
  });

  it("reads the body of a downloaded item from the cache, and strips the frontmatter", async () => {
    const same = articleFile(1, "t", 1, "unchanged");
    deployed = { list: [{ id: 1, title: "t", time: 1 }], oids: { "1.md": oidOf(same) } };
    const reader = makeReader({ "public/rebuild/articles": { "1.md": same, "2.md": articleFile(2, "t", 2, "hello") } }, {
      "public/rebuild/articles/1.md": same,
      "public/rebuild/articles/3.md": articleFile(3, "t", 1, "single"),
      "config.ts": "export default {}"
    });
    setHeadReader(reader);
    setHeadReadingActive(true);

    // 列表还没读过：单独读取文件
    expect(await fetchMd("/articles", "3")).toBe("single");
    expect(reader.file).toHaveBeenLastCalledWith("public/rebuild/articles/3.md");

    // 列表下载过的条目，正文直接从缓存中取，不再请求
    await fetchList("/articles");
    expect(await fetchMd("/articles", "2")).toBe("hello");
    expect(reader.file).toHaveBeenCalledTimes(1);
    // 列表没有下载未改动的条目：打开时单独读取
    expect(await fetchMd("/articles", "1")).toBe("unchanged");
    expect(reader.file).toHaveBeenLastCalledWith("public/rebuild/articles/1.md");

    // fetchAny 返回原文，包含 frontmatter（diff 对比整个文件）
    expect(await fetchAny("public/rebuild/articles/2.md")).toBe(articleFile(2, "t", 2, "hello"));
    expect(await fetchAny("config.ts")).toBe("export default {}");
    expect(reader.file).toHaveBeenLastCalledWith("config.ts");
  });

  it("invalidates the committed files and their directories", async () => {
    const dirs = { "public/rebuild/articles": { "1.md": articleFile(1, "before", 1) } };
    const reader = makeReader(dirs);
    setHeadReader(reader);
    setHeadReadingActive(true);
    expect((await fetchList<ArticleItem>("/articles"))[0]!.title).toBe("before");

    dirs["public/rebuild/articles"]["1.md"] = articleFile(1, "after", 1);
    // 其他目录的提交不影响这个目录
    invalidateHeadCache(["public/rebuild/records/5.md"]);
    expect((await fetchList<ArticleItem>("/articles"))[0]!.title).toBe("before");

    invalidateHeadCache(["public/rebuild/articles/1.md"]);
    expect((await fetchList<ArticleItem>("/articles"))[0]!.title).toBe("after");
    expect(reader.tree).toHaveBeenCalledTimes(2);
    expect(reader.blobs).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed read", async () => {
    let fail = true;
    const reader = makeReader({ "public/rebuild/articles": { "1.md": articleFile(1, "t", 1) } });
    reader.file.mockImplementation(async () => {
      if (fail) {
        throw Object.assign(new Error("GitHub API 404"), { status: 404 });
      }
      return "ok";
    });
    const blobs = reader.blobs.getMockImplementation()!;
    reader.blobs.mockImplementation(async (d, entries) => {
      if (fail) {
        throw new Error("GitHub API 502");
      }
      return blobs(d, entries);
    });
    setHeadReader(reader);
    setHeadReadingActive(true);
    await expect(fetchMd("/articles", "9")).rejects.toThrow("404");
    await expect(fetchList("/articles")).rejects.toThrow("502");
    fail = false;
    expect(await fetchMd("/articles", "9")).toBe("ok");
    expect(reader.file).toHaveBeenCalledTimes(2);
    expect((await fetchList<ArticleItem>("/articles"))[0]!.title).toBe("t");
    expect(reader.blobs).toHaveBeenCalledTimes(2);
  });

  it("rejects a malformed item file instead of showing a partial list", async () => {
    setHeadReader(makeReader({ "public/rebuild/articles": { "1.md": "---\ntitle: [\n---\nbody" } }));
    setHeadReadingActive(true);
    await expect(fetchList("/articles")).rejects.toThrow("public/rebuild/articles/1.md");
  });
});
