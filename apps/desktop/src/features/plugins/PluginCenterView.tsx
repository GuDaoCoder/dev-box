import { useEffect, useMemo, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  BadgeCheck,
  CircleAlert,
  Download,
  FolderOpen,
  PackageOpen,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  CatalogPlugin,
  CatalogVersion,
  InstallPreflight,
  InstalledPlugin,
} from "@devbox/ipc-contracts";
import { Badge, Button } from "@devbox/ui";

import { pluginAdminAPI } from "../../ipc/client";

type CenterTab = "installed" | "online" | "offline";

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "details" in error) {
    const details = (error as { details?: { reason?: unknown } }).details;
    if (typeof details?.reason === "string") return details.reason;
  }
  return error instanceof Error ? error.message : String(error);
}

function newestVersion(plugin: CatalogPlugin): CatalogVersion | undefined {
  return [...plugin.versions]
    .filter((version) => !version.revoked)
    .sort((left, right) =>
      right.version.localeCompare(left.version, undefined, { numeric: true }),
    )[0];
}

export function PluginCenterView() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CenterTab>("installed");
  const [plugins, setPlugins] = useState<InstalledPlugin[]>([]);
  const [catalog, setCatalog] = useState<CatalogPlugin[]>([]);
  const [catalogUrl, setCatalogUrl] = useState(
    (import.meta.env.VITE_PLUGIN_CATALOG_URL as string | undefined) ?? "",
  );
  const [developerMode, setDeveloperMode] = useState(false);
  const [preflight, setPreflight] = useState<InstallPreflight>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  const installedById = useMemo(
    () => new Map(plugins.map((plugin) => [plugin.id, plugin])),
    [plugins],
  );

  useEffect(() => {
    void pluginAdminAPI
      .list()
      .then(setPlugins)
      .catch((nextError: unknown) => setError(errorMessage(nextError)));
  }, []);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await operation();
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setBusy(false);
    }
  }

  function applyPlugins(next: InstalledPlugin[]) {
    setPlugins(next);
    setNotice(t("pluginCenter.messages.operationComplete"));
  }

  async function chooseOfflinePackage() {
    if (!("__TAURI_INTERNALS__" in window)) {
      setError(t("pluginCenter.messages.desktopOnly"));
      return;
    }
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "DevBox Plugin", extensions: ["devbox-plugin"] }],
    });
    if (typeof selected !== "string") return;
    setPreflight(await pluginAdminAPI.preflightOffline(selected, developerMode));
  }

  async function refreshCatalog() {
    if (!catalogUrl.trim()) {
      setError(t("pluginCenter.messages.catalogRequired"));
      return;
    }
    const result = await pluginAdminAPI.fetchCatalog(catalogUrl.trim());
    setCatalog(result.plugins);
    setNotice(t("pluginCenter.messages.catalogUpdated"));
  }

  async function preflightOnline(version: CatalogVersion) {
    setPreflight(await pluginAdminAPI.preflightOnline(version.packageUrl, version.packageSha256));
  }

  async function confirmInstall() {
    if (!preflight) return;
    const permissions =
      preflight.source === "development"
        ? preflight.summary.manifest.permissions.filter((permission) =>
            permission.startsWith("storage:"),
          )
        : preflight.summary.manifest.permissions;
    applyPlugins(await pluginAdminAPI.confirm(preflight.token, permissions));
    setPreflight(undefined);
    setTab("installed");
  }

  async function cancelInstall() {
    if (preflight) await pluginAdminAPI.cancel(preflight.token);
    setPreflight(undefined);
  }

  async function uninstallPlugin(plugin: InstalledPlugin) {
    if (!window.confirm(t("pluginCenter.confirmUninstall.plugin", { name: plugin.name }))) return;
    const deleteData = window.confirm(t("pluginCenter.confirmUninstall.data"));
    applyPlugins(await pluginAdminAPI.uninstall(plugin.id, deleteData));
  }

  return (
    <div className="plugin-page plugin-center">
      <header className="page-header">
        <div>
          <span className="page-eyebrow">{t("pluginCenter.eyebrow")}</span>
          <h1>{t("pluginCenter.title")}</h1>
          <p>{t("pluginCenter.description")}</p>
        </div>
        <Button onClick={() => setTab("offline")}>
          <FolderOpen aria-hidden="true" size={16} />
          {t("pluginCenter.actions.installFromFile")}
        </Button>
      </header>

      <div aria-label={t("pluginCenter.title")} className="plugin-tabs" role="tablist">
        {(["installed", "online", "offline"] as const).map((item) => (
          <button
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
            role="tab"
            type="button"
          >
            {t("pluginCenter.tabs." + item)}
            {item === "installed" ? <span>{plugins.length}</span> : null}
          </button>
        ))}
      </div>

      {error ? (
        <div className="plugin-notice danger" role="alert">
          <CircleAlert aria-hidden="true" size={18} />
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="plugin-notice success" role="status">
          <BadgeCheck aria-hidden="true" size={18} />
          {notice}
        </div>
      ) : null}

      {tab === "installed" ? (
        <section className="plugin-list" aria-label={t("pluginCenter.tabs.installed")}>
          {plugins.length ? (
            plugins.map((plugin) => (
              <article className="plugin-row" key={plugin.id}>
                <div className="plugin-icon">
                  <PackageOpen aria-hidden="true" />
                </div>
                <div className="plugin-row-copy">
                  <div className="plugin-title-line">
                    <h2>{plugin.name}</h2>
                    <Badge tone={plugin.enabled ? "success" : "neutral"}>
                      {t(
                        plugin.enabled
                          ? "pluginCenter.status.enabled"
                          : "pluginCenter.status.disabled",
                      )}
                    </Badge>
                  </div>
                  <p>{plugin.manifest.description || plugin.id}</p>
                  <small>
                    {plugin.publisherId} · v{plugin.currentVersion} ·{" "}
                    {t("pluginCenter.sources." + plugin.source)}
                  </small>
                </div>
                <div className="plugin-actions">
                  <Button
                    disabled={busy || !plugin.enabled}
                    onClick={() =>
                      void run(async () => void (await pluginAdminAPI.open(plugin.id)))
                    }
                  >
                    <Play aria-hidden="true" size={15} />
                    {t("pluginCenter.actions.open")}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void run(async () =>
                        applyPlugins(await pluginAdminAPI.setEnabled(plugin.id, !plugin.enabled)),
                      )
                    }
                    variant="ghost"
                  >
                    {t(
                      plugin.enabled
                        ? "pluginCenter.actions.disable"
                        : "pluginCenter.actions.enable",
                    )}
                  </Button>
                  <Button
                    disabled={busy || !plugin.previousVersion}
                    onClick={() =>
                      void run(async () => applyPlugins(await pluginAdminAPI.rollback(plugin.id)))
                    }
                    variant="ghost"
                  >
                    <RotateCcw aria-hidden="true" size={15} />
                    {t("pluginCenter.actions.rollback")}
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => void run(() => uninstallPlugin(plugin))}
                    variant="danger"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    {t("pluginCenter.actions.uninstall")}
                  </Button>
                </div>
              </article>
            ))
          ) : (
            <div className="plugin-empty">
              <PackageOpen aria-hidden="true" />
              <h2>{t("pluginCenter.empty.installedTitle")}</h2>
              <p>{t("pluginCenter.empty.installedDescription")}</p>
            </div>
          )}
        </section>
      ) : null}

      {tab === "online" ? (
        <section className="online-catalog">
          <div className="catalog-toolbar surface-card">
            <label className="field-label" htmlFor="catalog-url">
              {t("pluginCenter.catalog.url")}
            </label>
            <div className="catalog-input-row">
              <input
                className="text-input"
                id="catalog-url"
                onChange={(event) => setCatalogUrl(event.currentTarget.value)}
                placeholder="https://…/catalog.json"
                value={catalogUrl}
              />
              <Button disabled={busy} onClick={() => void run(refreshCatalog)} variant="primary">
                <RefreshCw aria-hidden="true" size={15} />
                {t("pluginCenter.actions.refresh")}
              </Button>
            </div>
            <p>{t("pluginCenter.catalog.officialOnly")}</p>
          </div>
          <div className="plugin-list">
            {catalog.map((plugin) => {
              const version = newestVersion(plugin);
              const installed = installedById.get(plugin.id);
              const current = installed?.currentVersion === version?.version;
              return (
                <article className="plugin-row" key={plugin.id}>
                  <div className="plugin-icon">
                    <Download aria-hidden="true" />
                  </div>
                  <div className="plugin-row-copy">
                    <div className="plugin-title-line">
                      <h2>{plugin.name}</h2>
                      <Badge tone="success">{plugin.publisher}</Badge>
                    </div>
                    <p>{plugin.description}</p>
                    <small>
                      {version ? "v" + version.version + " · " + version.releasedAt : "—"}
                    </small>
                  </div>
                  <Button
                    disabled={busy || !version || current}
                    onClick={() => (version ? void run(() => preflightOnline(version)) : undefined)}
                    variant="primary"
                  >
                    {t(
                      current
                        ? "pluginCenter.status.installed"
                        : installed
                          ? "pluginCenter.actions.update"
                          : "pluginCenter.actions.install",
                    )}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {tab === "offline" ? (
        <section className="offline-panel surface-card">
          <FolderOpen aria-hidden="true" className="offline-icon" />
          <h2>{t("pluginCenter.offline.title")}</h2>
          <p>{t("pluginCenter.offline.description")}</p>
          <label className="developer-toggle">
            <input
              checked={developerMode}
              onChange={(event) => setDeveloperMode(event.currentTarget.checked)}
              type="checkbox"
            />
            <span>
              <strong>{t("pluginCenter.offline.developerMode")}</strong>
              <small>{t("pluginCenter.offline.developerWarning")}</small>
            </span>
          </label>
          <Button disabled={busy} onClick={() => void run(chooseOfflinePackage)} variant="primary">
            <FolderOpen aria-hidden="true" size={16} />
            {t("pluginCenter.actions.choosePackage")}
          </Button>
        </section>
      ) : null}

      {preflight ? (
        <div className="palette-backdrop" role="presentation">
          <section
            aria-label={t("pluginCenter.confirm.title")}
            aria-modal="true"
            className="install-confirmation"
            role="dialog"
          >
            <div className="confirmation-heading">
              <ShieldCheck aria-hidden="true" />
              <div>
                <h2>{t("pluginCenter.confirm.title")}</h2>
                <p>
                  {preflight.summary.manifest.name} · v{preflight.summary.manifest.version}
                </p>
              </div>
            </div>
            <dl className="confirmation-details">
              <div>
                <dt>{t("pluginCenter.confirm.source")}</dt>
                <dd>{t("pluginCenter.sources." + preflight.source)}</dd>
              </div>
              <div>
                <dt>{t("pluginCenter.confirm.publisher")}</dt>
                <dd>{preflight.summary.manifest.publisher.name}</dd>
              </div>
              <div>
                <dt>{t("pluginCenter.confirm.signature")}</dt>
                <dd>{t("pluginCenter.signature." + preflight.summary.signatureStatus)}</dd>
              </div>
              <div>
                <dt>SHA-256</dt>
                <dd className="checksum">{preflight.summary.archiveSha256}</dd>
              </div>
            </dl>
            <div className="permission-summary">
              <h3>{t("pluginCenter.confirm.permissions")}</h3>
              {preflight.summary.manifest.permissions.length ? (
                <ul>
                  {preflight.summary.manifest.permissions.map((permission) => (
                    <li key={permission}>{permission}</li>
                  ))}
                </ul>
              ) : (
                <p>{t("pluginCenter.confirm.noPermissions")}</p>
              )}
            </div>
            <div className="confirmation-actions">
              <Button disabled={busy} onClick={() => void run(cancelInstall)} variant="ghost">
                {t("pluginCenter.actions.cancel")}
              </Button>
              <Button disabled={busy} onClick={() => void run(confirmInstall)} variant="primary">
                {t("pluginCenter.actions.install")}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
