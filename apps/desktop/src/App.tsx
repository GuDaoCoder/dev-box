import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ChevronDown, ChevronRight, Command, Moon, Search, Sun, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { InstalledPlugin } from "@devbox/ipc-contracts";
import { Kbd, StatusDot } from "@devbox/ui";

import "./App.css";
import {
  builtinFeatures,
  featureCategories,
  pluginIcons,
  type BuiltinFeature,
} from "./app/features";
import { InstalledPluginPanel } from "./features/plugins/InstalledPluginPanel";
import { PluginCenterView } from "./features/plugins/PluginCenterView";
import { applyLocale } from "./i18n";
import { coreAPI, pluginAdminAPI } from "./ipc/client";
import { useAppStore } from "./stores/app-store";

type WorkspaceFeature = {
  id: string;
  title: string;
  categoryId: string;
  categoryTitle: string;
  categoryOrder: number;
  order: number;
  icon: ComponentType<{ "aria-hidden"?: boolean | "true"; size?: number }>;
  builtin?: BuiltinFeature;
  plugin?: InstalledPlugin;
  pluginViewId?: string;
};

class FeatureErrorBoundary extends Component<
  { children: ReactNode; fallback: string },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("功能界面渲染失败", error, info);
  }
  render() {
    return this.state.failed ? (
      <div className="error-state">{this.props.fallback}</div>
    ) : (
      this.props.children
    );
  }
}

function pluginFeatureId(pluginId: string, viewId: string) {
  return `plugin:${pluginId}:${viewId}`;
}

function CommandPalette({ features }: { features: WorkspaceFeature[] }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const openTab = useAppStore((state) => state.openTab);
  const setOpen = useAppStore((state) => state.setPaletteOpen);
  const items = features.filter((feature) =>
    feature.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
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
                  openTab(item.id);
                  setOpen(false);
                }}
                type="button"
              >
                <Command aria-hidden="true" size={16} />
                {item.title}
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
  const activeTabId = useAppStore((state) => state.activeTabId);
  const tabs = useAppStore((state) => state.tabs);
  const closeTab = useAppStore((state) => state.closeTab);
  const openTab = useAppStore((state) => state.openTab);
  const reorderTab = useAppStore((state) => state.reorderTab);
  const paletteOpen = useAppStore((state) => state.paletteOpen);
  const setPaletteOpen = useAppStore((state) => state.setPaletteOpen);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const setLocale = useAppStore((state) => state.setLocale);
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [expanded, setExpanded] = useState(() => new Set(featureCategories.map((item) => item.id)));
  const [draggedTab, setDraggedTab] = useState<string>();

  useEffect(() => {
    void Promise.all([
      coreAPI.settings.get("ui.locale"),
      coreAPI.settings.get("ui.theme"),
      pluginAdminAPI.list(),
    ])
      .then(async ([savedLocale, savedTheme, installed]) => {
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
        setPlugins(installed);
      })
      .catch((error: unknown) => console.error("读取应用状态失败", error));
  }, [setLocale, setTheme]);

  const features = useMemo<WorkspaceFeature[]>(() => {
    const categoryById = new Map(featureCategories.map((category) => [category.id, category]));
    const builtins = builtinFeatures.map((feature) => {
      const category = categoryById.get(feature.categoryId)!;
      return {
        ...feature,
        title: t(feature.titleKey),
        categoryTitle: t(category.titleKey),
        categoryOrder: category.order,
        builtin: feature,
      } satisfies WorkspaceFeature;
    });
    const pluginFeatures = plugins.flatMap((plugin) =>
      plugin.enabled
        ? plugin.manifest.contributes.views.map((view) => ({
            id: pluginFeatureId(plugin.id, view.id),
            title:
              plugin.manifest.contributes.views.length === 1
                ? plugin.name
                : `${plugin.name} · ${view.id}`,
            categoryId: view.category.id,
            categoryTitle: view.category.title[i18n.language === "zh-CN" ? "zh-CN" : "en-US"],
            categoryOrder: view.category.order,
            order: view.order,
            icon: pluginIcons[view.icon] ?? pluginIcons.plug!,
            plugin,
            pluginViewId: view.id,
          }))
        : [],
    );
    return [...builtins, ...pluginFeatures];
  }, [i18n.language, plugins, t]);

  const featureById = useMemo(
    () => new Map(features.map((feature) => [feature.id, feature])),
    [features],
  );
  const groups = useMemo(() => {
    const result = new Map<
      string,
      { id: string; title: string; order: number; features: WorkspaceFeature[] }
    >();
    for (const feature of features) {
      const group = result.get(feature.categoryId) ?? {
        id: feature.categoryId,
        title: feature.categoryTitle,
        order: feature.categoryOrder,
        features: [],
      };
      group.features.push(feature);
      result.set(feature.categoryId, group);
    }
    return [...result.values()]
      .sort((left, right) => left.order - right.order)
      .map((group) => ({
        ...group,
        features: group.features.sort((left, right) => left.order - right.order),
      }));
  }, [features]);

  useEffect(() => {
    for (const tabId of tabs) {
      if (!featureById.has(tabId)) closeTab(tabId);
    }
  }, [closeTab, featureById, tabs]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!useAppStore.getState().paletteOpen);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [setPaletteOpen]);

  function renderFeature(feature: WorkspaceFeature, active: boolean) {
    if (feature.plugin && feature.pluginViewId) {
      return (
        <InstalledPluginPanel
          active={active}
          plugin={feature.plugin}
          viewId={feature.pluginViewId}
        />
      );
    }
    if (feature.id === "plugin-center") {
      return (
        <PluginCenterView
          plugins={plugins}
          onPluginsChange={setPlugins}
          onOpenPlugin={(plugin) => {
            const view = plugin.manifest.contributes.views[0];
            if (view) openTab(pluginFeatureId(plugin.id, view.id));
          }}
        />
      );
    }
    const FeatureComponent = feature.builtin?.component as ComponentType | undefined;
    return FeatureComponent ? <FeatureComponent /> : null;
  }

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
        {theme === "dark" ? (
          <Moon aria-hidden="true" size={16} />
        ) : (
          <Sun aria-hidden="true" size={16} />
        )}
      </header>

      <div className="workbench">
        <aside className="navigation-sidebar feature-tree">
          <nav>
            {groups.map((group) => {
              const isExpanded = expanded.has(group.id);
              return (
                <section className="tree-group" key={group.id}>
                  <button
                    className="tree-category"
                    onClick={() =>
                      setExpanded((current) => {
                        const next = new Set(current);
                        if (next.has(group.id)) next.delete(group.id);
                        else next.add(group.id);
                        return next;
                      })
                    }
                    type="button"
                  >
                    {isExpanded ? (
                      <ChevronDown aria-hidden="true" size={15} />
                    ) : (
                      <ChevronRight aria-hidden="true" size={15} />
                    )}
                    <span>{group.title}</span>
                  </button>
                  {isExpanded ? (
                    <div className="tree-children">
                      {group.features.map((feature) => {
                        const Icon = feature.icon;
                        return (
                          <button
                            className={activeTabId === feature.id ? "active" : ""}
                            key={feature.id}
                            onClick={() => openTab(feature.id)}
                            type="button"
                          >
                            <Icon aria-hidden="true" size={16} />
                            {feature.title}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </nav>
          <div className="sidebar-note">{t("status.milestone")}</div>
        </aside>

        <section className="main-workspace tab-workspace">
          <div className="workspace-tabs" role="tablist">
            {tabs.map((tabId) => {
              const feature = featureById.get(tabId);
              if (!feature) return null;
              const Icon = feature.icon;
              return (
                <button
                  aria-selected={activeTabId === tabId}
                  className={activeTabId === tabId ? "active" : ""}
                  draggable
                  key={tabId}
                  onClick={() => openTab(tabId)}
                  onDragStart={() => setDraggedTab(tabId)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedTab) reorderTab(draggedTab, tabId);
                    setDraggedTab(undefined);
                  }}
                  role="tab"
                  type="button"
                >
                  <Icon aria-hidden="true" size={14} />
                  <span>{feature.title}</span>
                  <span
                    aria-label={t("workspace.closeTab", { name: feature.title })}
                    className="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tabId);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        closeTab(tabId);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <X aria-hidden="true" size={13} />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="workspace-content">
            {tabs.length ? (
              tabs.map((tabId) => {
                const feature = featureById.get(tabId);
                if (!feature) return null;
                const active = activeTabId === tabId;
                return (
                  <div
                    aria-hidden={!active}
                    className="workspace-panel"
                    hidden={!active}
                    key={tabId}
                    role="tabpanel"
                  >
                    <FeatureErrorBoundary fallback={t("errors.pluginRender")}>
                      {renderFeature(feature, active)}
                    </FeatureErrorBoundary>
                  </div>
                );
              })
            ) : (
              <div className="workspace-empty">
                <Command aria-hidden="true" />
                <h2>{t("workspace.emptyTitle")}</h2>
                <p>{t("workspace.emptyDescription")}</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <footer className="statusbar">
        <StatusDot />
        <span>{t("status.ready")}</span>
        <span className="status-separator" />
        <span>{t("status.plugins", { count: plugins.length })}</span>
        <span className="status-spacer" />
        <span>v0.1.0</span>
      </footer>
      {paletteOpen ? <CommandPalette features={features} /> : null}
    </main>
  );
}

export default App;
