<script setup lang="ts">
import type { RecordItem } from "#layers/nuxt-blog/app/utils/common/types";
import { formatTime } from "#layers/nuxt-blog/app/utils/nuxt/format-time";
import { translate } from "#layers/nuxt-blog/app/utils/nuxt/i18n";
import { useContentPage } from "#layers/nuxt-blog/app/utils/nuxt/public/detail";
import { Comments, MarkdownHtml, Visitors, WroteDate } from "#layers/nuxt-blog/app/utils/nuxt/public/components";
import { useCommonSEOTitle } from "#layers/nuxt-blog/app/utils/nuxt/utils";
import { initViewer } from "#layers/nuxt-blog/app/utils/nuxt/viewer";

const { item, htmlContent, bindMarkdownEl, description, visitors } = await useContentPage<RecordItem>();
useCommonSEOTitle(() => `${translate("records")}: ${formatTime(item.time, "date")}`, undefined, description);

const root = ref<HTMLElement>();
initViewer(root);
</script>

<template>
  <main
    ref="root"
    class="container mx-auto grow px-4 py-8 max-md:px-1 max-md:py-4"
  >
    <article class="mx-auto max-w-4xl overflow-hidden rounded-xl bg-white shadow-sm dark:bg-dark-800">
      <div class="px-6 max-md:px-3">
        <div
          v-if="item.images.length > 0"
          class="my-8 grid grid-cols-1 items-start gap-6 max-md:my-4 md:grid-cols-2"
        >
          <the-lazy-img
            v-for="img, idx in item.images"
            :key="idx"
            :class="$style.img"
            viewer
            :alt="img.alt"
            :src="img.src"
            :title="img.alt"
          />
        </div>

        <MarkdownHtml
          :ref="bindMarkdownEl"
          tag="article"
          :html="htmlContent"
          :class="twMerge('--markdown', 'my-16 max-w-full')"
        />

        <div class="border-t border-dark-100 py-6 dark:border-dark-700">
          <div class="flex items-center space-x-4 text-sm text-dark-500 dark:text-dark-400">
            <WroteDate :item="item" />
            <Visitors :visitors="visitors" />
          </div>
        </div>
      </div>
    </article>

    <div
      v-if="item.showComments"
      class="mx-auto mt-6 max-w-4xl overflow-hidden rounded-xl bg-white p-4 shadow-sm dark:bg-dark-800 max-md:px-2"
    >
      <Comments />
    </div>
  </main>
</template>

<style module>
.img {
  @apply rounded-lg shadow min-h-12;

  img {
    @apply object-contain transition-transform duration-500 hover:scale-105;
  }
}
</style>
