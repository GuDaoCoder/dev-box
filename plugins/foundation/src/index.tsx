import type { DevBoxPlugin, PluginContext, PluginManifest } from "@devbox/plugin-sdk";

import { FoundationView } from "./FoundationView";
import enUS from "./locales/en-US.json";
import zhCN from "./locales/zh-CN.json";

export const FOUNDATION_PLUGIN_ID = "devbox.builtin.foundation";

export const manifest: PluginManifest = {
  schemaVersion: 1,
  id: FOUNDATION_PLUGIN_ID,
  name: "Foundation",
  version: "0.1.0",
  publisher: {
    id: "devbox",
    name: "DevBox Official",
    keyId: "0000000000000000",
  },
  engines: {
    devbox: ">=0.1.0",
    pluginApi: "^1.0.0",
  },
  type: "native",
  entry: {
    main: "dist/index.html",
  },
  activationEvents: ["onStartupFinished", "onView:foundation"],
  permissions: ["storage:read", "storage:write"],
  locales: {
    "zh-CN": "locales/zh-CN.json",
    "en-US": "locales/en-US.json",
  },
  contributes: {
    views: [
      {
        id: "foundation",
        titleKey: "plugin-foundation:navigation.title",
        icon: "box",
        order: 10,
      },
    ],
    commands: [
      {
        id: "foundation.ping",
        titleKey: "plugin-foundation:commands.ping",
      },
    ],
  },
};

export const foundationPlugin: DevBoxPlugin = {
  manifest,
  activate(context: PluginContext) {
    context.subscriptions.add(context.registerTranslations("en-US", "plugin-foundation", enUS));
    context.subscriptions.add(context.registerTranslations("zh-CN", "plugin-foundation", zhCN));
    context.subscriptions.add(
      context.registerView("foundation", () => <FoundationView api={context.api} />),
    );
    context.subscriptions.add(
      context.registerCommand("foundation.ping", () => context.api.core.ping()),
    );
  },
};
