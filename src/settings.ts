import { getIconIds } from "obsidian";

export type RootedViewMode = "single" | "multiple";

export interface SetToRootSettings {
  viewMode: RootedViewMode;
  viewIcon: string;
}

export const DEFAULT_SETTINGS: SetToRootSettings = {
  viewMode: "multiple",
  viewIcon: "lucide-folder-closed"
};

export function normalizeSettings(data: unknown): SetToRootSettings {
  const settings =
    data && typeof data === "object" ? ({ ...DEFAULT_SETTINGS, ...(data as Partial<SetToRootSettings>) } as Partial<SetToRootSettings>) : DEFAULT_SETTINGS;

  return {
    viewMode: settings.viewMode === "single" ? "single" : "multiple",
    viewIcon: resolveViewIcon(settings.viewIcon)
  };
}

export function resolveViewIcon(iconName: string | null | undefined): string {
  const normalized = iconName?.trim();
  if (!normalized) {
    return DEFAULT_SETTINGS.viewIcon;
  }

  return isValidViewIcon(normalized) ? normalized : DEFAULT_SETTINGS.viewIcon;
}

export function isValidViewIcon(iconName: string): boolean {
  return getIconIds().contains(iconName);
}
