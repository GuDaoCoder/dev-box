import { describe, expect, it } from "vitest";

import type { DevBoxPlugin } from "@devbox/plugin-sdk";

import { PluginManager } from "./plugin-manager";

const testPlugin: DevBoxPlugin = {
  manifest: {
    schemaVersion: 1,
    id: "devbox.test",
    name: "Test",
    version: "0.1.0",
    type: "ui",
    activationEvents: ["onStartupFinished"],
    contributes: {
      views: [{ id: "test", titleKey: "test:title", icon: "box", order: 1 }],
      commands: [{ id: "test.run", titleKey: "test:run" }],
    },
  },
  activate(context) {
    context.subscriptions.add(context.registerView("test", () => null));
    context.subscriptions.add(context.registerCommand("test.run", () => "done"));
  },
};

describe("PluginManager", () => {
  it("激活插件并注册视图和命令", async () => {
    const manager = new PluginManager([testPlugin]);

    await manager.activateAll();

    expect(manager.snapshot().states[0]?.status).toBe("active");
    expect(manager.snapshot().views[0]?.id).toBe("test");
    expect(await manager.snapshot().commands[0]?.run()).toBe("done");
  });
});
