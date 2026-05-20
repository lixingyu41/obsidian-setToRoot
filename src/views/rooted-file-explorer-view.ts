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

type NativeLikeFileItem = {
  childrenEl: HTMLElement | null;
  el: HTMLElement;
  file: TAbstractFile;
  selfEl: HTMLElement;
  titleEl: HTMLElement;
  titleInnerEl: HTMLElement;
};

interface RootedFileExplorerState {
  rootPath: string | null;
}

export class RootedFileExplorerView extends ItemView {
  fileItems: Record<string, NativeLikeFileItem> = {};

  private rootPath: string | null = null;
  private originalContainerDataType: string | null = null;
  private readonly expandedFolders = new Set<string>();
  private compatibilityRefreshFrame: number | null = null;

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
    this.containerEl.removeClass("mod-set-to-root");
    this.contentEl.removeClass("file-explorer");
    this.contentEl.removeClass("set-to-root-view");
    this.contentEl.removeClass("mod-rooted-file-explorer");
    this.contentEl.removeAttribute("data-path");
    this.fileItems = {};
    if (this.compatibilityRefreshFrame !== null) {
      window.cancelAnimationFrame(this.compatibilityRefreshFrame);
      this.compatibilityRefreshFrame = null;
    }
  }

  refresh(): void {
    this.icon = this.getViewIcon();
    this.fileItems = {};
    this.contentEl.empty();

    const rootFolder = this.getRootFolder();
    if (!rootFolder) {
      this.renderEmptyState();
      refreshLeafHeader(this.leaf);
      return;
    }

    this.containerEl.addClass("mod-set-to-root");
    this.contentEl.addClass("mod-rooted-file-explorer");
    this.contentEl.setAttr("data-path", rootFolder.path);
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
      attr: getFileAttributes(rootFolder)
    });
    const rootChildrenEl = rootEl.createDiv({
      cls: "tree-item-children nav-folder-children",
      attr: { role: "group" }
    });
    this.registerNativeLikeFileItem(rootFolder, rootEl, rootEl, rootEl, rootChildrenEl);

    for (const child of sortFiles(rootFolder.children)) {
      this.renderNode(child, rootChildrenEl);
    }

    this.queueCompatibilityRefresh();
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
      attr: getFileAttributes(file)
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
        ...getFileAttributes(file),
        "aria-selected": String(isActiveFile)
      }
    });

    if (isFolder) {
      rowEl.setAttr("aria-expanded", String(isExpanded));
      const collapseIconEl = rowEl.createDiv({ cls: "tree-item-icon collapse-icon" });
      setIcon(collapseIconEl, "right-triangle");
    }

    const titleInnerEl = rowEl.createDiv({
      cls: isFolder ? "tree-item-inner nav-folder-title-content" : "tree-item-inner nav-file-title-content",
      text: getNativeDisplayName(file)
    });
    this.registerNativeLikeFileItem(file, nodeEl, rowEl, titleInnerEl, null);

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
    const fileItem = this.fileItems[file.path];
    if (fileItem) {
      fileItem.childrenEl = childrenEl;
    }
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

    this.app.workspace.trigger("file-menu", menu, file, "file-explorer-context-menu", this.leaf);

    if (file instanceof TFile) {
      menu.addItem((item) => {
        item.setTitle(t("menuOpenFile")).setIcon("lucide-file").onClick(() => {
          void this.app.workspace.openLinkText(file.path, this.rootPath ?? "", false);
        });
      });
    }

    menu.showAtMouseEvent(event);
  }

  private registerNativeLikeFileItem(
    file: TAbstractFile,
    el: HTMLElement,
    selfEl: HTMLElement,
    titleInnerEl: HTMLElement,
    childrenEl: HTMLElement | null
  ): void {
    this.fileItems[file.path] = {
      childrenEl,
      el,
      file,
      selfEl,
      titleEl: selfEl,
      titleInnerEl
    };
  }

  private queueCompatibilityRefresh(): void {
    if (this.compatibilityRefreshFrame !== null) {
      window.cancelAnimationFrame(this.compatibilityRefreshFrame);
    }

    this.compatibilityRefreshFrame = window.requestAnimationFrame(() => {
      this.compatibilityRefreshFrame = null;
      this.app.workspace.trigger("layout-change");
    });
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

function getNativeDisplayName(file: TAbstractFile): string {
  if (file instanceof TFile && file.extension === "md") {
    return file.basename;
  }

  return file.name;
}

function getFileAttributes(file: TAbstractFile): Record<string, string> {
  const attributes: Record<string, string> = {
    "data-path": file.path
  };

  if (file instanceof TFile) {
    attributes["data-file-basename"] = file.basename;
    attributes["data-file-extension"] = file.extension;
    attributes["data-file-name"] = file.name;
    attributes["data-file-path"] = file.path;
  } else if (file instanceof TFolder) {
    attributes["data-folder-name"] = file.name;
    attributes["data-folder-path"] = file.path;
  }

  return attributes;
}

function getLastPathSegment(path: string): string {
  return path.split("/").pop() || t("viewName");
}

function refreshLeafHeader(leaf: WorkspaceLeaf): void {
  const leafWithHeader = leaf as WorkspaceLeaf & { updateHeader?: () => void };
  leafWithHeader.updateHeader?.();
}
