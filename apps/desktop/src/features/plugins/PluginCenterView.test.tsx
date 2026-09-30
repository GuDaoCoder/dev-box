import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstalledPlugin } from "@devbox/ipc-contracts";

import i18n from "../../i18n";
import { PluginCenterView } from "./PluginCenterView";

const apiMocks = vi.hoisted(() => ({
  uninstall: vi.fn(() => Promise.resolve([])),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../../ipc/client", () => ({ pluginAdminAPI: apiMocks }));

const plugin = {
  id: "devbox.test",
  name: "Test Plugin",
  publisherId: "devbox",
  currentVersion: "0.1.2",
  enabled: true,
  status: "installed",
  source: "offline",
  signatureStatus: "unsigned",
  grantedPermissions: [],
  manifest: {
    schemaVersion: 1,
    id: "devbox.test",
    name: "Test Plugin",
    description: "",
    version: "0.1.2",
    publisher: { id: "devbox", name: "DevBox" },
    engines: { devbox: ">=0.1.0", pluginApi: "^1.0.0" },
    type: "ui",
    entry: { main: "index.html" },
    activationEvents: [],
    permissions: [],
    locales: {},
    contributes: { views: [] },
  },
} satisfies InstalledPlugin;

describe("插件卸载确认", () => {
  afterEach(() => vi.clearAllMocks());

  function openConfirmation() {
    const onPluginsChange = vi.fn();
    render(
      <PluginCenterView
        onOpenPlugin={vi.fn()}
        onPluginsChange={onPluginsChange}
        plugins={[plugin]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: i18n.t("pluginCenter.actions.uninstall") }));
    return onPluginsChange;
  }

  it("取消时不卸载插件", () => {
    openConfirmation();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("pluginCenter.actions.cancel") }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(apiMocks.uninstall).not.toHaveBeenCalled();
  });

  it.each([
    ["keepData", false],
    ["deleteData", true],
  ] as const)("%s 传递正确的数据保留选项", async (action, deleteData) => {
    const onPluginsChange = openConfirmation();
    fireEvent.click(
      screen.getByRole("button", { name: i18n.t(`pluginCenter.confirmUninstall.${action}`) }),
    );
    await waitFor(() => expect(apiMocks.uninstall).toHaveBeenCalledWith(plugin.id, deleteData));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onPluginsChange).toHaveBeenCalledWith([]);
  });
});
