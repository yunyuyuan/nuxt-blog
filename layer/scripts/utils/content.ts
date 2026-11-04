// Node 侧读写条目文件（public/rebuild/{栏目}/{id}.md），并生成索引 public/rebuild/json/{栏目}.json
// 和 oid 映射 public/rebuild/json/{栏目}.oids.json。这两个文件是构建产物，不提交到仓库。
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { indexFilePath, oidMapFilePath } from "../../app/utils/common/content-body";
import { ContentFormatError, parseItemFile, serializeItemFile, sortIndex, toIndexItem } from "../../app/utils/common/content-file";
import { HeaderTabs } from "../../app/utils/common/tabs";
import type { HeaderTabUrl } from "../../app/utils/common/tabs";
import type { CommonItem, CommonItemByHeaderType } from "../../app/utils/common/types";

export type ContentEntry<T extends HeaderTabUrl = HeaderTabUrl> = {
  /** 存储字段（不含 encryptBlocks） */
  item: CommonItemByHeaderType<T>;
  body: string;
  file: string;
  /** 文件的 git blob oid */
  oid: string;
};

const ITEM_FILE = /^\d+\.md$/;

/**
 * 与 git 相同的 blob oid：sha1("blob <字节数>\0" + 文件内容)。
 * 不需要 .git 目录。用 CRLF 检出时与仓库中的 oid 不同，后台列表只会多下载这些文件，结果不受影响。
 */
export function gitBlobOid(content: Buffer) {
  return crypto.createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}

/** 旧格式的标志：json 目录中有手动维护的索引，但条目文件没有 frontmatter */
function migrationHint(rebuildDir: string) {
  return "\nThis looks like the old content format (JSON index + md). Convert it once with: pnpm local:migrate-content"
    + `\n(content directory: ${rebuildDir})`;
}

/**
 * 读取一个栏目的全部条目文件，按索引顺序（创建时间倒序）排列。
 * @throws ContentFormatError 任何一个文件格式错误
 */
export function readContentEntries<T extends HeaderTabUrl>(rebuildDir: string, tab: T): ContentEntry<T>[] {
  const dir = path.join(rebuildDir, tab.slice(1));
  if (!fs.existsSync(dir)) {
    return [];
  }
  const entries = fs.readdirSync(dir).filter(f => ITEM_FILE.test(f)).map((f) => {
    const file = path.join(dir, f);
    const content = fs.readFileSync(file);
    const raw = content.toString("utf-8");
    try {
      const { item, body } = parseItemFile(tab, Number(f.slice(0, -3)), raw, path.relative(process.cwd(), file));
      return { item, body, file, oid: gitBlobOid(content) };
    } catch (e) {
      if (e instanceof ContentFormatError && e.message.includes("missing frontmatter")) {
        e.message += migrationHint(rebuildDir);
      }
      throw e;
    }
  });
  const order = new Map(sortIndex(entries.map(e => e.item)).map((item, i) => [item, i]));
  return entries.sort((a, b) => order.get(a.item)! - order.get(b.item)!);
}

/** 一个栏目的索引：存储字段 + 计算字段（encryptBlocks） */
export function readIndex<T extends HeaderTabUrl>(rebuildDir: string, tab: T): CommonItemByHeaderType<T>[] {
  return readContentEntries(rebuildDir, tab).map(e => toIndexItem(e.item, e.body));
}

/**
 * 生成全部栏目的索引文件和 oid 映射文件。内容不变时不重写文件，避免开发模式下的监听循环。
 * @returns 各栏目的索引
 */
export function generateIndex(rebuildDir: string): Record<HeaderTabUrl, CommonItem[]> {
  const jsonDir = path.join(rebuildDir, "json");
  fs.mkdirSync(jsonDir, { recursive: true });
  const write = (file: string, text: string) => {
    if (!fs.existsSync(file) || fs.readFileSync(file, "utf-8") !== text) {
      fs.writeFileSync(file, text);
    }
  };
  const result = {} as Record<HeaderTabUrl, CommonItem[]>;
  for (const tab of HeaderTabs) {
    const entries = readContentEntries(rebuildDir, tab);
    const list = entries.map(e => toIndexItem(e.item, e.body));
    write(path.join(jsonDir, path.basename(indexFilePath(tab))), JSON.stringify(list));
    // 键是条目文件名（如 1234.md），与 GitHub 目录查询返回的 name 相同
    const oids = Object.fromEntries(entries.map(e => [path.basename(e.file), e.oid]));
    write(path.join(jsonDir, path.basename(oidMapFilePath(tab))), JSON.stringify(oids));
    result[tab] = list;
  }
  return result;
}

/** 写入一个条目文件 */
export function writeContentEntry(file: string, tab: HeaderTabUrl, item: CommonItem, body: string) {
  fs.writeFileSync(file, serializeItemFile(tab, item, body));
}
