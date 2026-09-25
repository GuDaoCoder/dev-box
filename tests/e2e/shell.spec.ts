import { expect, test } from "@playwright/test";

test("启动 DevBox 应用壳层并打开命令面板", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("DevBox", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "JSON Tool" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Data" })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
});

test("左侧菜单可整体收起，窄窗口可临时展开并自动收回", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const sidebar = page.getByRole("complementary", { name: "Feature menu" });
  const sidebarButton = sidebar.getByRole("button", { name: "Hide sidebar" });
  const alignment = await page.evaluate(() => {
    const sidebar = document.querySelector<HTMLElement>(".navigation-sidebar")!;
    const button = sidebar.querySelector<HTMLElement>(".sidebar-collapse-button")!;
    const tabs = document.querySelector<HTMLElement>(".workspace-tab-header")!;
    return {
      widthGap: Math.abs(
        sidebar.getBoundingClientRect().width - button.getBoundingClientRect().width,
      ),
      topGap: Math.abs(button.getBoundingClientRect().top - tabs.getBoundingClientRect().top),
    };
  });
  expect(alignment.widthGap).toBeLessThanOrEqual(1);
  expect(alignment.topGap).toBeLessThanOrEqual(1);
  const category = page.getByRole("button", { name: "Data" });
  await category.click();
  await sidebarButton.click();
  await expect(sidebar).toBeHidden();
  await expect(page.locator(".workspace-tab-header > .sidebar-expand-button")).toBeVisible();
  await expect(page.locator(".workbench")).toHaveClass(/sidebar-collapsed/);
  expect(
    await page
      .locator(".main-workspace")
      .evaluate((element) => element.getBoundingClientRect().left),
  ).toBeLessThan(2);

  await page.getByRole("button", { name: "Show sidebar" }).click();
  await expect(category).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 640, height: 600 });
  await expect(sidebar).toBeHidden();
  await page.getByRole("button", { name: "Show sidebar" }).click();
  await expect(sidebar).toBeVisible();
  await page.getByRole("button", { name: "Timestamp Tool" }).click();
  await expect(sidebar).toBeHidden();
  await expect(page.getByRole("tab", { name: "Timestamp Tool" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("使用多标签打开工具并进入本地插件管理", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Timestamp Tool" }).click();
  await expect(page.getByRole("tab", { name: "Timestamp Tool" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "Timestamp Tool" }).click({ button: "right" });
  await expect(page.getByRole("menu", { name: "Tab actions" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Close Other Tabs" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Plugin Manager" }).click();

  await expect(page.getByRole("heading", { name: "Plugin Manager" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Add ZIP Plugin/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Online/ })).toHaveCount(0);
});

test("JSON、XML、SQL 编辑区高亮并保持双栏格式化流程", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByRole("textbox", { name: "Input" }).fill('{"name":"DevBox","ok":true}');
  await expect
    .poll(async () =>
      page
        .getByRole("textbox", { name: "Input" })
        .locator(".cm-line span")
        .evaluateAll((nodes) =>
          nodes.some(
            (node) => getComputedStyle(node).color !== getComputedStyle(node.parentElement!).color,
          ),
        ),
    )
    .toBe(true);

  await page.getByRole("button", { name: "XML Tool" }).click();
  await expect(page.getByRole("heading", { name: "XML Tool" })).toBeVisible();
  await page.getByRole("textbox", { name: "Input" }).fill("<root><item/></root>");
  await expect
    .poll(async () =>
      page
        .getByRole("textbox", { name: "Input" })
        .locator(".cm-line span")
        .evaluateAll((nodes) =>
          nodes.some(
            (node) => getComputedStyle(node).color !== getComputedStyle(node.parentElement!).color,
          ),
        ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Format" }).click();
  await expect
    .poll(async () =>
      (
        await page.getByRole("textbox", { name: "Result" }).locator(".cm-line").allTextContents()
      ).join("\n"),
    )
    .toBe("<root>\n  <item/>\n</root>");
  await page.getByRole("textbox", { name: "Input" }).fill("<root>");
  await page.getByRole("button", { name: "Validate" }).click();
  await expect(page.getByRole("status")).toHaveText("Invalid XML");

  await page.getByRole("button", { name: "SQL Tool" }).click();
  await expect(page.getByRole("heading", { name: "SQL Tool" })).toBeVisible();
  await page.getByRole("combobox", { name: "Keywords" }).selectOption("upper");
  await page.getByRole("textbox", { name: "Input" }).fill("select name from users");
  await page.getByRole("button", { name: "Format" }).click();
  await expect
    .poll(async () =>
      (
        await page.getByRole("textbox", { name: "Result" }).locator(".cm-line").allTextContents()
      ).join("\n"),
    )
    .toBe("SELECT\n  name\nFROM\n  users");
  await expect
    .poll(async () =>
      page
        .getByRole("textbox", { name: "Result" })
        .locator(".cm-line span")
        .evaluateAll((nodes) =>
          nodes.some(
            (node) => getComputedStyle(node).color !== getComputedStyle(node.parentElement!).color,
          ),
        ),
    )
    .toBe(true);
  expect(
    await page
      .getByRole("tabpanel")
      .locator(".tool-editor-grid")
      .evaluate((element) => element.clientHeight),
  ).toBeGreaterThan(350);
});

test("窗口缩放时标签栏和应用壳层不显示系统滚动条", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto("/");

  for (const name of [
    "Timestamp Tool",
    "Encoding Tool",
    "UUID & Hash",
    "Plugin Manager",
    "Settings",
  ]) {
    await page.getByRole("button", { name }).click();
  }

  const tabList = page.getByRole("tablist", { name: "Open features" });
  await expect(tabList).toHaveCSS("overflow-y", "hidden");
  await expect(tabList).toHaveCSS("scrollbar-width", "none");
  expect(
    await tabList.evaluate((element) => element.scrollWidth > element.clientWidth),
  ).toBeTruthy();
  expect(
    await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    })),
  ).toEqual({ horizontal: false, vertical: false });
});

test("功能页隐藏分类路径并让编辑区占满剩余空间", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");

  await expect(page.locator(".page-eyebrow")).toHaveCount(0);
  const layout = await page.locator(".tool-page--editor").evaluate((toolPage) => {
    const editorGrid = toolPage.querySelector<HTMLElement>(".tool-editor-grid");
    if (!editorGrid) throw new Error("未找到编辑区");
    const pageRect = toolPage.getBoundingClientRect();
    const gridRect = editorGrid.getBoundingClientRect();
    return {
      bottomGap: Math.round(pageRect.bottom - gridRect.bottom),
      gridRatio: gridRect.height / pageRect.height,
    };
  });

  expect(layout.bottomGap).toBeLessThanOrEqual(24);
  expect(layout.gridRatio).toBeGreaterThan(0.55);
});

test("宽屏工作区让双栏编辑区充分利用可用宽度", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  const layout = await page.locator(".tool-page--editor").evaluate((toolPage) => {
    const parent = toolPage.parentElement;
    if (!parent) throw new Error("未找到工作区");
    return {
      pageWidth: toolPage.getBoundingClientRect().width,
      workspaceWidth: parent.getBoundingClientRect().width,
    };
  });

  expect(layout.pageWidth / layout.workspaceWidth).toBeGreaterThan(0.94);
});

test("文本编辑器首次打开为空且窄窗口不产生页面滚动条", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: "Text Editor" }).click();
  await expect(page.getByRole("heading", { name: "Text Editor" })).toBeVisible();
  await expect(page.getByText("Open a folder to browse and edit text files")).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Folder" })).toBeVisible();
  await expect(page.locator(".editor-file-tab")).toHaveCount(0);

  await page.setViewportSize({ width: 800, height: 600 });
  await expect(page.getByRole("heading", { name: "Text Editor" })).toBeVisible();
  expect(
    await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      vertical: document.documentElement.scrollHeight > document.documentElement.clientHeight,
    })),
  ).toEqual({ horizontal: false, vertical: false });
});

test("文本编辑器短文件仍填满正文，状态固定右下且编码菜单向上展开", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
      configurable: true,
      value: { unregisterListener: () => {} },
    });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        metadata: { currentWindow: { label: "main" } },
        invoke: (command: string) => {
          switch (command) {
            case "plugin:dialog|open":
              return Promise.resolve("/workspace");
            case "editor_open_directory":
              return Promise.resolve({ name: "workspace", path: "/workspace" });
            case "editor_list_directory":
              return Promise.resolve([
                { name: "short.txt", path: "short.txt", kind: "file", hidden: false },
              ]);
            case "editor_read_file":
              return Promise.resolve({
                path: "short.txt",
                content: "hello",
                revision: "hash",
                size: 5,
                readOnly: false,
                encoding: "UTF-8",
                lineEnding: "LF",
              });
            case "plugin:event|listen":
              return Promise.resolve(1);
            default:
              return Promise.resolve(null);
          }
        },
        transformCallback: () => 1,
        unregisterCallback: () => {},
      },
    });
  });
  await page.getByRole("button", { name: "Text Editor" }).click();
  await page.getByRole("button", { name: "Open Folder" }).click();
  await expect(page.locator(".editor-toolbar > button").first()).toHaveAttribute(
    "aria-label",
    "Files",
  );
  await page.getByRole("button", { name: "short.txt" }).click();
  await expect(page.locator(".editor-workarea .cm-editor")).toBeVisible();

  const layout = await page.locator(".editor-workarea").evaluate((workarea) => {
    const code = workarea.querySelector<HTMLElement>(".cm-editor")!;
    const status = workarea.querySelector<HTMLElement>(".editor-status")!;
    const area = workarea.getBoundingClientRect();
    const codeRect = code.getBoundingClientRect();
    const statusRect = status.getBoundingClientRect();
    const firstStatus = status.querySelector<HTMLElement>("span")!.getBoundingClientRect();
    return {
      codeHeight: codeRect.height,
      codeGap: statusRect.top - codeRect.bottom,
      statusBottomGap: area.bottom - statusRect.bottom,
      statusRightGap: area.right - statusRect.right,
      statusStartRatio: (firstStatus.left - area.left) / area.width,
    };
  });
  expect(layout.codeHeight).toBeGreaterThan(350);
  expect(Math.abs(layout.codeGap)).toBeLessThanOrEqual(3);
  expect(Math.abs(layout.statusBottomGap)).toBeLessThanOrEqual(3);
  expect(Math.abs(layout.statusRightGap)).toBeLessThanOrEqual(3);
  expect(layout.statusStartRatio).toBeGreaterThan(0.45);

  await page.locator(".editor-encoding > button").click();
  const button = await page.locator(".editor-encoding > button").boundingBox();
  const menu = await page.locator(".editor-encoding-menu").boundingBox();
  expect(button).not.toBeNull();
  expect(menu).not.toBeNull();
  expect(menu!.y + menu!.height).toBeLessThanOrEqual(button!.y + 1);
});

test("文本编辑器恢复上次文件并区分未知文件图标与越界跳转", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.setItem(
      "devbox.editor.workspace.v1",
      JSON.stringify({ rootPath: "/workspace", tabs: ["sample.txt"], activePath: "sample.txt" }),
    );
    Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
      configurable: true,
      value: { unregisterListener: () => {} },
    });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        metadata: { currentWindow: { label: "main" } },
        invoke: (command: string) => {
          switch (command) {
            case "editor_open_directory":
              return Promise.resolve({ name: "workspace", path: "/workspace" });
            case "editor_list_directory":
              return Promise.resolve([
                { name: "sample.txt", path: "sample.txt", kind: "file", hidden: false },
                { name: "blob.xyz", path: "blob.xyz", kind: "file", hidden: false },
              ]);
            case "editor_read_file":
              return Promise.resolve({
                path: "sample.txt",
                content: "a\nbcd",
                revision: "hash",
                size: 5,
                readOnly: false,
                encoding: "UTF-8",
                lineEnding: "LF",
              });
            case "plugin:event|listen":
              return Promise.resolve(1);
            default:
              return Promise.resolve(null);
          }
        },
        transformCallback: () => 1,
        unregisterCallback: () => {},
      },
    });
  });
  await page.getByRole("button", { name: "Text Editor" }).click();
  await expect(page.getByRole("tab", { name: "sample.txt" })).toBeVisible();
  const sampleRow = page.locator(".editor-tree-row").filter({ hasText: "sample.txt" });
  await expect(sampleRow).toHaveCSS("color", "rgb(232, 237, 242)");
  await expect(sampleRow.locator("svg")).toHaveClass(/editor-tree-icon--document/);
  await expect(page.getByRole("button", { name: "blob.xyz" }).locator("svg")).toHaveClass(
    /lucide-file-question-mark/,
  );
  await expect(page.getByRole("button", { name: "blob.xyz" }).locator("svg")).toHaveClass(
    /editor-tree-icon--neutral/,
  );
  await page.getByRole("button", { name: /Go to Line/ }).click();
  await expect(page.getByPlaceholder("line:column")).toBeVisible();
  await page.getByRole("textbox", { name: "Line and column" }).fill("99:99");
  await page
    .getByRole("dialog", { name: "Go to Line" })
    .getByRole("button", { name: "Confirm" })
    .click();
  await expect(page.locator(".editor-status")).toContainText("Ln 2, Col 4");
});

test("使用键盘切换标签并在设置中切换语言", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Timestamp Tool" }).click();
  const timestampTab = page.getByRole("tab", { name: "Timestamp Tool" });
  await timestampTab.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("tab", { name: "JSON Tool" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("combobox", { name: "Language" }).selectOption("zh-CN");
  await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
  await expect(page.getByRole("button", { name: "数据处理" })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
});

test("首屏和标签切换不超过冒烟性能上限", async ({ page }) => {
  const navigationStarted = Date.now();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "JSON Tool" })).toBeVisible();
  expect(Date.now() - navigationStarted).toBeLessThan(15_000);

  const switchStarted = Date.now();
  await page.getByRole("button", { name: "Encoding Tool" }).click();
  await expect(page.getByRole("heading", { name: "Encoding Tool" })).toBeVisible();
  expect(Date.now() - switchStarted).toBeLessThan(3_000);
});
