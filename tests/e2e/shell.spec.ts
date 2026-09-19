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

  await page.getByRole("button", { name: "Plugin Manager" }).click();

  await expect(page.getByRole("heading", { name: "Plugin Manager" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Add ZIP Plugin/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Online/ })).toHaveCount(0);
});
