/**
 * 站点配置的结构。站点配置是站点项目根目录下的 config.ts，
 * 前端代码通过 "~~/config" 导入它，构建期代码通过 loadBlogConfig() 读取它。
 */
export interface BlogConfig {
  /** GitHub 账户名 */
  githubName: string;
  /** 网站标题 */
  title: string;
  nickName: string;
  /** 站点域名，用于 rss.xml 和 sitemap.xml */
  domain: string;
  SEO_title: string;
  SEO_keywords: string;
  MSClarityId: string;
  CloudflareAnalyze: string;
  CommentRepoId: string;
  CommentDiscussionCategoryId: string;
  /**
   * 评论（giscus）所在的仓库，格式为 owner/name。留空时使用 githubName/githubRepo。
   * 只有评论不在博客仓库中时才需要设置，例如从模板新建仓库后，评论仍在旧仓库的 Discussions 中。
   * 它要和 CommentRepoId 指向同一个仓库。
   */
  CommentRepo?: string;
  database: {
    initialVisitors: number;
    visitFromOwner: boolean;
  };
  algoliaSearch: {
    appId: string;
    searchKey: string;
    indexName: string;
  };
  /** tailwind 颜色名；有多个时随机使用 */
  themeColor: string[];
  /** 夜间模式的 tailwind 颜色名 */
  themeColorDark: string;
  defaultLang: string;
  about: string[];
  /** 仓库名 */
  githubRepo: string;
}

/** owner/name 格式 */
export const REPO_FULL_NAME = /^[\w.-]+\/[\w.-]+$/;

/** giscus 的 data-repo：CommentRepo，留空时是 githubName/githubRepo */
export function commentRepo(config: Pick<BlogConfig, "githubName" | "githubRepo" | "CommentRepo">): string {
  return config.CommentRepo?.trim() || `${config.githubName}/${config.githubRepo}`;
}
