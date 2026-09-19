import { create } from "zustand";

import type { LocalePreference } from "../i18n";

export type ThemePreference = "dark" | "light";

interface AppStore {
  activeTabId?: string;
  locale: LocalePreference;
  paletteOpen: boolean;
  tabs: string[];
  theme: ThemePreference;
  closeAllTabs: () => void;
  closeOtherTabs: (tabId: string) => void;
  closeTab: (tabId: string) => void;
  closeTabsToRight: (tabId: string) => void;
  openTab: (tabId: string) => void;
  reorderTab: (sourceId: string, targetId: string) => void;
  setActiveTabId: (tabId?: string) => void;
  setLocale: (locale: LocalePreference) => void;
  setPaletteOpen: (open: boolean) => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  activeTabId: "tool.json",
  locale: "system",
  paletteOpen: false,
  tabs: ["tool.json"],
  theme: "dark",
  closeAllTabs: () => set({ activeTabId: undefined, tabs: [] }),
  closeOtherTabs: (tabId) =>
    set((state) => (state.tabs.includes(tabId) ? { activeTabId: tabId, tabs: [tabId] } : state)),
  closeTab: (tabId) =>
    set((state) => {
      const index = state.tabs.indexOf(tabId);
      const tabs = state.tabs.filter((id) => id !== tabId);
      if (state.activeTabId !== tabId) return { tabs };
      return { tabs, activeTabId: tabs[Math.min(index, tabs.length - 1)] };
    }),
  closeTabsToRight: (tabId) =>
    set((state) => {
      const index = state.tabs.indexOf(tabId);
      if (index < 0 || index === state.tabs.length - 1) return state;
      const tabs = state.tabs.slice(0, index + 1);
      return {
        tabs,
        activeTabId:
          state.activeTabId && tabs.includes(state.activeTabId) ? state.activeTabId : tabId,
      };
    }),
  openTab: (tabId) =>
    set((state) => ({
      activeTabId: tabId,
      tabs: state.tabs.includes(tabId) ? state.tabs : [...state.tabs, tabId],
    })),
  reorderTab: (sourceId, targetId) =>
    set((state) => {
      const sourceIndex = state.tabs.indexOf(sourceId);
      const targetIndex = state.tabs.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return state;
      const tabs = [...state.tabs];
      tabs.splice(sourceIndex, 1);
      tabs.splice(targetIndex, 0, sourceId);
      return { tabs };
    }),
  setActiveTabId: (activeTabId) => set({ activeTabId }),
  setLocale: (locale) => set({ locale }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  setTheme: (theme) => set({ theme }),
}));
