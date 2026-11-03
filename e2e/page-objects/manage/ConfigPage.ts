import { ManageBasePage } from "./BasePage";

/** Page object for the config form (`/manage/config`). */
export class ManageConfigPage extends ManageBasePage {
  isUpdateDisabled() {
    return this.isElementDisabled("update-config-btn");
  }

  async setTitle(title: string) {
    await this.fillInput("config-title-input", title);
  }

  async setCommentRepo(repo: string) {
    await this.fillInput("config-CommentRepo-input", repo);
  }

  async clickUpdate() {
    await this.clickElement("update-config-btn");
  }

  /** Fill in a new site title and commit it. */
  async updateTitle(title: string) {
    await this.setTitle(title);
    await this.clickUpdate();
  }

  /** The committed `config.ts` content (or empty string if not committed). */
  getCommittedConfig() {
    return this.requestAdditions[0]?.content || "";
  }
}
