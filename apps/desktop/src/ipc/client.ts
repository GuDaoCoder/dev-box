import { invoke } from "@tauri-apps/api/core";

import {
  CORE_PLUGIN_ID,
  createEnvelope,
  type CorePingResponse,
  type JsonValue,
  type SettingRecord,
  type SettingsGetResponse,
  type SettingsUpdateResponse,
} from "@devbox/ipc-contracts";
import type { PluginAPI } from "@devbox/plugin-sdk";

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

export function createPluginAPI(pluginId: string): PluginAPI {
  return {
    core: {
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
  };
}

export const coreAPI = createPluginAPI(CORE_PLUGIN_ID);
