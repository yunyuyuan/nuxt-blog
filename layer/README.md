# @yunyuyuan/nuxt-blog

A blog framework as a [Nuxt layer](https://nuxt.com/docs/getting-started/layers): articles, records and knowledge items, an admin UI that commits to GitHub, encryption, comments, visitor counts, search, RSS and sitemap.

Repository and documentation: https://github.com/yunyuyuan/nuxt-blog

## Create a site

Open the template repository [yunyuyuan/nuxt-blog-starter](https://github.com/yunyuyuan/nuxt-blog-starter) and click "Use this template". You do not need a local environment for this. Then follow the README of the new repository.

Or create the site locally:

```bash
npx giget@latest gh:yunyuyuan/nuxt-blog-starter my-blog
cd my-blog
pnpm install
pnpm dev
```

The starter contains the files of your site only:

- `nuxt.config.ts` with `extends: ["@yunyuyuan/nuxt-blog"]`
- `config.ts`, the site configuration
- `public/rebuild/{articles,records,knowledges}/<id>.md`, the content: one file for each item, with the metadata in YAML frontmatter
- `gulpfile.js`, which loads the local scripts (`pnpm local:*`) of this package

## Requirements

- Node.js 22 or later
- Nuxt 4.4.7 or a later 4.x version
- pnpm: set `shamefully-hoist=true` (or `node-linker=hoisted`) in `.npmrc`. The build resolves dependencies of this package (for example shiki and katex) from the root of the site. npm installs packages flat by default.

## Your nuxt.config.ts

Put Vite options for the server build in `vite.$server`, not in `vite`. For example, if `vite.ssr` is set, Nuxt also clears `vite.optimizeDeps.include` of the client build. The dev server then does not pre-bundle the CommonJS dependencies of this package, and the browser fails to load them.

## Upgrade

Major versions can change the content format or the configuration. Read the [CHANGELOG](https://github.com/yunyuyuan/nuxt-blog/blob/master/CHANGELOG.md), then change the range of `@yunyuyuan/nuxt-blog` in `package.json` to the new major version, for example `"^10.0.0"`. Without a local environment, edit `package.json` on GitHub. If the repository has `pnpm-lock.yaml`, run this command locally instead, and commit `package.json` and `pnpm-lock.yaml`:

```bash
pnpm add @yunyuyuan/nuxt-blog@^<new major version>
```

## License

MIT
