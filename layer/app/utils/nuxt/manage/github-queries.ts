// GitHub GraphQL 文档与变量构建。这个文件不依赖 Nuxt，方便单独测试和用 GitHub schema 校验。
// 所有动态值都通过 variables 传入，不拼接进查询字符串：标题里的引号、反斜杠不会破坏查询。

/**
 * 验证 token 属于博客作者，并读取分支最新的 commit oid。
 * nameWithOwner 是仓库现在的名字：仓库改名后，查询仍能用旧名找到仓库，但 createCommitOnBranch 只认现在的名字。
 */
export const AuthorQuery = `query ($owner: String!, $name: String!, $branch: String!) {
  viewer {
    login
  }
  repository(owner: $owner, name: $name) {
    nameWithOwner
    ref(qualifiedName: $branch) {
      target {
        ... on Commit {
          history(first: 1) {
            nodes {
              oid
            }
          }
        }
      }
    }
  }
}`;

export type AuthorQueryData = {
  viewer?: { login?: string };
  repository?: { nameWithOwner?: string; ref?: { target?: { history?: { nodes?: { oid: string }[] } } } } | null;
};

/**
 * 读取某个提交中一个目录的文件名和 git blob oid，不读文件内容（后台的条目列表）。
 * expression 形如 "<commit oid>:public/rebuild/articles"。
 */
export const HeadTreeQuery = `query ($owner: String!, $name: String!, $expression: String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) {
      ... on Tree {
        entries {
          name
          type
          oid
        }
      }
    }
  }
}`;
export type HeadTreeData = {
  // 目录不存在时 object 为 null
  repository?: { object?: { entries?: { name: string; type: string; oid: string }[] } | null } | null;
};

/**
 * 按 git blob oid 一次读取多个文件的原文。别名 b0、b1… 与 oids 的顺序对应。
 * 查询文档中只有生成的变量名，oid 通过 variables 传入。
 * 仓库中没有这个 oid 时，对应的别名为 null；文件过大时 text 被截断（isTruncated）。这两种情况调用方要单独读取。
 */
export function buildBlobsQuery(oids: string[]) {
  const declarations = oids.map((_, i) => `$o${i}: GitObjectID!`).join(", ");
  const fields = oids.map((_, i) => `    b${i}: object(oid: $o${i}) {
      ... on Blob {
        text
        isTruncated
      }
    }`).join("\n");
  return {
    query: `query ($owner: String!, $name: String!, ${declarations}) {
  repository(owner: $owner, name: $name) {
${fields}
  }
}`,
    variables: Object.fromEntries(oids.map((oid, i) => [`o${i}`, oid])) as Record<string, string>
  };
}
export type BlobsData = {
  repository?: Record<string, { text?: string | null; isTruncated?: boolean } | null> | null;
};

export const CreateCommitMutation = `mutation ($input: CreateCommitOnBranchInput!) {
  createCommitOnBranch(input: $input) {
    commit {
      oid
    }
  }
}`;

export type CreateCommitData = {
  createCommitOnBranch?: { commit?: { oid: string } };
};

export type CommitInputParams = {
  owner: string;
  repo: string;
  /** AuthorQuery 返回的仓库名（owner/repo）。有值时代替 owner/repo */
  nameWithOwner?: string;
  branch: string;
  headline: string;
  expectedHeadOid: string;
  additions?: { path: string; content: string }[];
  deletions?: { path: string }[];
};

/** 生成 CreateCommitOnBranchInput；encode 把文件内容转成 base64（UTF-8） */
export function buildCommitInput(p: CommitInputParams, encode: (_: string) => string) {
  const fileChanges: {
    additions?: { path: string; contents: string }[];
    deletions?: { path: string }[];
  } = {};
  if (p.additions?.length) {
    fileChanges.additions = p.additions.map(item => ({ path: item.path, contents: encode(item.content) }));
  }
  if (p.deletions?.length) {
    fileChanges.deletions = p.deletions.map(item => ({ path: item.path }));
  }
  return {
    branch: {
      branchName: p.branch,
      repositoryNameWithOwner: p.nameWithOwner || `${p.owner}/${p.repo}`
    },
    message: {
      headline: p.headline
    },
    expectedHeadOid: p.expectedHeadOid,
    fileChanges
  };
}
