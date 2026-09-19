import {expect,test} from "@playwright/test";

test("runs a blank scenario without API keys",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("dialog",{name:"Connect decision providers"})).toBeVisible();
  await page.getByRole("button",{name:"Use deterministic mode"}).click();

  const event=page.getByLabel("World event");
  await expect(event).toHaveValue("");
  await event.fill("A sudden shipping interruption closes a major trade route.");
  await page.getByRole("button",{name:"Run world"}).click();

  await expect(page.getByText("Custom world event")).toBeVisible({timeout:30_000});
  await expect(page.getByText("Rules only")).toBeVisible();
  await expect(page.getByText("WEEK 1",{exact:true})).toBeVisible({timeout:5_000});
  await expect(page.locator(".error-banner")).toHaveCount(0);
});

test("keeps result-only controls unavailable before a scenario runs",async({page})=>{
  await page.goto("/");
  await page.getByRole("button",{name:"Use deterministic mode"}).click();

  await expect(page.getByRole("button",{name:"Compare to baseline"})).toBeDisabled();
  await expect(page.getByRole("button",{name:"Branch from week 0"})).toBeDisabled();
  await expect(page.getByLabel("Simulation week")).toBeDisabled();
  await expect(page.getByText("Active links")).toHaveCount(0);
});

test("explains an unreachable simulation server",async({page})=>{
  await page.route("**/api/simulations",route=>route.abort());
  await page.goto("/");
  await page.getByRole("button",{name:"Use deterministic mode"}).click();
  await page.getByLabel("World event").fill("A sudden shipping interruption closes a major trade route.");
  await page.getByRole("button",{name:"Run world"}).click();
  await expect(page.locator(".error-banner")).toContainText("WorldSim could not reach the simulation server");
});

test("validates provider keys before entering the lab",async({page})=>{
  let validated=false;
  await page.route("**/api/providers/validate",route=>{validated=true;return route.fulfill({status:200,contentType:"application/json",body:"{\"ok\":true}"})});
  await page.goto("/");
  await page.getByLabel("TypeSafe / Jev API key").fill("jev-test-key");
  await page.getByLabel("OpenRouter API key").fill("openrouter-test-key");
  await page.getByRole("button",{name:"Connect providers"}).click();
  await expect.poll(()=>validated).toBe(true);
  await expect(page.getByRole("dialog",{name:"Connect decision providers"})).toHaveCount(0);
});
