# My Blog

中文 | [English](#english)

这个站点基于 [nuxt-blog](https://github.com/yunyuyuan/nuxt-blog)。框架代码在 npm 包 `@yunyuyuan/nuxt-blog` 中，本仓库只放站点自己的文件。

## 创建站点

### 方式一：GitHub 模板（不需要本地环境）

1. 打开模板仓库 [yunyuyuan/nuxt-blog-starter](https://github.com/yunyuyuan/nuxt-blog-starter)，点击 "Use this template" → "Create a new repository"。
2. 在新仓库中编辑 `config.ts`。以下两项必须修改：`githubName` 改为你的 GitHub 用户名，`githubRepo` 改为新仓库的名字。后台用这两项读写你的仓库。
3. 部署，见下面的“部署”。

### 方式二：在本地创建

```bash
npx giget@latest gh:yunyuyuan/nuxt-blog-starter my-blog
cd my-blog
pnpm install
```

需要 Node.js 22 和 pnpm 9。然后修改 `config.ts`（同方式一的第 2 步），在 GitHub 上新建一个仓库，把本目录推送上去。

## 部署

环境变量见 `env.sample`，详细步骤见 [wiki](https://github.com/yunyuyuan/nuxt-blog/wiki)。

- **GitHub Pages**：在仓库的 Settings → Pages 中，把 Source 设为 "GitHub Actions"，然后在 Actions 页面重新运行 "Deploy Nuxt site to Pages"。创建仓库时，这个 workflow 可能已经运行过一次并失败，因为当时还没有开启 Pages。如果网址是 `https://<用户名>.github.io/<仓库名>/`，先把 `.github/workflows/pages.yml` 中的 `NUXT_APP_BASE_URL` 改为 `/<仓库名>/`。
- **Vercel、Cloudflare Pages、Netlify**：在平台上导入这个仓库。不用 GitHub Pages 时，可以删除 `.github/workflows/pages.yml`。
- **Docker**：使用仓库中的 `Dockerfile`。

## 文件

| 路径 | 内容 |
| --- | --- |
| `config.ts` | 站点配置 |
| `public/rebuild/articles/`、`records/`、`knowledges/` | 内容。每个条目一个 `<id>.md` 文件，元数据写在文件开头的 YAML frontmatter 中 |
| `public/` 中的其他文件 | 图标、`robots.txt` 等静态文件 |
| `nuxt.config.ts` | `extends: ["@yunyuyuan/nuxt-blog"]` |

`public/rebuild/json/` 中的索引在构建时生成，不提交到仓库。示例条目可以删除。

后台管理页面在 `/manage`。在后台提交内容时，每个条目只写一个 md 文件。

在本地安装时，不要删除 `.npmrc` 中的 `shamefully-hoist=true`：框架的依赖（例如 shiki、katex）在构建时从站点根目录解析。

在 `nuxt.config.ts` 中添加只用于服务端构建的 Vite 配置时，写在 `vite.$server` 中，不要直接写 `vite.ssr`。如果设置了 `vite.ssr`，Nuxt 会同时清空客户端的 `vite.optimizeDeps.include`，开发模式下浏览器会加载框架的依赖失败。

## 本地命令

这些命令需要本地环境，都是可选的。

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 开发服务器。在开发模式下，后台的提交直接写入本地文件 |
| `pnpm build` | 构建 |
| `pnpm local:change-pwd` | 修改加密内容的密码 |
| `pnpm local:generate-file-map`、`local:download-file`、`local:substitute-file` | 备份和替换内容中的图片 |
| `pnpm local:upload-algolia` | 上传搜索索引 |
| `pnpm local:migrate-content` | 把旧格式的内容（JSON 索引 + md）转换为 frontmatter 格式 |

## 升级

本仓库没有 lockfile 时，每次构建都会安装 `package.json` 中版本范围内的最新版本。所以框架的小版本和补丁版本会自动生效。`nuxt` 的范围是 `~`，只接受补丁版本，这是框架测试过的 Nuxt 版本。

后台检测到新的主版本时会显示升级提示。升级前先阅读 [CHANGELOG](https://github.com/yunyuyuan/nuxt-blog/blob/master/CHANGELOG.md)，然后：

- 仓库中没有 `pnpm-lock.yaml` 时：在 GitHub 上编辑 `package.json`，把 `"@yunyuyuan/nuxt-blog": "^9.0.0"` 中的主版本号改为新的版本，例如 `"^10.0.0"`，然后提交。
- 仓库中有 `pnpm-lock.yaml` 时：在本地运行 `pnpm add @yunyuyuan/nuxt-blog@^<新的主版本号>`，然后提交 `package.json` 和 `pnpm-lock.yaml`。

提交后，部署平台会重新构建。

---

## English

This site uses [nuxt-blog](https://github.com/yunyuyuan/nuxt-blog). The framework is the npm package `@yunyuyuan/nuxt-blog`. This repository contains only the files of your site.

### Create the site

#### Option 1: GitHub template (no local environment needed)

1. Open the template repository [yunyuyuan/nuxt-blog-starter](https://github.com/yunyuyuan/nuxt-blog-starter) and click "Use this template" → "Create a new repository".
2. Edit `config.ts` in the new repository. You must change two fields: set `githubName` to your GitHub user name, and `githubRepo` to the name of the new repository. The admin pages use them to read and write your repository.
3. Deploy the site, see "Deploy" below.

#### Option 2: create the site locally

```bash
npx giget@latest gh:yunyuyuan/nuxt-blog-starter my-blog
cd my-blog
pnpm install
```

You need Node.js 22 and pnpm 9. Then edit `config.ts` (as in step 2 of option 1), create a GitHub repository and push this directory to it.

### Deploy

See `env.sample` for the environment variables and the [wiki](https://github.com/yunyuyuan/nuxt-blog/wiki) for the steps.

- **GitHub Pages**: in Settings → Pages of the repository, set Source to "GitHub Actions". Then run "Deploy Nuxt site to Pages" again on the Actions page. The workflow can already have run once and failed when the repository was created, because Pages was not enabled then. If the address is `https://<user>.github.io/<repository>/`, first set `NUXT_APP_BASE_URL` in `.github/workflows/pages.yml` to `/<repository>/`.
- **Vercel, Cloudflare Pages, Netlify**: import this repository on the platform. If you do not use GitHub Pages, you can delete `.github/workflows/pages.yml`.
- **Docker**: use the `Dockerfile` in this repository.

### Files

| Path | Content |
| --- | --- |
| `config.ts` | Site configuration |
| `public/rebuild/articles/`, `records/`, `knowledges/` | Content. One `<id>.md` file for each item, with the metadata in YAML frontmatter at the start of the file |
| Other files in `public/` | Icons, `robots.txt` and other static files |
| `nuxt.config.ts` | `extends: ["@yunyuyuan/nuxt-blog"]` |

The build generates the indexes in `public/rebuild/json/`. Do not commit them. You can delete the sample items.

The admin pages are at `/manage`. A commit from the admin pages writes one md file for each item.

When you install locally, keep `shamefully-hoist=true` in `.npmrc`: the build resolves dependencies of the framework (for example shiki and katex) from the root of the site.

Put Vite options for the server build in `vite.$server` in `nuxt.config.ts`, not in `vite.ssr`. If `vite.ssr` is set, Nuxt also clears `vite.optimizeDeps.include` of the client build, and in development mode the browser fails to load dependencies of the framework.

### Local commands

These commands need a local environment. All of them are optional.

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Development server. In development mode, commits from the admin pages write to the local files |
| `pnpm build` | Build |
| `pnpm local:change-pwd` | Change the password of encrypted content |
| `pnpm local:generate-file-map`, `local:download-file`, `local:substitute-file` | Back up and replace the images in your content |
| `pnpm local:upload-algolia` | Upload the search index |
| `pnpm local:migrate-content` | Convert content in the old format (JSON index + md) to the frontmatter format |

### Upgrade

When this repository has no lockfile, each build installs the newest versions that the ranges in `package.json` allow. So minor and patch versions of the framework take effect automatically. The range of `nuxt` uses `~` and accepts only patch versions: this is the Nuxt version that the framework is tested with.

The admin pages show a message when a new major version is available. Read the [CHANGELOG](https://github.com/yunyuyuan/nuxt-blog/blob/master/CHANGELOG.md) first, then:

- If the repository has no `pnpm-lock.yaml`: edit `package.json` on GitHub. In `"@yunyuyuan/nuxt-blog": "^9.0.0"`, change the major version to the new one, for example `"^10.0.0"`, and commit.
- If the repository has `pnpm-lock.yaml`: run `pnpm add @yunyuyuan/nuxt-blog@^<new major version>` locally, then commit `package.json` and `pnpm-lock.yaml`.

After the commit, your platform rebuilds the site.
