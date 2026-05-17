import { App, Plugin, PluginSettingTab, Setting, setIcon } from "obsidian";

import { t, tf } from "../i18n";
import { DEFAULT_SETTINGS, type SetToRootSettings, resolveViewIcon } from "../settings";
import { IconPickerModal } from "./icon-picker-modal";

export interface SetToRootSettingsController {
  settings: SetToRootSettings;
  getRootedViewIcon(): string;
  updateSettings(nextSettings: SetToRootSettings): Promise<void>;
}

export class SetToRootSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: Plugin & SetToRootSettingsController) {
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
