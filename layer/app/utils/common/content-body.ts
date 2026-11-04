// 条目文件 = YAML frontmatter + 正文。这个模块只切分 frontmatter，不解析 YAML，
// 所以公开页面也可以使用，不会把 YAML 解析器打包进去。
import type { HeaderTabUrl } from "./tabs";
import { HeaderTabs } from "./tabs";

// 文件第一行是 ---，到下一个单独一行的 --- 为止。frontmatter 可以为空。
const FRONTMATTER_RE = /^---\n((?:[\s\S]*?\n)?)---(?:\n|$)/;

export function splitFrontmatter(raw: string): { frontmatter: string | null; body: string } {
  const text = raw.replace(/\r\n/g, "\n");
  const m = FRONTMATTER_RE.exec(text);
  if (!m) {
    return { frontmatter: null, body: text };
  }
  return { frontmatter: m[1]!, body: text.slice(m[0].length) };
}

/** 去掉 frontmatter，只返回正文 */
export function stripFrontmatter(raw: string) {
  return splitFrontmatter(raw).body;
}

/** 条目文件相对仓库根目录的路径 */
export function itemFilePath(tab: HeaderTabUrl, id: number | string) {
  return `public/rebuild${tab}/${id}.md`;
}

/** 条目所在目录相对仓库根目录的路径 */
export function itemDirPath(tab: HeaderTabUrl) {
  return `public/rebuild${tab}`;
}

/** 构建时生成的索引（不提交到仓库）相对仓库根目录的路径 */
export function indexFilePath(tab: HeaderTabUrl) {
  return `public/rebuild/json${tab}.json`;
}

/**
 * 构建时与索引一起生成：条目文件名 → 这个文件的 git blob oid。
 * 后台列表用它判断哪些条目在部署之后改过，只下载这些条目的原文。
 */
export function oidMapFilePath(tab: HeaderTabUrl) {
  return `public/rebuild/json${tab}.oids.json`;
}

/** 解析条目文件路径；不是条目文件时返回 null */
export function parseItemFilePath(path: string): { tab: HeaderTabUrl; id: number } | null {
  const m = /^public\/rebuild(\/[a-z]+)\/(\d+)\.md$/.exec(path);
  if (!m || !(HeaderTabs as readonly string[]).includes(m[1]!)) {
    return null;
  }
  return { tab: m[1] as HeaderTabUrl, id: Number(m[2]) };
}
