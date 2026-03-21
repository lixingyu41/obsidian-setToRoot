import {
  App,
  Keymap,
  Notice,
  TAbstractFile,
  TFile,
  TFolder,
  View,
  ViewStateResult,
  WorkspaceLeaf,
  debounce
} from "obsidian";

import { t } from "./i18n";

export const ROOTED_FILE_EXPLORER_VIEW_TYPE = "set-to-root-explorer";
const FILE_EXPLORER_VIEW_TYPE = "file-explorer";

type ViewCreator = (leaf: WorkspaceLeaf) => View;

export interface RootedFileExplorerOptions {
  getIcon(): string;
}

interface InternalTreeItem {
  el: HTMLElement;
  selfEl: HTMLElement;
  file: TAbstractFile;
  parent?: InternalTreeItem | null;
  collapsed?: boolean;
  sort?: () => void;
  toggleCollapsed?: (collapsed?: boolean) => Promise<void> | void;
  setCollapsed?: (collapsed: boolean, animate?: boolean) => Promise<void> | void;
}

interface InternalTree {
  focusedItem: InternalTreeItem | null;
  selectedDoms: Set<InternalTreeItem>;
  isAllCollapsed: boolean;
  infinityScroll: {
    rootEl: {
      vChildren: {
        setChildren(children: InternalTreeItem[]): void;
      };
    };
    compute(): void;
    invalidateAll(): void;
    scrollIntoView(item: InternalTreeItem, padding?: number): void;
  };
  clearSelectedDoms(): void;
  setFocusedItem(item: InternalTreeItem | null, focus?: boolean): void;
}

interface InternalExplorerView extends View {
  activeDom: InternalTreeItem | null;
  autoRevealFile: boolean;
  containerEl: HTMLElement;
  fileItems: Record<string, InternalTreeItem>;
  navFileContainerEl: HTMLElement;
  ready: boolean;
  requestSort(): void;
  rootPath?: string | null;
  rootEmptyStateEl?: HTMLDivElement;
  rootEmptyTitleEl?: HTMLDivElement;
  rootEmptyDescriptionEl?: HTMLDivElement;
  tree: InternalTree;
  _sortQueued?: boolean;
  createAbstractFile(
    kind: "file" | "folder",
    parent: TFolder | null,
    newLeaf: boolean | string
  ): Promise<void>;
  getSortedFolderItems(folder: TFolder): InternalTreeItem[];
  handlePaste(event: ClipboardEvent): Promise<void>;
  load(): void;
  onCreateNewFolderClick(event: MouseEvent): void;
  onCreateNewNoteClick(event: MouseEvent): void;
  onDelete(file: TAbstractFile): void;
  onFileContextMenu(event: MouseEvent, file: TAbstractFile): void;
  onRename(file: TAbstractFile, oldPath: string): void;
  revealActiveFile(): void;
  revealInFolder(file: TAbstractFile): void;
  sort(): void;
}

interface PatchedExplorerView extends InternalExplorerView {
  rootPath: string | null;
  rootEmptyStateEl: HTMLDivElement;
  rootEmptyTitleEl: HTMLDivElement;
  rootEmptyDescriptionEl: HTMLDivElement;
}

export function createRootedFileExplorerView(app: App, leaf: WorkspaceLeaf): View {
  return createRootedFileExplorerViewWithOptions(app, leaf, {
    getIcon: () => "lucide-folder-closed"
  });
}

export function createRootedFileExplorerViewWithOptions(
  app: App,
  leaf: WorkspaceLeaf,
  options: RootedFileExplorerOptions
): View {
  const creator = getFileExplorerCreator(app);
  if (!creator) {
    return new RootExplorerFallbackView(leaf, options);
  }

  const baseView = creator(leaf) as InternalExplorerView;
  return patchExplorerView(baseView, options);
}

function getFileExplorerCreator(app: App): ViewCreator | null {
  const registry = (app as App & {
    viewRegistry?: unknown;
  }).viewRegistry as {
    getViewCreatorByType?: (type: string) => ViewCreator | undefined;
  };

  return registry.getViewCreatorByType?.(FILE_EXPLORER_VIEW_TYPE) ?? null;
}

function patchExplorerView(
  baseView: InternalExplorerView,
  options: RootedFileExplorerOptions
): PatchedExplorerView {
  const view = baseView as PatchedExplorerView;
  if (view.rootEmptyStateEl) {
    return view;
  }

  const originalLoad = view.load.bind(view);
  const originalGetState = view.getState.bind(view);
  const originalSetState = view.setState.bind(view);
  const originalGetDisplayText = view.getDisplayText.bind(view);
  const originalSort = view.sort.bind(view);
  const originalRevealInFolder = view.revealInFolder.bind(view);
  const originalHandlePaste = view.handlePaste.bind(view);
  const originalOnRename = view.onRename.bind(view);
  const originalOnDelete = view.onDelete.bind(view);

  initializeEmptyState(view);
  view.icon = options.getIcon();

  view.getViewType = () => ROOTED_FILE_EXPLORER_VIEW_TYPE;
  view.getIcon = () => options.getIcon();

  view.getDisplayText = () => {
    const rootFolder = getRootFolder(view);
    if (rootFolder) {
      return rootFolder.name;
    }

    return view.rootPath ? lastPathSegment(view.rootPath) : originalGetDisplayText();
  };

  view.getState = () => ({
    ...originalGetState(),
    rootPath: view.rootPath
  });

  view.setState = async (state: unknown, result: ViewStateResult) => {
    const nextState = normalizeState(state);
    view.rootPath = nextState.rootPath;
    await originalSetState(nextState, result);
    refreshRootPresentation(view, Boolean(view.rootPath));
    refreshLeafHeader(view);
  };

  view.load = () => {
    originalLoad();
    registerRootContextMenuOverride(view);
    refreshRootPresentation(view, false);
  };

  view.sort = () => {
    const rootFolder = getRootFolder(view);
    refreshRootPresentation(view, false);

    if (!rootFolder) {
      renderChildren(view, []);
      return;
    }

    if (!view.ready) {
      originalSort();
      return;
    }

    if (view.containerEl.isShown()) {
      view._sortQueued = false;
      sortNestedFolders(view);
      renderChildren(view, view.getSortedFolderItems(rootFolder));
      if (view.autoRevealFile) {
        view.revealActiveFile();
      }
      return;
    }

    if (!view._sortQueued) {
      view.containerEl.onNodeInserted(() => view.requestSort(), true);
      view._sortQueued = true;
    }
  };

  view.requestSort = debounce(() => {
    view.sort();
  }, 20, true);

  view.revealInFolder = (file: TAbstractFile) => {
    if (!isInsideRoot(view, file.path)) {
      return;
    }

    originalRevealInFolder(file);
  };

  view.handlePaste = async (event: ClipboardEvent) => {
    const originalFocused = view.tree.focusedItem;
    if (!originalFocused) {
      view.tree.focusedItem = getRootItem(view);
    }

    try {
      await originalHandlePaste(event);
    } finally {
      if (!originalFocused) {
        view.tree.focusedItem = originalFocused;
      }
    }
  };

  view.onCreateNewNoteClick = (event: MouseEvent) => {
    event.preventDefault();
    const targetFolder = getPreferredTargetFolder(view);
    if (!targetFolder) {
      new Notice(t("rootUnavailable"));
      return;
    }

    void view.createAbstractFile("file", targetFolder, Keymap.isModEvent(event));
  };

  view.onCreateNewFolderClick = (event: MouseEvent) => {
    event.preventDefault();
    const targetFolder = getPreferredTargetFolder(view);
    if (!targetFolder) {
      new Notice(t("rootUnavailable"));
      return;
    }

    void view.createAbstractFile("folder", targetFolder, false);
  };

  view.onRename = (file: TAbstractFile, oldPath: string) => {
    originalOnRename(file, oldPath);

    if (!view.rootPath) {
      return;
    }

    if (view.rootPath === oldPath) {
      view.rootPath = file.path;
    } else if (view.rootPath.startsWith(`${oldPath}/`)) {
      view.rootPath = `${file.path}${view.rootPath.slice(oldPath.length)}`;
    } else {
      return;
    }

    refreshRootPresentation(view, true);
  };

  view.onDelete = (file: TAbstractFile) => {
    originalOnDelete(file);

    if (!view.rootPath) {
      return;
    }

    if (file.path === view.rootPath || view.rootPath.startsWith(`${file.path}/`)) {
      view.rootPath = null;
      refreshRootPresentation(view, true);
    }
  };

  return view;
}

function normalizeState(state: unknown): Record<string, unknown> & { rootPath: string | null } {
  const objectState =
    state && typeof state === "object" ? ({ ...(state as Record<string, unknown>) } as Record<string, unknown>) : {};

  const rootPath = objectState.rootPath;
  objectState.rootPath = typeof rootPath === "string" && rootPath.trim().length > 0 ? rootPath : null;

  return objectState as Record<string, unknown> & { rootPath: string | null };
}

function initializeEmptyState(view: PatchedExplorerView): void {
  const emptyState = view.containerEl.createDiv({ cls: "set-to-root-empty-state" });
  const title = emptyState.createDiv({ cls: "set-to-root-empty-title" });
  const description = emptyState.createDiv({ cls: "set-to-root-empty-desc" });

  view.rootPath = null;
  view.rootEmptyStateEl = emptyState;
  view.rootEmptyTitleEl = title;
  view.rootEmptyDescriptionEl = description;
}

function registerRootContextMenuOverride(view: PatchedExplorerView): void {
  view.registerDomEvent(
    view.navFileContainerEl,
    "contextmenu",
    (event: MouseEvent & { targetNode?: EventTarget | null }) => {
      const target = event.targetNode ?? event.target;
      if (target !== view.navFileContainerEl) {
        return;
      }

      const rootFolder = getRootFolder(view);
      if (!rootFolder) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      view.tree.clearSelectedDoms();
      view.tree.setFocusedItem(null);
      openRootBlankAreaContextMenu(view, event, rootFolder);
    },
    { capture: true }
  );
}

function openRootBlankAreaContextMenu(
  view: PatchedExplorerView,
  event: MouseEvent,
  rootFolder: TFolder
): void {
  const rootItem = view.fileItems[rootFolder.path];
  if (!rootItem || rootItem.selfEl.isConnected) {
    view.onFileContextMenu(event, rootFolder);
    return;
  }

  delete view.fileItems[rootFolder.path];

  try {
    view.onFileContextMenu(event, rootFolder);
  } finally {
    view.fileItems[rootFolder.path] = rootItem;
  }
}

function refreshRootPresentation(view: PatchedExplorerView, saveLayout: boolean): void {
  const rootFolder = getRootFolder(view);
  const hasRootFolder = Boolean(rootFolder);

  view.navFileContainerEl.toggle(hasRootFolder);
  view.rootEmptyStateEl.toggle(!hasRootFolder);
  view.rootEmptyTitleEl.setText(
    view.rootPath && !hasRootFolder ? t("emptyMissingTitle") : t("emptyTitle")
  );
  view.rootEmptyDescriptionEl.setText(t("emptyDescription"));

  if (saveLayout) {
    void view.app.workspace.requestSaveLayout();
    refreshLeafHeader(view);
    view.requestSort();
  }
}

function sortNestedFolders(view: PatchedExplorerView): void {
  for (const item of Object.values(view.fileItems)) {
    if (typeof item.sort === "function") {
      item.sort();
    }
  }
}

function renderChildren(view: PatchedExplorerView, items: InternalTreeItem[]): void {
  const scrollTop = view.navFileContainerEl.scrollTop;
  view.tree.infinityScroll.rootEl.vChildren.setChildren(items);
  view.navFileContainerEl.scrollTop = scrollTop;
  view.tree.infinityScroll.compute();
}

function refreshLeafHeader(view: PatchedExplorerView): void {
  const leafWithHeader = view.leaf as WorkspaceLeaf & { updateHeader?: () => void };
  leafWithHeader.updateHeader?.();
}

function getRootFolder(view: PatchedExplorerView): TFolder | null {
  if (!view.rootPath) {
    return null;
  }

  const folder = view.app.vault.getAbstractFileByPath(view.rootPath);
  return folder instanceof TFolder ? folder : null;
}

function getRootItem(view: PatchedExplorerView): InternalTreeItem | null {
  const rootFolder = getRootFolder(view);
  if (!rootFolder) {
    return null;
  }

  return view.fileItems[rootFolder.path] ?? null;
}

function getPreferredTargetFolder(view: PatchedExplorerView): TFolder | null {
  const focusedFile = view.tree.focusedItem?.file;
  if (focusedFile instanceof TFolder) {
    return focusedFile;
  }

  if (focusedFile instanceof TFile) {
    return focusedFile.parent;
  }

  const activeFile = view.app.workspace.getActiveFile();
  if (activeFile && isInsideRoot(view, activeFile.path)) {
    return activeFile.parent;
  }

  return getRootFolder(view);
}

function isInsideRoot(view: PatchedExplorerView, path: string): boolean {
  const rootPath = view.rootPath;
  if (!rootPath) {
    return false;
  }

  return path === rootPath || path.startsWith(`${rootPath}/`);
}

function lastPathSegment(path: string): string {
  const segments = path.split("/");
  return segments[segments.length - 1] || t("viewName");
}

class RootExplorerFallbackView extends View {
  private rootPath: string | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly options: RootedFileExplorerOptions) {
    super(leaf);
    this.icon = options.getIcon();
  }

  override async onOpen(): Promise<void> {
    this.containerEl.empty();
    this.containerEl.createDiv({ cls: "set-to-root-empty-state" }, (container) => {
      container.createDiv({
        cls: "set-to-root-empty-title",
        text: t("emptyMissingTitle")
      });
      container.createDiv({
        cls: "set-to-root-empty-desc",
        text: t("emptyDescription")
      });
    });
  }

  override getViewType(): string {
    return ROOTED_FILE_EXPLORER_VIEW_TYPE;
  }

  override getIcon(): string {
    return this.options.getIcon();
  }

  override getDisplayText(): string {
    return this.rootPath ? lastPathSegment(this.rootPath) : t("viewName");
  }

  override getState(): Record<string, unknown> {
    return {
      rootPath: this.rootPath
    };
  }

  override async setState(state: unknown, _result: ViewStateResult): Promise<void> {
    const nextState = normalizeState(state);
    this.rootPath = nextState.rootPath;
  }
}
