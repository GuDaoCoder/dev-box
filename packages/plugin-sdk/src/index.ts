import type { ComponentType } from "react";

import type { CorePingResponse, JsonValue, SettingRecord } from "@devbox/ipc-contracts";

export type SupportedLocale = "en-US" | "zh-CN";

export interface Disposable {
  dispose(): void | Promise<void>;
}

export class DisposableStore implements Disposable {
  readonly #items = new Set<Disposable>();
  #disposed = false;

  add<T extends Disposable>(value: T): T {
    if (this.#disposed) {
      void value.dispose();
      return value;
    }

    this.#items.add(value);
    return value;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    const items = [...this.#items].reverse();
    this.#items.clear();
    await Promise.allSettled(items.map(async (item) => item.dispose()));
  }
}

export interface ViewContribution {
  id: string;
  titleKey: string;
  icon: "box" | "braces" | "clock" | "coffee" | "database" | "globe";
  order: number;
}

export interface CommandContribution {
  id: string;
  titleKey: string;
}

export interface PluginManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  type: "ui" | "native";
  activationEvents: string[];
  contributes: {
    views: ViewContribution[];
    commands?: CommandContribution[];
  };
}

export interface CoreAPI {
  ping(): Promise<CorePingResponse>;
}

export interface SettingsAPI {
  get(key: string): Promise<SettingRecord | undefined>;
  update(key: string, value: JsonValue, expectedRevision?: number): Promise<SettingRecord>;
}

export interface PluginAPI {
  readonly core: CoreAPI;
  readonly settings: SettingsAPI;
}

export interface PluginContext {
  readonly pluginId: string;
  readonly manifest: Readonly<PluginManifest>;
  readonly api: PluginAPI;
  readonly subscriptions: DisposableStore;
  registerView(viewId: string, component: ComponentType): Disposable;
  registerCommand(commandId: string, handler: () => unknown): Disposable;
  registerTranslations(
    locale: SupportedLocale,
    namespace: string,
    resources: Record<string, unknown>,
  ): Disposable;
}

export interface DevBoxPlugin {
  readonly manifest: PluginManifest;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export type PluginRuntimeStatus = "inactive" | "activating" | "active" | "failed";

export interface PluginRuntimeState {
  id: string;
  status: PluginRuntimeStatus;
  error?: string;
}
