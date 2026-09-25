import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { shortcutLabelForPlatform } from "@devbox/ui/shortcuts";

import App from "./App";
import i18n from "./i18n";
import { useAppStore } from "./stores/app-store";

function toolEditor(label: string) {
  const element = screen.getByRole("textbox", { name: label });
  const view = EditorView.findFromDOM(element);
  if (!view) throw new Error(`找不到 ${label} 编辑器`);
  return view;
}

function setToolInput(value: string) {
  const view = toolEditor("Input");
  act(() => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
  });
}

describe("App", () => {
  beforeEach(async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
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
    expect(document.querySelector("img.brand-mark")).toBeVisible();
    expect(await screen.findByRole("heading", { name: "JSON Tool" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Data" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Timestamp Tool" })).toBeVisible();
    expect(screen.getByText("0 plugins")).toBeVisible();
  });

  it("可收起整个左侧菜单，重新展开后保留分类状态", () => {
    render(<App />);
    const sidebar = screen.getByRole("complementary", { name: "Feature menu" });
    const category = screen.getByRole("button", { name: "Data" });
    fireEvent.click(category);
    expect(category).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(sidebar).toHaveAttribute("hidden");
    expect(document.querySelector(".workbench")).toHaveClass("sidebar-collapsed");
    expect(screen.getByRole("button", { name: "Show sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(sidebar).not.toHaveAttribute("hidden");
    expect(category).toHaveAttribute("aria-expanded", "false");
  });

  it("窄窗口通过临时侧栏打开功能，并可用 Escape 收起", () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 640 });
    render(<App />);
    const sidebar = screen.getByRole("complementary", { hidden: true });
    expect(sidebar).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(sidebar).not.toHaveAttribute("hidden");
    expect(document.querySelector(".workbench")).toHaveClass("mobile-sidebar-open");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(sidebar).toHaveAttribute("hidden");

    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: "Timestamp Tool" }));
    expect(sidebar).toHaveAttribute("hidden");
    expect(screen.getByRole("tab", { name: "Timestamp Tool" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
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
    expect(
      within(actionBar as HTMLElement)
        .getAllByRole("button")
        .every((button) => button.querySelector("svg")),
    ).toBe(true);
    expect(within(actionBar as HTMLElement).getAllByRole("checkbox")).toHaveLength(2);
  });

  it("文本结果可以通过统一按钮复制", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });

    setToolInput('{"value":1}');
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('{\n  "value": 1\n}'));
    expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
  });

  it("文本类工具默认不填充示例数据", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "JSON Tool" });
    expect(toolEditor("Input").state.doc.toString()).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Timestamp Tool" }));
    expect(screen.getByRole("textbox", { name: "Timestamp or date" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Encoding Tool" }));
    expect(screen.getByRole("textbox", { name: "Input" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "UUID & Hash" }));
    fireEvent.click(screen.getByRole("tab", { name: "Hash" }));
    expect(screen.getByRole("textbox", { name: "Text to hash" })).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "XML Tool" }));
    expect(await screen.findByRole("heading", { name: "XML Tool" })).toBeVisible();
    expect(toolEditor("Input").state.doc.toString()).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "SQL Tool" }));
    expect(await screen.findByRole("heading", { name: "SQL Tool" })).toBeVisible();
    expect(toolEditor("Input").state.doc.toString()).toBe("");
  });

  it("XML 工具沿用双栏布局，并在校验失败时保留上次结果", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "XML Tool" }));
    await screen.findByRole("heading", { name: "XML Tool" });
    const actionBar = screen.getByRole("button", { name: "Format" }).closest(".tool-action-bar");
    expect(
      within(actionBar as HTMLElement)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Format", "Compact", "Validate", "Clear"]);

    setToolInput("<root><item/></root>");
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    expect(toolEditor("Result").state.doc.toString()).toBe("<root>\n  <item/>\n</root>");

    setToolInput("<root>");
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    expect(screen.getByRole("status")).toHaveTextContent("Invalid XML");
    expect(toolEditor("Result").state.doc.toString()).toBe("<root>\n  <item/>\n</root>");
  });

  it("SQL 工具支持方言与大小写选项，但不提供执行入口", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "SQL Tool" }));
    await screen.findByRole("heading", { name: "SQL Tool" });
    fireEvent.change(screen.getByRole("combobox", { name: "Dialect" }), {
      target: { value: "postgresql" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Keywords" }), {
      target: { value: "upper" },
    });
    setToolInput("select name from users");
    fireEvent.click(screen.getByRole("button", { name: "Format" }));
    await waitFor(() =>
      expect(toolEditor("Result").state.doc.toString()).toBe("SELECT\n  name\nFROM\n  users"),
    );
    expect(screen.queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
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

  it("根据操作系统显示快捷键提示", () => {
    expect(shortcutLabelForPlatform("Macintosh", "k")).toBe("⌘ K");
    expect(shortcutLabelForPlatform("Windows NT 10.0", "k")).toBe("Ctrl K");
    expect(shortcutLabelForPlatform("Linux", "k")).toBe("Ctrl K");
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
