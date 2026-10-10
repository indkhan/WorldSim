import { describe, expect, it } from "vitest";
import {
  runShipping,
  branchShipping,
  defaultShippingPlan,
  shippingPlanSchema,
  shippingLinks,
  initialShippingFrame,
  stepShipping,
  ruleShippingDecisions,
} from "@/lib/simulation/shipping";
import { packResult, unpackStored } from "@/lib/simulation/transport-server";
import { parseShippingReplay } from "@/lib/simulation/shipping-replay";

describe("shipping resource engine", () => {
  it("holds the unshocked supply chain at its initial equilibrium", () => {
    const r = runShipping({ ...defaultShippingPlan, severity: 0 });
    expect(r.frames).toHaveLength(17);
    expect(r.frames[0].countries).toHaveLength(8);
    for (const f of r.frames)
      for (const c of f.countries) {
        expect(c.shipping!.output).toBeCloseTo(100, 6);
        expect(c.shipping!.inventory).toBeCloseTo(
          defaultShippingPlan.inventoryWeeks * 100,
          6,
        );
      }
  });
  it("accounts for stock, finite public money and delayed intervention each week", () => {
    const r = runShipping({
      ...defaultShippingPlan,
      inventoryWeeks: 1,
      severity: 90,
      policy: "reroute",
      policyWeek: 1,
    });
    for (let i = 1; i < r.frames.length; i++)
      for (const c of r.frames[i].countries) {
        const s = c.shipping!,
          previous = r.frames[i - 1].countries.find(
            (x) => x.code === c.code,
          )!.shipping!;
        expect(s.inventory).toBeCloseTo(
          previous.inventory + s.arrivals - s.output,
          7,
        );
        expect(s.inventory).toBeGreaterThanOrEqual(0);
        expect(s.budget).toBeGreaterThanOrEqual(0);
        expect(s.budget).toBeLessThanOrEqual(previous.budget);
        expect(s.households.every((h) => h.savings >= 0)).toBe(true);
        expect(c.pressure).toBeGreaterThanOrEqual(0);
        expect(c.pressure).toBeLessThanOrEqual(1);
        expect(c.productionPressure).toBeLessThanOrEqual(1);
      }
    expect(
      r.frames[1].countries.find((c) => c.code === "DEU")!.shipping!.rerouted,
    ).toBe(false);
    expect(
      r.frames[3].countries.find((c) => c.code === "DEU")!.shipping!.rerouted,
    ).toBe(true);
    expect(
      r.frames.some((f) => f.countries.some((c) => c.shipping!.output < 100)),
    ).toBe(true);
  });
  it("branches the complete checkpoint and preserves its prefix and shock clock", () => {
    const parent = runShipping(defaultShippingPlan);
    const child = branchShipping(parent, "reroute", 3);
    expect(child.frames.slice(0, 4)).toEqual(parent.frames.slice(0, 4));
    expect(child.frames[4].shipping!.shipments).not.toEqual([]);
    expect(child.scenario.shipping!.shockStartWeek).toBe(
      defaultShippingPlan.shockStartWeek,
    );
    expect(() => branchShipping(parent, "reroute", 17)).toThrow();
    expect(
      child.frames.at(-1)!.countries.find((c) => c.code === "DEU")!.shipping!
        .budget,
    ).toBeLessThan(100);
  });
  it("replays exactly and keeps shipping state through the existing compressed transport", () => {
    const r = runShipping(defaultShippingPlan);
    expect(runShipping(defaultShippingPlan)).toEqual(r);
    expect(unpackStored(packResult(r))).toEqual(r);
    expect(parseShippingReplay(JSON.parse(JSON.stringify(r)))).toEqual(r);
    const broken = structuredClone(r);
    broken.frames[2].countries[0].shipping!.inventory = -1;
    expect(() => parseShippingReplay(broken)).toThrow();
    const reordered = structuredClone(r);
    reordered.frames[1].countries.reverse();
    expect(() => parseShippingReplay(reordered)).toThrow();
    const invalidAction = structuredClone(r);
    invalidAction.frames[1].countries[0].shipping!.decisions[0].action =
      "invented";
    expect(() => parseShippingReplay(invalidAction)).toThrow();
    const badScale = structuredClone(r);
    badScale.frames[1].countries[0].pressure = 80;
    expect(() => parseShippingReplay(badScale)).toThrow();
  });
  it("rejects invalid resource settings and interventions outside the horizon", () => {
    expect(
      shippingPlanSchema.safeParse({
        ...defaultShippingPlan,
        inventoryWeeks: -1,
      }).success,
    ).toBe(false);
    expect(
      shippingPlanSchema.safeParse({ ...defaultShippingPlan, policyWeek: 30 })
        .success,
    ).toBe(false);
  });
  it("reduces supplier output and wages when fulfilled export orders decline", () => {
    const r = runShipping({
      ...defaultShippingPlan,
      severity: 100,
      shockStartWeek: 1,
    });
    const china = r.frames[1].countries.find(
      (c) => c.code === "CHN",
    )!.shipping!;
    expect(china.output).toBeLessThan(100);
    expect(china.households[0].savings).toBeLessThan(0.5);
  });
  it("conserves in-transit deliveries and queued orders across the complete horizon", () => {
    const r = runShipping(defaultShippingPlan);
    const normal = shippingLinks.reduce((n, l) => n + l.share * 100, 0);
    for (let i = 1; i < r.frames.length; i++) {
      const old = r.frames[i - 1].shipping!,
        next = r.frames[i].shipping!;
      expect(next.shipments.reduce((n, s) => n + s.quantity, 0)).toBeCloseTo(
        old.shipments.reduce((n, s) => n + s.quantity, 0) +
          next.dispatched -
          next.delivered,
        7,
      );
      expect(
        Object.values(next.backlog).reduce((n, v) => n + v, 0),
      ).toBeCloseTo(
        Object.values(old.backlog).reduce((n, v) => n + v, 0) +
          normal -
          next.dispatched,
        7,
      );
    }
  });
  it("does not turn reduced demand into a shortage or execute unaffordable actions", () => {
    const p = { ...defaultShippingPlan, severity: 0 };
    const f = initialShippingFrame(p);
    const germany = f.countries.find((c) => c.code === "DEU")!;
    germany.shipping!.cash = 0;
    const actions = ruleShippingDecisions(f).map((d) =>
      d.country === "DEU"
        ? {
            ...d,
            action:
              d.actor === "firm"
                ? "expedite"
                : d.actor === "government"
                  ? "observe"
                  : "defer",
          }
        : d,
    );
    const c = stepShipping(f, p, 1, actions).countries.find(
      (c) => c.code === "DEU",
    )!.shipping!;
    expect(c.priceIndex).toBe(100);
    expect(c.decisions.find((d) => d.actor === "firm")!.action).toBe("hold");
    const denied = runShipping({
      ...defaultShippingPlan,
      policy: "reroute",
      policyWeek: 1,
      publicBudget: 20,
    });
    expect(
      denied.frames.every((f) =>
        f.countries.every((c) => !c.shipping!.rerouted),
      ),
    ).toBe(true);
  });
});
