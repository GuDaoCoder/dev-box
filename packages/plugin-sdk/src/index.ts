import type { ComponentType } from "react";

import type {
  CorePingResponse,
  JavaEnvironment,
  JavaExecutionRequest,
  JavaExecutionResult,
  JsonValue,
  SettingRecord,
} from "@devbox/ipc-contracts";

export type {
  JavaEnvironment,
  JavaExecutionRequest,
  JavaExecutionResult,
} from "@devbox/ipc-contracts";

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
  icon: "binary" | "box" | "braces" | "clock" | "code" | "fingerprint" | "plug";
  order: number;
  category: {
    id: string;
    title: Record<SupportedLocale, string>;
    order: number;
  };
}

export interface CommandContribution {
  id: string;
  titleKey: string;
}

export interface PluginManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  description?: string;
  version: string;
  publisher: {
    id: string;
    name: string;
    keyId?: string;
  };
  engines: {
    devbox: string;
    pluginApi: string;
  };
  type: "ui" | "native";
  entry: {
    main: string;
  };
  activationEvents: string[];
  permissions: PluginPermission[];
  locales: Partial<Record<SupportedLocale, string>>;
  contributes: {
    views: ViewContribution[];
    commands?: CommandContribution[];
  };
}

export type PluginPermission =
  "clipboard:read" | "clipboard:write" | "java:execute" | "storage:read" | "storage:write";

export interface CoreAPI {
  ping(): Promise<CorePingResponse>;
  readonly version: string;
}

export interface SettingsAPI {
  get(key: string): Promise<SettingRecord | undefined>;
  update(key: string, value: JsonValue, expectedRevision?: number): Promise<SettingRecord>;
}

export interface ClipboardAPI {
  readText(): Promise<string>;
  writeText(value: string): Promise<void>;
}

export interface PluginAPI {
  readonly core: CoreAPI;
  readonly settings: SettingsAPI;
  readonly clipboard: ClipboardAPI;
  readonly java?: {
    execute(request: JavaExecutionRequest): Promise<JavaExecutionResult>;
  };
}

export interface InstalledPluginHostContext {
  readonly apiVersion: string;
  readonly pluginId: string;
  readonly version: string;
  readonly permissions: readonly PluginPermission[];
  readonly locale: SupportedLocale;
  readonly java: JavaEnvironment | null;
}

export interface InstalledPluginBridge extends PluginAPI {
  reportReady(): Promise<void>;
}

declare global {
  interface Window {
    readonly __DEVBOX_PLUGIN__?: InstalledPluginHostContext;
    readonly __DEVBOX_PLUGIN_API__?: InstalledPluginBridge;
  }
}

export function getInstalledPluginBridge(): {
  context: InstalledPluginHostContext;
  api: InstalledPluginBridge;
} {
  const context = window.__DEVBOX_PLUGIN__;
  const api = window.__DEVBOX_PLUGIN_API__;
  if (!context || !api || !context.apiVersion.startsWith("1.")) {
    throw new Error("当前运行环境不支持此 Plugin API 版本");
  }
  return { context, api };
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
