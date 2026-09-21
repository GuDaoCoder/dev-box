import { Languages, Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@devbox/ui";

import { applyLocale, type LocalePreference } from "../../i18n";
import { coreAPI } from "../../ipc/client";
import { useAppStore, type ThemePreference } from "../../stores/app-store";

export function SettingsView() {
  const { t } = useTranslation("settings");
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);

  async function changeLocale(nextLocale: LocalePreference) {
    setLocale(nextLocale);
    await applyLocale(nextLocale);
    await coreAPI.settings.update("ui.locale", nextLocale);
  }

  function changeTheme(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    void coreAPI.settings.update("ui.theme", nextTheme);
  }

  return (
    <section className="plugin-page" aria-labelledby="settings-title">
      <header className="page-header">
        <div>
          <p className="page-eyebrow">DEVBOX</p>
          <h1 id="settings-title">{t("title")}</h1>
        </div>
      </header>

      <div className="settings-stack">
        <article className="surface-card setting-card">
          <Languages aria-hidden="true" />
          <div className="setting-copy">
            <h2>{t("language")}</h2>
          </div>
          <select
            aria-label={t("language")}
            className="select-input"
            onChange={(event) => void changeLocale(event.currentTarget.value as LocalePreference)}
            value={locale}
          >
            <option value="system">{t("system")}</option>
            <option value="zh-CN">{t("chinese")}</option>
            <option value="en-US">{t("english")}</option>
          </select>
        </article>

        <article className="surface-card setting-card">
          {theme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          <div className="setting-copy">
            <h2>{t("appearance")}</h2>
          </div>
          <div className="segmented-control" aria-label={t("theme")} role="group">
            <Button
              aria-pressed={theme === "dark"}
              className={theme === "dark" ? "is-selected" : undefined}
              onClick={() => changeTheme("dark")}
              variant="ghost"
            >
              {t("dark")}
            </Button>
            <Button
              aria-pressed={theme === "light"}
              className={theme === "light" ? "is-selected" : undefined}
              onClick={() => changeTheme("light")}
              variant="ghost"
            >
              {t("light")}
            </Button>
          </div>
        </article>
      </div>
    </section>
  );
}
