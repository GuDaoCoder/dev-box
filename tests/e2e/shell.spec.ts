import { expect, test } from "@playwright/test";

test("boots the DevBox application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("DevBox", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The foundation is ready." })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
});
