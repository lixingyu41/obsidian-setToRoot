import { Menu, Plugin, TFolder, WorkspaceLeaf } from "obsidian";

import { t } from "./i18n";
import {
  ROOTED_FILE_EXPLORER_VIEW_TYPE,
  createRootedFileExplorerViewWithOptions
} from "./rooted-file-explorer";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  resolveViewIcon,
  type SetToRootSettings
} from "./settings";
import { SetToRootSettingTab } from "./ui/settings-tab";

export default class SetToRootPlugin extends Plugin {
  settings: SetToRootSettings = DEFAULT_SETTINGS;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      ROOTED_FILE_EXPLORER_VIEW_TYPE,
      (leaf) =>
        createRootedFileExplorerViewWithOptions(this.app, leaf, {
          getIcon: () => this.getRootedViewIcon()
        })
    );

    this.addSettingTab(new SetToRootSettingTab(this.app, this));
    this.registerFolderMenu();
  }

  override onunload(): void {
    this.app.workspace.detachLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE);
  }

  getRootedViewIcon(): string {
    return resolveViewIcon(this.settings.viewIcon);
  }

  async updateSettings(settings: SetToRootSettings): Promise<void> {
    this.settings = normalizeSettings(settings);
    await this.saveData(this.settings);
    this.refreshRootedViews();
  }

  private async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  private registerFolderMenu(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu: Menu, file, source) => {
        if (source !== "file-explorer-context-menu" || !(file instanceof TFolder) || file.isRoot()) {
          return;
        }

        menu.addItem((item) => {
          item
            .setSection("view")
            .setTitle(t("menuSetToRoot"))
            .setIcon("lucide-panel-left-open")
            .onClick(() => {
              void this.openRootedView(file);
            });
        });
      })
    );
  }

  private async openRootedView(folder: TFolder): Promise<void> {
    const leaf = this.getRootedLeaf();

    await leaf.setViewState({
      type: ROOTED_FILE_EXPLORER_VIEW_TYPE,
      active: true,
      state: { rootPath: folder.path }
    });

    await this.app.workspace.revealLeaf(leaf);
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await this.app.workspace.requestSaveLayout();
    refreshLeafHeader(leaf);
  }

  private getRootedLeaf(): WorkspaceLeaf {
    if (this.settings.viewMode === "single") {
      const existingLeaf = this.app.workspace.getLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE)[0];
      if (existingLeaf) {
        return existingLeaf;
      }
    }

    return (
      this.app.workspace.getLeftLeaf(this.settings.viewMode === "multiple") ??
      this.app.workspace.getRightLeaf(this.settings.viewMode === "multiple") ??
      this.app.workspace.getLeaf("tab")
    );
  }

  private refreshRootedViews(): void {
    const icon = this.getRootedViewIcon();
    for (const leaf of this.app.workspace.getLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE)) {
      const view = leaf.view as { icon?: string };
      view.icon = icon;
      refreshLeafHeader(leaf);
    }
  }
}

function refreshLeafHeader(leaf: WorkspaceLeaf): void {
  const leafWithHeader = leaf as WorkspaceLeaf & { updateHeader?: () => void };
  leafWithHeader.updateHeader?.();
}
