import { expect, test } from "@playwright/test";

test("启动 DevBox 应用壳层并打开命令面板", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("DevBox", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The foundation is connected." })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
});
