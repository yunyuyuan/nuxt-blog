import { Calendar, Eye, FileText } from "lucide-vue-next";
import type { CommonItem } from "../../common/types";
import { formatTime } from "../format-time";
import { watchUntil } from "../utils";
import { translate } from "#layers/nuxt-blog/app/utils/nuxt/i18n";

export function Visitors(props: { visitors?: number }) {
  return (
    __NB_DATABASE_ENABLED__ && Number(props.visitors) >= 0
      ? (
        <span class="flex items-center gap-1" title={translate("visit-time", [props.visitors])}>
          <Eye class="size-4" />
          {props.visitors}
        </span>
      )
      : null
  );
}

export function Words(props: { len: number }) {
  return (
    Number(props.len) >= 0
      ? (
        <span class="flex items-center gap-1">
          <FileText class="size-4" />
          {props.len}
          {" "}
          {translate("words-num")}
        </span>
      )
      : null
  );
}

export function WroteDate(props: { item: CommonItem }) {
  return (
    <span class="flex items-center gap-1" title={`${translate("created-at")}: ${formatTime(props.item.time)}\n${translate("updated-at")}: ${formatTime(props.item.modifyTime)}`}>
      <Calendar class="size-4" />
      {formatTime(props.item.time, "date")}
    </span>
  );
}


export const Comments = defineComponent({
  name: 'Comments',
  setup() {
    if (!__NB_CMTREPOID__ || !__NB_CMTREPOCATEID__) return () => null;

    const { themeMode } = useThemeMode();
    const { i18nCode } = useI18nCode();
    const giscusLoaded = ref(false);
    const containerRef = ref<HTMLElement | null>(null);

    const updateGiscusConfig = (config: object) => {
      const iframe = document.querySelector<HTMLIFrameElement>("iframe.giscus-frame");
      if (!iframe) {
        return;
      }
      iframe.contentWindow!.postMessage({
        giscus: {
          setConfig: config
        }
      }, "https://giscus.app");
    };

    const getTheme = () => {
      return themeMode.value === "light" ? "light" : "dark_dimmed";
    };

    const getLang = (locale: string) => {
      switch (locale) {
        case "en":
          return "en";
        default:
          return "zh-CN";
      }
    };

    const loadGiscus = () => {
      if (giscusLoaded.value || !containerRef.value) return;

      const script = document.createElement("script");
      script.src = "https://giscus.app/client.js";
      // config.ts 的 CommentRepo，留空时是 githubName/githubRepo（modules/blog.ts）
      script.setAttribute("data-repo", __NB_CMTREPO__);
      script.setAttribute("data-repo-id", __NB_CMTREPOID__);
      script.setAttribute("data-category", "Announcements");
      script.setAttribute("data-category-id", __NB_CMTREPOCATEID__);
      script.setAttribute("data-mapping", "pathname");
      script.setAttribute("data-strict", "0");
      script.setAttribute("data-reactions-enabled", "1");
      script.setAttribute("data-emit-metadata", "0");
      script.setAttribute("data-input-position", "top");
      script.setAttribute("data-theme", getTheme());
      script.setAttribute("data-lang", getLang(i18nCode.value));
      script.setAttribute("crossorigin", "anonymous");
      script.setAttribute("async", "");
      containerRef.value.appendChild(script);
      giscusLoaded.value = true;
    };

    onMounted(() => {
      watchUntil(themeMode, loadGiscus,
        { immediate: true },
        themeMode => !!themeMode,
        "cancelAfterUntil"
      );
    });

    watch(i18nCode, (locale) => {
      if (giscusLoaded.value) {
        updateGiscusConfig({
          lang: getLang(locale)
        });
      }
    });

    watch(themeMode, () => {
      if (giscusLoaded.value) {
        updateGiscusConfig({
          theme: getTheme()
        });
      }
    });

    return () => (
      <section>
        <h3 class="mb-4 text-xl font-medium text-dark-800 dark:text-dark-200">
          {translate("comments")}
        </h3>
        <div class="flex min-h-44 items-center justify-center rounded-lg py-4">
          <div
            ref={containerRef}
            class="w-full"
          />
        </div>
      </section>
    );
  }
});
