import { test, expect } from "@playwright/test";
test("demo opens without a key and supports country history and a controlled policy comparison", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Follow the disruption, week by week." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Germany", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Germany", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Germany", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Selected week").fill("6");
  await page.getByRole("button", { name: "Compare rerouting" }).click();
  await expect(
    page.getByText("Controlled policy comparison", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/same checkpoint/i).first()).toBeVisible();
  await expect(page.getByLabel("Country output history")).toBeVisible();
  await page.getByRole("button", { name: "Run scenario", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Completed 16 weeks");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export replay" }).click();
  const download = await downloadEvent;
  await page
    .getByLabel("Open replay file")
    .setInputFiles((await download.path())!);
  await expect(page.getByRole("status")).toContainText("Replay file loaded");
  await expect(page.getByLabel("Selected week")).toHaveValue("0");
});
test("mobile demo stays within the viewport and exposes assumptions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Follow the disruption, week by week." }),
  ).toBeVisible();
  await page.getByText("Data and assumptions", { exact: true }).click();
  await expect(page.getByText(/Annual trade data/).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("keyboard users can skip the controls and inspect the replay", async ({
  page,
}) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to replay" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#shipping-stage")).toBeFocused();
});
