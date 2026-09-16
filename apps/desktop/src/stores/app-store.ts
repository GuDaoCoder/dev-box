import { create } from "zustand";

import type { LocalePreference } from "../i18n";

export type ThemePreference = "dark" | "light";

interface AppStore {
  activeViewId: string;
  locale: LocalePreference;
  paletteOpen: boolean;
  theme: ThemePreference;
  setActiveViewId: (viewId: string) => void;
  setLocale: (locale: LocalePreference) => void;
  setPaletteOpen: (open: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeViewId: "foundation",
  locale: "system",
  paletteOpen: false,
  theme: "dark",
  setActiveViewId: (activeViewId) => set({ activeViewId }),
  setLocale: (locale) => set({ locale }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setTheme: (theme) => set({ theme }),
}));
