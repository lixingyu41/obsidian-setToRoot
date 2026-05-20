import {
  ItemView,
  Menu,
  Notice,
  setIcon,
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
  private originalContainerDataType: string | null = null;
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
    this.originalContainerDataType = this.containerEl.getAttribute("data-type");
    this.containerEl.setAttribute("data-type", "file-explorer");
    this.containerEl.setAttribute("data-set-to-root-view-type", ROOTED_FILE_EXPLORER_VIEW_TYPE);
    this.containerEl.addClass("file-explorer");
    this.containerEl.addClass("set-to-root-file-explorer");
    this.contentEl.addClass("file-explorer");
    this.contentEl.addClass("set-to-root-view");
    this.addAction("lucide-refresh-cw", t("actionRefresh"), () => this.refresh());
    this.registerVaultEvents();
    this.registerWorkspaceEvents();
    this.refresh();
  }

  override async onClose(): Promise<void> {
    if (this.originalContainerDataType !== null) {
      this.containerEl.setAttribute("data-type", this.originalContainerDataType);
    } else {
      this.containerEl.removeAttribute("data-type");
    }
    this.containerEl.removeAttribute("data-set-to-root-view-type");
    this.containerEl.removeClass("file-explorer");
    this.containerEl.removeClass("set-to-root-file-explorer");
    this.contentEl.removeClass("file-explorer");
    this.contentEl.removeClass("set-to-root-view");
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

    const treeEl = this.contentEl.createDiv({
      cls: "nav-files-container node-insert-event",
      attr: {
        "aria-label": rootFolder.path || rootFolder.name,
        role: "tree"
      }
    });

    const rootEl = treeEl.createDiv({
      cls: "tree-item nav-folder mod-root set-to-root-root",
      attr: { "data-path": rootFolder.path }
    });
    const rootChildrenEl = rootEl.createDiv({
      cls: "tree-item-children nav-folder-children",
      attr: { role: "group" }
    });

    for (const child of sortFiles(rootFolder.children)) {
      this.renderNode(child, rootChildrenEl);
    }

    refreshLeafHeader(this.leaf);
  }

  private registerVaultEvents(): void {
    this.registerEvent(this.app.vault.on("create", () => this.refresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => this.handleRename(file, oldPath)));
  }

  private registerWorkspaceEvents(): void {
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
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
    this.contentEl.createDiv({ cls: "empty-state set-to-root-empty-state" }, (container) => {
      container.createDiv({
        cls: "empty-state-title set-to-root-empty-title",
        text: this.rootPath ? t("emptyMissingTitle") : t("emptyTitle")
      });
      container.createDiv({
        cls: "empty-state-description set-to-root-empty-desc",
        text: t("emptyDescription")
      });
    });
  }

  private renderNode(file: TAbstractFile, containerEl: HTMLElement): void {
    const isFolder = file instanceof TFolder;
    const isExpanded = isFolder && this.expandedFolders.has(file.path);
    const activeFile = this.app.workspace.getActiveFile();
    const isActiveFile = file instanceof TFile && activeFile?.path === file.path;

    const nodeEl = containerEl.createDiv({
      cls: [
        "tree-item",
        isFolder ? "nav-folder" : "nav-file",
        isFolder && !isExpanded ? "is-collapsed" : "",
        isActiveFile ? "is-active" : ""
      ]
        .filter(Boolean)
        .join(" "),
      attr: { "data-path": file.path }
    });

    const rowEl = nodeEl.createDiv({
      cls: [
        "tree-item-self",
        "is-clickable",
        isFolder ? "nav-folder-title" : "nav-file-title",
        isActiveFile ? "is-active" : ""
      ]
        .filter(Boolean)
        .join(" "),
      attr: {
        role: "treeitem",
        "data-path": file.path,
        "aria-selected": String(isActiveFile)
      }
    });

    if (isFolder) {
      rowEl.setAttr("aria-expanded", String(isExpanded));
      const collapseIconEl = rowEl.createDiv({ cls: "tree-item-icon collapse-icon" });
      setIcon(collapseIconEl, "right-triangle");
    }

    rowEl.createDiv({
      cls: isFolder ? "tree-item-inner nav-folder-title-content" : "tree-item-inner nav-file-title-content",
      text: file.name
    });

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

    const childrenEl = nodeEl.createDiv({
      cls: "tree-item-children nav-folder-children",
      attr: { role: "group" }
    });
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
