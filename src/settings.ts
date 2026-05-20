import { getIconIds } from "obsidian";

export type RootedViewMode = "single" | "multiple";
export type RootedOpenLocation = "tab" | "leaf";

export interface SetToRootSettings {
  viewMode: RootedViewMode;
  openLocation: RootedOpenLocation;
  viewIcon: string;
}

export const DEFAULT_SETTINGS: SetToRootSettings = {
  viewMode: "multiple",
  openLocation: "tab",
  viewIcon: "lucide-folder-closed"
};

export function normalizeSettings(data: unknown): SetToRootSettings {
  const settings = getSettingsObject(data);

  return {
    viewMode: settings.viewMode === "single" ? "single" : "multiple",
    openLocation: settings.openLocation === "leaf" ? "leaf" : "tab",
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

function getSettingsObject(data: unknown): Partial<SetToRootSettings> {
  if (!data || typeof data !== "object") {
    return DEFAULT_SETTINGS;
  }

  return {
    ...DEFAULT_SETTINGS,
    ...(data as Partial<SetToRootSettings>)
  };
}

function isValidViewIcon(iconName: string): boolean {
  return getIconIds().includes(iconName);
}
