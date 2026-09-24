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
