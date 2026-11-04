import config from "~~/config";
import type { CommonItem } from "#layers/nuxt-blog/app/utils/common/types";
import { decryptEncryptBlocks, encryptDecryptItem, hideEncryptBlocks, showEncryptBlocksPlaceholder } from "#layers/nuxt-blog/app/utils/common/process-encrypt-decrypt";
import { useMarkdownParser } from "#layers/nuxt-blog/app/utils/hooks/useMarkdownParser";
import { useUnmount } from "#layers/nuxt-blog/app/utils/hooks/useUnmount";
import { DBOperate } from ".";
import { loadContentPage, visibleMarkdown } from "./content";
import { translate } from "../i18n";
import { deepClone, getCurrentTab, watchUntil } from "../utils";

/**
 * 详情页面通用功能
 */
export async function useContentPage<T extends CommonItem> (onAfterInsertHtml?: CallableFunction) {
  // composable 都要在第一个 await 之前调用
  const nuxtApp = useNuxtApp();
  const isAuthor = useIsAuthor();
  const githubToken = useGithubToken();
  const encryptor = useEncryptor();
  const targetTab = getCurrentTab();

  const id = useRoute().params.id as string;

  const destroyFns = useUnmount();

  // 条目、构建期 HTML、目录和摘要进入 payload：水合和客户端导航都不再下载 md、不再解析
  const { data } = await useAsyncData(`content:${targetTab}:${id}`, () => loadContentPage<T>(targetTab, id));
  const loaded = data.value;
  if (!loaded) {
    // 服务端：非 fatal 的错误同样渲染 404 页，但不会作为 [request error] 打印调用栈
    // （预渲染时爬虫会访问加密条目中未解密的相对链接）。客户端：只有 fatal 错误会显示错误页
    throw createError({
      statusCode: 404,
      statusMessage: `${targetTab}/${id} not found`,
      message: "wtf bro",
      fatal: import.meta.client
    });
  }

  // 复制一份，解密和访客数只改这份，不改 payload
  const item = reactive(deepClone(loaded.item)) as T;
  const originMd = loaded.md;
  // 构建期 HTML 对应的 md；普通条目不在 payload 里放原文，用空串表示
  const initialMd = originMd === null ? "" : visibleMarkdown(item, originMd);
  // 只有加密条目的 md 会在浏览器中变化
  const shownMd = ref(initialMd);
  // 加密条目的字段（标题、链接等）在解密前是密文
  const decrypted = ref(!item.encrypt);

  if (originMd !== null) {
    if (item.encrypt) {
      await encryptor.decryptOrWatchToDecrypt(async (decrypt) => {
        await encryptDecryptItem(item, decrypt, targetTab);
        decrypted.value = true;
        shownMd.value = await decrypt(originMd);
      });
    } else if (item.encryptBlocks?.length) {
      // encryptBlocks 只表示“有加密块”，位置从正文的 [encrypt] 标记解析
      watch(githubToken, async (logined) => {
        // 已登录：加密块显示为占位；未登录：直接隐藏
        shownMd.value = logined
          ? showEncryptBlocksPlaceholder(originMd, translate("encrypted-content"))
          : hideEncryptBlocks(originMd);
        await encryptor.decryptOrWatchToDecrypt(async (decrypt) => {
          shownMd.value = await decryptEncryptBlocks(originMd, decrypt);
        });
      }, { immediate: true });
    }
  }

  const { htmlContent, markdownRef, bindMarkdownEl, menuItems } = await useMarkdownParser({
    mdValueRef: shownMd,
    onAfterInsertHtml,
    destroyFns,
    initial: {
      html: loaded.html,
      menu: loaded.menu,
      md: initialMd,
      // 水合期间先保持服务端的 HTML，水合结束后再换成浏览器里的内容
      whenReady: (fn) => {
        if (import.meta.client && nuxtApp.isHydrating) {
          nuxtApp.hooks.hookOnce("app:suspense:resolve", fn);
        } else {
          fn();
        }
      }
    }
  });

  const visitors = ref<number>();
  watchUntil(isAuthor, () => {
    DBOperate({
      apiPath: "/db/inc-visitors",
      query: {
        id: item.id,
        type: targetTab,
        inc: config.database.visitFromOwner || !githubToken.value
      },
      callback: (data) => {
        visitors.value = data;
      }
    });
  }, { immediate: true }, isAuthor => isAuthor !== null, "cancelAfterUntil");

  // meta description：构建期生成；整篇加密的条目不暴露任何内容
  const description = computed(() => loaded.excerpt || undefined);

  return {
    item,
    decrypted,
    related: loaded.related,
    htmlContent,
    menuItems,
    markdownRef,
    bindMarkdownEl,
    description,
    visitors
  };
}
