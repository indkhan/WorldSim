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

test("explains an unreachable simulation server",async({page})=>{
  await page.route("**/api/simulations",route=>route.abort());
  await page.goto("/");
  await page.getByRole("button",{name:"Use deterministic mode"}).click();
  await page.getByLabel("World event").fill("A sudden shipping interruption closes a major trade route.");
  await page.getByRole("button",{name:"Run world"}).click();
  await expect(page.locator(".error-banner")).toContainText("WorldSim could not reach the simulation server");
});
