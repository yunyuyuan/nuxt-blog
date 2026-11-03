export default {
  /** -------------------------------------------------以下必须修改----------------------------------------------------- */

  githubName: "<your-github-account-name>", // 必须修改，github账户名

  /** -------------------------------------------------以下可选修改----------------------------------------------------- */

  title: "<your-blog-title>", // 网站标题
  nickName: "<your-nickname>", // 昵称
  domain: "https://<your-blog-domain>", // rss域名
  SEO_title: " - <your-blog-title>", // 搜索引擎显示的标题
  SEO_keywords: "<your-keywords>", // keywords meta header
  MSClarityId: "", // Microsoft的Clarity统计，https://clarity.microsoft.com/
  CloudflareAnalyze: "", // cloudflare的统计，https://developers.cloudflare.com/analytics/web-analytics
  CommentRepoId: "", // 评论系统，参考 https://github.com/yunyuyuan/nuxt-blog/wiki/2.3-%E8%AF%84%E8%AE%BA%E7%B3%BB%E7%BB%9F
  CommentDiscussionCategoryId: "", // 评论系统
  CommentRepo: "", // 评论所在的仓库，格式为 owner/name，留空时使用 githubName/githubRepo

  database: { // 参考 https://github.com/yunyuyuan/nuxt-blog/wiki/2.4-%E6%B5%8F%E8%A7%88%E9%87%8F%E7%BB%9F%E8%AE%A1
    initialVisitors: 1, // 如果设置成10000，那么发一篇文章立马就有10000个浏览量！
    visitFromOwner: false // 网站拥有者访问时，是否增加浏览量
  },
  algoliaSearch: { // 参考 https://github.com/yunyuyuan/nuxt-blog/wiki/2.5-%E5%85%A8%E7%AB%99%E6%90%9C%E7%B4%A2
    appId: "",
    searchKey: "",
    indexName: ""
  },
  themeColor: ["cyan", "sky", "teal", "emerald", "purple", "indigo", "fuchsia", "orange", "amber"], // 主题色，如果有多个颜色，则随机使用，参考 https://tailwindcss.com/docs/colors
  themeColorDark: "neutral", // 主题色(夜间模式)
  defaultLang: "zh", // default language, "zh" and "en" are supported currently
  about: [
    "Hello there",
    "Welcome to my new blog"
  ],

  /** -------------------------------------------------注意----------------------------------------------------- */

  githubRepo: "my-blog" // 必须与你的 GitHub 仓库名一致
};
