import { encode } from "js-base64";
import { itemFilePath } from "../../common/content-body";
import { invalidateHeadCache, setHeadReader, type HeadTreeEntry } from "../fetch";
import { formatTime } from "../format-time";
import { translate } from "../i18n";
import { notify } from "../notify";
import { getCurrentTab } from "../utils";
import { AuthorQuery, buildBlobsQuery, buildCommitInput, CreateCommitMutation, HeadTreeQuery, type AuthorQueryData, type BlobsData, type CreateCommitData, type HeadTreeData } from "./github-queries";
import { createDiffModal } from ".";
import config from "~~/config";
import type { CommitParams, CommonItem, CommitParamsAddition } from "#layers/nuxt-blog/app/utils/common/types";

type GraphQLResponse<T> = { data?: T; errors?: { type?: string; message: string }[] };

/** isAuthor 时 GitHub 返回的仓库名（owner/repo）。仓库改名后与 config.ts 不同，提交要用这个名字 */
let resolvedRepo = "";

async function post<T = unknown>(query: string, variables?: Record<string, unknown>, token_?: string): Promise<GraphQLResponse<T>> {
  const token = token_ || useGithubToken().value;
  if (!token) {
    throw new Error(translate("need-token"));
  }
  // 只在浏览器中运行；e2e 用 page.route 拦截这个地址
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) {
    // 401（token 无效）等错误：GitHub 返回 { message }
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`GitHub API ${res.status}: ${body.message || res.statusText}`);
  }
  return await res.json() as GraphQLResponse<T>;
}

/**
 * 读取仓库文件在 useRemoteLatestSha 这个提交时的原文（REST contents API，raw 格式）。
 * 后台的列表、正文和 diff 原文都由它读取，所以与下一次提交的 expectedHeadOid 一致。
 */
async function readRepoFile(token: string, repoPath: string): Promise<string> {
  const ref = useRemoteLatestSha().value || __NB_GIT_BRANCH__;
  const encodedPath = repoPath.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`https://api.github.com/repos/${config.githubName}/${__NB_GITHUB_REPO__}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`, {
    headers: {
      "Authorization": "Bearer " + token,
      "Accept": "application/vnd.github.raw+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!res.ok) {
    // 与读取静态文件时一样，非 2xx 抛错（例如 404：条目的 md 不存在）
    throw Object.assign(new Error(`GitHub API ${res.status}: ${repoPath}`), { status: res.status, statusCode: res.status });
  }
  return await res.text();
}

/**
 * 读取仓库目录在 useRemoteLatestSha 这个提交时的文件名和 oid（GraphQL 一次请求，不读文件内容）。
 */
async function readRepoTree(token: string, repoDir: string): Promise<HeadTreeEntry[]> {
  const ref = useRemoteLatestSha().value || __NB_GIT_BRANCH__;
  const result = await post<HeadTreeData>(HeadTreeQuery, {
    owner: config.githubName,
    name: __NB_GITHUB_REPO__,
    expression: `${ref}:${repoDir}`
  }, token);
  if (result.errors?.length) {
    throw new Error(result.errors.map(e => e.message).join("; "));
  }
  // 目录不存在时 object 为 null；路径是文件时没有 entries
  const entries = result.data?.repository?.object?.entries ?? [];
  return entries.filter(e => e.type === "blob").map(({ name, oid }) => ({ name, oid }));
}

/** 一次 GraphQL 请求最多读取的文件数 */
const BLOBS_PER_QUERY = 50;

/**
 * 按 oid 读取一个目录中这些文件的原文，每 BLOBS_PER_QUERY 个文件一次请求。
 * GitHub 会截断过大的文件内容，找不到 oid 时返回 null；这些文件改用 readRepoFile 单独读取。
 */
async function readRepoBlobs(token: string, repoDir: string, entries: HeadTreeEntry[]): Promise<string[]> {
  const parts: HeadTreeEntry[][] = [];
  for (let i = 0; i < entries.length; i += BLOBS_PER_QUERY) {
    parts.push(entries.slice(i, i + BLOBS_PER_QUERY));
  }
  const texts = await Promise.all(parts.map(async (part) => {
    const { query, variables } = buildBlobsQuery(part.map(e => e.oid));
    const result = await post<BlobsData>(query, { owner: config.githubName, name: __NB_GITHUB_REPO__, ...variables }, token);
    if (result.errors?.length) {
      throw new Error(result.errors.map(e => e.message).join("; "));
    }
    return Promise.all(part.map(async (e, i) => {
      const blob = result.data?.repository?.[`b${i}`];
      return blob && !blob.isTruncated && typeof blob.text === "string"
        ? blob.text
        : await readRepoFile(token, `${repoDir}/${e.name}`);
    }));
  }));
  return texts.flat();
}

/** @description 是否管理员 */
export async function isAuthor(token: string): Promise<boolean> {
  const result = await post<AuthorQueryData>(AuthorQuery, {
    owner: config.githubName,
    name: __NB_GITHUB_REPO__,
    branch: __NB_GIT_BRANCH__
  }, token);
  if (result.errors?.length) {
    // 仓库不存在，或者 token 不能访问这个仓库
    if (result.errors.some(e => e.type === "NOT_FOUND") && !result.data?.repository) {
      throw new Error(translate("repo-not-found", [`${config.githubName}/${__NB_GITHUB_REPO__}`]));
    }
    throw new Error(result.errors.map(e => e.message).join("; "));
  }
  // GitHub 用户名不区分大小写
  const verified = result.data?.viewer?.login?.toLowerCase() === config.githubName.toLowerCase();
  if (verified) {
    // token 验证成功
    useGithubToken().value = token;
    resolvedRepo = result.data?.repository?.nameWithOwner ?? "";
    // 更新 commit id
    const headOid = result.data?.repository?.ref?.target?.history?.nodes?.[0]?.oid ?? "";
    useRemoteLatestSha().value = headOid;
    // 此后后台从这个提交读取内容。若线上站点还没部署到这个提交，页面已经读过的是旧内容，重新挂载一次
    setHeadReader({
      file: path => readRepoFile(token, path),
      tree: dir => readRepoTree(token, dir),
      blobs: (dir, entries) => readRepoBlobs(token, dir, entries)
    });
    if (headOid && headOid !== __NB_CURRENT_GIT_SHA__) {
      reloadManagePage();
    }
  }
  return verified;
}

/**
 *
 * @param commit commit信息
 * @param additions 修改/增加内容
 * @param deletions 删除内容
 * @returns 是否执行成功，失败会自动notify
 */
export async function createCommit(
  commit = "",
  { additions, deletions }: CommitParams
): Promise<boolean> {
  const correctSha = useRemoteLatestSha().value;
  if (__NB_BUILDTIME_VITESTING__) {
    await post(JSON.stringify({ additions, deletions }));
    return true;
  }
  // 显示 diff 弹窗让用户确认更改
  if (!(await createDiffModal({ additions, deletions }))) {
    return false;
  }
  try {
    const result = await post<CreateCommitData>(CreateCommitMutation, {
      input: buildCommitInput({
        owner: config.githubName,
        repo: __NB_GITHUB_REPO__,
        nameWithOwner: resolvedRepo,
        branch: __NB_GIT_BRANCH__,
        headline: `[${formatTime()}]${commit}`,
        expectedHeadOid: correctSha,
        additions,
        deletions
      }, encode)
    });
    const err = result.errors;
    if (err?.length) {
      // expectedHeadOid 不是分支的最新提交：后台读取内容之后，仓库有了别的提交。不覆盖，提示刷新
      const conflict = /Expected branch to point to/i.test(err[0]!.message);
      notify({
        title: conflict ? translate("commit-conflict") : (err[0]!.type || "Error"),
        type: "error",
        description: err[0]!.message
      });
      return false;
    }
    // 不刷新页面：记录新提交，清除这些文件的缓存，重新挂载当前后台页面。下一次提交基于新提交
    const newOid = result.data?.createCommitOnBranch?.commit?.oid;
    if (newOid) {
      useRemoteLatestSha().value = newOid;
    }
    invalidateHeadCache([...(additions ?? []), ...(deletions ?? [])].map(file => file.path));
    notify({
      title: translate("update-success")
    });
    // 等调用方处理完成功后的逻辑（如清理暂存区）再重新挂载
    setTimeout(reloadManagePage);
    return true;
  } catch (e: any) {
    notify({
      title: "Error!",
      type: "error",
      description: e.toString()
    });
    throw e;
  }
}

/**
 * 把删除封装成函数，因为即有多项删除，也有单项删除
 * @param newList 新json，不需要cloneDeep
 * @param dels 删除的CommonItem[]
 * @returns 是否执行成功
 */
export function deleteList(
  dels: { item: CommonItem; md: string }[]
): Promise<boolean> {
  const commitInfo
    = dels.length === 1 ? `'${dels[0]!.item.id}'` : `${dels.length} items`;
  const folder = getCurrentTab();
  // 每个条目只有一个文件；索引在构建时生成
  return createCommit(
    `Delete ${commitInfo} from ${folder}`,
    {
      deletions: dels.map(item => ({
        path: itemFilePath(folder, item.item.id),
        content: item.md
      }))
    }
  );
}

/**
 * 批量提交暂存的项目
 * @param stagedItems 暂存的项目列表
 * @returns 是否执行成功
 */
export async function commitStagedItems(
  additions: CommitParamsAddition[]
): Promise<boolean> {
  if (additions.length === 0) {
    return true;
  }

  const commitMessage = `Batch update ${additions.length} items`;
  return createCommit(commitMessage, { additions });
}
