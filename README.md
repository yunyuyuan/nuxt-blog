<p align="center">
<img width="200px" src="public/favicon.png" />
</p>
<h1 align="center">💎Nuxt-Blog</h1>

[![](https://img.shields.io/github/license/yunyuyuan/nuxt-blog)](/LICENSE) ![](https://img.shields.io/badge/vue-v3-%234FC08D?logo=vue.js) ![](https://img.shields.io/badge/nuxt-v4-%2300DC82?logo=nuxt.js) [![](https://img.shields.io/npm/v/@yunyuyuan/nuxt-blog?logo=npm)](https://www.npmjs.com/package/@yunyuyuan/nuxt-blog)

[English Readme](/README.en.md) | 中文说明

**🚀已通过[NitroJS](https://nitro.unjs.io/)多平台部署（NitroJS是Nuxt3的[官方引擎](https://nuxt.com/docs/guide/concepts/server-engine)）**

> Vercel:[https://blog.yunyuyuan.net](https://blog.yunyuyuan.net)
>
> Cloudflare Page:[https://blog-cfpage.yunyuyuan.net](https://blog-cfpage.yunyuyuan.net)
>
> Netlify:[https://blog-netlify.yunyuyuan.net](https://blog-netlify.yunyuyuan.net)
>
> Github Pages:[https://blog-ghpage.yunyuyuan.net](https://blog-ghpage.yunyuyuan.net)
>
> **🚀self hosted部署（参考[我的文章](https://blog.yunyuyuan.net/articles/8346)）**
> forgejo-runner:[https://blog-local-cf.yunyuyuan.net](https://blog-local-cf.yunyuyuan.net)，这里的`cf`意思是使用cloudflare做内网穿透

# 博客特性

- 💻 **5分钟完成搭建**。快速搭建，不用写一行代码。
- 🤝 **方便使用**。全能的后台管理界面，只需一个token，就可**在网页端更新配置，新增/修改/删除博客内容**，不用`notepad`，更不用`git push`。
- 🌐 **纯静态**。打包为纯静态网站，无需后端。
- 🔍 **SEO友好**。每个HTML页面都是已经渲染完毕的，搜索引擎可收录。
- 🔌 **扩展性**。提供多个可选扩展功能，例如集成Cloudflare R2图床，展示实时浏览量，评论系统，全站搜索。
- 🔒 **可加密**。可以对任意单篇**文章/记录/文化**加密，也可以对某些内容单独加密，只有输入密码才可查看。

# 教我搭建

## 详细搭建教程请参考 [wiki](https://github.com/yunyuyuan/nuxt-blog/wiki)

有两种搭建方式：

| 方式 | 适合 | 升级方法 |
| --- | --- | --- |
| starter 模板（推荐新用户使用） | 只修改配置和内容，不改框架代码 | 修改 `package.json` 中 `@yunyuyuan/nuxt-blog` 的主版本号 |
| fork 本仓库 | 需要修改框架代码 | 在 GitHub 上点击 "Sync fork" |

**starter 模板**：框架以 npm 包 `@yunyuyuan/nuxt-blog` 的形式安装，站点仓库中只有 `config.ts`、内容和部署配置。打开模板仓库 [yunyuyuan/nuxt-blog-starter](https://github.com/yunyuyuan/nuxt-blog-starter)，点击 "Use this template" 创建自己的仓库。这种方式不需要本地环境。详见 [starter/README.md](/starter/README.md)。

也可以在本地创建：

```bash
npx giget@latest gh:yunyuyuan/nuxt-blog-starter my-blog
```

**fork**：框架代码在 `layer/` 目录中，站点的文件在根目录中。如果只修改根目录的文件，同步上游时的冲突会少很多。

博客原理示例：

<center>
<img width="600px" src="docs/workflow.png"/>
</center>

# 待开发

#### 特性

- [x] 404页面
- [x] 在本地`npm run dev`下更新数据
- [x] 自动化测试
- [x] 纯静态网站生成(SSG)
- [ ] 插件系统
- [x] 支持serverless function上传图片
- [x] 数据库集成(浏览量统计)
- [x] algolia全站搜索
- [x] 博客图片备份与迁移
- [x] 密码修改(目前仅支持在本地使用npm脚本修改)

#### 外观

- [x] 夜间模式
- [x] 国际化
- [ ] 多种布局主题(缺少UI设计)
- [x] 自定义主题色

##### 低优先级特性

- [ ] 不同加密页面可使用不同的密码
- [ ] 让monaco editor支持额外的markdown语法高亮
- [x] 一键拉取上游github仓库更新
- [ ] IV for AES encryption
- [x] 块级加密
- [x] SSR, 用于自建([参考](https://blog.yunyuyuan.net/articles/8346))
- [x] 支持 cloudflare page,netlify 以及其他服务

# 项目结构

- `/layer` 框架代码，以 npm 包 `@yunyuyuan/nuxt-blog` 发布
  - `/app` Nuxt 应用：页面、组件、composables、插件和工具函数
  - `/server` 服务端接口（图片上传、浏览量统计等）
  - `/modules/blog.ts` 构建期逻辑：读取站点配置和内容，生成索引，注入全局常量
  - `/i18n` 国际化翻译文件
  - `/scripts` 本地脚本（`pnpm local:*`），由 Gulp 执行
  - `/vite-plugins` 开发模式下，把后台的提交写入本地文件
  - `/public/sticker` 所有表情图片
- `/starter` 新站点的模板，依赖 npm 包 `@yunyuyuan/nuxt-blog`。每次发布新版本后，发版脚本把它推送到模板仓库 [yunyuyuan/nuxt-blog-starter](https://github.com/yunyuyuan/nuxt-blog-starter)
- `/config.ts` 博客配置，必须修改
- `/public`
  - `/rebuild` 所有博客数据。`articles/`、`records/`、`knowledges/` 中每个条目一个 md 文件，元数据写在文件开头的 YAML frontmatter 中。`json/` 中的索引在构建时生成，不提交到仓库
  - `/e2e/rebuild` 用于 e2e 测试的假数据
- `/e2e` e2e 测试
- `/nuxt.config.ts` `extends: ["@yunyuyuan/nuxt-blog"]`，通过 pnpm workspace 使用本仓库的 `layer/`

# Node脚本

```json5
"scripts": {
  "build": "nuxt build", // 编译为ssr
  "dev": "nuxt dev", //开发
  "dev-for-test": "cross-env PORT=13000 VITESTING=\"true\" nuxt dev", //用于e2e测试
  "build-for-test": "cross-env VITESTING=\"true\" nuxt build", //用于e2e测试
  "prod-for-test": "cross-env PORT=13000 node .output/server/index.mjs", //用于e2e测试
  "generate": "nuxt generate", // 弃用了
  "local:change-pwd": "gulp change-passwd", // 全局修改密码
  "local:generate-file-map": "gulp generate-file-map", // 收集全站图片，输出到file-map.json
  "local:download-file": "gulp download-file", // 读取file-map.json，下载所有图片到files/
  "local:substitute-file": "gulp substitute-file", // 读取file-map.json，替换为新的图片（运行此脚本前，请先修改file-map.json里的newUrl为需要替换的url）
  "local:upload-algolia": "gulp upload-algolia", // 上传所有索引到algolia
  "local:migrate-content": "gulp migrate-content", // 把旧格式的内容（JSON索引 + md）转换为frontmatter格式
  "test:unit": "vitest run --exclude ./e2e", // unit测试
  "test:e2e": "vitest run --dir ./e2e", // e2e测试
  "test:dev-and-e2e": "start-server-and-test dev-for-test http://localhost:13000 test:e2e", // 运行测试dev并开始e2e测试
  "test:prod-and-e2e": "start-server-and-test prod-for-test http://localhost:13000 test:e2e", // 运行测试prod并开始e2e测试
  "eslint": "eslint --fix .", //执行eslint
  "typecheck": "nuxi typecheck", // 类型检查
  "preview": "nuxt preview", // 预览编译后的网站
  "prepare": "husky" // 安装husky
}
```

# 旧版本

v8 及更早的版本不再支持，也不提供升级步骤。

# 更新日志

[CHANGELOG.md](/CHANGELOG.md)

# 其他

- 技术解答/交流qq群：745105612
- 邮箱：me@yunyuyuan.net
- discord: https://discord.gg/HtSehSMYXa
