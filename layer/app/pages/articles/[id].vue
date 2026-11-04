<script setup lang="tsx">
import { addScrollListener, rmScrollListener } from "#layers/nuxt-blog/app/utils/common/scroll-event";
import type { ArticleItem } from "#layers/nuxt-blog/app/utils/common/types";
import { useContentPage } from "#layers/nuxt-blog/app/utils/nuxt/public/detail";
import { Comments, MarkdownHtml, Visitors, WroteDate } from "#layers/nuxt-blog/app/utils/nuxt/public/components";
import { useCommonSEOTitle } from "#layers/nuxt-blog/app/utils/nuxt/utils";
import { initViewer } from "#layers/nuxt-blog/app/utils/nuxt/viewer";

const { related: relativeArticles, item, menuItems, htmlContent, markdownRef, bindMarkdownEl, description, visitors } = await useContentPage<ArticleItem>(() => {
  const hash = useRoute().hash;
  if (hash) {
    window.scrollTo({
      top: document
        .getElementById(hash.slice(1))
        ?.getBoundingClientRect().y
    });
  }
});

useCommonSEOTitle(() => item.title, () => item.tags, description);
const activeAnchor = ref<string>();

const onScroll = () => {
  try {
    const links = Array.from(markdownRef.value!.querySelectorAll<HTMLLinkElement>("h1>a, h2>a, h3>a, h4>a, h5>a, h6>a")).reverse();
    for (const link of links) {
      if (link.getBoundingClientRect().y <= 52) {
        const hash = link.getAttribute("href");
        activeAnchor.value = menuItems.value.find(anchor => anchor.url === hash?.slice(1))?.url;
        return;
      }
    }
    // 未找到
    activeAnchor.value = menuItems.value[0]?.url;
  } catch { /* empty */ }
};

const style = useCssModule();
const FloatMenu = () => {
  return (menuItems.value.length > 2
    ? (
        <aside
          class="shrink-0 opacity-0 transition-opacity hover:opacity-100 max-2xl:hidden lg:w-52"
        >
          <div class="sticky top-2 max-h-[calc(100vh-10px)] overflow-y-auto p-4 [&::-webkit-scrollbar]:w-1">
            <nav class="space-y-1 text-sm">
              {
                menuItems.value.map((anchor, idx) => (
                  <a
                    key={idx}
                    href={`#${anchor.url}`}
                    class={twMerge(
                      style.menuItem,
                      anchor.size === "small" && style.menuItemSmall,
                      activeAnchor.value === anchor.url && style.menuItemActive
                    )}
                    title={anchor.text}
                  >
                    <span innerHTML={anchor.text} />
                  </a>
                ))
              }
            </nav>
          </div>
        </aside>
      )
    : null
  );
};

onMounted(() => {
  nextTick(() => {
    if (!useRoute().hash) {
      onScroll();
    }
    addScrollListener(onScroll);
  });
});

onBeforeUnmount(() => {
  rmScrollListener(onScroll);
});

const root = ref<HTMLElement>();
initViewer(root);
</script>

<template>
  <div
    ref="root"
    class="container mx-auto px-4 py-8 max-md:px-1 max-md:py-2"
  >
    <div class="flex w-full justify-center">
      <FloatMenu />
      <main class="max-w-5xl flex-1 overflow-hidden rounded-lg bg-white p-6 shadow dark:bg-dark-800 max-md:px-2">
        <h1 class="mb-4 text-2xl font-medium text-dark-900 dark:text-white">
          {{ item.title }}
        </h1>

        <div
          class="mb-6 flex flex-wrap items-center gap-4 border-b border-dark-300 pb-3 text-sm text-dark-500 dark:border-dark-600 dark:text-dark-400"
        >
          <WroteDate :item="item" />
          <Visitors :visitors="visitors" />
          <div class="flex flex-wrap gap-2">
            <the-tag
              v-for="tag in item.tags"
              :key="tag"
              :href="'/articles?tag=' + tag"
            >
              {{ tag }}
            </the-tag>
          </div>
        </div>

        <MarkdownHtml
          :ref="bindMarkdownEl"
          tag="article"
          :html="htmlContent"
          :class="twMerge('--markdown', 'mb-8 pb-8 border-b border-dark-200 dark:border-dark-700 max-w-full')"
        />

        <aside
          v-if="relativeArticles.length"
          class="mt-8"
        >
          <div class="rounded-lg border border-dark-300 p-4 dark:border-dark-600">
            <h3 class="mb-4 text-lg font-medium text-dark-700 dark:text-dark-300">
              {{ $t('relativeArticles') }}
            </h3>
            <div class="max-h-40 space-y-4 overflow-auto">
              <NuxtLink
                v-for="{ item: i } in relativeArticles"
                :key="i.id"
                :to="`/articles/${i.customSlug || i.id}`"
                class="block rounded-md bg-dark-50 p-3 transition hover:bg-dark-100 dark:bg-dark-700 dark:hover:bg-dark-600"
              >
                <h4 class="text-sm font-medium text-dark-700 dark:text-dark-300">{{ i.title }}</h4>
              </NuxtLink>
            </div>
          </div>
        </aside>

        <Comments
          v-if="item.showComments"
          class="mt-8"
        />
      </main>
      <FloatMenu />
    </div>
  </div>
</template>

<style module>
.menuItem {
  @apply block py-1.5 px-2 text-sm text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 hover:text-primary-600 dark:hover:text-primary-400 rounded-md font-medium;
}

.menuItemActive {
  @apply text-primary-600 dark:text-primary-400;
}

.menuItemSmall {
  @apply py-1 px-2 pl-4 text-sm;
}
</style>
