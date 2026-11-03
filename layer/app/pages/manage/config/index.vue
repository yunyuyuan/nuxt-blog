<script setup lang="ts">
import twColors from "tailwindcss/colors";
import { BarChart3, Check, ExternalLink, Eye, FileDiff, Github, Info, Languages, MessageCircleMore, Moon, Palette, Search, Upload } from "lucide-vue-next";
import type { FunctionalComponent } from "vue";
import { createCommit } from "#layers/nuxt-blog/app/utils/nuxt/manage/repository";
import configString from "~~/config.ts?raw";
import config from "~~/config";
import { translate } from "#layers/nuxt-blog/app/utils/nuxt/i18n";
import { createDiffModal, useStatusText } from "#layers/nuxt-blog/app/utils/nuxt/manage";
import { deepClone, useCommonSEOTitle } from "#layers/nuxt-blog/app/utils/nuxt/utils";
import type { BlogConfig } from "#layers/nuxt-blog/app/utils/common/blog-config";

useCommonSEOTitle(computed(() => translate("config-manage")));

// 旧的 config.ts 可能没有 CommentRepo（v9.1.0 加入）
const form = reactive({ ...deepClone(config as BlogConfig), CommentRepo: (config as BlogConfig).CommentRepo ?? "" });
const aboutText = ref(config.about.join("\n"));

const TAILWIND_COLORS = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
  "rose", "slate", "gray", "zinc", "neutral", "stone"
] as const;
const colorHex = (name: string) => (twColors as unknown as Record<string, Record<number, string>>)[name]?.[500] ?? "#888";

const toggleThemeColor = (name: string) => {
  const idx = form.themeColor.indexOf(name);
  if (idx >= 0) {
    if (form.themeColor.length > 1) {
      form.themeColor.splice(idx, 1);
    }
  } else {
    form.themeColor.push(name);
  }
};

const str = (s: string) => JSON.stringify(s ?? "");
const generatedConfig = computed(() => `export default {
  /** -------------------------------------------------以下必须修改----------------------------------------------------- */

  githubName: ${str(form.githubName)}, // 必须修改，github账户名

  /** -------------------------------------------------以下可选修改----------------------------------------------------- */

  title: ${str(form.title)}, // 网站标题
  nickName: ${str(form.nickName)}, // 昵称
  domain: ${str(form.domain)}, // rss域名
  SEO_title: ${str(form.SEO_title)}, // 搜索引擎显示的标题
  SEO_keywords: ${str(form.SEO_keywords)}, // keywords meta header
  MSClarityId: ${str(form.MSClarityId)}, // Microsoft的Clarity统计，https://clarity.microsoft.com/
  CloudflareAnalyze: ${str(form.CloudflareAnalyze)}, // cloudflare的统计，https://developers.cloudflare.com/analytics/web-analytics
  CommentRepoId: ${str(form.CommentRepoId)}, // 评论系统，参考 https://github.com/yunyuyuan/nuxt-blog/wiki/2.3-%E8%AF%84%E8%AE%BA%E7%B3%BB%E7%BB%9F
  CommentDiscussionCategoryId: ${str(form.CommentDiscussionCategoryId)}, // 评论系统
  CommentRepo: ${str(form.CommentRepo)}, // 评论所在的仓库，格式为 owner/name，留空时使用 githubName/githubRepo

  database: { // 参考 https://github.com/yunyuyuan/nuxt-blog/wiki/2.4-%E6%B5%8F%E8%A7%88%E9%87%8F%E7%BB%9F%E8%AE%A1
    initialVisitors: ${Number(form.database.initialVisitors) || 0}, // 如果设置成10000，那么发一篇文章立马就有10000个浏览量！
    visitFromOwner: ${form.database.visitFromOwner} // 网站拥有者访问时，是否增加浏览量
  },
  algoliaSearch: { // 参考 https://github.com/yunyuyuan/nuxt-blog/wiki/2.5-%E5%85%A8%E7%AB%99%E6%90%9C%E7%B4%A2
    appId: ${str(form.algoliaSearch.appId)},
    searchKey: ${str(form.algoliaSearch.searchKey)},
    indexName: ${str(form.algoliaSearch.indexName)}
  },
  themeColor: [${form.themeColor.map(str).join(", ")}], // 主题色，如果有多个颜色，则随机使用，参考 https://tailwindcss.com/docs/colors
  themeColorDark: ${str(form.themeColorDark)}, // 主题色(夜间模式)
  defaultLang: ${str(form.defaultLang)}, // default language, "zh" and "en" are supported currently
  about: [${aboutText.value.split("\n").map(s => s.trim()).filter(Boolean).map(line => `\n    ${str(line)}`).join(",")}
  ],

  /** -------------------------------------------------注意----------------------------------------------------- */

  githubRepo: ${str(form.githubRepo)} // 需要与仓库名一致，如果fork时更改了仓库名，则这里也要改
};
`);

const initialGenerated = generatedConfig.value;
const modified = computed(() => generatedConfig.value !== initialGenerated);
const invalid = computed(() => !form.githubName.trim() || !form.githubRepo.trim());

const { statusText, canCommit, processing, toggleProcessing } = useStatusText(modified);

const previewChanges = () => {
  createDiffModal({
    rawDiff: [{
      path: "config.ts",
      original: configString,
      modified: generatedConfig.value
    }],
    showOk: false
  });
};

const doUpload = async () => {
  toggleProcessing();
  try {
    await createCommit("Update config.ts", {
      additions: [{
        path: "config.ts",
        content: generatedConfig.value
      }]
    });
  } finally {
    toggleProcessing();
  }
};

type TextField = {
  key: string;
  label: string;
  model: Ref<string>;
  required?: boolean;
  desc?: string;
  link?: string;
  placeholder?: string;
};
type TextSection = {
  key: string;
  title: string;
  icon: FunctionalComponent;
  link?: string;
  fields: TextField[];
};

const textSections: TextSection[] = [
  {
    key: "basic",
    title: "config-section-basic",
    icon: Github,
    fields: [
      { key: "githubName", label: "config-github-name", model: toRef(form, "githubName"), required: true, desc: "config-github-name-desc" },
      { key: "githubRepo", label: "config-github-repo", model: toRef(form, "githubRepo"), required: true, desc: "config-github-repo-desc" },
      { key: "title", label: "config-title", model: toRef(form, "title") },
      { key: "nickName", label: "config-nickname", model: toRef(form, "nickName") },
      { key: "domain", label: "config-domain", model: toRef(form, "domain"), placeholder: "https://example.com" }
    ]
  },
  {
    key: "seo",
    title: "config-section-seo",
    icon: Search,
    fields: [
      { key: "SEO_title", label: "config-seo-title", model: toRef(form, "SEO_title"), desc: "config-seo-title-desc" },
      { key: "SEO_keywords", label: "config-seo-keywords", model: toRef(form, "SEO_keywords"), desc: "config-seo-keywords-desc" }
    ]
  },
  {
    key: "analytics",
    title: "config-section-analytics",
    icon: BarChart3,
    fields: [
      { key: "MSClarityId", label: "config-ms-clarity", model: toRef(form, "MSClarityId"), link: "https://clarity.microsoft.com/" },
      { key: "CloudflareAnalyze", label: "config-cf-analyze", model: toRef(form, "CloudflareAnalyze"), link: "https://developers.cloudflare.com/analytics/web-analytics" }
    ]
  },
  {
    key: "comment",
    title: "config-section-comment",
    icon: MessageCircleMore,
    link: "https://github.com/yunyuyuan/nuxt-blog/wiki/2.3-%E8%AF%84%E8%AE%BA%E7%B3%BB%E7%BB%9F",
    fields: [
      { key: "CommentRepoId", label: "config-comment-repo-id", model: toRef(form, "CommentRepoId") },
      { key: "CommentDiscussionCategoryId", label: "config-comment-category-id", model: toRef(form, "CommentDiscussionCategoryId") },
      { key: "CommentRepo", label: "config-comment-repo", model: toRef(form, "CommentRepo"), desc: "config-comment-repo-desc", placeholder: "owner/name" }
    ]
  },
  {
    key: "search",
    title: "config-section-search",
    icon: Search,
    link: "https://github.com/yunyuyuan/nuxt-blog/wiki/2.5-%E5%85%A8%E7%AB%99%E6%90%9C%E7%B4%A2",
    fields: [
      { key: "algoliaAppId", label: "config-algolia-app-id", model: toRef(form.algoliaSearch, "appId") },
      { key: "algoliaSearchKey", label: "config-algolia-search-key", model: toRef(form.algoliaSearch, "searchKey") },
      { key: "algoliaIndexName", label: "config-algolia-index-name", model: toRef(form.algoliaSearch, "indexName") }
    ]
  }
];
</script>

<template>
  <main class="h-full overflow-y-auto">
    <div class="mx-auto flex max-w-4xl flex-col gap-4 px-2 py-4 md:px-4">
      <div class="flex items-center justify-end gap-3">
        <span
          v-show="!!statusText || invalid"
          class="text-xs text-red-500"
        >{{ invalid ? $t('config-invalid') : statusText }}</span>
        <CommonButton
          :icon="FileDiff"
          :disabled="!modified"
          data-testid="preview-config-btn"
          @click="previewChanges"
        >
          {{ $t('preview-changes') }}
        </CommonButton>
        <CommonButton
          :icon="Upload"
          :disabled="!canCommit || !modified || invalid"
          :loading="processing"
          data-testid="update-config-btn"
          theme="primary"
          @click="doUpload"
        >
          {{ $t('update') }}
        </CommonButton>
      </div>

      <section
        v-for="section in textSections"
        :key="section.key"
        :class="$style.card"
      >
        <h3 :class="$style.cardTitle">
          <component
            :is="section.icon"
            class="size-5 opacity-70"
          />
          {{ $t(section.title) }}
          <a
            v-if="section.link"
            :href="section.link"
            target="_blank"
            class="ml-auto flex items-center gap-1 text-xs font-normal text-primary-600 hover:underline dark:text-primary-400"
          >
            {{ $t('config-help-doc') }}
            <ExternalLink class="size-3.5" />
          </a>
        </h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div
            v-for="field in section.fields"
            :key="field.key"
            class="flex flex-col gap-1.5"
          >
            <label
              :class="$style.label"
              :for="`config-${field.key}`"
            >
              {{ $t(field.label) }}
              <b
                v-if="field.required"
                class="text-red-500"
              >*</b>
              <a
                v-if="field.link"
                :href="field.link"
                target="_blank"
                class="text-primary-600 dark:text-primary-400"
              >
                <ExternalLink class="size-3.5" />
              </a>
            </label>
            <input
              :id="`config-${field.key}`"
              v-model="field.model.value"
              :data-testid="`config-${field.key}-input`"
              :placeholder="field.placeholder"
              :class="field.required && !field.model.value.trim() && '!border-red-500'"
              class="text-sm"
            >
            <p
              v-if="field.desc"
              :class="$style.desc"
            >
              {{ $t(field.desc) }}
            </p>
          </div>
        </div>
      </section>

      <section :class="$style.card">
        <h3 :class="$style.cardTitle">
          <Eye class="size-5 opacity-70" />
          {{ $t('config-section-visitors') }}
          <a
            href="https://github.com/yunyuyuan/nuxt-blog/wiki/2.4-%E6%B5%8F%E8%A7%88%E9%87%8F%E7%BB%9F%E8%AE%A1"
            target="_blank"
            class="ml-auto flex items-center gap-1 text-xs font-normal text-primary-600 hover:underline dark:text-primary-400"
          >
            {{ $t('config-help-doc') }}
            <ExternalLink class="size-3.5" />
          </a>
        </h3>
        <div class="grid gap-4 md:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label
              :class="$style.label"
              for="config-initialVisitors"
            >
              {{ $t('config-initial-visitors') }}
            </label>
            <input
              id="config-initialVisitors"
              v-model.number="form.database.initialVisitors"
              data-testid="config-initialVisitors-input"
              type="number"
              min="0"
              class="text-sm"
            >
            <p :class="$style.desc">
              {{ $t('config-initial-visitors-desc') }}
            </p>
          </div>
          <div class="flex items-center gap-3 md:mt-6">
            <common-checkbox
              :checked="form.database.visitFromOwner"
              test-id="config-visitFromOwner-checkbox"
              @change="form.database.visitFromOwner = $event"
            />
            <span
              :class="$style.label"
              class="cursor-pointer"
              @click="form.database.visitFromOwner = !form.database.visitFromOwner"
            >
              {{ $t('config-visit-from-owner') }}
            </span>
          </div>
        </div>
      </section>

      <section :class="$style.card">
        <h3 :class="$style.cardTitle">
          <Palette class="size-5 opacity-70" />
          {{ $t('config-section-appearance') }}
        </h3>
        <div class="flex flex-col gap-6">
          <div class="flex flex-col gap-2">
            <span :class="$style.label">{{ $t('config-theme-color') }}</span>
            <p :class="$style.desc">
              {{ $t('config-theme-color-desc') }}
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in TAILWIND_COLORS"
                :key="color"
                type="button"
                :title="color"
                :data-testid="`config-theme-color-${color}`"
                :class="twMerge(
                  'relative size-7 cursor-pointer rounded-full border-2 border-transparent transition hover:scale-110',
                  form.themeColor.includes(color) && 'border-dark-800 dark:border-white'
                )"
                :style="{ backgroundColor: colorHex(color) }"
                @click="toggleThemeColor(color)"
              >
                <Check
                  v-if="form.themeColor.includes(color)"
                  class="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                />
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span :class="$style.label">
              <Moon class="size-4" />
              {{ $t('config-theme-color-dark') }}
            </span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in TAILWIND_COLORS"
                :key="color"
                type="button"
                :title="color"
                :class="twMerge(
                  'relative size-7 cursor-pointer rounded-full border-2 border-transparent transition hover:scale-110',
                  form.themeColorDark === color && 'border-dark-800 dark:border-white'
                )"
                :style="{ backgroundColor: colorHex(color) }"
                @click="form.themeColorDark = color"
              >
                <Check
                  v-if="form.themeColorDark === color"
                  class="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                />
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <span :class="$style.label">
              <Languages class="size-4" />
              {{ $t('config-default-lang') }}
            </span>
            <div class="flex gap-2">
              <button
                v-for="lang in [{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]"
                :key="lang.value"
                type="button"
                :data-testid="`config-lang-${lang.value}`"
                :class="twMerge(
                  'cursor-pointer rounded-md border border-dark-300 px-4 py-1.5 text-sm transition dark:border-dark-600',
                  form.defaultLang === lang.value
                    ? 'border-primary-600 bg-primary-600 text-white dark:border-primary-600'
                    : 'hover:border-primary-500'
                )"
                @click="form.defaultLang = lang.value"
              >
                {{ lang.label }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section :class="$style.card">
        <h3 :class="$style.cardTitle">
          <Info class="size-5 opacity-70" />
          {{ $t('config-section-about') }}
        </h3>
        <div class="flex flex-col gap-1.5">
          <textarea
            v-model="aboutText"
            data-testid="config-about-textarea"
            rows="5"
            class="resize-y text-sm"
          />
          <p :class="$style.desc">
            {{ $t('config-about-desc') }}
          </p>
        </div>
      </section>
    </div>
  </main>
</template>

<style module>
.card {
  @apply rounded-lg border border-dark-100 bg-white p-4 shadow-sm dark:border-dark-700 dark:bg-dark-800;
}

.cardTitle {
  @apply mb-4 flex items-center gap-2 border-b border-dark-100 pb-3 text-sm font-bold text-dark-800 dark:border-dark-700 dark:text-dark-200;
}

.label {
  @apply flex items-center gap-1 text-sm text-dark-600 dark:text-dark-300;
}

.desc {
  @apply text-xs text-dark-400 dark:text-dark-500;
}
</style>
