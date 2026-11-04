import { Marked } from "marked";
import markedFootnote from "marked-footnote";
import markedTokenPosition from "marked-token-position";
import { withBase } from "ufo";
import { ViewerAttr } from "../common/constants";
import { SHIKI_LIGHT_THEME, SHIKI_DARK_THEME } from "../common/shiki";
import { escapeHtml } from "../common/utils";

export const MarkedDataLineAttr = "data-marked-line";

/** 属性中的文本：转义引号和尖括号，避免标题或说明文字中的 " 截断属性 */
function attr(value: unknown): string {
  return escapeHtml(String(value ?? ""));
}

/** 属性中的 URL：与 marked 默认渲染器一致先 encodeURI，再转义 */
function attrUrl(href: unknown): string {
  const raw = String(href ?? "");
  try {
    return attr(encodeURI(raw).replace(/%25/g, "%"));
  } catch {
    return attr(raw);
  }
}

function dataLine(token: any): string {
  const line = token?.position?.start?.line;
  return line != null ? ` ${MarkedDataLineAttr}="${line + 1}"` : "";
}

/**
 * @param options.prerender 在服务端渲染公式（katex）和代码高亮（shiki）。只在预渲染时传 true：
 * 这两个库体积大，只在服务端加载。本文件也被 Node 脚本（RSS）使用，所以不直接依赖 Nuxt 的标志
 */
export async function parseMarkdown(text: string, baseURL: string = "/", options: { prerender?: boolean } = {}) {
  const isPrerender = options.prerender ?? false;
  const katex = isPrerender ? (await import("katex")).default : null;

  let shikiHighlighter: Awaited<ReturnType<typeof import("shiki")["getSingletonHighlighter"]>> | null = null;
  if (isPrerender) {
    const { getSingletonHighlighter } = await import("shiki");
    shikiHighlighter = await getSingletonHighlighter({
      themes: [SHIKI_LIGHT_THEME, SHIKI_DARK_THEME],
      langs: []
    });
    // Pre-load all languages found in fenced code blocks
    const langMatches = text.matchAll(/^```(\w+)/gm);
    const langs = new Set<string>();
    for (const match of langMatches) {
      const lang = match[1]!.toLowerCase();
      if (lang !== "mermaid") langs.add(lang);
    }
    for (const lang of langs) {
      const loaded = shikiHighlighter.getLoadedLanguages();
      if (!loaded.includes(lang as never)) {
        try {
          await shikiHighlighter.loadLanguage(lang as never);
        } catch {
          // Language not bundled, will fall back to plain text
        }
      }
    }
  }
  const menuItems: { size: "big" | "small"; text: string; url: string }[] = [];
  const instance = new Marked();
  instance.use({
    gfm: true,
    renderer: {
      heading(token) {
        const { depth, tokens } = token;
        const text = this.parser.parseInline(tokens);
        const url = escapeHtml(encodeURI(text), true);

        menuItems.push({
          size: depth < 3 ? "big" : "small",
          text,
          url
        });
        return `<h${depth}${dataLine(token)}><sup class="fake-head" id="${url}"></sup><a class="header-link" href="#${url}">${text}</a></h${depth}>`;
      },
      image({ href, text }) {
        // 预渲染的 HTML 中图片都加 loading="lazy"：水合后正文图片才换成懒加载组件，
        // 在这之前浏览器会下载页面中所有的 <img>，包括首屏以外的
        // sticker
        if (text === "sticker") {
          const matcher = href?.match(/^(.*?)\/(\d*)$/);
          if (matcher) {
            const [, name, tone] = matcher;
            return `<img loading="lazy" src="${attrUrl(withBase(`/sticker/${name}/${tone}.png`, baseURL))}" alt="${attr(text)}"/>`;
          }
        }
        const matcher = text?.match(/^(.*?)\[(.*?) x (.*?)]$/);
        if (!matcher) {
          return `<span class="image-container"><img ${ViewerAttr} loading="lazy" alt="${attr(text)}" title="${attr(text)}" src="${attrUrl(href)}"/><small class="desc">${instance.parseInline(text)}</small></span>`;
        }
        // with dimension
        const [, alt_, w, h] = matcher;
        const justHeight = !w;
        return `<span class="image-container${
          justHeight ? " just-height" : ""
        }"><img ${ViewerAttr} loading="lazy" alt="${attr(alt_)}" title="${attr(alt_)}" style="${
          w ? `width: ${attr(w)} !important;` : ""
        }${
          h ? `height: ${attr(h)} !important;` : ""
        }" src="${attrUrl(href)}"/><small class="desc">${instance.parseInline(alt_ || "")}</small></span>`;
      },
      code(token) {
        let { text } = token;
        const { lang, escaped } = token;
        if (lang === "mermaid") {
          return `<pre${dataLine(token)} class="mermaid-block">${escaped ? text : escapeHtml(text)}</pre>`;
        }
        if (shikiHighlighter) {
          const resolvedLang = lang && shikiHighlighter.getLoadedLanguages().includes(lang as never) ? lang : "text";
          const html = shikiHighlighter.codeToHtml(text, {
            lang: resolvedLang,
            themes: { light: SHIKI_LIGHT_THEME, dark: SHIKI_DARK_THEME }
          });
          const match = html.match(/<code>([\s\S]*)<\/code>/);
          text = match ? match[1]! : escapeHtml(text);
        } else {
          // hydration: escape first, will be highlighted in afterInsertHtml
          text = escaped ? text : escapeHtml(text);
        }
        return `<pre${dataLine(token)} data-lang="${attr(lang)}"${shikiHighlighter ? " data-shiki" : ""}><code class="language-${attr(lang)}">${text}</code></pre>`;
      },
      paragraph(token) {
        return `<p${dataLine(token)}>${this.parser.parseInline(token.tokens)}</p>\n`;
      },
      blockquote(token) {
        return `<blockquote${dataLine(token)}>\n${this.parser.parse(token.tokens)}</blockquote>\n`;
      },
      list(token) {
        const tag = token.ordered ? "ol" : "ul";
        const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : "";
        let body = "";
        for (const item of token.items) {
          body += this.listitem(item);
        }
        return `<${tag}${startAttr}${dataLine(token)}>\n${body}</${tag}>\n`;
      },
      hr(token) {
        return `<hr${dataLine(token)} />\n`;
      }
    },
    extensions: [
      // inline level
      {
        name: "indent-two",
        level: "inline",
        start(src: string) { return src.match(/<<>>/)?.index; },
        tokenizer(src: string) {
          const match = /^(<<>>)/.exec(src);
          if (match) {
            return {
              type: "indent-two",
              raw: match[0]
            };
          }
        },
        renderer() {
          return "&emsp;&emsp;";
        }
      },
      {
        name: "target-blank",
        level: "inline",
        start(src: string) { return src.match(/#\[/)?.index; },
        tokenizer(src: string) {
          const match = /^#\[([^\]]+)\]\(([^)]+)\)/.exec(src);
          if (match) {
            return {
              type: "target-blank",
              raw: match[0],
              text: this.lexer.inlineTokens(match[1] || ""),
              href: match[2]
            };
          }
        },
        renderer({ text, href }) {
          return `<a href="${attrUrl(href)}" target="_blank">${this.parser.parseInline(text)}</a>`;
        }
      },
      {
        name: "color-text",
        level: "inline",
        start(src: string) { return src.match(/-\(/)?.index; },
        tokenizer(src: string) {
          const match = /^-\(([#a-zA-Z0-9]+): (.+?)\)-/.exec(src);
          if (match) {
            return {
              type: "color-text",
              raw: match[0],
              color: match[1],
              text: this.lexer.inlineTokens(match[2] || "")
            };
          }
        },
        renderer({ color, text }) {
          return `<span style="color: ${color}">${this.parser.parseInline(text)}</span>`;
        }
      },
      {
        name: "underline-text",
        level: "inline",
        start(src: string) { return src.match(/_\(/)?.index; },
        tokenizer(src: string) {
          const match = /^_\((.+?)\)_/.exec(src);
          if (match) {
            return {
              type: "underline-text",
              raw: match[0],
              text: this.lexer.inlineTokens(match[1] || "")
            };
          }
        },
        renderer({ text }) {
          return `<span style="text-decoration: underline">${this.parser.parseInline(text)}</span>`;
        }
      },
      {
        name: "embed-youtube",
        level: "inline",
        start(src: string) { return src.match(/\[youtube]/)?.index; },
        tokenizer(src: string) {
          const match = /^\[youtube]\[(.+?)]\((https?:\/\/.*?)\)\[\/youtube]/.exec(src);
          if (match) {
            return {
              type: "embed-youtube",
              raw: match[0],
              title: match[1],
              text: this.lexer.inlineTokens(match[1] || ""),
              href: match[2]
            };
          }
        },
        renderer({ text, title, href }) {
          text = this.parser.parseInline(text);
          return `<div class="embed-media youtube">
                      <iframe loading="lazy" src="${attrUrl(href)}" title="${attr(title)}" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                      <small class="desc">${text}</small>
                  </div>`;
        }
      },
      {
        name: "embed-bili",
        level: "inline",
        start(src: string) { return src.match(/\[bili]/)?.index; },
        tokenizer(src: string) {
          const match = /^\[bili]\[(.+?)]\((https?:\/\/.*?)\)\[\/bili]/.exec(src);
          if (match) {
            return {
              type: "embed-bili",
              raw: match[0],
              title: match[1],
              text: this.lexer.inlineTokens(match[1] || ""),
              href: match[2]
            };
          }
        },
        renderer({ text, title, href }) {
          text = this.parser.parseInline(text);
          return `<div class="embed-media bili">
                      <iframe loading="lazy" src="${attrUrl(`${href}&autoplay=0`)}" title="${attr(title)}" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                      <small class="desc">${text}</small>
                  </div>`;
        }
      },
      {
        name: "embed-media",
        level: "inline",
        start(src: string) { return src.match(/\[video]/)?.index; },
        tokenizer(src: string) {
          const match = /^\[video]\[(.+?)]\((?:(https?:\/\/.+?)\|)?(https?:\/\/.+?)\)\[\/video]/.exec(src);
          if (match) {
            return {
              type: "embed-media",
              raw: match[0],
              text: this.lexer.inlineTokens(match[1] || ""),
              poster: match[2],
              href: match[3]
            };
          }
        },
        renderer({ text, poster, href }) {
          text = this.parser.parseInline(text);
          return `<div class="embed-media vanilla-video">
                      <video src="${attrUrl(href)}" preload="metadata" controls${poster ? ` poster="${attrUrl(poster)}"` : ""}></video>
                      <small class="desc">${text}</small>
                  </div>`;
        }
      },
      {
        name: "embed-audio",
        level: "inline",
        start(src: string) { return src.match(/\[audio]/)?.index; },
        tokenizer(src: string) {
          const match = /^\[audio]\[(.+?)]\((https?:\/\/.+?)\)\[\/audio]/.exec(src);
          if (match) {
            return {
              type: "embed-audio",
              raw: match[0],
              text: this.lexer.inlineTokens(match[1] || ""),
              href: match[2]
            };
          }
        },
        renderer({ text, href }) {
          text = this.parser.parseInline(text);
          return `<div class="embed-media vanilla-audio">
                      <audio src="${attrUrl(href)}" preload="metadata" controls></audio>
                      <small class="desc">${text}</small>
                  </div>`;
        }
      },
      {
        name: "math-formula-inline",
        level: "inline",
        start(src: string) { return src.match(/\$\$/)?.index; },
        tokenizer(src: string) {
          const match = /^\$\$([\s\S]+?)\$\$/.exec(src);
          if (match) {
            return {
              type: "math-formula-inline",
              raw: match[0],
              content: match[1]
            };
          }
        },
        renderer({ content }) {
          return `<span class="math-formula inline ${isPrerender ? "parsed" : ""}">${isPrerender ? katex!.renderToString(content, { strict: "ignore" }) : content}</span>`;
        }
      },
      {
        name: "text-with-mask",
        level: "inline",
        start(src: string) { return src.match(/\[!/)?.index; },
        tokenizer(src: string) {
          const match = /^\[!([\s\S]+?)!\]/.exec(src);
          if (match) {
            return {
              type: "text-with-mask",
              raw: match[0],
              text: this.lexer.inlineTokens(match[1] || "")
            };
          }
        },
        renderer({ text }) {
          return `<span class="text-with-mask">${this.parser.parseInline(text)}</span>`;
        }
      },
      // block level
      {
        name: "math-formula-block",
        level: "block",
        start(src: string) { return src.match(/\$\$\n/)?.index; },
        tokenizer(src: string) {
          const match = /^\$\$\n([\s\S]+?)\n\$\$/.exec(src);
          if (match) {
            return {
              type: "math-formula-block",
              raw: match[0],
              content: match[1]
            };
          }
        },
        renderer(token) {
          return `<div${dataLine(token)} class="math-formula block ${isPrerender ? "parsed" : ""}"><div>${isPrerender ? katex!.renderToString(token.content, { strict: "ignore" }) : token.content}</div></div>`;
        }
      },
      {
        name: "raw-html",
        level: "block",
        start(src: string) { return src.match(/\[html]/)?.index; },
        tokenizer(src: string) {
          const match = /^\[html]([\s\S]*?)\[\/html]/.exec(src);
          if (match) {
            return {
              type: "raw-html",
              raw: match[0],
              text: this.lexer.blockTokens(match[1] || "", [])
            };
          }
        },
        renderer(token) {
          return `<span${dataLine(token)} class="raw-html">${this.parser.parse(token.text)}</span>`;
        }
      },
      {
        name: "fieldset-block",
        level: "block",
        start(src: string) { return src.match(/--.*?--\n/)?.index; },
        tokenizer(src: string) {
          const match = /^--(.*?)--\n([\s\S]+?)\n-- --/.exec(src);
          if (match) {
            return {
              type: "fieldset-block",
              raw: match[0],
              legend: this.lexer.inlineTokens(match[1] || ""),
              content: this.lexer.blockTokens(match[2] || "", [])
            };
          }
        },
        renderer(token) {
          return `<fieldset${dataLine(token)}><legend>${this.parser.parseInline(token.legend)}</legend>${this.parser.parse(token.content)}</fieldset>`;
        }
      },
      {
        name: "encrypt-block",
        level: "block",
        start(src: string) { return src.match(/\[encrypt]\n/)?.index; },
        tokenizer(src: string) {
          const match = /^\[encrypt]\n([\s\S]+?)\n\[\/encrypt]/.exec(src);
          if (match) {
            return {
              type: "encrypt-block",
              raw: match[0],
              text: this.lexer.blockTokens(match[1] || "", [])
            };
          }
        },
        renderer(token) {
          return `<div${dataLine(token)} class="encrypt-block">${this.parser.parse(token.text)}</div>`;
        }
      },
      {
        name: "container-block",
        level: "block",
        start(src: string) { return src.match(/:::/)?.index; },
        tokenizer(src: string) {
          const match = /^^:::\s+(info|tip|warning|danger|details)(?:([ \t\r\f\v]+.+)\n|\s*?\n)([\s\S]+?)\n:::/.exec(src);
          if (match) {
            return {
              type: "container-block",
              raw: match[0],
              cType: match[1],
              title: this.lexer.inlineTokens(match[2]?.trim() || ""),
              content: this.lexer.blockTokens(match[3] || "", [])
            };
          }
        },
        renderer(token) {
          let title = this.parser.parseInline(token.title);
          title = title || token.cType.toUpperCase();

          if (token.cType === "details") {
            return `<details${dataLine(token)} class="container-block ${token.cType}">
                      <summary class="container-title">${title}</summary>
                      ${this.parser.parse(token.content)}
                    </details>`;
          }
          return `<div${dataLine(token)} class="container-block ${token.cType}">
                    <p class="container-title">${title}</p>
                    ${this.parser.parse(token.content)}
                  </div>`;
        }
      }
    ]
  });
  instance.use(markedFootnote({ refMarkers: true }));
  instance.use(markedTokenPosition());
  const md = await instance.parse(text);
  return {
    menu: menuItems,
    md
  };
}
