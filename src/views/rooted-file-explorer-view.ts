import {
  ItemView,
  Menu,
  Notice,
  TAbstractFile,
  TFile,
  TFolder,
  WorkspaceLeaf,
  type ViewStateResult
} from "obsidian";

import { ROOTED_FILE_EXPLORER_VIEW_TYPE } from "../constants";
import { t } from "../i18n";

export interface RootedFileExplorerOptions {
  getIcon(): string;
}

interface RootedExplorerState {
  rootPath: string | null;
}

export class RootedFileExplorerView extends ItemView {
  private rootPath: string | null = null;
  private readonly expandedFolderPaths = new Set<string>();

  constructor(leaf: WorkspaceLeaf, private readonly options: RootedFileExplorerOptions) {
    super(leaf);
    this.navigation = false;
    this.icon = this.options.getIcon();
  }

  override getViewType(): string {
    return ROOTED_FILE_EXPLORER_VIEW_TYPE;
  }

  override getIcon(): string {
    return this.options.getIcon();
  }

  override getDisplayText(): string {
    const rootFolder = this.getRootFolder();
    if (rootFolder) {
      return rootFolder.name || t("viewName");
    }

    return this.rootPath ? getLastPathSegment(this.rootPath) : t("viewName");
  }

  override getState(): Record<string, unknown> {
    return {
      rootPath: this.rootPath
    };
  }

  override async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    this.rootPath = normalizeState(state).rootPath;
    this.render();
  }

  override async onOpen(): Promise<void> {
    this.contentEl.addClass("set-to-root-view");
    this.addAction("lucide-refresh-cw", t("actionRefresh"), () => this.render());
    this.registerVaultEvents();
    this.render();
  }

  private registerVaultEvents(): void {
    this.registerEvent(this.app.vault.on("create", () => this.render()));
    this.registerEvent(this.app.vault.on("delete", () => this.render()));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.onVaultRename(file, oldPath)));
  }

  private onVaultRename(file: TAbstractFile, oldPath: string): void {
    if (!this.rootPath) {
      this.render();
      return;
    }

    if (this.rootPath === oldPath) {
      this.rootPath = file.path;
    } else if (this.rootPath.startsWith(`${oldPath}/`)) {
      this.rootPath = `${file.path}${this.rootPath.slice(oldPath.length)}`;
    }

    this.render();
  }

  private render(): void {
    this.icon = this.options.getIcon();
    this.contentEl.empty();

    const rootFolder = this.getRootFolder();
    if (!rootFolder) {
      this.renderEmptyState();
      refreshLeafHeader(this.leaf);
      return;
    }

    this.expandedFolderPaths.add(rootFolder.path);
    this.contentEl.createDiv({ cls: "set-to-root-root-label", text: rootFolder.path || rootFolder.name });
    const treeEl = this.contentEl.createDiv({ cls: "set-to-root-tree", attr: { role: "tree" } });

    for (const child of sortFiles(rootFolder.children)) {
      this.renderFile(child, treeEl);
    }

    refreshLeafHeader(this.leaf);
  }

  private renderEmptyState(): void {
    this.contentEl.createDiv({ cls: "set-to-root-empty-state" }, (container) => {
      container.createDiv({
        cls: "set-to-root-empty-title",
        text: this.rootPath ? t("emptyMissingTitle") : t("emptyTitle")
      });
      container.createDiv({ cls: "set-to-root-empty-desc", text: t("emptyDescription") });
    });
  }

  private renderFile(file: TAbstractFile, containerEl: HTMLElement): void {
    const itemEl = containerEl.createDiv({ cls: "set-to-root-tree-node" });
    const rowEl = itemEl.createDiv({
      cls: "set-to-root-tree-item",
      attr: {
        role: "treeitem",
        "data-path": file.path
      }
    });

    const isFolder = file instanceof TFolder;
    const isExpanded = isFolder && this.expandedFolderPaths.has(file.path);

    rowEl.createSpan({ cls: "set-to-root-tree-toggle", text: isFolder ? (isExpanded ? "▾" : "▸") : "" });
    rowEl.createSpan({ cls: isFolder ? "set-to-root-tree-folder" : "set-to-root-tree-file", text: file.name });

    rowEl.addEventListener("click", (event) => {
      event.preventDefault();
      if (file instanceof TFolder) {
        this.toggleFolder(file);
        return;
      }

      if (file instanceof TFile) {
        void this.app.workspace.openLinkText(file.path, this.rootPath ?? "", false);
      }
    });

    rowEl.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.openFileMenu(file, event);
    });

    if (!isExpanded || !(file instanceof TFolder)) {
      return;
    }

    const childrenEl = itemEl.createDiv({ cls: "set-to-root-tree-children", attr: { role: "group" } });
    for (const child of sortFiles(file.children)) {
      this.renderFile(child, childrenEl);
    }
  }

  private toggleFolder(folder: TFolder): void {
    if (this.expandedFolderPaths.has(folder.path)) {
      this.expandedFolderPaths.delete(folder.path);
    } else {
      this.expandedFolderPaths.add(folder.path);
    }

    this.render();
  }

  private openFileMenu(file: TAbstractFile, event: MouseEvent): void {
    const menu = new Menu();

    if (file instanceof TFolder) {
      menu.addItem((item) =>
        item.setTitle(t("menuSetToRoot")).setIcon("lucide-panel-left-open").onClick(() => {
          void this.setRoot(file);
        })
      );
    }

    if (file instanceof TFile) {
      menu.addItem((item) =>
        item.setTitle(t("menuOpenFile")).setIcon("lucide-file").onClick(() => {
          void this.app.workspace.openLinkText(file.path, this.rootPath ?? "", false);
        })
      );
    }

    menu.showAtMouseEvent(event);
  }

  private async setRoot(folder: TFolder): Promise<void> {
    this.rootPath = folder.path;
    this.expandedFolderPaths.clear();
    this.expandedFolderPaths.add(folder.path);
    this.render();
    await this.app.workspace.requestSaveLayout();
    new Notice(t("rootChanged"));
  }

  private getRootFolder(): TFolder | null {
    if (!this.rootPath) {
      return null;
    }

    const folder = this.app.vault.getAbstractFileByPath(this.rootPath);
    return folder instanceof TFolder ? folder : null;
  }
}

function normalizeState(state: unknown): RootedExplorerState {
  if (!state || typeof state !== "object") {
    return { rootPath: null };
  }

  const { rootPath } = state as Partial<RootedExplorerState>;
  return {
    rootPath: typeof rootPath === "string" && rootPath.trim().length > 0 ? rootPath : null
  };
}

function sortFiles(files: TAbstractFile[]): TAbstractFile[] {
  return files.slice().sort((left, right) => {
    if (left instanceof TFolder && right instanceof TFile) {
      return -1;
    }

    if (left instanceof TFile && right instanceof TFolder) {
      return 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function getLastPathSegment(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || t("viewName");
}

function refreshLeafHeader(leaf: WorkspaceLeaf): void {
  const leafWithHeader = leaf as WorkspaceLeaf & { updateHeader?: () => void };
  leafWithHeader.updateHeader?.();
}
