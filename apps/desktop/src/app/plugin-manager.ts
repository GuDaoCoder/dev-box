import type { ComponentType } from "react";

import i18n from "../i18n";
import { createPluginAPI } from "../ipc/client";
import {
  DisposableStore,
  type DevBoxPlugin,
  type PluginContext,
  type PluginRuntimeState,
  type SupportedLocale,
  type ViewContribution,
} from "@devbox/plugin-sdk";

export interface RegisteredView extends ViewContribution {
  pluginId: string;
  component: ComponentType;
}

export interface RegisteredCommand {
  id: string;
  titleKey: string;
  pluginId: string;
  run: () => Promise<unknown>;
}

export interface PluginManagerSnapshot {
  states: PluginRuntimeState[];
  views: RegisteredView[];
  commands: RegisteredCommand[];
}

const activationTimeout = 5_000;

async function withTimeout<T>(operation: Promise<T> | T): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("插件激活超时")), activationTimeout);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

export class PluginManager {
  readonly #plugins: readonly DevBoxPlugin[];
  readonly #listeners = new Set<() => void>();
  readonly #stores = new Map<string, DisposableStore>();
  readonly #states = new Map<string, PluginRuntimeState>();
  readonly #views = new Map<string, RegisteredView>();
  readonly #commands = new Map<string, RegisteredCommand>();

  constructor(plugins: readonly DevBoxPlugin[]) {
    this.#plugins = plugins;
    for (const plugin of plugins) {
      this.#states.set(plugin.manifest.id, { id: plugin.manifest.id, status: "inactive" });
    }
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  snapshot(): PluginManagerSnapshot {
    return {
      states: [...this.#states.values()],
      views: [...this.#views.values()].sort((left, right) => left.order - right.order),
      commands: [...this.#commands.values()],
    };
  }

  async activateAll(): Promise<void> {
    await Promise.all(this.#plugins.map((plugin) => this.activate(plugin)));
  }

  async activate(plugin: DevBoxPlugin): Promise<void> {
    const pluginId = plugin.manifest.id;
    if (["active", "activating"].includes(this.#states.get(pluginId)?.status ?? "")) {
      return;
    }

    this.#setState({ id: pluginId, status: "activating" });
    const subscriptions = new DisposableStore();
    this.#stores.set(pluginId, subscriptions);

    const context: PluginContext = {
      pluginId,
      manifest: plugin.manifest,
      api: createPluginAPI(pluginId, plugin.manifest.permissions),
      subscriptions,
      registerView: (viewId, component) => {
        const contribution = plugin.manifest.contributes.views.find((view) => view.id === viewId);
        if (!contribution) {
          throw new Error(`插件 ${pluginId} 未声明视图 ${viewId}`);
        }
        const key = `${pluginId}:${viewId}`;
        this.#views.set(key, { ...contribution, pluginId, component });
        this.#emit();
        return {
          dispose: () => {
            this.#views.delete(key);
            this.#emit();
          },
        };
      },
      registerCommand: (commandId, handler) => {
        const contribution = plugin.manifest.contributes.commands?.find(
          (command) => command.id === commandId,
        );
        if (!contribution) {
          throw new Error(`插件 ${pluginId} 未声明命令 ${commandId}`);
        }
        this.#commands.set(commandId, {
          ...contribution,
          pluginId,
          run: () => Promise.resolve(handler()),
        });
        this.#emit();
        return {
          dispose: () => {
            this.#commands.delete(commandId);
            this.#emit();
          },
        };
      },
      registerTranslations: (locale: SupportedLocale, namespace, resources) => {
        i18n.addResourceBundle(locale, namespace, resources, true, true);
        return { dispose: () => void i18n.removeResourceBundle(locale, namespace) };
      },
    };

    try {
      await withTimeout(plugin.activate(context));
      this.#setState({ id: pluginId, status: "active" });
    } catch (error) {
      await subscriptions.dispose();
      this.#setState({
        id: pluginId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async dispose(): Promise<void> {
    await Promise.all(this.#plugins.map(async (plugin) => plugin.deactivate?.()));
    await Promise.all([...this.#stores.values()].map(async (store) => store.dispose()));
  }

  #setState(state: PluginRuntimeState): void {
    this.#states.set(state.id, state);
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}
