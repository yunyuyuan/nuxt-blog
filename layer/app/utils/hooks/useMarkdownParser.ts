// 公式样式随 Markdown 渲染一起加载（详情页和编辑器），不再放进全局入口 CSS
import "katex/dist/katex.min.css";
import type { ComponentPublicInstance } from "vue";
import { parseMarkdown } from "../common/markdown";
import { afterInsertHtml } from "../nuxt/markdown";
import { isPrerender } from "../nuxt/constants";

type useMarkdownParserProps = {
  mdValueRef: Ref<string>;
  fromEdit?: boolean;
  onAfterInsertHtml?: CallableFunction;
  destroyFns?: CallableFunction[];
  /**
   * 构建期渲染的结果。md 是这份 HTML 对应的原文：mdValueRef 与它相同时直接复用，不再解析。
   * 不同时调用 whenReady 安排重新解析（详情页用它等水合结束）。
   */
  initial?: {
    html: string;
    menu: Awaited<ReturnType<typeof parseMarkdown>>["menu"];
    md: string;
    whenReady: (_: () => void) => void;
  };
};

const waitUntilConnected = (element: HTMLElement, signal: AbortSignal) => {
  if (signal.aborted) return Promise.resolve(false);
  if (element.isConnected) return Promise.resolve(true);

  return new Promise<boolean>((resolve) => {
    const observer = new MutationObserver(() => {
      if (element.isConnected) finish(true);
    });
    const finish = (connected: boolean) => {
      observer.disconnect();
      signal.removeEventListener("abort", onAbort);
      resolve(connected);
    };
    const onAbort = () => finish(false);

    signal.addEventListener("abort", onAbort, { once: true });
    observer.observe(document, { childList: true, subtree: true });

    // Close the gap between the initial check and observer registration.
    if (element.isConnected) finish(true);
  });
};

export const useMarkdownParser = async ({ mdValueRef, fromEdit, onAfterInsertHtml, destroyFns, initial }: useMarkdownParserProps) => {
  const markdownRef = ref<HTMLElement>();
  // 详情页的正文由 MarkdownHtml 组件输出，模板中 ref 拿到的是组件实例，这里取它的根元素
  const bindMarkdownEl = (target: Element | ComponentPublicInstance | null) => {
    const element = target instanceof Element ? target : target?.$el;
    markdownRef.value = element instanceof HTMLElement ? element : undefined;
  };

  const htmlContent = ref("");
  const menuItems = ref<Awaited<ReturnType<typeof parseMarkdown>>["menu"]>([]);

  let parseVersion = 0;
  const parse = async (md: string) => {
    const version = ++parseVersion;
    const result = await parseMarkdown(md, __NB_BASE_URL__, { prerender: isPrerender });
    if (version === parseVersion) {
      htmlContent.value = result.md;
      menuItems.value = result.menu;
    }
  };

  watch(mdValueRef, async (md) => {
    await parse(md);
  });

  if (initial) {
    // 复用构建期 HTML：代码块和公式已经处理过，浏览器不用再加载 shiki 和 KaTeX
    htmlContent.value = initial.html;
    menuItems.value = initial.menu;
    if (mdValueRef.value !== initial.md) {
      initial.whenReady(() => void parse(mdValueRef.value));
    }
  } else {
    await parse(mdValueRef.value);
  }

  let disposed = false;
  let enhanceVersion = 0;
  let enhanceController: AbortController | undefined;
  const enhancementCleanupFns: CallableFunction[] = [];

  const cleanupEnhancements = () => {
    enhanceController?.abort();
    enhanceController = undefined;
    enhancementCleanupFns.splice(0).forEach(fn => fn());
  };

  const enhanceMarkdown = async (element: HTMLElement) => {
    const version = ++enhanceVersion;
    cleanupEnhancements();

    const controller = new AbortController();
    enhanceController = controller;

    // A template ref can become available before a transitioning page is attached
    // to document. Mermaid performs document-level lookups while rendering, so only
    // start post-processing after Vue has flushed the DOM and the element is connected.
    await nextTick();
    if (disposed || controller.signal.aborted || element !== markdownRef.value) {
      return;
    }
    if (!await waitUntilConnected(element, controller.signal)) {
      return;
    }

    try {
      const fns = await afterInsertHtml(element, fromEdit, controller.signal);
      if (disposed || controller.signal.aborted || version !== enhanceVersion || element !== markdownRef.value || !element.isConnected) {
        fns.forEach(fn => fn());
        return;
      }

      enhancementCleanupFns.push(...fns);
      onAfterInsertHtml?.();
    } catch (error) {
      if (!disposed && !controller.signal.aborted) {
        console.error("Failed to enhance markdown", error);
      }
    }
  };

  const stopEnhancementWatch = watch(
    [htmlContent, markdownRef],
    ([, element]) => {
      if (element) {
        void enhanceMarkdown(element);
      }
    },
    { immediate: true, flush: "post" }
  );

  const destroyEnhancements = () => {
    disposed = true;
    enhanceVersion++;
    stopEnhancementWatch();
    cleanupEnhancements();
  };

  if (destroyFns) {
    destroyFns.push(destroyEnhancements);
  } else if (getCurrentScope()) {
    onScopeDispose(destroyEnhancements);
  }

  return {
    markdownRef,
    bindMarkdownEl,
    htmlContent,
    menuItems
  };
};
