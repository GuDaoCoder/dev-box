import { useEffect, useRef, useState } from "react";
import { PackageOpen } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { InstalledPlugin } from "@devbox/ipc-contracts";

import { pluginAdminAPI } from "../../ipc/client";
import { hostErrorMessage } from "../../ipc/errors";

export function InstalledPluginPanel({
  active,
  plugin,
  suspended,
  viewId,
}: {
  active: boolean;
  plugin: InstalledPlugin;
  suspended: boolean;
  viewId: string;
}) {
  const { t, i18n } = useTranslation();
  const container = useRef<HTMLDivElement>(null);
  const pending = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const element = container.current;
    if (!element) return;
    const target = element;
    let cancelled = false;
    const currentGeneration = ++generation.current;

    function sync() {
      // 原生 WebView 操作串行，避免快速开关浮层时旧请求重新显示插件。
      pending.current = pending.current
        .catch(() => undefined)
        .then(async () => {
          if (cancelled || generation.current !== currentGeneration) return;
          if (!active || suspended) {
            await pluginAdminAPI.setViewVisible(plugin.id, viewId, false).catch(() => undefined);
            return;
          }
          const bounds = target.getBoundingClientRect();
          if (bounds.width < 1 || bounds.height < 1) return;
          try {
            await pluginAdminAPI.open(
              plugin.id,
              viewId,
              { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
              i18n.language === "zh-CN" ? "zh-CN" : "en-US",
            );
            if (!cancelled && generation.current === currentGeneration) setError(undefined);
          } catch (nextError) {
            if (!cancelled && generation.current === currentGeneration)
              setError(hostErrorMessage(nextError));
          }
        });
    }

    sync();
    const observer = new ResizeObserver(sync);
    const handleResize = sync;
    observer.observe(target);
    window.addEventListener("resize", handleResize);
    return () => {
      cancelled = true;
      generation.current = currentGeneration + 1;
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      pending.current = pending.current
        .catch(() => undefined)
        .then(() => pluginAdminAPI.setViewVisible(plugin.id, viewId, false))
        .catch(() => undefined);
    };
  }, [active, i18n.language, plugin.id, suspended, viewId]);

  useEffect(
    () => () => {
      pending.current = pending.current
        .catch(() => undefined)
        .then(() => pluginAdminAPI.closeView(plugin.id, viewId))
        .catch(() => undefined);
    },
    [plugin.id, viewId],
  );

  return (
    <div className="installed-plugin-panel" ref={container}>
      {!("__TAURI_INTERNALS__" in window) ? (
        <div className="workspace-empty">
          <PackageOpen aria-hidden="true" />
          <p>{t("workspace.pluginBrowserOnly")}</p>
        </div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : (
        <span className="plugin-loading-label">{t("workspace.pluginLoading")}</span>
      )}
    </div>
  );
}
