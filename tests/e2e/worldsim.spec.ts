import { expect, test } from "@playwright/test";
test("renders Earth, supports rotation, and focuses the inspected country", async ({ page }, testInfo) => {
  testInfo.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  const earth = page.getByRole("region", { name: "Interactive Earth" });
  await expect(earth).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  const rotate = page.getByRole("button", { name: "Rotate Earth", exact: true });
  await expect(rotate).toHaveAttribute("aria-pressed", "false");
  const stillEarth = await earth.locator("canvas").screenshot();
  await rotate.click();
  await expect(page.getByRole("button", { name: "Pause rotation" })).toHaveAttribute("aria-pressed", "true");
  expect(stillEarth.equals(await earth.locator("canvas").screenshot())).toBe(false);
  await page.getByRole("button", { name: "Pause rotation" }).click();
  await page.getByLabel("Inspect country").selectOption({ label: "France" });
  await expect(earth).toHaveAttribute("data-country", "FRA");
  const shot = await earth.screenshot({ path: testInfo.outputPath("earth-desktop.png") });
  expect(shot.length).toBeGreaterThan(10000);
  await testInfo.attach("earth-desktop", { body: shot, contentType: "image/png" });
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.getByLabel("World event").fill("A major energy disruption affects international supply.");
  await page.getByLabel("Horizon in weeks").fill("4");
  await page.getByRole("button", { name: "Run world" }).click();
  await expect(page.getByRole("button", { name: "Run world" })).toBeEnabled({ timeout: 30000 });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  const before = await earth.screenshot();
  await page.getByLabel("Simulation week").fill("4");
  await expect(earth).toHaveAttribute("data-week", "4");
  const after = await earth.screenshot({ path: testInfo.outputPath("earth-simulation.png") });
  expect(before.equals(after)).toBe(false);
  await page.setViewportSize({ width: 375, height: 812 });
  await expect.poll(() => earth.locator("canvas").evaluate((canvas) => Math.round(canvas.getBoundingClientRect().height))).toBe(420);
  await testInfo.attach("earth-mobile", { body: await earth.screenshot({ path: testInfo.outputPath("earth-mobile.png") }), contentType: "image/png" });
});
test("keeps optional controls tucked away and fits narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await expect(page.getByLabel("Shock decay scale (weeks)")).toBeHidden();
  await page.getByText("Advanced settings", { exact: true }).click();
  await expect(page.getByLabel("Shock decay scale (weeks)")).toBeVisible();
  await expect(page.getByLabel("Saved runs")).toBeHidden();
  await page.locator(".run-library > summary").click();
  await expect(page.getByLabel("Saved runs")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("runs a blank scenario without API keys", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("dialog", { name: "Connect OpenRouter" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  const event = page.getByLabel("World event");
  await expect(event).toHaveValue("");
  await event.fill(
    "A sudden shipping interruption closes a major trade route.",
  );
  await page.getByRole("button", { name: "Run world" }).click();
  await expect(page.getByText("Custom world event")).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText("Rules only")).toBeVisible();
  await expect(page.getByText("WEEK 1", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(page.locator(".error-banner")).toHaveCount(0);
});
test("keeps result-only controls unavailable before a scenario runs", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await expect(
    page.getByRole("button", { name: "Compare to baseline" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Branch from week 0" }),
  ).toBeDisabled();
  await expect(page.getByLabel("Simulation week")).toBeDisabled();
  await expect(page.getByText("Active links")).toHaveCount(0);
});
test("provides a heading and skip link for keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "WorldSim" })).toBeVisible();
  const skip = page.getByRole("link", { name: "Skip to simulator" });
  await expect(skip).toBeVisible();
  await expect(page.locator("#simulation-lab")).toHaveAttribute(
    "tabindex",
    "-1",
  );
});
test("explains an unreachable simulation server", async ({ page }) => {
  await page.route("**/api/simulations", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await page
    .getByLabel("World event")
    .fill("A sudden shipping interruption closes a major trade route.");
  await page.getByRole("button", { name: "Run world" }).click();
  await expect(page.locator(".error-banner")).toContainText(
    "WorldSim could not reach the simulation server",
  );
});
test("validates provider keys before entering the lab", async ({ page }) => {
  let validated = false;
  await page.route("**/api/providers/validate", (route) => {
    validated = true;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: '{"ok":true}',
    });
  });
  await page.goto("/");
  await page.getByLabel("OpenRouter API key").fill("openrouter-test-key");
  await page.getByRole("button", { name: "Connect OpenRouter" }).click();
  await expect.poll(() => validated).toBe(true);
  await expect(
    page.getByRole("dialog", { name: "Connect OpenRouter" }),
  ).toHaveCount(0);
});
test("contains keyboard focus and restores it on dismissal", async ({
  page,
}) => {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "Connect OpenRouter" });
  await expect(page.getByLabel("OpenRouter API key")).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest("dialog")),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#simulation-lab")).toBeFocused();
});
test("baseline uses completed settings and clears after a new run", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await page
    .getByLabel("World event")
    .fill("Synthetic energy disruption for testing.");
  await page.getByRole("button", { name: "Run world" }).click();
  await expect(page.getByRole("button", { name: "Run world" })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByLabel("Horizon in weeks").fill("4");
  const request = page.waitForRequest(
    (r) => r.method() === "POST" && r.url().endsWith("/api/simulations"),
  );
  await page.getByRole("button", { name: "Compare to baseline" }).click();
  expect((await request).postDataJSON()).toMatchObject({
    durationWeeks: 12,
    severity: 0,
    description: "Synthetic energy disruption for testing.",
  });
  await expect(page.getByText("GLOBAL PRESSURE DELTA")).toBeVisible();
  await page.getByRole("button", { name: "Run world" }).click();
  await expect(page.getByRole("button", { name: "Run world" })).toBeEnabled();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByText("Create a baseline")).toBeVisible();
});
test("searches countries and controls playback", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await page
    .getByLabel("World event")
    .fill("Synthetic energy disruption for testing.");
  await page.getByRole("button", { name: "Run world" }).click();
  await expect(page.getByRole("button", { name: "Run world" })).toBeEnabled({
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByText("WEEK 0", { exact: true })).toBeVisible();
  await page.getByLabel("Search countries").fill("France");
  await page.getByLabel("Inspect country").selectOption({ label: "France" });
  await expect(
    page.getByRole("heading", { name: "France", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Business", exact: true }).click();
  await expect(page.locator(".cohort")).not.toHaveCount(0);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await expect(page.getByText("WEEK 1", { exact: true })).toBeVisible();
});
test("keeps Methodology visible on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await expect(page.getByRole("link", { name: "Methodology" })).toBeVisible();
});
test("loads saved history, metadata and parent ancestry", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/simulations", {
    headers: { "x-provider-mode": "deterministic" },
    data: {
      title: "Saved example",
      description: "Synthetic energy disruption.",
      family: "energy",
      severity: 70,
      durationWeeks: 4,
      seed: 42,
    },
  });
  const packed = await response.json();
  packed.id = "child";
  packed.createdAt = "2026-01-01T00:00:00.000Z";
  packed.saveStatus = "saved";
  packed.scenario.parentSimulationId = "parent";
  packed.scenario.branchWeek = 2;
  await page.route("**/api/simulations", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [
            {
              id: "child",
              title: "Saved example",
              createdAt: packed.createdAt,
            },
          ],
        })
      : route.continue(),
  );
  await page.route("**/api/simulations/child", (route) =>
    route.fulfill({ json: packed }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await page.locator(".run-library > summary").click();
  await page.getByRole("button", { name: "Refresh saved history" }).click();
  await expect(page.getByLabel("Saved runs")).toContainText("Saved example");
  await page.getByLabel("Saved runs").selectOption("child");
  await expect(page.getByText("Saved example", { exact: true })).toBeVisible();
  await expect(page.locator(".run-library").getByRole("status")).toContainText("Saved 2026-01-01");
  await expect(
    page.getByRole("button", { name: "Replay parent parent (week 2)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Branch from week 0" }),
  ).toBeEnabled();
});
test("clears a previous baseline when branching a saved run", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/simulations", {
    headers: { "x-provider-mode": "deterministic" },
    data: {
      title: "Saved run",
      description: "Synthetic energy disruption.",
      family: "energy",
      severity: 70,
      durationWeeks: 4,
      seed: 42,
    },
  });
  const packed = await response.json();
  packed.id = "parent";
  packed.createdAt = "2026-01-01T00:00:00.000Z";
  packed.saveStatus = "saved";
  await page.route("**/api/simulations", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          json: [
            { id: "parent", title: "Saved run", createdAt: packed.createdAt },
          ],
        })
      : route.continue(),
  );
  await page.route("**/api/simulations/parent", (route) =>
    route.fulfill({ json: packed }),
  );
  await page.route("**/api/simulations/parent/branch", (route) =>
    route.fulfill({
      json: {
        ...packed,
        id: "child",
        scenario: {
          ...packed.scenario,
          parentSimulationId: "parent",
          branchWeek: 0,
          title: "Branch: Saved run",
        },
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Use deterministic mode" }).click();
  await page.locator(".run-library > summary").click();
  await page.getByRole("button", { name: "Refresh saved history" }).click();
  await expect(page.getByLabel("Saved runs")).toContainText("Saved run");
  await page.getByLabel("Saved runs").selectOption("parent");
  await expect(page.getByText("Saved run", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Compare to baseline" }).click();
  await expect(page.getByText("GLOBAL PRESSURE DELTA")).toBeVisible();
  await page.getByRole("button", { name: "Branch from week 0" }).click();
  await expect(
    page.getByText("Branch: Saved run", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByText("Create a baseline")).toBeVisible();
});
