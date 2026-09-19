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
  await expect(page.locator(".error-banner")).toHaveCount(0);
});
