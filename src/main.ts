import {
  FuzzySuggestModal,
  Plugin,
  PluginSettingTab,
  Setting,
  TFolder,
  View,
  WorkspaceLeaf,
  getIconIds,
  setIcon
} from "obsidian";

import { t, tf } from "./i18n";
import {
  ROOTED_FILE_EXPLORER_VIEW_TYPE,
  createRootedFileExplorerViewWithOptions
} from "./rooted-file-explorer";
import {
  DEFAULT_SETTINGS,
  SetToRootSettings,
  normalizeSettings,
  resolveViewIcon
} from "./settings";

export default class SetToRootPlugin extends Plugin {
  settings: SetToRootSettings = DEFAULT_SETTINGS;

  override async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(ROOTED_FILE_EXPLORER_VIEW_TYPE, (leaf) =>
      createRootedFileExplorerViewWithOptions(this.app, leaf, {
        getIcon: () => this.getRootedViewIcon()
      })
    );

    this.addSettingTab(new SetToRootSettingTab(this.app, this));

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

  async updateSettings(nextSettings: SetToRootSettings): Promise<void> {
    this.settings = normalizeSettings(nextSettings);
    await this.saveData(this.settings);
    this.refreshRootedLeaves();
  }

  getRootedViewIcon(): string {
    return resolveViewIcon(this.settings.viewIcon);
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
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    refreshLeafHeader(leaf);
  }

  private async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
  }

  private getTargetLeaf(): WorkspaceLeaf {
    if (this.settings.viewMode === "single") {
      return (
        this.app.workspace.getLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE).first() ??
        this.createSidebarLeaf(false)
      );
    }

    return this.createSidebarLeaf(true);
  }

  private createSidebarLeaf(split: boolean): WorkspaceLeaf {
    return (
      this.app.workspace.getLeftLeaf(split) ??
      this.app.workspace.getRightLeaf(split) ??
      this.app.workspace.getLeaf("tab")
    );
  }

  private refreshRootedLeaves(): void {
    if (this.settings.viewMode === "single") {
      this.enforceSingleRootedLeaf();
    }

    const icon = this.getRootedViewIcon();
    for (const leaf of this.app.workspace.getLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE)) {
      const view = leaf.view as View & { icon?: string };
      view.icon = icon;
      refreshLeafHeader(leaf);
    }
  }

  private enforceSingleRootedLeaf(): void {
    const leaves = this.app.workspace.getLeavesOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE);
    if (leaves.length <= 1) {
      return;
    }

    const activeView = this.app.workspace.getActiveViewOfType(View);
    const activeLeaf =
      activeView?.getViewType() === ROOTED_FILE_EXPLORER_VIEW_TYPE ? activeView.leaf : null;
    const keepLeaf =
      (activeLeaf && leaves.contains(activeLeaf) ? activeLeaf : null) ??
      leaves[leaves.length - 1];

    for (const leaf of leaves) {
      if (leaf !== keepLeaf) {
        leaf.detach();
      }
    }

    refreshLeafHeader(keepLeaf);
    void this.app.workspace.requestSaveLayout();
  }
}

function refreshLeafHeader(leaf: WorkspaceLeaf): void {
  const leafWithHeader = leaf as WorkspaceLeaf & { updateHeader?: () => void };
  leafWithHeader.updateHeader?.();
}

class SetToRootSettingTab extends PluginSettingTab {
  constructor(app: Plugin["app"], private readonly plugin: SetToRootPlugin) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(t("settingsViewModeName"))
      .setDesc(t("settingsViewModeDesc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOption("single", t("settingsViewModeSingle"))
          .addOption("multiple", t("settingsViewModeMultiple"))
          .setValue(this.plugin.settings.viewMode)
          .onChange(async (value) => {
            await this.plugin.updateSettings({
              ...this.plugin.settings,
              viewMode: value === "single" ? "single" : "multiple"
            });
          });
      });

    const iconSetting = new Setting(containerEl)
      .setName(t("settingsViewIconName"))
      .setDesc(t("settingsViewIconDesc"))
      .setClass("set-to-root-icon-setting");

    const previewEl = iconSetting.controlEl.createDiv({ cls: "set-to-root-icon-preview" });
    const currentIconEl = iconSetting.infoEl.createDiv({ cls: "set-to-root-setting-feedback" });

    const renderSelectedIcon = (iconName: string): void => {
      const icon = resolveViewIcon(iconName);
      previewEl.empty();
      setIcon(previewEl, icon);
      currentIconEl.setText(tf("settingsViewIconCurrent", { icon }));
    };

    iconSetting.addButton((button) => {
      button.setButtonText(t("settingsViewIconChoose")).onClick(() => {
        new IconPickerModal(this.app, this.plugin.getRootedViewIcon(), async (icon) => {
          await this.plugin.updateSettings({
            ...this.plugin.settings,
            viewIcon: icon
          });
          renderSelectedIcon(icon);
        }).open();
      });
    });

    iconSetting.addButton((button) => {
      button.setButtonText(t("settingsViewIconReset")).onClick(async () => {
        await this.plugin.updateSettings({
          ...this.plugin.settings,
          viewIcon: DEFAULT_SETTINGS.viewIcon
        });
        renderSelectedIcon(DEFAULT_SETTINGS.viewIcon);
      });
    });

    renderSelectedIcon(this.plugin.settings.viewIcon);
  }
}

class IconPickerModal extends FuzzySuggestModal<string> {
  private readonly icons: string[];

  constructor(
    app: Plugin["app"],
    private readonly selectedIcon: string,
    private readonly onChoose: (icon: string) => void | Promise<void>
  ) {
    super(app);
    this.icons = getIconIds().slice().sort((left, right) => left.localeCompare(right));
    this.emptyStateText = t("settingsViewIconModalEmpty");
    this.setPlaceholder(t("settingsViewIconModalPlaceholder"));
  }

  override getItems(): string[] {
    return this.icons;
  }

  override getItemText(item: string): string {
    return item;
  }

  override renderSuggestion(item: { item: string }, el: HTMLElement): void {
    const row = el.createDiv({ cls: "set-to-root-icon-suggestion" });
    const iconEl = row.createDiv({ cls: "set-to-root-icon-suggestion-preview" });
    setIcon(iconEl, item.item);

    row.createDiv({
      cls: "set-to-root-icon-suggestion-label",
      text: item.item
    });

    if (item.item === this.selectedIcon) {
      row.addClass("is-selected");
    }
  }

  override onChooseItem(item: string): void {
    void this.onChoose(item);
  }
}
