import { getLanguage } from "obsidian";

type LocaleKey =
  | "menuSetToRoot"
  | "viewName"
  | "emptyTitle"
  | "emptyMissingTitle"
  | "emptyDescription"
  | "rootUnavailable"
  | "rootChanged"
  | "actionRefresh"
  | "menuOpenFile"
  | "settingsViewModeName"
  | "settingsViewModeDesc"
  | "settingsViewModeSingle"
  | "settingsViewModeMultiple"
  | "settingsViewIconName"
  | "settingsViewIconDesc"
  | "settingsViewIconChoose"
  | "settingsViewIconReset"
  | "settingsViewIconCurrent"
  | "settingsViewIconModalPlaceholder"
  | "settingsViewIconModalEmpty";

type LocaleTable = Record<LocaleKey, string>;

const ENGLISH: LocaleTable = {
  menuSetToRoot: "Set to root",
  viewName: "Set to root",
  emptyTitle: "No root folder set",
  emptyMissingTitle: "The configured root folder is unavailable",
  emptyDescription: 'Right-click a folder in the default file explorer and choose "Set to root".',
  rootUnavailable: "The selected root folder is unavailable.",
  rootChanged: "Root folder changed.",
  actionRefresh: "Refresh",
  menuOpenFile: "Open file",
  settingsViewModeName: "Rooted view instances",
  settingsViewModeDesc: "Choose whether Set to root reuses one rooted explorer or opens additional ones.",
  settingsViewModeSingle: "Single view",
  settingsViewModeMultiple: "Multiple views",
  settingsViewIconName: "Rooted view icon",
  settingsViewIconDesc: "Choose the icon used by rooted explorer tabs.",
  settingsViewIconChoose: "Choose icon",
  settingsViewIconReset: "Reset",
  settingsViewIconCurrent: "Current icon: {{icon}}",
  settingsViewIconModalPlaceholder: "Search icons",
  settingsViewIconModalEmpty: "No icons found."
};

const CHINESE: LocaleTable = {
  menuSetToRoot: "设置为根目录",
  viewName: "设置为根目录",
  emptyTitle: "未设置根目录",
  emptyMissingTitle: "已设置的根目录不可用",
  emptyDescription: "请在默认文件列表中右键文件夹，然后选择“设置为根目录”。",
  rootUnavailable: "所选根目录不可用。",
  rootChanged: "根目录已更改。",
  actionRefresh: "刷新",
  menuOpenFile: "打开文件",
  settingsViewModeName: "根目录视图数量",
  settingsViewModeDesc: "选择“设置为根目录”时，是复用单个 rooted 视图，还是继续打开多个视图。",
  settingsViewModeSingle: "只保留一个视图",
  settingsViewModeMultiple: "允许多个视图",
  settingsViewIconName: "根目录视图图标",
  settingsViewIconDesc: "选择 rooted 视图标签使用的图标。",
  settingsViewIconChoose: "选择图标",
  settingsViewIconReset: "恢复默认",
  settingsViewIconCurrent: "当前图标：{{icon}}",
  settingsViewIconModalPlaceholder: "搜索图标",
  settingsViewIconModalEmpty: "没有匹配的图标。"
};

function getTable(): LocaleTable {
  return getLanguage().toLowerCase().startsWith("zh") ? CHINESE : ENGLISH;
}

export function t(key: LocaleKey): string {
  return getTable()[key];
}

export function tf(key: LocaleKey, values: Record<string, string>): string {
  let text = t(key);
  for (const [name, value] of Object.entries(values)) {
    text = text.replace(`{{${name}}}`, value);
  }
  return text;
}
