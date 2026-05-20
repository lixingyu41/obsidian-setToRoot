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

interface RootedFileExplorerState {
  rootPath: string | null;
}

export class RootedFileExplorerView extends ItemView {
  private rootPath: string | null = null;
  private readonly expandedFolders = new Set<string>();

  constructor(leaf: WorkspaceLeaf, private readonly getViewIcon: () => string) {
    super(leaf);
    this.navigation = false;
  }

  override getViewType(): string {
    return ROOTED_FILE_EXPLORER_VIEW_TYPE;
  }

  override getIcon(): string {
    return this.getViewIcon();
  }

  override getDisplayText(): string {
    const rootFolder = this.getRootFolder();
    if (rootFolder) {
      return rootFolder.name || t("viewName");
    }

    return this.rootPath ? getLastPathSegment(this.rootPath) : t("viewName");
  }

  override getState(): Record<string, unknown> {
    return { rootPath: this.rootPath };
  }

  override async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    this.rootPath = normalizeState(state).rootPath;
    this.refresh();
  }

  override async onOpen(): Promise<void> {
    this.contentEl.addClass("set-to-root-view");
    this.addAction("lucide-refresh-cw", t("actionRefresh"), () => this.refresh());
    this.registerVaultEvents();
    this.refresh();
  }

  refresh(): void {
    this.icon = this.getViewIcon();
    this.contentEl.empty();

    const rootFolder = this.getRootFolder();
    if (!rootFolder) {
      this.renderEmptyState();
      refreshLeafHeader(this.leaf);
      return;
    }

    this.expandedFolders.add(rootFolder.path);
    this.contentEl.createDiv({ cls: "set-to-root-root-label", text: rootFolder.path || rootFolder.name });

    const treeEl = this.contentEl.createDiv({ cls: "set-to-root-tree", attr: { role: "tree" } });
    for (const child of sortFiles(rootFolder.children)) {
      this.renderNode(child, treeEl);
    }

    refreshLeafHeader(this.leaf);
  }

  private registerVaultEvents(): void {
    this.registerEvent(this.app.vault.on("create", () => this.refresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.handleRename(file, oldPath)));
  }

  private handleRename(file: TAbstractFile, oldPath: string): void {
    if (!this.rootPath) {
      this.refresh();
      return;
    }

    if (this.rootPath === oldPath) {
      this.rootPath = file.path;
    } else if (this.rootPath.startsWith(`${oldPath}/`)) {
      this.rootPath = `${file.path}${this.rootPath.slice(oldPath.length)}`;
    }

    this.refresh();
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

  private renderNode(file: TAbstractFile, containerEl: HTMLElement): void {
    const nodeEl = containerEl.createDiv({ cls: "set-to-root-tree-node" });
    const isFolder = file instanceof TFolder;
    const isExpanded = isFolder && this.expandedFolders.has(file.path);

    const rowEl = nodeEl.createDiv({
      cls: "set-to-root-tree-item",
      attr: {
        role: "treeitem",
        "data-path": file.path
      }
    });

    if (isFolder) {
      rowEl.setAttr("aria-expanded", String(isExpanded));
    }

    rowEl.createSpan({ cls: "set-to-root-tree-toggle", text: isFolder ? (isExpanded ? "▾" : "▸") : "" });
    rowEl.createSpan({ cls: isFolder ? "set-to-root-tree-folder" : "set-to-root-tree-file", text: file.name });

    rowEl.addEventListener("click", (event) => {
      event.preventDefault();
      this.handleNodeClick(file);
    });

    rowEl.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      this.showContextMenu(file, event);
    });

    if (!isExpanded || !(file instanceof TFolder)) {
      return;
    }

    const childrenEl = nodeEl.createDiv({ cls: "set-to-root-tree-children", attr: { role: "group" } });
    for (const child of sortFiles(file.children)) {
      this.renderNode(child, childrenEl);
    }
  }

  private handleNodeClick(file: TAbstractFile): void {
    if (file instanceof TFolder) {
      this.toggleFolder(file);
      return;
    }

    if (file instanceof TFile) {
      void this.app.workspace.openLinkText(file.path, this.rootPath ?? "", false);
    }
  }

  private toggleFolder(folder: TFolder): void {
    if (this.expandedFolders.has(folder.path)) {
      this.expandedFolders.delete(folder.path);
    } else {
      this.expandedFolders.add(folder.path);
    }

    this.refresh();
  }

  private showContextMenu(file: TAbstractFile, event: MouseEvent): void {
    const menu = new Menu();

    if (file instanceof TFolder) {
      menu.addItem((item) => {
        item.setTitle(t("menuSetToRoot")).setIcon("lucide-panel-left-open").onClick(() => {
          void this.setRoot(file);
        });
      });
    }

    if (file instanceof TFile) {
      menu.addItem((item) => {
        item.setTitle(t("menuOpenFile")).setIcon("lucide-file").onClick(() => {
          void this.app.workspace.openLinkText(file.path, this.rootPath ?? "", false);
        });
      });
    }

    menu.showAtMouseEvent(event);
  }

  private async setRoot(folder: TFolder): Promise<void> {
    this.rootPath = folder.path;
    this.expandedFolders.clear();
    this.expandedFolders.add(folder.path);
    this.refresh();
    await this.app.workspace.requestSaveLayout();
    new Notice(t("rootChanged"));
  }

  private getRootFolder(): TFolder | null {
    if (!this.rootPath) {
      return null;
    }

    const file = this.app.vault.getAbstractFileByPath(this.rootPath);
    return file instanceof TFolder ? file : null;
  }
}

function normalizeState(state: unknown): RootedFileExplorerState {
  if (!state || typeof state !== "object") {
    return { rootPath: null };
  }

  const rootPath = (state as Partial<RootedFileExplorerState>).rootPath;
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
  return path.split("/").pop() || t("viewName");
}

function refreshLeafHeader(leaf: WorkspaceLeaf): void {
  const leafWithHeader = leaf as WorkspaceLeaf & { updateHeader?: () => void };
  leafWithHeader.updateHeader?.();
}
