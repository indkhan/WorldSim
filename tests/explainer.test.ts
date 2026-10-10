import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { branchShipping, defaultShippingPlan, runShipping, shippingLinks } from '@/lib/simulation/shipping';

test('visual guide charts match the current shipping engine and trade weights', () => {
  const html = readFileSync('public/explainer.html', 'utf8');
  const embedded = JSON.parse(html.match(/<script id="demo-data" type="application\/json">([\s\S]*?)<\/script>/)![1]);
  const base = runShipping(defaultShippingPlan);
  const runs = { base, reroute: branchShipping(base, 'reroute', 3), relief: branchShipping(base, 'relief', 3) };
  expect(embedded.links).toEqual(shippingLinks.map(({ from, to, share }) => ({ from, to, share })));
  for (const [name, run] of Object.entries(runs)) {
    expect(embedded[name]).toEqual(run.frames.map(frame => Object.fromEntries(frame.countries.map(country => {
      const state = country.shipping!;
      return [country.code, {
        inventory: state.inventory, arrivals: state.arrivals, output: state.output,
        budget: state.budget, savings: state.households.find(household => household.income === 'low')!.savings,
      }];
    }))));
  }
});
