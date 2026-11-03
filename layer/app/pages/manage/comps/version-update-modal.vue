<script setup lang="ts">
import { CircleFadingArrowUp, ExternalLink, ScrollText, Sparkles } from "lucide-vue-next";
import config from "~~/config";
import { OfficialRepo } from "#layers/nuxt-blog/app/utils/common/constants";
import { withBase } from "#layers/nuxt-blog/app/utils/nuxt/with-base";

const show = defineModel<boolean>({ required: true });

const props = defineProps<{
  newVersion: string;
  onClose: () => void;
}>();

const changelogUrl = `https://github.com/${OfficialRepo}/blob/master/CHANGELOG.md`;
const repoUrl = `https://github.com/${config.githubName}/${__NB_GITHUB_REPO__}`;
// 从 npm 安装（starter）时修改依赖的版本号；fork 本仓库时同步上游
const fromNpm = __NB_LAYER_FROM_NPM__;
// GitHub 把 HEAD 解析为默认分支
const packageJsonUrl = `${repoUrl}/blob/HEAD/package.json`;
const upgradeRange = computed(() => `"@yunyuyuan/nuxt-blog": "^${props.newVersion}.0.0"`);
const upgradeCommand = computed(() => `pnpm add @yunyuyuan/nuxt-blog@^${props.newVersion}`);
</script>

<template>
  <common-modal
    v-model="show"
    modal-width="800px"
    :show-ok="false"
    :show-cancel="false"
    @cancel="onClose"
  >
    <template #title>
      {{ $t('new-version-available') }}
    </template>
    <template #body>
      <div class="space-y-6">
        <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <p class="flex items-center gap-2 text-dark-900 dark:text-dark-100">
            <Sparkles class="size-5 text-primary-600" />
            {{ $t('new-version-detected', [newVersion]) }}
          </p>
        </div>

        <div>
          <h4 class="mb-2 flex items-center gap-2 font-medium text-dark-900 dark:text-white">
            <ScrollText class="size-5" />
            {{ $t('view-changelog') }}
          </h4>
          <a
            :href="changelogUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            <span>CHANGELOG.md</span>
            <ExternalLink class="size-4" />
          </a>
        </div>

        <div>
          <h4 class="mb-2 flex items-center gap-2 font-medium text-dark-900 dark:text-white">
            <CircleFadingArrowUp class="size-5" />
            {{ $t('how-to-upgrade') }}
          </h4>
          <div
            v-if="fromNpm"
            data-testid="upgrade-steps-npm"
            class="space-y-4 text-dark-700 dark:text-dark-300"
          >
            <div class="space-y-1">
              <p>{{ $t('upgrade-npm-web') }}</p>
              <a
                :href="packageJsonUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>{{ packageJsonUrl }}</span>
                <ExternalLink class="size-3" />
              </a>
              <div>
                <code class="rounded bg-dark-100 px-1.5 py-0.5 text-sm dark:bg-dark-800">{{ upgradeRange }}</code>
              </div>
            </div>
            <div class="space-y-1">
              <p>{{ $t('upgrade-npm-local') }}</p>
              <code class="rounded bg-dark-100 px-1.5 py-0.5 text-sm dark:bg-dark-800">{{ upgradeCommand }}</code>
            </div>
            <p>{{ $t('upgrade-npm-rebuild') }}</p>
          </div>
          <template v-else>
            <ol
              data-testid="upgrade-steps-fork"
              class="mb-5 list-decimal space-y-2 pl-5 text-dark-700 dark:text-dark-300"
            >
              <li>
                {{ $t('upgrade-step-1') }}
                <a
                  :href="repoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <span>{{ repoUrl }}</span>
                  <ExternalLink class="size-3" />
                </a>
              </li>
              <li>{{ $t('upgrade-step-2') }}</li>
            </ol>
            <div class="m-2 overflow-hidden rounded-lg border border-dark-200 dark:border-dark-700">
              <img
                :src="withBase('/how-to-upgrade.png')"
                alt="How to upgrade"
                class="w-full"
              >
            </div>
          </template>
        </div>
      </div>
    </template>
  </common-modal>
</template>
