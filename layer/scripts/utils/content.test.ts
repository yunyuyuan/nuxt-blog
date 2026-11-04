import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateIndex, gitBlobOid } from "./content";

let dir: string;
function write(rel: string, text: string) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(dir, rel), "utf-8"));

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "nb-content-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("git blob oid", () => {
  it("is the oid that git computes for the same content", () => {
    // printf 'hello\n' | git hash-object --stdin
    expect(gitBlobOid(Buffer.from("hello\n"))).toBe("ce013625030ba8dba906f756967f9e9ca394464a");
    // 按字节数计算，不是字符数
    const text = "---\ntitle: 中文\n---\n正文\n";
    const file = path.join(dir, "zh.md");
    fs.writeFileSync(file, text);
    let expected: string | undefined;
    try {
      expected = execFileSync("git", ["hash-object", file], { encoding: "utf-8" }).trim();
    } catch {
      // 没有 git 时跳过这一项
    }
    if (expected) {
      expect(gitBlobOid(Buffer.from(text))).toBe(expected);
    }
  });
});

describe("generateIndex", () => {
  it("writes the oid of every item file next to the index", () => {
    const a1 = "---\ntitle: one\ntime: 1\n---\nbody 1";
    const a2 = "---\ntitle: two\ntime: 2\n---\nbody 2";
    write("articles/1.md", a1);
    write("articles/2.md", a2);
    write("articles/notes.txt", "not an item");

    const result = generateIndex(dir);
    expect(result["/articles"].map(i => i.id)).toEqual([2, 1]);
    expect(readJson("json/articles.json")).toEqual(JSON.parse(JSON.stringify(result["/articles"])));
    expect(readJson("json/articles.oids.json")).toEqual({
      "1.md": gitBlobOid(Buffer.from(a1)),
      "2.md": gitBlobOid(Buffer.from(a2))
    });
    // 没有条目的栏目也生成两个文件
    expect(readJson("json/records.json")).toEqual([]);
    expect(readJson("json/records.oids.json")).toEqual({});
  });

  it("does not rewrite unchanged files", () => {
    write("articles/1.md", "---\ntitle: one\ntime: 1\n---\nbody");
    generateIndex(dir);
    const oidFile = path.join(dir, "json/articles.oids.json");
    const old = new Date(2000, 0, 1);
    fs.utimesSync(oidFile, old, old);
    generateIndex(dir);
    expect(fs.statSync(oidFile).mtime.getTime()).toBe(old.getTime());

    write("articles/1.md", "---\ntitle: one\ntime: 1\n---\nchanged");
    generateIndex(dir);
    expect(fs.statSync(oidFile).mtime.getTime()).not.toBe(old.getTime());
  });
});
