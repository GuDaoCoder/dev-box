import { Component, type ErrorInfo, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Blocks,
  Box,
  Command,
  Languages,
  Moon,
  Search,
  Settings,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Kbd, StatusDot } from "@devbox/ui";

import "./App.css";
import { PluginManager, type PluginManagerSnapshot } from "./app/plugin-manager";
import { SettingsView } from "./features/settings/SettingsView";
import { PluginCenterView } from "./features/plugins/PluginCenterView";
import { applyLocale } from "./i18n";
import { coreAPI } from "./ipc/client";
import { builtInPlugins } from "./plugins.generated";
import { useAppStore } from "./stores/app-store";

const pluginManager = new PluginManager(builtInPlugins);

class PluginErrorBoundary extends Component<
  { children: ReactNode; fallback: string },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("插件界面渲染失败", error, info);
  }

  render() {
    if (this.state.failed) {
      return <div className="error-state">{this.props.fallback}</div>;
    }
    return this.props.children;
  }
}

function usePluginSnapshot(): PluginManagerSnapshot {
  const [snapshot, setSnapshot] = useState(() => pluginManager.snapshot());
  useEffect(() => pluginManager.subscribe(() => setSnapshot(pluginManager.snapshot())), []);
  return snapshot;
}

function CommandPalette({ snapshot }: { snapshot: PluginManagerSnapshot }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const setActiveViewId = useAppStore((state) => state.setActiveViewId);
  const setOpen = useAppStore((state) => state.setPaletteOpen);
  const items = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return [
      ...snapshot.views.map((view) => ({
        id: `view:${view.id}`,
        label: t(view.titleKey),
        run: () => setActiveViewId(view.id),
      })),
      ...snapshot.commands.map((command) => ({
        id: `command:${command.id}`,
        label: t(command.titleKey),
        run: command.run,
      })),
    ].filter((item) => item.label.toLocaleLowerCase().includes(normalized));
  }, [query, setActiveViewId, snapshot, t]);

  return (
    <div className="palette-backdrop" onMouseDown={() => setOpen(false)} role="presentation">
      <section
        aria-label={t("palette.title")}
        aria-modal="true"
        className="command-palette"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="palette-input-row">
          <Search aria-hidden="true" size={18} />
          <input
            autoFocus
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={t("palette.placeholder")}
            value={query}
          />
          <button aria-label={t("actions.close")} onClick={() => setOpen(false)} type="button">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="palette-results">
          {items.length ? (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  void item.run();
                  setOpen(false);
                }}
                type="button"
              >
                <Command aria-hidden="true" size={16} />
                {item.label}
              </button>
            ))
          ) : (
            <p>{t("palette.empty")}</p>
          )}
        </div>
      </section>
    </div>
  );
}

function App() {
  const { t, i18n } = useTranslation();
  const snapshot = usePluginSnapshot();
  const activeViewId = useAppStore((state) => state.activeViewId);
  const setActiveViewId = useAppStore((state) => state.setActiveViewId);
  const paletteOpen = useAppStore((state) => state.paletteOpen);
  const setPaletteOpen = useAppStore((state) => state.setPaletteOpen);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLocale = useAppStore((state) => state.setLocale);
  const activeView = snapshot.views.find((view) => view.id === activeViewId);
  const toolsActive = activeViewId !== "settings" && activeViewId !== "plugin-center";
  const activeCount = snapshot.states.filter((state) => state.status === "active").length;

  useEffect(() => {
    void pluginManager.activateAll();
    void Promise.all([coreAPI.settings.get("ui.locale"), coreAPI.settings.get("ui.theme")])
      .then(async ([savedLocale, savedTheme]) => {
        const locale = savedLocale?.value;
        if (locale === "system" || locale === "zh-CN" || locale === "en-US") {
          setLocale(locale);
          await applyLocale(locale);
        }
        const nextTheme = savedTheme?.value;
        if (nextTheme === "dark" || nextTheme === "light") {
          setTheme(nextTheme);
          document.documentElement.dataset.theme = nextTheme;
        }
      })
      .catch((error: unknown) => console.error("读取应用设置失败", error));
  }, [setLocale, setTheme]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!useAppStore.getState().paletteOpen);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setPaletteOpen]);

  return (
    <main className="app-shell">
      <header className="titlebar">
        <span className="brand-mark" aria-hidden="true">
          D
        </span>
        <div className="brand-copy">
          <strong>{t("app.name")}</strong>
          <span>{t("app.tagline")}</span>
        </div>
        <button className="search-trigger" onClick={() => setPaletteOpen(true)} type="button">
          <Search aria-hidden="true" size={16} />
          <span>{t("actions.search")}</span>
          <Kbd>⌘ K</Kbd>
        </button>
        <span className="locale-indicator" title={i18n.language}>
          <Languages aria-hidden="true" size={16} />
          {i18n.language === "zh-CN" ? "中" : "EN"}
        </span>
        {theme === "dark" ? (
          <Moon aria-hidden="true" size={16} />
        ) : (
          <Sun aria-hidden="true" size={16} />
        )}
      </header>

      <div className="workbench">
        <aside className="activity-rail" aria-label={t("navigation.tools")}>
          <button
            aria-label={t("navigation.tools")}
            className={toolsActive ? "active" : ""}
            onClick={() => setActiveViewId(snapshot.views[0]?.id ?? "foundation")}
            type="button"
          >
            <Wrench aria-hidden="true" />
          </button>
          <button
            aria-label={t("navigation.pluginCenter")}
            className={activeViewId === "plugin-center" ? "active" : ""}
            onClick={() => setActiveViewId("plugin-center")}
            type="button"
          >
            <Blocks aria-hidden="true" />
          </button>
          <span className="rail-spacer" />
          <button
            aria-label={t("navigation.settings")}
            className={activeViewId === "settings" ? "active" : ""}
            onClick={() => setActiveViewId("settings")}
            type="button"
          >
            <Settings aria-hidden="true" />
          </button>
        </aside>

        <aside className="navigation-sidebar">
          <p className="nav-section-title">
            {t(activeViewId === "plugin-center" ? "navigation.pluginCenter" : "navigation.tools")}
          </p>
          {activeViewId === "plugin-center" ? (
            <div className="sidebar-context-copy">{t("pluginCenter.sidebar")}</div>
          ) : (
            <nav>
              {snapshot.views.map((view) => (
                <button
                  className={activeViewId === view.id ? "active" : ""}
                  key={`${view.pluginId}:${view.id}`}
                  onClick={() => setActiveViewId(view.id)}
                  type="button"
                >
                  <Box aria-hidden="true" size={17} />
                  {t(view.titleKey)}
                </button>
              ))}
            </nav>
          )}
          <div className="sidebar-note">{t("status.milestone")}</div>
        </aside>

        <section className="main-workspace">
          {activeViewId === "settings" ? (
            <SettingsView />
          ) : activeViewId === "plugin-center" ? (
            <PluginCenterView />
          ) : activeView ? (
            <PluginErrorBoundary fallback={t("errors.pluginRender")} key={activeView.id}>
              <activeView.component />
            </PluginErrorBoundary>
          ) : (
            <div className="loading-state">{t("status.ready")}</div>
          )}
        </section>
      </div>

      <footer className="statusbar">
        <StatusDot />
        <span>{t("status.ready")}</span>
        <span className="status-separator" />
        <span>{t("status.plugins", { count: activeCount })}</span>
        <span className="status-spacer" />
        <span>v0.1.0</span>
      </footer>
      {paletteOpen ? <CommandPalette snapshot={snapshot} /> : null}
    </main>
  );
}

export default App;
