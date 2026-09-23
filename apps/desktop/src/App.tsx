import {
  Component,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown, ChevronRight, Command, Moon, Search, Sun, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { InstalledPlugin } from "@devbox/ipc-contracts";
import { Kbd, StatusDot } from "@devbox/ui";

import "./App.css";
import devboxMark from "./assets/devbox-mark.svg";
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

type TabContextMenuState = {
  tabId: string;
  x: number;
  y: number;
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

function workspaceDomId(prefix: string, featureId: string) {
  return `${prefix}-${featureId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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
  const closeAllTabs = useAppStore((state) => state.closeAllTabs);
  const closeOtherTabs = useAppStore((state) => state.closeOtherTabs);
  const closeTab = useAppStore((state) => state.closeTab);
  const closeTabsToRight = useAppStore((state) => state.closeTabsToRight);
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
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuState>();
  const tabContextMenuRef = useRef<HTMLDivElement>(null);

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
    if (!activeTabId) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById(workspaceDomId("workspace-tab", activeTabId))
        ?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTabId, tabs]);

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

  useEffect(() => {
    if (!tabContextMenu) return;
    const closeMenu = () => setTabContextMenu(undefined);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };
    const focusFrame = window.requestAnimationFrame(() => {
      tabContextMenuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    });
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [tabContextMenu]);

  function runTabMenuAction(action: () => void) {
    setTabContextMenu(undefined);
    action();
  }

  function focusTab(tabId: string | undefined) {
    if (!tabId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(workspaceDomId("workspace-tab", tabId))?.focus();
    });
  }

  function closeTabAndRestoreFocus(tabId: string) {
    const index = tabs.indexOf(tabId);
    const remaining = tabs.filter((id) => id !== tabId);
    closeTab(tabId);
    focusTab(remaining[Math.min(index, remaining.length - 1)]);
  }

  function handleWorkspaceTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, tabId: string) {
    const currentIndex = tabs.indexOf(tabId);
    if (event.key === "Delete") {
      event.preventDefault();
      closeTabAndRestoreFocus(tabId);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTabId = tabs[nextIndex];
    if (nextTabId) {
      openTab(nextTabId);
      focusTab(nextTabId);
    }
  }

  function handleTabMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [
      ...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
    ];
    if (!items.length) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (currentIndex + 1) % items.length
            : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

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
        <img alt="" aria-hidden="true" className="brand-mark" src={devboxMark} />
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
                    aria-controls={workspaceDomId("tree-group", group.id)}
                    aria-expanded={isExpanded}
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
                    <div
                      aria-label={group.title}
                      className="tree-children"
                      id={workspaceDomId("tree-group", group.id)}
                      role="group"
                    >
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
        </aside>

        <section aria-label={t("workspace.label")} className="main-workspace tab-workspace">
          <div
            aria-label={t("workspace.openTabs")}
            className="workspace-tabs"
            onWheel={(event) => {
              const element = event.currentTarget;
              if (
                element.scrollWidth <= element.clientWidth ||
                Math.abs(event.deltaX) >= Math.abs(event.deltaY)
              ) {
                return;
              }
              event.preventDefault();
              element.scrollLeft += event.deltaY;
            }}
            role="tablist"
          >
            {tabs.map((tabId) => {
              const feature = featureById.get(tabId);
              if (!feature) return null;
              const Icon = feature.icon;
              return (
                <div
                  className={`workspace-tab${activeTabId === tabId ? " active" : ""}`}
                  draggable
                  key={tabId}
                  onDragStart={() => setDraggedTab(tabId)}
                  onDragOver={(event) => event.preventDefault()}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const menuWidth = 208;
                    const menuHeight = 156;
                    setTabContextMenu({
                      tabId,
                      x: Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8)),
                      y: Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8)),
                    });
                  }}
                  onDrop={() => {
                    if (draggedTab) reorderTab(draggedTab, tabId);
                    setDraggedTab(undefined);
                  }}
                >
                  <button
                    aria-controls={workspaceDomId("workspace-panel", tabId)}
                    aria-selected={activeTabId === tabId}
                    className="workspace-tab-button"
                    id={workspaceDomId("workspace-tab", tabId)}
                    onClick={() => openTab(tabId)}
                    onKeyDown={(event) => handleWorkspaceTabKeyDown(event, tabId)}
                    role="tab"
                    tabIndex={activeTabId === tabId ? 0 : -1}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={14} />
                    <span>{feature.title}</span>
                  </button>
                  <button
                    aria-label={t("workspace.closeTab", { name: feature.title })}
                    className="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTabAndRestoreFocus(tabId);
                    }}
                    tabIndex={activeTabId === tabId ? 0 : -1}
                    type="button"
                  >
                    <X aria-hidden="true" size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          {tabContextMenu ? (
            <div
              aria-label={t("workspace.tabMenu.label")}
              className="tab-context-menu"
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={handleTabMenuKeyDown}
              onPointerDown={(event) => event.stopPropagation()}
              ref={tabContextMenuRef}
              role="menu"
              style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            >
              <button
                onClick={() => runTabMenuAction(() => closeTab(tabContextMenu.tabId))}
                role="menuitem"
                type="button"
              >
                {t("workspace.tabMenu.closeCurrent")}
              </button>
              <button onClick={() => runTabMenuAction(closeAllTabs)} role="menuitem" type="button">
                {t("workspace.tabMenu.closeAll")}
              </button>
              <button
                disabled={tabs.indexOf(tabContextMenu.tabId) === tabs.length - 1}
                onClick={() => runTabMenuAction(() => closeTabsToRight(tabContextMenu.tabId))}
                role="menuitem"
                type="button"
              >
                {t("workspace.tabMenu.closeRight")}
              </button>
              <button
                disabled={tabs.length <= 1}
                onClick={() => runTabMenuAction(() => closeOtherTabs(tabContextMenu.tabId))}
                role="menuitem"
                type="button"
              >
                {t("workspace.tabMenu.closeOthers")}
              </button>
            </div>
          ) : null}
          <div className="workspace-content">
            {tabs.length ? (
              tabs.map((tabId) => {
                const feature = featureById.get(tabId);
                if (!feature) return null;
                const active = activeTabId === tabId;
                return (
                  <div
                    aria-hidden={!active}
                    aria-labelledby={workspaceDomId("workspace-tab", tabId)}
                    className={`workspace-panel${feature.plugin ? " plugin-workspace-panel" : ""}`}
                    hidden={!active}
                    id={workspaceDomId("workspace-panel", tabId)}
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
                <p>{t("workspace.empty")}</p>
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
