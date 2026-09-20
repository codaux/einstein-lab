import { test, expect } from "@playwright/test";

test("local tiling button runs the solver in the browser", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Square" }).click();

  const runButton = page.getByRole("button", { name: "Run local tiling test" });
  await expect(runButton).toBeEnabled();
  await runButton.click();

  await expect(page.getByRole("button", { name: "Running solver…" })).toBeVisible();

  await expect(
    page.getByText(/Local compatibility found|No convincing growth found/)
  ).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText("Solver error")).toHaveCount(0);
});
