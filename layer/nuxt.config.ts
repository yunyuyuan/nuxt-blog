import { hash as cryptoHash } from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import postcssNesting from "postcss-nesting";
import { clientDeps } from "./client-deps";
import { ThemeModeKey } from "./app/utils/common/constants";
import { HeaderTabs } from "./app/utils/common/types";

/** layer 目录下的绝对路径。layer 的配置里不能用 "~/"，它指向站点项目的 app 目录 */
const resolveLayer = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/**
 * tailwindcss/nesting 插件文件的绝对路径，作为 postcss 插件名。
 * Nuxt 4.6 起按 ESM 规则解析插件名。tailwindcss 3 没有 exports 字段，"tailwindcss/nesting"
 * 是一个目录，ESM 不能导入目录，插件会被跳过（警告 NUXT_B7027），嵌套的 CSS 就不会展开。
 * 文件路径在旧的（jiti）和新的解析方式下都能加载，而且从 layer 解析，不依赖站点的安装方式。
 */
const tailwindNesting = createRequire(import.meta.url).resolve("tailwindcss/nesting");

/**
 * 服务端不打包的大依赖。vite 的 SSR 构建默认按“能否从站点根目录解析到”决定是否 external，
 * 结果和包管理器的提升方式有关：用 pnpm 安装本 layer 时，它们从站点根目录解析不到，会被打包，
 * 而 nitro 打包 shiki 的全部语法要 3 GB 以上内存。所以 vite 和 nitro 都固定为 external
 */
const serverExternals = ["monaco-editor", "shiki", "mermaid", "katex"];

/**
 * nuxt-blog 的框架层（Nuxt layer）。站点项目在 nuxt.config.ts 中 extends 本包，
 * 并在根目录提供 config.ts 和 public/rebuild/ 中的内容。
 * 依赖站点配置的部分（head、主题色、全局常量、预渲染路由）在 modules/blog.ts 中。
 */
export default defineNuxtConfig({
  modules: [
    resolveLayer("./modules/blog"),
    "@nuxtjs/tailwindcss"
  ],
  // #layers/nuxt-blog 别名的名字。layer 内的代码都通过这个别名互相导入
  $meta: { name: "nuxt-blog" },
  imports: {
    presets: [
      {
        from: "tailwind-merge",
        imports: ["twMerge"]
      }
    ]
  },

  app: {
    pageTransition: { name: "page", mode: "out-in" },
    head: {
      meta: [
        { charset: "utf-8" }
      ],
      script: [
        // dark mode
        { innerHTML: `(function(){const e=localStorage.getItem("${ThemeModeKey}")||"light";document.documentElement.classList.add(e)})();` }
      ]
    }
  },
  // katex.min.css 随 useMarkdownParser、viewer.css 随 utils/nuxt/viewer.ts 进入详情页和编辑器的 chunk
  css: [resolveLayer("./app/assets/style/main.css")],

  // 由 modules/blog.ts 在构建时填充；这里的初始值用于类型推导
  runtimeConfig: {
    // 仅服务端可见
    nbItemIds: {} as Record<string, number[]>,
    public: {
      stickers: {} as Record<string, number>
    }
  },

  features: {
    inlineStyles: false
  },

  experimental: {
    defaults: {
      // NuxtLink 默认在链接进入视口时预取页面代码和 _payload.json。顶栏的链接在每个页面都可见，
      // 首次访问会下载所有栏目的 payload（/knowledges 的约 70KB gzip）。
      // 改为鼠标悬停或获得焦点时预取：跳转前仍然提前加载，但不会下载访客不打开的页面
      nuxtLink: { prefetchOn: { visibility: false, interaction: true } }
    }
  },

  compatibilityDate: "2025-02-15",

  nitro: {
    prerender: {
      crawlLinks: true,
      // 默认不因单个页面出错（如文章里的失效站内链接）而中断博客部署；
      // 本仓库的 CI 设置 NB_PRERENDER_STRICT=true，让模板本身的预渲染错误暴露出来
      failOnError: process.env.NB_PRERENDER_STRICT === "true",
      // /404.html 会被 Nuxt 渲染成 SPA 外壳。GitHub Pages 等静态托管对未知路径返回它，
      // 从而可以直接打开或刷新 /manage/** 等未预渲染的页面
      // 内容页面的路由由 modules/blog.ts 追加
      routes: ["/404.html"],
      ignore: ["/manage"]
    },
    cloudflare: {
      pages: {
        routes: {
          exclude: HeaderTabs.map(tab => `${tab}/*`)
        }
      }
    },
    rollupConfig: {
      external: serverExternals
    }
  },

  vite: {
    // 开发模式的写入插件和 define（__NB_*__ 常量）由 modules/blog.ts 注册
    optimizeDeps: {
      // 本 layer 从 npm 安装时，Vite 不扫描 node_modules 中的源文件，要显式列出，见 client-deps.ts
      include: clientDeps,
      exclude: ["monaco-editor"]
    },
    // 只写在服务端配置中，不用顶层的 ssr 字段。Nuxt 的 nuxt:environments 插件看到顶层配置有 ssr 字段时，
    // 会清空 optimizeDeps.include（它据此判断是服务端实例）；写在共享配置中，客户端的 include 也会被清空。
    // resolve.external 是环境级别的写法，Vite 把顶层的 ssr.external 也合并到 ssr 环境的 resolve.external
    $server: {
      resolve: {
        // 只 external shiki 而打包它的子包 @shikijs/*（或反过来）时，rollup 会为 shiki/wasm
        // 生成非法代码 _mergeNamespaces({ default: default })。external 会连同传递依赖一起 external
        external: serverExternals
      }
    },
    css: {
      modules: {
        generateScopedName: (name, css) => {
          if (name === "dark") return "dark";
          const hash = cryptoHash("sha1", css).substring(0, 5);

          return `_${name}_${hash}`;
        }
      }
    }
  },

  postcss: {
    plugins: {
      "postcss-import": {},
      // 传入插件本身而不是包名：传包名时 tailwindcss 会从它自己的安装目录 require，
      // 而 postcss-nesting 是本 layer 的依赖，pnpm 不一定把它放在 tailwindcss 能找到的位置
      [tailwindNesting]: postcssNesting,
      "tailwindcss": {},
      "autoprefixer": {}
    }
  },

  hooks: {
    // vue-bundle-renderer 把页面所用模块的全部动态导入写成 <link rel="prefetch">，
    // 包括后台的布局、编辑器和 monaco（gzip 后约 900KB），每个首次访问的访客都会下载。
    // 关闭 manifest 的 prefetch；跳转所需的代码由上面的 NuxtLink 预取负责
    "build:manifest": (manifest) => {
      for (const chunk of Object.values(manifest)) {
        chunk.prefetch = false;
      }
    }
  },

  tailwindcss: {
    exposeConfig: true,
    // @nuxtjs/tailwindcss 生成的 .nuxt/tailwind/postcss.mjs 按包名导入 @nuxtjs/tailwindcss，
    // 从站点目录解析。所以站点要平铺安装依赖（pnpm 用 shamefully-hoist 或 node-linker=hoisted）
    cssPath: resolveLayer("./app/assets/style/tailwind.css")
  }
});
