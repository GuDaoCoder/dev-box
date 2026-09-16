import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import type { SupportedLocale } from "@devbox/plugin-sdk";

import commonEnUS from "./locales/en-US/common.json";
import errorsEnUS from "./locales/en-US/errors.json";
import settingsEnUS from "./locales/en-US/settings.json";
import commonZhCN from "./locales/zh-CN/common.json";
import errorsZhCN from "./locales/zh-CN/errors.json";
import settingsZhCN from "./locales/zh-CN/settings.json";

export type LocalePreference = "system" | SupportedLocale;

export function resolveSystemLocale(language = navigator.language): SupportedLocale {
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

void i18n.use(initReactI18next).init({
  resources: {
    "en-US": { common: commonEnUS, errors: errorsEnUS, settings: settingsEnUS },
    "zh-CN": { common: commonZhCN, errors: errorsZhCN, settings: settingsZhCN },
  },
  lng: resolveSystemLocale(),
  fallbackLng: "en-US",
  supportedLngs: ["zh-CN", "en-US"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

export async function applyLocale(preference: LocalePreference): Promise<void> {
  await i18n.changeLanguage(preference === "system" ? resolveSystemLocale() : preference);
  document.documentElement.lang = i18n.language;
}

export default i18n;
