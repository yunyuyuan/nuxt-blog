import { GithubTokenKey, IgnoredVersionKey, OfficialRepo } from "#layers/nuxt-blog/app/utils/common/constants";
import { isDev } from "#layers/nuxt-blog/app/utils/nuxt/constants";
import { translate } from "#layers/nuxt-blog/app/utils/nuxt/i18n";
import { getLocalStorage, setLocalStorage } from "#layers/nuxt-blog/app/utils/nuxt/localStorage";
import { notify } from "#layers/nuxt-blog/app/utils/nuxt/notify";

// 本插件属于 entry，所有访客都会下载。后台代码（GitHub 接口、升级弹窗、diff 弹窗）
// 只在有 token 时才动态导入。静态导入会把它们打包进 entry，
// 并让 diff 弹窗中的 import("monaco-editor") 成为 entry 的动态导入
async function checkVersion() {
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${OfficialRepo}/refs/heads/master/CHANGELOG.md`);
    const content = await response.text();
    const versionMatch = content.match(/##\s*\[v(\d+)\]/);
    const latestVersion = versionMatch ? versionMatch[1] : null;

    if (latestVersion && latestVersion !== __NB_CURRENT_VERSION__) {
      const ignoredVersion = getLocalStorage(IgnoredVersionKey);
      if (ignoredVersion !== latestVersion) {
        const { createVersionUpdateModal } = await import("#layers/nuxt-blog/app/utils/nuxt/manage");
        await createVersionUpdateModal(latestVersion);
        // 不会弹出第二次
        setLocalStorage(IgnoredVersionKey, latestVersion);
      }
    }
  } catch (e) {
    // 检查版本失败，静默处理
    console.error("Failed to check version:", e);
  }
}

export default defineNuxtPlugin({
  name: "nb-github-token",
  // 插件按文件名顺序执行，本插件排在 i18n.ts 之前。如果 GitHub 先于语言包返回，
  // translate() 读不到 $i18nMessages 而抛错，通知丢失，useIsAuthor 也不会被赋值
  dependsOn: ["nb-i18n"],
  setup(app) {
    if (isDev || __NB_BUILDTIME_VITESTING__) {
      app.hook("app:suspense:resolve", () => {
        useGithubToken().value = "LocalServer";
        useRemoteLatestSha().value = __NB_CURRENT_GIT_SHA__;
        useIsAuthor().value = true;
      });
    } else {
      const localToken = getLocalStorage(GithubTokenKey);
      if (localToken) {
        // 进入界面时，检查token
        import("#layers/nuxt-blog/app/utils/nuxt/manage/github")
          .then(({ isAuthor }) => isAuthor(localToken))
          .then((res) => {
            notify({
              title: res ? translate("token-verified") : translate("token-unverified"),
              type: res ? "success" : "error"
            });
            useIsAuthor().value = res;
            // 验证成功后检查版本
            if (res) {
              checkVersion();
            }
          })
          .catch((e) => {
            notify({
              title: translate("token-unverified"),
              type: "error",
              description: e
            });
            useIsAuthor().value = false;
          });
      } else {
        useIsAuthor().value = false;
      }
    }
  }
});
