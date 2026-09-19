import { invoke } from "@tauri-apps/api/core";

import {
  CORE_PLUGIN_ID,
  createEnvelope,
  type CorePingResponse,
  type InstalledPluginsResponse,
  type JsonValue,
  type PluginGrant,
  type PluginGrantsResponse,
  type PreflightResponse,
  type SettingRecord,
  type SettingsGetResponse,
  type SettingsUpdateResponse,
} from "@devbox/ipc-contracts";
import type { PluginAPI, PluginPermission } from "@devbox/plugin-sdk";

const browserSettings = new Map<string, SettingRecord>();

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function invokeHost<T>(command: string, envelope: unknown): Promise<T> {
  return invoke<T>(command, { envelope });
}

function browserKey(pluginId: string, key: string): string {
  return `${pluginId}:${key}`;
}

function requirePermission(
  permissions: ReadonlySet<PluginPermission>,
  permission: PluginPermission,
) {
  if (!permissions.has(permission)) {
    throw new Error(`插件没有 ${permission} 权限`);
  }
}

export function createPluginAPI(
  pluginId: string,
  grantedPermissions: readonly PluginPermission[] = ["storage:read", "storage:write"],
): PluginAPI {
  const permissions = new Set(grantedPermissions);
  return {
    core: {
      version: "0.1.0",
      async ping() {
        if (!isTauriRuntime()) {
          return {
            application: "DevBox",
            version: "0.1.0",
            ready: true,
            serverTime: new Date().toISOString(),
          } satisfies CorePingResponse;
        }

        return invokeHost<CorePingResponse>(
          "core_ping",
          createEnvelope(pluginId, { clientTime: new Date().toISOString() }),
        );
      },
    },
    settings: {
      async get(key) {
        requirePermission(permissions, "storage:read");
        if (!isTauriRuntime()) {
          return browserSettings.get(browserKey(pluginId, key));
        }

        const response = await invokeHost<SettingsGetResponse>(
          "settings_get",
          createEnvelope(pluginId, { key }),
        );
        return response.record;
      },
      async update(key: string, value: JsonValue, expectedRevision?: number) {
        requirePermission(permissions, "storage:write");
        if (!isTauriRuntime()) {
          const scopedKey = browserKey(pluginId, key);
          const current = browserSettings.get(scopedKey);
          const record = { key, value, revision: (current?.revision ?? 0) + 1 };
          browserSettings.set(scopedKey, record);
          return record;
        }

        const response = await invokeHost<SettingsUpdateResponse>(
          "settings_update",
          createEnvelope(pluginId, { key, value, expectedRevision }),
        );
        return response.record;
      },
    },
    clipboard: {
      async readText() {
        requirePermission(permissions, "clipboard:read");
        return navigator.clipboard.readText();
      },
      async writeText(value) {
        requirePermission(permissions, "clipboard:write");
        await navigator.clipboard.writeText(value);
      },
    },
  };
}

export const coreAPI = createPluginAPI(CORE_PLUGIN_ID);

const browserPlugins: InstalledPluginsResponse = { plugins: [] };

export const pluginAdminAPI = {
  async list() {
    if (!isTauriRuntime()) return browserPlugins.plugins;
    return (
      await invokeHost<InstalledPluginsResponse>("plugins_list", createEnvelope(CORE_PLUGIN_ID, {}))
    ).plugins;
  },
  async preflightOffline(path: string) {
    const response = await invokeHost<PreflightResponse>(
      "plugin_preflight_offline",
      createEnvelope(CORE_PLUGIN_ID, { path }),
    );
    return response.preflight;
  },
  async confirm(token: string, grantedPermissions: string[]) {
    const response = await invokeHost<InstalledPluginsResponse>(
      "plugin_install_confirm",
      createEnvelope(CORE_PLUGIN_ID, { token, grantedPermissions }),
    );
    return response.plugins;
  },
  async cancel(token: string) {
    await invokeHost<void>("plugin_install_cancel", createEnvelope(CORE_PLUGIN_ID, { token }));
  },
  async setEnabled(pluginId: string, enabled: boolean) {
    const response = await invokeHost<InstalledPluginsResponse>(
      "plugin_set_enabled",
      createEnvelope(CORE_PLUGIN_ID, { pluginId, enabled }),
    );
    return response.plugins;
  },
  async grants(pluginId: string) {
    const response = await invokeHost<PluginGrantsResponse>(
      "plugin_grants",
      createEnvelope(CORE_PLUGIN_ID, { pluginId }),
    );
    return response.grants;
  },
  async setGrant(
    pluginId: string,
    permission: string,
    granted: boolean,
    expectedRevision?: number,
  ) {
    return invokeHost<PluginGrant>(
      "plugin_set_grant",
      createEnvelope(CORE_PLUGIN_ID, {
        pluginId,
        permission,
        granted,
        expectedRevision,
      }),
    );
  },
  async rollback(pluginId: string) {
    const response = await invokeHost<InstalledPluginsResponse>(
      "plugin_rollback",
      createEnvelope(CORE_PLUGIN_ID, { pluginId }),
    );
    return response.plugins;
  },
  async uninstall(pluginId: string, deleteData = false) {
    const response = await invokeHost<InstalledPluginsResponse>(
      "plugin_uninstall",
      createEnvelope(CORE_PLUGIN_ID, { pluginId, deleteData }),
    );
    return response.plugins;
  },
  async open(
    pluginId: string,
    viewId: string,
    bounds: { x: number; y: number; width: number; height: number },
  ) {
    return invokeHost<{ label: string }>(
      "plugin_open",
      createEnvelope(CORE_PLUGIN_ID, { pluginId, viewId, bounds }),
    );
  },
  async setViewVisible(pluginId: string, viewId: string, visible: boolean) {
    await invokeHost<void>(
      "plugin_view_set_visible",
      createEnvelope(CORE_PLUGIN_ID, { pluginId, viewId, visible }),
    );
  },
  async closeView(pluginId: string, viewId: string) {
    await invokeHost<void>(
      "plugin_view_close",
      createEnvelope(CORE_PLUGIN_ID, { pluginId, viewId }),
    );
  },
};
