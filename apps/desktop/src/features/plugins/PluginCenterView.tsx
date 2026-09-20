import { useState } from "react";
import { confirm, open } from "@tauri-apps/plugin-dialog";
import {
  BadgeCheck,
  CircleAlert,
  FolderOpen,
  PackageOpen,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type { InstallPreflight, InstalledPlugin } from "@devbox/ipc-contracts";
import { Badge, Button } from "@devbox/ui";

import { pluginAdminAPI } from "../../ipc/client";

type CenterTab = "installed" | "offline";

export interface PluginCenterViewProps {
  plugins: InstalledPlugin[];
  onPluginsChange: (plugins: InstalledPlugin[]) => void;
  onOpenPlugin: (plugin: InstalledPlugin) => void;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const structured = error as {
      code?: unknown;
      message?: unknown;
      messageKey?: unknown;
      details?: { field?: unknown; reason?: unknown };
    };
    const details = structured.details;
    if (typeof details?.reason === "string") return details.reason;
    if (typeof details?.field === "string" && typeof structured.code === "string") {
      return `${structured.code}: ${details.field}`;
    }
    if (typeof structured.message === "string") return structured.message;
    if (typeof structured.messageKey === "string") return structured.messageKey;
    if (typeof structured.code === "string") return structured.code;
  }
  return error instanceof Error ? error.message : String(error);
}

export function PluginCenterView({
  onOpenPlugin,
  onPluginsChange,
  plugins,
}: PluginCenterViewProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<CenterTab>("installed");
  const [preflight, setPreflight] = useState<InstallPreflight>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

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
    onPluginsChange(next);
    setNotice(t("pluginCenter.messages.operationComplete"));
  }

  async function choosePackage() {
    if (!("__TAURI_INTERNALS__" in window)) {
      setError(t("pluginCenter.messages.desktopOnly"));
      return;
    }
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "ZIP", extensions: ["zip"] }],
    });
    if (typeof selected !== "string") return;
    setPreflight(await pluginAdminAPI.preflightOffline(selected));
  }

  async function confirmInstall() {
    if (!preflight) return;
    applyPlugins(
      await pluginAdminAPI.confirm(preflight.token, preflight.summary.manifest.permissions),
    );
    setPreflight(undefined);
    setTab("installed");
  }

  async function cancelInstall() {
    if (preflight) await pluginAdminAPI.cancel(preflight.token);
    setPreflight(undefined);
  }

  async function uninstallPlugin(plugin: InstalledPlugin) {
    const approved = await confirm(
      t("pluginCenter.confirmUninstall.plugin", { name: plugin.name }),
      {
        title: "DevBox",
        kind: "warning",
      },
    );
    if (!approved) return;
    const deleteData = await confirm(t("pluginCenter.confirmUninstall.data"), {
      title: "DevBox",
      kind: "warning",
    });
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
        {(["installed", "offline"] as const).map((item) => (
          <button
            aria-selected={tab === item}
            className={tab === item ? "active" : ""}
            key={item}
            onClick={() => setTab(item)}
            role="tab"
            type="button"
          >
            {t(`pluginCenter.tabs.${item}`)}
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
                    {plugin.signatureStatus !== "verified" ? (
                      <Badge tone="danger">
                        <ShieldAlert aria-hidden="true" size={13} />
                        {t("pluginCenter.signature.unsigned")}
                      </Badge>
                    ) : null}
                  </div>
                  <p>{plugin.manifest.description || plugin.id}</p>
                  <small>
                    {plugin.publisherId} · v{plugin.currentVersion} ·{" "}
                    {t(`pluginCenter.sources.${plugin.source}`)}
                  </small>
                </div>
                <div className="plugin-actions">
                  <Button
                    disabled={busy || !plugin.enabled || !plugin.manifest.contributes.views.length}
                    onClick={() => onOpenPlugin(plugin)}
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

      {tab === "offline" ? (
        <section className="offline-panel surface-card">
          <FolderOpen aria-hidden="true" className="offline-icon" />
          <h2>{t("pluginCenter.offline.title")}</h2>
          <p>{t("pluginCenter.offline.description")}</p>
          <div className="plugin-warning">
            <ShieldAlert aria-hidden="true" size={20} />
            <span>{t("pluginCenter.offline.unsignedWarning")}</span>
          </div>
          <Button disabled={busy} onClick={() => void run(choosePackage)} variant="primary">
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
              {preflight.summary.signatureStatus === "verified" ? (
                <ShieldCheck aria-hidden="true" />
              ) : (
                <ShieldAlert aria-hidden="true" />
              )}
              <div>
                <h2>{t("pluginCenter.confirm.title")}</h2>
                <p>
                  {preflight.summary.manifest.name} · v{preflight.summary.manifest.version}
                </p>
              </div>
            </div>
            {preflight.summary.signatureStatus !== "verified" ? (
              <div className="plugin-warning danger">
                <ShieldAlert aria-hidden="true" size={20} />
                <span>{t("pluginCenter.offline.unsignedWarning")}</span>
              </div>
            ) : null}
            <dl className="confirmation-details">
              <div>
                <dt>{t("pluginCenter.confirm.source")}</dt>
                <dd>{t(`pluginCenter.sources.${preflight.source}`)}</dd>
              </div>
              <div>
                <dt>{t("pluginCenter.confirm.publisher")}</dt>
                <dd>{preflight.summary.manifest.publisher.name}</dd>
              </div>
              <div>
                <dt>{t("pluginCenter.confirm.signature")}</dt>
                <dd>{t(`pluginCenter.signature.${preflight.summary.signatureStatus}`)}</dd>
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
            {preflight.summary.manifest.permissions.includes("java:execute") ? (
              <div className="plugin-warning danger">
                <ShieldAlert aria-hidden="true" size={20} />
                <span>{t("pluginCenter.confirm.javaExecuteWarning")}</span>
              </div>
            ) : null}
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
