import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import App from "./App";
import i18n from "./i18n";
import { useAppStore } from "./stores/app-store";

describe("App", () => {
  beforeEach(async () => {
    useAppStore.setState({
      activeTabId: "tool.json",
      locale: "en-US",
      paletteOpen: false,
      tabs: ["tool.json"],
      theme: "dark",
    });
    await i18n.changeLanguage("en-US");
  });

  it("显示内置工具和二级功能树", async () => {
    render(<App />);

    expect(screen.getByText("DevBox")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "JSON Tool" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Data" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Timestamp Tool" })).toBeVisible();
    expect(screen.getByText("0 plugins")).toBeVisible();
  });

  it("按操作和选项分组显示 JSON 工具栏", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });

    const actionBar = screen.getByRole("button", { name: "Format" }).closest(".tool-action-bar");
    expect(actionBar).not.toBeNull();
    expect(
      within(actionBar as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Format", "Compact", "Clear"]);
    expect(within(actionBar as HTMLElement).getAllByRole("checkbox")).toHaveLength(2);
  });

  it("文本类工具默认不填充示例数据", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });
    expect(screen.getByRole("textbox", { name: "Input" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Timestamp Tool" }));
    expect(screen.getByRole("textbox", { name: "Timestamp or date" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Encoding Tool" }));
    expect(screen.getByRole("textbox", { name: "Input" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "UUID & Hash" }));
    fireEvent.click(screen.getByRole("tab", { name: "Hash" }));
    expect(screen.getByRole("textbox", { name: "Text to hash" })).toHaveValue("");
  });

  it("同一功能只打开一个可关闭的工作区标签", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });

    fireEvent.click(screen.getByRole("button", { name: "Timestamp Tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Timestamp Tool" }));

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByRole("tab", { name: "Timestamp Tool" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Close Timestamp Tool" }));
    expect(screen.getAllByRole("tab")).toHaveLength(1);
  });

  it("支持使用方向键切换标签并用 Delete 关闭", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });
    fireEvent.click(screen.getByRole("button", { name: "Timestamp Tool" }));

    const timestampTab = screen.getByRole("tab", { name: "Timestamp Tool" });
    timestampTab.focus();
    fireEvent.keyDown(timestampTab, { key: "ArrowLeft" });

    expect(screen.getByRole("tab", { name: "JSON Tool" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "JSON Tool" }), { key: "Delete" });
    expect(screen.queryByRole("tab", { name: "JSON Tool" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timestamp Tool" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("为功能树和工作区建立可访问关系", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });

    const category = screen.getByRole("button", { name: "Data" });
    const tab = screen.getByRole("tab", { name: "JSON Tool" });
    expect(category).toHaveAttribute("aria-expanded", "true");
    expect(category).toHaveAttribute("aria-controls");
    expect(tab).toHaveAttribute("aria-controls");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("右键标签显示批量关闭菜单", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });
    fireEvent.click(screen.getByRole("button", { name: "Timestamp Tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Encoding Tool" }));

    fireEvent.contextMenu(screen.getByRole("tab", { name: "Timestamp Tool" }), {
      clientX: 200,
      clientY: 100,
    });

    expect(screen.getByRole("menu", { name: "Tab actions" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Close Tab" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Close All Tabs" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Close Tabs to the Right" })).toBeVisible();
    expect(screen.getByRole("menuitem", { name: "Close Other Tabs" })).toBeVisible();

    fireEvent.click(screen.getByRole("menuitem", { name: "Close Tabs to the Right" }));
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: "Encoding Tool" })).not.toBeInTheDocument();
  });

  it("使用快捷键打开命令面板", async () => {
    render(<App />);

    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeVisible();
  });

  it("插件中心只提供本地 ZIP 安装入口", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });

    fireEvent.click(screen.getByRole("button", { name: "Plugin Manager" }));

    expect(await screen.findByRole("heading", { name: "Plugin Manager" })).toBeVisible();
    expect(screen.getByRole("tab", { name: /Add ZIP Plugin/ })).toBeVisible();
    expect(screen.queryByRole("tab", { name: /Online/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Installed/ })).toBeVisible());
  });
});
