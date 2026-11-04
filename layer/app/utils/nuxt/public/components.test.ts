import { createSSRApp, h, nextTick, ref } from "vue";
import { renderToString } from "vue/server-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownHtml } from "./components";

const HTML = "<p>first</p><div class=\"embed-media youtube\"><iframe src=\"about:blank\"></iframe></div>";
const innerHTML = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")!;

describe("MarkdownHtml", () => {
  afterEach(() => {
    Object.defineProperty(Element.prototype, "innerHTML", innerHTML);
  });

  it("keeps the server-rendered children when hydrating, and updates when html changes", async () => {
    const html = ref(HTML);
    const element = ref<HTMLElement>();
    const instance = ref<{ $: { subTree: { dynamicProps: string[] | null } } }>();
    const App = () => h(MarkdownHtml, {
      tag: "article",
      html: html.value,
      class: "--markdown",
      ref: (target: unknown) => {
        instance.value = target as typeof instance.value;
        element.value = (target as { $el?: HTMLElement } | null)?.$el;
      }
    });

    const serverHtml = await renderToString(createSSRApp(App));
    expect(serverHtml).toBe(`<article class="--markdown">${HTML}</article>`);

    const container = document.createElement("div");
    container.innerHTML = serverHtml;
    document.body.appendChild(container);
    const iframe = container.querySelector("iframe");

    // 记录水合期间对正文 innerHTML 的赋值
    const writes: string[] = [];
    Object.defineProperty(Element.prototype, "innerHTML", {
      ...innerHTML,
      set (value: string) {
        if (this.tagName === "ARTICLE") writes.push(value);
        innerHTML.set!.call(this, value);
      }
    });
    createSSRApp(App).mount(container);

    // Vue 3.5.39 起，水合会重新设置 dynamicProps 中的 prop；模板中的 v-html 会生成 ["innerHTML"]。
    // 根仓库锁定的 Vue 早于 3.5.39，只检查结果区分不出来，所以同时检查原因
    expect(instance.value!.$.subTree.dynamicProps).toBeNull();
    expect(writes).toEqual([]);
    expect(container.querySelector("iframe")).toBe(iframe);
    expect(element.value).toBe(container.firstElementChild);

    html.value = "<p>second</p>";
    await nextTick();
    expect(writes).toEqual(["<p>second</p>"]);
    expect(element.value!.innerHTML).toBe("<p>second</p>");
    container.remove();
  });
});
