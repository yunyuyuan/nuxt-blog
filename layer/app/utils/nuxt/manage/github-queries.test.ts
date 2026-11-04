import { describe, expect, it } from "vitest";
import { encode } from "js-base64";
import { AuthorQuery, buildBlobsQuery, buildCommitInput, CreateCommitMutation, HeadTreeQuery } from "./github-queries";

describe("github queries", () => {
  it("keep every dynamic value in variables", () => {
    // 查询文档是固定字符串，不包含插值
    for (const doc of [AuthorQuery, CreateCommitMutation, HeadTreeQuery]) {
      expect(doc).not.toContain("${");
      expect(doc).toMatch(/^(query|mutation) \(\$/);
    }
  });

  it("reads the directory without the file contents", () => {
    expect(HeadTreeQuery).toMatch(/entries \{\s+name\s+type\s+oid\s+\}/);
    expect(HeadTreeQuery).not.toContain("text");
  });

  it("reads the blobs by oid, one alias per oid, with the oids in variables", () => {
    const oids = ["a".repeat(40), "b".repeat(40)];
    const { query, variables } = buildBlobsQuery(oids);
    expect(query).toMatch(/^query \(\$owner: String!, \$name: String!, \$o0: GitObjectID!, \$o1: GitObjectID!\) \{/);
    expect(query).toContain("b0: object(oid: $o0)");
    expect(query).toContain("b1: object(oid: $o1)");
    // oid 只出现在 variables 中
    expect(query).not.toContain(oids[0]);
    expect(variables).toEqual({ o0: oids[0], o1: oids[1] });
    expect(query.split("{").length).toBe(query.split("}").length);
  });

  it("builds CreateCommitOnBranchInput", () => {
    const input = buildCommitInput({
      owner: "me",
      repo: "blog",
      branch: "master",
      headline: "[2026-10-22]Update \"quoted\" \\ title",
      expectedHeadOid: "abc",
      additions: [{ path: "public/rebuild/json/articles.json", content: "[{\"title\":\"中文\"}]" }],
      deletions: [{ path: "public/rebuild/articles/1.md" }]
    }, encode);
    expect(input).toEqual({
      branch: { branchName: "master", repositoryNameWithOwner: "me/blog" },
      // 引号和反斜杠原样保留，由 JSON 序列化负责转义
      message: { headline: "[2026-10-22]Update \"quoted\" \\ title" },
      expectedHeadOid: "abc",
      fileChanges: {
        additions: [{ path: "public/rebuild/json/articles.json", contents: encode("[{\"title\":\"中文\"}]") }],
        deletions: [{ path: "public/rebuild/articles/1.md" }]
      }
    });
  });

  it("omits empty file change lists", () => {
    const input = buildCommitInput({ owner: "o", repo: "r", branch: "b", headline: "h", expectedHeadOid: "x", additions: [], deletions: [] }, encode);
    expect(input.fileChanges).toEqual({});
  });

  it("commits to the name that GitHub resolved", () => {
    // config.ts 中还是旧仓库名；AuthorQuery 返回的是现在的名字
    const params = { owner: "me", repo: "old-name", branch: "b", headline: "h", expectedHeadOid: "x" };
    expect(buildCommitInput({ ...params, nameWithOwner: "me/new-name" }, encode).branch.repositoryNameWithOwner).toBe("me/new-name");
    expect(buildCommitInput({ ...params, nameWithOwner: "" }, encode).branch.repositoryNameWithOwner).toBe("me/old-name");
  });

  it("reads the current repository name in AuthorQuery", () => {
    expect(AuthorQuery).toMatch(/repository\(owner: \$owner, name: \$name\) \{\s+nameWithOwner/);
  });
});
