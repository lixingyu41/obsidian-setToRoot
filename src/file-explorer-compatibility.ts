import { Plugin, debounce } from "obsidian";

import { ROOTED_FILE_EXPLORER_VIEW_TYPE } from "./rooted-file-explorer";

const FILE_EXPLORER_VIEW_TYPE = "file-explorer";
const STRUCTURAL_DATA_ATTRIBUTES = new Set([
  "data-file-basename",
  "data-file-extension",
  "data-file-name",
  "data-file-path",
  "data-folder-name",
  "data-folder-path",
  "data-path",
  "data-tooltip-position",
  "data-type"
]);

interface FileExplorerItemLike {
  selfEl?: HTMLElement;
  titleEl?: HTMLElement;
}

interface FileExplorerViewLike {
  containerEl?: HTMLElement;
  fileItems?: Record<string, FileExplorerItemLike | undefined>;
  headerDom?: {
    navButtonsEl?: HTMLElement;
  };
}

export class FileExplorerCompatibilityBridge {
  private readonly mirroredAttributesByElement = new WeakMap<HTMLElement, Set<string>>();
  private readonly observersByContainer = new Map<HTMLElement, MutationObserver>();
  private readonly sync = debounce(() => this.syncNow(), 50, true);

  constructor(private readonly plugin: Plugin) {}

  start(): void {
    this.plugin.app.workspace.onLayoutReady(() => {
      this.refreshObservers();
      this.sync();
    });

    this.plugin.registerEvent(
      this.plugin.app.workspace.on("layout-change", () => {
        this.refreshObservers();
        this.sync();
      })
    );
    this.plugin.registerEvent(this.plugin.app.workspace.on("file-open", () => this.sync()));
    this.plugin.registerEvent(this.plugin.app.vault.on("create", () => this.sync()));
    this.plugin.registerEvent(this.plugin.app.vault.on("delete", () => this.sync()));
    this.plugin.registerEvent(this.plugin.app.vault.on("rename", () => this.sync()));
    this.plugin.registerInterval(
      window.setInterval(() => {
        this.refreshObservers();
        this.sync();
      }, 2000)
    );
    this.plugin.register(() => this.disconnectObservers());
  }

  syncNow(): void {
    const sourceViews = this.getViewsOfType(FILE_EXPLORER_VIEW_TYPE);
    const targetViews = this.getViewsOfType(ROOTED_FILE_EXPLORER_VIEW_TYPE);

    if (sourceViews.length === 0 || targetViews.length === 0) {
      return;
    }

    const attributesByPath = this.getSourceAttributesByPath(sourceViews);
    const headerAttributes = this.getHeaderAttributes(sourceViews);

    for (const targetView of targetViews) {
      this.mirrorFileItemAttributes(targetView, attributesByPath);
      this.mirrorHeaderAttributes(targetView, headerAttributes);
    }
  }

  private refreshObservers(): void {
    const sourceContainers = new Set(
      this.getViewsOfType(FILE_EXPLORER_VIEW_TYPE)
        .map((view) => view.containerEl)
        .filter(isHTMLElement)
    );

    for (const [container, observer] of this.observersByContainer) {
      if (!sourceContainers.has(container)) {
        observer.disconnect();
        this.observersByContainer.delete(container);
      }
    }

    for (const container of sourceContainers) {
      if (this.observersByContainer.has(container)) {
        continue;
      }

      const observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => isMirrorAttribute(mutation.attributeName))) {
          this.sync();
        }
      });
      observer.observe(container, {
        attributes: true,
        subtree: true
      });
      this.observersByContainer.set(container, observer);
    }
  }

  private disconnectObservers(): void {
    for (const observer of this.observersByContainer.values()) {
      observer.disconnect();
    }
    this.observersByContainer.clear();
  }

  private getViewsOfType(type: string): FileExplorerViewLike[] {
    return this.plugin.app.workspace
      .getLeavesOfType(type)
      .map((leaf) => leaf.view as FileExplorerViewLike)
      .filter((view) => view.containerEl instanceof HTMLElement && Boolean(view.fileItems));
  }

  private getSourceAttributesByPath(sourceViews: FileExplorerViewLike[]): Map<string, Map<string, string>> {
    const attributesByPath = new Map<string, Map<string, string>>();

    for (const sourceView of sourceViews) {
      for (const [path, item] of Object.entries(sourceView.fileItems ?? {})) {
        const el = getItemLabelElement(item);
        if (!el) {
          continue;
        }

        const attributes = getMirrorAttributes(el);
        if (attributes.size > 0) {
          attributesByPath.set(path, attributes);
        }
      }
    }

    return attributesByPath;
  }

  private getHeaderAttributes(sourceViews: FileExplorerViewLike[]): Map<string, string> {
    for (const sourceView of sourceViews) {
      const attributes = getMirrorAttributes(sourceView.headerDom?.navButtonsEl);
      if (attributes.size > 0) {
        return attributes;
      }
    }

    return new Map();
  }

  private mirrorFileItemAttributes(
    targetView: FileExplorerViewLike,
    attributesByPath: Map<string, Map<string, string>>
  ): void {
    for (const [path, item] of Object.entries(targetView.fileItems ?? {})) {
      const el = getItemLabelElement(item);
      if (!el) {
        continue;
      }

      this.applyMirroredAttributes(el, attributesByPath.get(path) ?? new Map());
    }
  }

  private mirrorHeaderAttributes(targetView: FileExplorerViewLike, attributes: Map<string, string>): void {
    const headerEl = targetView.headerDom?.navButtonsEl;
    if (!headerEl) {
      return;
    }

    this.applyMirroredAttributes(headerEl, attributes);
  }

  private applyMirroredAttributes(targetEl: HTMLElement, nextAttributes: Map<string, string>): void {
    const previousAttributeNames = this.mirroredAttributesByElement.get(targetEl) ?? new Set<string>();

    for (const name of previousAttributeNames) {
      if (!nextAttributes.has(name)) {
        targetEl.removeAttribute(name);
      }
    }

    for (const [name, value] of nextAttributes) {
      targetEl.setAttribute(name, value);
    }

    this.mirroredAttributesByElement.set(targetEl, new Set(nextAttributes.keys()));
  }
}

function getItemLabelElement(item: FileExplorerItemLike | undefined): HTMLElement | null {
  return item?.titleEl ?? item?.selfEl ?? null;
}

function getMirrorAttributes(el: HTMLElement | undefined): Map<string, string> {
  const attributes = new Map<string, string>();
  if (!el) {
    return attributes;
  }

  for (const attribute of Array.from(el.attributes)) {
    if (isMirrorAttribute(attribute.name)) {
      attributes.set(attribute.name, attribute.value);
    }
  }

  return attributes;
}

function isMirrorAttribute(name: string | null): boolean {
  return Boolean(name?.startsWith("data-") && !STRUCTURAL_DATA_ATTRIBUTES.has(name));
}

function isHTMLElement(value: HTMLElement | undefined): value is HTMLElement {
  return value instanceof HTMLElement;
}
