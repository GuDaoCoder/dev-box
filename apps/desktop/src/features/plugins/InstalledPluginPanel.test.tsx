import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InstalledPlugin } from "@devbox/ipc-contracts";

import "../../i18n";
import { InstalledPluginPanel } from "./InstalledPluginPanel";

const apiMocks = vi.hoisted(() => ({
  open: vi.fn(() => Promise.resolve({ label: "test" })),
  setViewVisible: vi.fn(() => Promise.resolve()),
  closeView: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../ipc/client", () => ({
  pluginAdminAPI: apiMocks,
}));

class TestResizeObserver {
  observe() {}
  disconnect() {}
}

describe("插件视图与主程序浮层", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("打开浮层时隐藏活动插件，关闭后恢复", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    } as DOMRect);
    const plugin = { id: "test-plugin" } as InstalledPlugin;
    const view = render(
      <InstalledPluginPanel active plugin={plugin} suspended={false} viewId="main" />,
    );

    await waitFor(() => expect(apiMocks.open).toHaveBeenCalledTimes(1));
    view.rerender(<InstalledPluginPanel active plugin={plugin} suspended viewId="main" />);
    await waitFor(() =>
      expect(apiMocks.setViewVisible).toHaveBeenCalledWith("test-plugin", "main", false),
    );
    view.rerender(<InstalledPluginPanel active plugin={plugin} suspended={false} viewId="main" />);
    await waitFor(() => expect(apiMocks.open).toHaveBeenCalledTimes(2));
  });
});
