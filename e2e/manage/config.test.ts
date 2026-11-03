import { describe, expect, it } from "vitest";
import { configPath } from "./fixtures";
import { createConfigPage, setupTestEnvironment } from "./test-helpers";

describe("Config Editing", async () => {
  await setupTestEnvironment();

  it("disables update until the config is modified", async () => {
    const { configPage } = await createConfigPage(configPath());

    expect(await configPage.isUpdateDisabled()).toBe(true);
    await configPage.screenShot();
    await configPage.setTitle("test-config-title");
    await configPage.screenShot();
    expect(await configPage.isUpdateDisabled()).toBe(false);
  });

  it("commits the edited config to config.ts", async () => {
    const { configPage } = await createConfigPage(configPath());

    await configPage.updateTitle("test-config-title");

    expect(configPage.requestAdditions[0]?.path).toBe("config.ts");
    expect(configPage.getCommittedConfig()).toContain("title: \"test-config-title\"");
    // 没有填写时，CommentRepo 是空字符串（评论使用 githubName/githubRepo）
    expect(configPage.getCommittedConfig()).toContain("CommentRepo: \"\",");
  });

  it("commits CommentRepo to config.ts", async () => {
    const { configPage } = await createConfigPage(configPath());

    await configPage.setCommentRepo("someone/old-blog");
    await configPage.clickUpdate();

    expect(configPage.getCommittedConfig()).toContain("CommentRepo: \"someone/old-blog\",");
  });
});
