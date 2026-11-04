import { indexFilePath, itemDirPath, itemFilePath, oidMapFilePath, parseItemFilePath, stripFrontmatter } from "../common/content-body";
import { escapeNewLine } from "../common/utils";
import type { CommonItem, HeaderTabUrl } from "#layers/nuxt-blog/app/utils/common/types";
import { isDev, isPrerender } from "#layers/nuxt-blog/app/utils/nuxt/constants";
import { withBase } from "#layers/nuxt-blog/app/utils/nuxt/with-base";

// 读的是静态文件，不需要 Nitro 的路由类型。直接调用带类型的 $fetch，在新增带方法后缀的 API 路由后
// 会让类型推导栈深度超限；所以先转成简单的函数类型。仍用 $fetch 而不是原生 fetch：
// 单元测试的 registerEndpoint 只拦截 $fetch，$fetch 也会对非 2xx 状态抛错。
type StaticFetch = <T>(url: string, opts: { query: Record<string, string>; parseResponse: (_: string) => T }) => Promise<T>;
const staticFetch = $fetch as unknown as StaticFetch;

/** 目录中的一个文件：文件名和 git blob oid */
export type HeadTreeEntry = { name: string; oid: string };
/** 从仓库读取内容。参数都是相对仓库根目录的路径 */
export type HeadReader = {
  /** 读取一个文件的原文 */
  file: (repoPath: string) => Promise<string>;
  /** 读取一个目录中的文件名和 oid（不递归，不读内容）；目录不存在时返回空数组 */
  tree: (repoDir: string) => Promise<HeadTreeEntry[]>;
  /** 按 oid 读取这个目录中一些文件的原文，顺序与 entries 相同 */
  blobs: (repoDir: string, entries: HeadTreeEntry[]) => Promise<string[]>;
};

// 后台从仓库 HEAD 读取内容，不再读已部署的静态文件，所以提交后不必等部署。
// headReader 由 GitHub 实现在 token 验证通过后注册；headReadingActive 只在后台布局挂载期间为 true。
// 公开页面始终读已部署的静态文件。
let headReader: HeadReader | undefined;
let headReadingActive = false;
// 缓存原文（Promise），每次读取时再 transform，调用方拿到的是新对象
const headCache = new Map<string, Promise<string>>();
const headTreeCache = new Map<string, Promise<HeadTreeEntry[]>>();

export function setHeadReader(reader: HeadReader | undefined) {
  headReader = reader;
  headCache.clear();
  headTreeCache.clear();
}

export function setHeadReadingActive(active: boolean) {
  headReadingActive = active;
}

export function isReadingFromHead() {
  return import.meta.client && headReadingActive && !!headReader;
}

const parentDir = (repoPath: string) => repoPath.slice(0, repoPath.lastIndexOf("/"));
const baseName = (repoPath: string) => repoPath.slice(repoPath.lastIndexOf("/") + 1);

/** 提交成功后调用：这些文件和它们所在的目录，下次从新的 HEAD 读取 */
export function invalidateHeadCache(repoPaths: string[]) {
  repoPaths.forEach((p) => {
    headCache.delete(p);
    headTreeCache.delete(parentDir(p));
  });
}

function cached<T>(cache: Map<string, Promise<T>>, key: string, load: () => Promise<T>) {
  let value = cache.get(key);
  if (!value) {
    value = load();
    cache.set(key, value);
    // 失败的读取不缓存；错误仍由调用方处理
    value.catch(() => cache.delete(key));
  }
  return value;
}

function readFromHead(repoPath: string) {
  return cached(headCache, repoPath, () => headReader!.file(repoPath));
}

/** 读取一个目录中这些文件的原文。已经读过的文件不再请求，其余的一次按 oid 读取 */
function readFilesFromHead(repoDir: string, entries: HeadTreeEntry[]) {
  const missing = entries.filter(e => !headCache.has(`${repoDir}/${e.name}`));
  if (missing.length) {
    const texts = headReader!.blobs(repoDir, missing);
    missing.forEach((e, i) => cached(headCache, `${repoDir}/${e.name}`, () => texts.then(t => t[i]!)));
  }
  return Promise.all(entries.map(e => headCache.get(`${repoDir}/${e.name}`)!));
}

/**
 * 读已部署的静态文件。
 * @param repoPath 相对仓库根目录的路径，去掉 public/ 前缀就是文件在站点上的路径
 */
async function fetchStatic<T>(repoPath: string, transform: (_: string) => T): Promise<T> {
  const _path = repoPath.replace(/^public\//, "");
  const path = __NB_BUILDTIME_VITESTING__ ? `e2e/${_path}` : _path;
  if (import.meta.client) {
    if (!window.NBCache) {
      window.NBCache = {};
    }
    if (typeof window.NBCache[path] !== "undefined") {
      return window.NBCache[path];
    } else {
      const res = await staticFetch(withBase(`/${path}`), { query: { s: __NB_BUILD_TIME__ }, parseResponse: transform });
      window.NBCache[path] = res;
      return res;
    }
  } else if (isDev || isPrerender) {
    return transform((await import("fs")).readFileSync("public/" + path, { encoding: "utf-8" }).toString());
  }
  return transform("[]");
}

/**
 * @param repoPath 相对仓库根目录的路径，如 public/rebuild/articles/1.md、config.ts。
 * 后台读仓库 HEAD，其他情况读已部署的静态文件。
 */
const magicFetch = async<T = any>(repoPath: string, transform: (_: string) => T): Promise<T> => {
  if (isReadingFromHead()) {
    return transform(await readFromHead(repoPath));
  }
  return fetchStatic(repoPath, transform);
};

/**
 * 这次部署的索引中的条目，键是条目文件的路径，值包含构建时这个文件的 oid。
 * 索引和 oid 映射由同一次构建生成。读不到时（例如站点由没有 oid 映射的旧版本构建）返回 undefined。
 */
async function readDeployedIndex(tab: HeaderTabUrl) {
  try {
    const [list, oids] = await Promise.all([
      fetchStatic<CommonItem[]>(indexFilePath(tab), JSON.parse),
      fetchStatic<Record<string, string>>(oidMapFilePath(tab), JSON.parse)
    ]);
    const deployed = new Map<string, { oid: string; item: CommonItem }>();
    for (const item of list) {
      const file = itemFilePath(tab, item.id);
      const oid = oids[baseName(file)];
      if (oid) {
        deployed.set(file, { oid, item });
      }
    }
    return deployed;
  } catch {
    return undefined;
  }
}

/**
 * 仓库 HEAD 中的条目列表，与构建时生成的索引相同（layer/scripts/utils/content.ts）。
 * 只向 GitHub 读取目录中的文件名和 oid。oid 与部署时相同的条目，文件内容相同，直接用已部署索引中的元数据；
 * 只下载部署之后新增或修改的条目。读不到已部署的索引时，下载全部条目。
 */
async function fetchListFromHead<T extends CommonItem>(tab: HeaderTabUrl): Promise<T[]> {
  const dir = itemDirPath(tab);
  // 解析 frontmatter 要用 yaml，只在后台需要，所以按需加载
  const [tree, deployed, { parseItemFile, sortIndex, toIndexItem }] = await Promise.all([
    cached(headTreeCache, dir, () => headReader!.tree(dir)),
    readDeployedIndex(tab),
    import("../common/content-file")
  ]);
  const list: CommonItem[] = [];
  const changed: { entry: HeadTreeEntry; file: string; id: number }[] = [];
  for (const entry of tree) {
    const file = `${dir}/${entry.name}`;
    const parsed = parseItemFilePath(file);
    if (!parsed) {
      continue;
    }
    const known = deployed?.get(file);
    if (known && known.oid === entry.oid) {
      // 已部署的索引在静态文件缓存中，调用方可能修改条目（例如解密），所以复制一份
      list.push(structuredClone(known.item));
    } else {
      changed.push({ entry, file, id: parsed.id });
    }
  }
  const texts = changed.length ? await readFilesFromHead(dir, changed.map(c => c.entry)) : [];
  changed.forEach(({ file, id }, i) => {
    const { item, body } = parseItemFile(tab, id, texts[i]!, file);
    list.push(toIndexItem(item, body));
  });
  return sortIndex(list) as unknown as T[];
}

export const fetchList = async<T extends CommonItem>(tab: HeaderTabUrl) => {
  if (isReadingFromHead()) {
    return await fetchListFromHead<T>(tab);
  }
  // 索引在构建时生成（public/rebuild/json/），字段已经补齐
  return await fetchStatic<T[]>(indexFilePath(tab), s => JSON.parse(s) as T[]);
};

/** 条目的正文（不含 frontmatter） */
export const fetchMd = async (tab: HeaderTabUrl, id: string) => {
  return await magicFetch<string>(itemFilePath(tab, id), s => stripFrontmatter(s)) || "";
};

/**
 * 读取仓库中的文件原文（条目文件包含 frontmatter）。
 * @param path 相对仓库根目录的路径（与提交时的 path 相同）
 */
export const fetchAny = async<T = any>(path: string) => {
  return await magicFetch<T>(path, path.endsWith(".json") ? JSON.parse : escapeNewLine);
};

declare global {
  interface Window {
    NBCache: Record<string, any>;
  }
}
