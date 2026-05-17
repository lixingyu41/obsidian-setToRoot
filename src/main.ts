import { Plugin, TFolder, WorkspaceLeaf } from "obsidian";

import { ROOTED_FILE_EXPLORER_VIEW_TYPE } from "./constants";
import { t } from "./i18n";
import {
  DEFAULT_SETTINGS,
  type SetToRootSettings,
  normalizeSettings,
  resolveViewIcon
} from "./settings";
import { SetToRootSettingTab } from "./ui/settings-tab";
import { RootedFileExplorerView } from "./views/rooted-file-explorer-view";

export default class SetToRootPlugin extends Plugin {
  settings: SetToRootSettings = DEFAULT_SETTINGS;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      ROOTED_FILE_EXPLORER_VIEW_TYPE,
      (leaf) => new RootedFileExplorerView(leaf, { getIcon: () => this.getRootedViewIcon() })
    );

    this.addSettingTab(new SetToRootSettingTab(this.app, this));
    this.registerFolderContextMenu();
  }

  async updateSettings(nextSettings: SetToRootSettings): Promise<void> {
    this.settings = normalizeSettings(nextSettings);
    await this.saveData(this.settings);
    this.refreshRootedLeaves();
  }

  getRootedViewIcon(): string {
    return resolveViewIcon(this.settings.viewIcon);
  }

  private registerFolderContextMenu(): void {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source) => {
        if (source !== "file-explorer-context-menu" || !(file instanceof TFolder) || file.isRoot()) {
          return;
        }

        menu.addItem((item) =>
          item
            .setSection("view")
            .setTitle(t("menuSetToRoot"))
            .setIcon("lucide-panel-left-open")
            .onClick(() => {
              void this.openRootedExplorer(file);
            })
        );
      })
    );
  }

  private async openRootedExplorer(folder: TFolder): Promise<void> {
    const leaf = this.getTargetLeaf();

    await leaf.setViewState({
      type: ROOTED_FILE_EXPLORER_VIEW_TYPE,
      active: true,
      state: {
        rootPath: folder.path
      }
    });

    await this.app.workspace.revealLeaf(leaf);
    refreshLeafHeader(leaf);
  }

  private async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  private getTargetLeaf(): WorkspaceLeaf {
    if (this.settings.viewMode === "single") {
      const existingLeaf = this.app.workspace.getLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE).first();
      if (existingLeaf) {
        return existingLeaf;
      }
    }

    return this.createSidebarLeaf(this.settings.viewMode === "multiple");
  }

  private createSidebarLeaf(split: boolean): WorkspaceLeaf {
    return (
      this.app.workspace.getLeftLeaf(split) ??
      this.app.workspace.getRightLeaf(split) ??
      this.app.workspace.getLeaf("tab")
    );
  }

  private refreshRootedLeaves(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE)) {
      if (leaf.view instanceof RootedFileExplorerView) {
        leaf.view.icon = this.getRootedViewIcon();
      }
      refreshLeafHeader(leaf);
    }
  }
}

function refreshLeafHeader(leaf: WorkspaceLeaf): void {
  const leafWithHeader = leaf as WorkspaceLeaf & { updateHeader?: () => void };
  leafWithHeader.updateHeader?.();
}
