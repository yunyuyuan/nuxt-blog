<script setup lang="ts">
import { Link } from "lucide-vue-next";
import type { KnowledgeItem } from "#layers/nuxt-blog/app/utils/common/types";
import { useContentPage } from "#layers/nuxt-blog/app/utils/nuxt/public/detail";
import { Comments, MarkdownHtml, Visitors, WroteDate } from "#layers/nuxt-blog/app/utils/nuxt/public/components";
import { useCommonSEOTitle } from "#layers/nuxt-blog/app/utils/nuxt/utils";
import { initViewer } from "#layers/nuxt-blog/app/utils/nuxt/viewer";

const { item, decrypted, bindMarkdownEl, htmlContent, description, visitors } = await useContentPage<KnowledgeItem>();
useCommonSEOTitle(() => item.title, undefined, description);

const root = ref<HTMLElement>();
initViewer(root);
</script>

<template>
  <main
    ref="root"
    class="container mx-auto grow px-4 py-8 max-md:px-1 max-md:py-2"
  >
    <article class="mx-auto max-w-4xl overflow-hidden rounded-xl bg-white shadow-sm dark:bg-dark-800">
      <div class="relative mt-4 flex w-full justify-center overflow-hidden p-1">
        <the-lazy-img
          :class="$style.img"
          :src="item.cover"
          alt="cover"
          viewer
        />
      </div>

      <div class="px-6 py-8 max-md:px-3">
        <div class="mb-6 flex justify-between max-md:flex-col max-md:gap-2">
          <a
            target="_blank"
            :href="decrypted ? item.link : undefined"
            class="mb-2 flex items-center text-2xl font-medium text-dark-900 dark:text-white max-md:mb-0"
          >
            <Link class="mr-2 size-5 text-primary-500" />
            {{ item.title }}
          </a>
          <div class="flex items-center space-x-4 text-sm text-dark-500 dark:text-dark-400">
            <WroteDate :item="item" />
            <Visitors :visitors="visitors" />
          </div>
        </div>

        <div class="mb-8 max-w-none text-sm text-dark-600 dark:text-dark-300">
          {{ item.summary }}
        </div>

        <div class="mb-6 border-t border-dark-200 dark:border-dark-700" />

        <MarkdownHtml
          :ref="bindMarkdownEl"
          tag="article"
          :html="htmlContent"
          :class="twMerge('--markdown', 'mb-2 max-w-full')"
        />
      </div>
    </article>
    <div
      v-if="item.showComments"
      class="mx-auto mt-4 max-w-4xl overflow-hidden rounded-xl bg-white p-4 shadow-sm dark:bg-dark-800 max-md:px-2"
    >
      <Comments />
    </div>
  </main>
</template>

<style module>
.img {
  @apply rounded-lg shadow h-64 min-w-36 justify-center;

  img {
    @apply h-full rounded-lg object-contain transition-transform duration-500 hover:scale-105;
  }
}
</style>
