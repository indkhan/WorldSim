import { expect, test } from '@playwright/test';

test('visual guide works offline and displays recorded weeks and policy branches', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/explainer.html');
  await page.context().setOffline(true);
  await expect(page.getByRole('heading', { name: 'Nothing arrives by magic.' })).toBeVisible();
  for (const week of [0, 9, 16]) {
    await page.locator('#week').fill(String(week));
    const expected = await page.evaluate(w => {
      const data = JSON.parse(document.querySelector('#demo-data')!.textContent!);
      return data.base[w].DEU.output.toFixed(1);
    }, week);
    await expect(page.locator('#output')).toHaveText(expected);
  }
  await expect(page.getByRole('button', { name: 'Next week', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Household relief', exact: true }).click();
  await expect(page.locator('#budget')).toHaveText('80');
  await expect(page.locator('#branch-note')).toHaveText('Fund week 4 → active week 5');
  await page.getByRole('button', { name: 'Reroute shipments', exact: true }).click();
  await expect(page.locator('#budget')).toHaveText('60');
  await expect(page.locator('#branch-note')).toHaveText('Fund week 4 → active week 6');
  for (const width of [1440, 728, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});
