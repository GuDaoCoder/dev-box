import { useEffect, useRef, useState } from "react";
import { PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { InstalledPlugin } from "@devbox/ipc-contracts";

import { pluginAdminAPI } from "../../ipc/client";

export function InstalledPluginPanel({
  active,
  plugin,
  viewId,
}: {
  active: boolean;
  plugin: InstalledPlugin;
  viewId: string;
}) {
  const { t } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const element = container.current;
    if (!element) return;
    const target = element;
    let cancelled = false;

    async function sync() {
      if (!active) {
        await pluginAdminAPI.setViewVisible(plugin.id, viewId, false).catch(() => undefined);
        return;
      }
      const bounds = target.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      try {
        await pluginAdminAPI.open(plugin.id, viewId, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
        });
        if (!cancelled) setError(undefined);
      } catch (nextError) {
        if (!cancelled)
          setError(nextError instanceof Error ? nextError.message : String(nextError));
      }
    }

    void sync();
    const observer = new ResizeObserver(() => void sync());
    const handleResize = () => void sync();
    observer.observe(target);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      void pluginAdminAPI.setViewVisible(plugin.id, viewId, false).catch(() => undefined);
    };
  }, [active, plugin.id, viewId]);

  useEffect(
    () => () => {
      void pluginAdminAPI.closeView(plugin.id, viewId).catch(() => undefined);
    },
    [plugin.id, viewId],
  );

  return (
    <div className="installed-plugin-panel" ref={container}>
      {error ? <div className="error-state">{error}</div> : null}
      {!("__TAURI_INTERNALS__" in window) ? (
        <div className="workspace-empty">
          <PackageOpen aria-hidden="true" />
          <p>{t("workspace.pluginBrowserOnly")}</p>
        </div>
      ) : (
        <span className="plugin-loading-label">{t("workspace.pluginLoading")}</span>
      )}
    </div>
  );
}
