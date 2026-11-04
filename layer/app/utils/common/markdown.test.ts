import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown";

const render = async (md: string) => (await parseMarkdown(md)).md;

describe("parseMarkdown attributes", () => {
  it("escapes quotes in image alt and title", async () => {
    const html = await render("![say \"hi\" <b>](https://a.com/x.png)");
    expect(html).toContain("alt=\"say &quot;hi&quot; &lt;b&gt;\"");
    expect(html).toContain("title=\"say &quot;hi&quot; &lt;b&gt;\"");
    expect(html).toContain("src=\"https://a.com/x.png\"");
  });

  it("keeps the title of a sized image as plain text", async () => {
    const html = await render("![with `code`[10rem x ]](https://a.com/x.png)");
    expect(html).toContain("title=\"with `code`\"");
    expect(html).toContain("style=\"width: 10rem !important;\"");
  });

  it("encodes quotes in custom link and media urls", async () => {
    expect(await render("#[x](https://a.com/?q=\"y\")")).toContain("href=\"https://a.com/?q=%22y%22\"");
    expect(await render("[video][v](https://a.com/p\".png|https://a.com/v.mp4)[/video]"))
      .toContain("poster=\"https://a.com/p%22.png\"");
  });

  it("uses plain text for iframe titles", async () => {
    const html = await render("[youtube][a \"quoted\" **title**](https://youtube.com/embed/x)[/youtube]");
    expect(html).toContain("title=\"a &quot;quoted&quot; **title**\"");
    expect(html).toContain("<strong>title</strong>");
  });

  it("escapes the code block language", async () => {
    const html = await render("```a\"b\nx\n```");
    expect(html).toContain("data-lang=\"a&quot;b\"");
  });
});

describe("parseMarkdown media embeds", () => {
  it("recognizes [bili] and [audio] in the middle of a paragraph", async () => {
    const bili = await render("before [bili][b](https://player.bilibili.com/x?a=1)[/bili] after");
    expect(bili).toContain("class=\"embed-media bili\"");
    const audio = await render("before [audio][a](https://a.com/a.mp3)[/audio] after");
    expect(audio).toContain("class=\"embed-media vanilla-audio\"");
  });

  // 嵌入的播放器和媒体文件不在页面加载时下载：YouTube 播放器的脚本 gzip 后约 1.2MB
  it("defers embedded players and media files", async () => {
    for (const md of [
      "[youtube][y](https://www.youtube.com/embed/x)[/youtube]",
      "[bili][b](https://player.bilibili.com/x?a=1)[/bili]"
    ]) {
      expect(await render(md)).toMatch(/<iframe loading="lazy" src=/);
    }
    expect(await render("[video][v](https://a.com/v.mp4)[/video]")).toContain("preload=\"metadata\"");
    expect(await render("[audio][a](https://a.com/a.mp3)[/audio]")).toContain("preload=\"metadata\"");
  });

  // 水合后正文图片才换成懒加载组件。预渲染的 <img> 不加 lazy，浏览器解析 HTML 时就会下载全部图片
  it("defers images in the rendered html", async () => {
    for (const md of [
      "![photo](https://a.com/a.jpg)",
      "![photo[100px x 50px]](https://a.com/a.jpg)",
      "![photo[ x 50px]](https://a.com/a.jpg)",
      "![sticker](aru/1)"
    ]) {
      const html = await render(md);
      expect(html.match(/<img /g)).toHaveLength(1);
      expect(html).toMatch(/<img [^>]*loading="lazy"/);
    }
  });
});
