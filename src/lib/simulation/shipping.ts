import { z } from "zod";
import countries from "@/data/countries.json";
import trade from "@/data/shipping-trade.json";
import type { CountryState, SimulationFrame, SimulationResult } from "./types";

export const SHIPPING_ENGINE = "shipping-1.0";
export const SHIPPING_PROMPT = "shipping-decisions-1.0";
export const shippingPlanSchema = z
  .object({
    title: z.string().min(2).max(120),
    description: z.string().min(10).max(2000),
    durationWeeks: z.number().int().min(4).max(24),
    severity: z.number().min(0).max(100),
    shockStartWeek: z.number().int().min(1).max(24),
    shockDurationWeeks: z.number().int().min(1).max(16),
    inventoryWeeks: z.number().min(0).max(6),
    leadWeeks: z.number().int().min(1).max(4),
    publicBudget: z.number().min(0).max(200),
    policy: z.enum(["none", "reroute", "relief"]),
    policyWeek: z.number().int().min(1).max(24),
  })
  .refine(
    (p) =>
      p.shockStartWeek <= p.durationWeeks && p.policyWeek <= p.durationWeeks,
    "Start weeks must fit within the horizon",
  );
export type ShippingPlan = z.infer<typeof shippingPlanSchema>;
export type Policy = ShippingPlan["policy"];
export const defaultShippingPlan: ShippingPlan = {
  title: "When the shipping lane slows down",
  description:
    "A disruption reduces Asia–Europe electrical equipment shipping capacity for eight weeks. Compare supplier delays, factory output and household buffers before and after an intervention.",
  durationWeeks: 16,
  severity: 70,
  shockStartWeek: 2,
  shockDurationWeeks: 8,
  inventoryWeeks: 1.5,
  leadWeeks: 2,
  publicBudget: 100,
  policy: "none",
  policyWeek: 4,
};
export const ACTOR_OPTIONS = {
  low: ["maintain", "defer"],
  middle: ["maintain", "defer"],
  high: ["maintain", "defer"],
  firm: ["hold", "expedite"],
  government: ["observe", "reroute", "relief"],
} as const;
export type ActorId = keyof typeof ACTOR_OPTIONS;
export type ShippingDecision = {
  country: string;
  actor: ActorId;
  action: string;
  rationale: string;
  evidenceWeeks: number[];
  source: "rules" | "openrouter" | "reused" | "intervention";
  requestedAction?: string;
};
export type Household = {
  income: "low" | "middle" | "high";
  share: number;
  savings: number;
  strain: number;
  action: string;
};
export type ShippingCountry = {
  inventory: number;
  arrivals: number;
  output: number;
  priceIndex: number;
  cash: number;
  budget: number;
  rerouted: boolean;
  reliefUntil: number;
  pendingPolicy?: { action: "reroute" | "relief"; effectiveWeek: number };
  households: Household[];
  decisions: ShippingDecision[];
};
export type Shipment = {
  from: string;
  to: string;
  quantity: number;
  dispatched: number;
  arrival: number;
};
export type ShippingCheckpoint = {
  shipments: Shipment[];
  backlog: Record<string, number>;
  delivered: number;
  dispatched: number;
  events: string[];
};
export type ShippingAudit = {
  engine: string;
  prompt: string;
  data: string;
  requestedModel?: string;
  requests: {
    week: number;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    cost: number | null;
  }[];
  attemptedCalls?: number;
  reviewWeeks: number[];
  warnings: string[];
  comparison?: string;
};
const supplierIds: Record<number, string> = {
  156: "CHN",
  410: "KOR",
  699: "IND",
};
export const shippingLinks = trade.rows.flatMap((row) => {
  const records = row.data ?? [];
  const total = records.find((x) => x.partnerCode === 0)?.primaryValue ?? 0;
  return records
    .filter(
      (x) => supplierIds[x.partnerCode] && x.primaryValue > 0 && total > 0,
    )
    .map((x) => ({
      from: supplierIds[x.partnerCode],
      to: row.code,
      share: x.primaryValue / total,
      annualValue: x.primaryValue,
      totalImports: total,
      source: row.url,
    }));
});
export const shippingCountryCodes = [
  "CHN",
  "KOR",
  "IND",
  "DEU",
  "FRA",
  "GBR",
  "ITA",
  "NLD",
];
const clamp = (v: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, v));
export function shippingReviews(horizon: number) {
  return Array.from({ length: Math.ceil(horizon / 4) }, (_, i) => 1 + i * 4);
}
function frame(
  week: number,
  states: CountryState[],
  shipping: ShippingCheckpoint,
): SimulationFrame {
  const mean = (field: "pressure" | "householdStrain" | "productionPressure") =>
    states.reduce((n, c) => n + c[field], 0) / states.length;
  return {
    week,
    countries: states,
    flows: shippingLinks.map((l) => ({
      from: l.from,
      to: l.to,
      strength: l.share,
      kind: "trade",
    })),
    globalPressure: mean("pressure"),
    globalHouseholdStrain: mean("householdStrain"),
    globalProductionPressure: mean("productionPressure"),
    shipping,
  };
}
export function initialShippingFrame(plan: ShippingPlan): SimulationFrame {
  const states: CountryState[] = shippingCountryCodes.map((code) => {
    const c = countries.find((c) => c.code === code)!;
    return {
      ...c,
      pressure: 0,
      householdStrain: 0,
      productionPressure: 0,
      policyResponse: 0,
      agents: 5,
      cohorts: [],
      decisions: [],
      imports: shippingLinks
        .filter((l) => l.to === code)
        .reduce((n, l) => n + l.share, 0),
      exports: shippingLinks
        .filter((l) => l.from === code)
        .reduce((n, l) => n + l.share, 0),
      energyExposure: 0,
      adaptiveCapacity: 0,
      shipping: {
        inventory: plan.inventoryWeeks * 100,
        arrivals: 100,
        output: 100,
        priceIndex: 100,
        cash: 100,
        budget: plan.publicBudget,
        rerouted: false,
        reliefUntil: 0,
        households: [
          {
            income: "low",
            share: 0.4,
            savings: 0.5,
            strain: 0,
            action: "maintain",
          },
          {
            income: "middle",
            share: 0.4,
            savings: 2,
            strain: 0,
            action: "maintain",
          },
          {
            income: "high",
            share: 0.2,
            savings: 6,
            strain: 0,
            action: "maintain",
          },
        ],
        decisions: [],
      },
    };
  });
  const shipments = shippingLinks.flatMap((l) =>
    Array.from({ length: plan.leadWeeks }, (_, i) => ({
      from: l.from,
      to: l.to,
      quantity: l.share * 100,
      dispatched: i + 1 - plan.leadWeeks,
      arrival: i + 1,
    })),
  );
  return frame(0, states, {
    shipments,
    backlog: {},
    delivered: 0,
    dispatched: 0,
    events: ["Steady-state pipeline initialized before the shock."],
  });
}
export function ruleShippingDecisions(
  previous: SimulationFrame,
): ShippingDecision[] {
  return previous.countries.flatMap((c) => {
    const s = c.shipping!;
    return (Object.keys(ACTOR_OPTIONS) as ActorId[]).map((actor) => ({
      country: c.code,
      actor,
      action:
        actor === "government"
          ? "observe"
          : actor === "firm"
            ? s.inventory < 100 && s.output < 100 && s.cash >= 10
              ? "expedite"
              : "hold"
            : s.priceIndex > 110 &&
                s.households.find((h) => h.income === actor)!.savings < 2
              ? "defer"
              : "maintain",
      rationale:
        actor === "government"
          ? "The scenario controls public intervention."
          : actor === "firm"
            ? `Prior inventory ${s.inventory.toFixed(1)} units; cash ${s.cash.toFixed(1)} units.`
            : `Prior price index ${s.priceIndex.toFixed(1)} and this income group's savings determine the response.`,
      evidenceWeeks: [previous.week],
      source: "rules" as const,
    }));
  });
}
export function stepShipping(
  previous: SimulationFrame,
  plan: ShippingPlan,
  week: number,
  choices: ShippingDecision[] = ruleShippingDecisions(previous),
): SimulationFrame {
  // All choices observe one frozen checkpoint; dispatch and production commit after decisions.
  const states = structuredClone(previous.countries),
    old = previous.shipping!;
  const shipments = old.shipments
    .filter((s) => s.arrival > week)
    .map((s) => ({ ...s }));
  const arriving = old.shipments.filter((s) => s.arrival === week);
  const backlog = { ...old.backlog },
    events: string[] = [];
  let dispatched = 0;
  const active =
    week >= plan.shockStartWeek &&
    week < plan.shockStartWeek + plan.shockDurationWeeks;
  if (week === plan.shockStartWeek && plan.severity > 0)
    events.push(`Lane capacity falls by ${plan.severity}%.`);
  if (
    week === plan.shockStartWeek + plan.shockDurationWeeks &&
    plan.severity > 0
  )
    events.push(
      "Lane reopens; outstanding orders clear at 150% of normal weekly capacity.",
    );
  for (const c of states) {
    const s = c.shipping!,
      before = previous.countries.find((x) => x.code === c.code)!.shipping!;
    s.decisions = choices
      .filter((d) => d.country === c.code)
      .map((d) => ({ ...d }));
    for (const d of s.decisions)
      if (!ACTOR_OPTIONS[d.actor].includes(d.action as never))
        throw new Error("Invalid actor action");
    if (s.pendingPolicy && s.pendingPolicy.effectiveWeek <= week) {
      if (s.pendingPolicy.action === "reroute") s.rerouted = true;
      else s.reliefUntil = week + 4;
      events.push(`${c.code}: ${s.pendingPolicy.action} becomes active.`);
      delete s.pendingPolicy;
    }
    // Government is an experimental control, even when household/firm actions use AI.
    const importing = shippingLinks.some((l) => l.to === c.code);
    if (importing && week === plan.policyWeek && plan.policy !== "none") {
      const cost = plan.policy === "reroute" ? 40 : 20;
      const accepted = s.budget >= cost;
      if (accepted) {
        s.budget -= cost;
        s.pendingPolicy = {
          action: plan.policy,
          effectiveWeek: week + (plan.policy === "reroute" ? 2 : 1),
        };
      }
      s.decisions = s.decisions.filter((d) => d.actor !== "government");
      s.decisions.push({
        country: c.code,
        actor: "government",
        action: accepted ? plan.policy : "observe",
        rationale: accepted
          ? `${cost} public budget units committed; effect delayed ${plan.policy === "reroute" ? 2 : 1} weeks.`
          : `Insufficient budget: requires ${cost}, available ${s.budget}.`,
        evidenceWeeks: [previous.week],
        source: "intervention",
      });
      events.push(
        `${c.code}: ${accepted ? `${plan.policy} funded` : "intervention rejected: insufficient budget"}.`,
      );
    }
    const expedited =
      s.decisions.find((d) => d.actor === "firm")?.action === "expedite" &&
      s.cash >= 10;
    if (!expedited)
      s.decisions = s.decisions.map((d) =>
        d.actor === "firm" && d.action === "expedite"
          ? {
              ...d,
              requestedAction: "expedite",
              action: "hold",
              rationale: `${d.rationale} Action rejected: less than 10 cash units available.`,
            }
          : d,
      );
    if (expedited) s.cash -= 10;
    const share = shippingLinks
      .filter((l) => l.to === c.code)
      .reduce((n, l) => n + l.share, 0);
    s.arrivals =
      (1 - share) * 100 +
      arriving
        .filter((a) => a.to === c.code)
        .reduce((n, a) => n + a.quantity, 0);
    const available = before.inventory + s.arrivals;
    const deferred = s.households.reduce(
      (n, h) =>
        n +
        (s.decisions.find((d) => d.actor === h.income)?.action === "defer"
          ? h.share * 0.12
          : 0),
      0,
    );
    s.output = Math.min(100 * (1 - deferred), available);
    s.inventory = available - s.output;
    s.priceIndex =
      100 +
      Math.max(0, 100 - available) * 0.8 +
      (active ? plan.severity * share * 0.15 : 0) +
      (expedited ? 2 : 0);
    s.cash = clamp(s.cash + (s.output - 100) * 0.1, 0, 100);
    for (const l of shippingLinks.filter((l) => l.to === c.code)) {
      const id = `${l.from}-${l.to}`,
        normal = l.share * 100;
      const orders = normal + (backlog[id] ?? 0);
      const disruption = active
        ? (plan.severity / 100) * (s.rerouted ? 0.35 : 1)
        : 0;
      const capacity = normal * (active ? 1 - disruption : 1.5);
      const quantity = Math.min(orders, capacity);
      backlog[id] = orders - quantity;
      const lead = Math.max(
        1,
        plan.leadWeeks + (s.rerouted ? 1 : 0) - (expedited ? 1 : 0),
      );
      if (quantity > 0)
        shipments.push({
          from: l.from,
          to: l.to,
          quantity,
          dispatched: week,
          arrival: week + lead,
        });
      dispatched += quantity;
    }
  }
  // Export receipts depend on actual fulfilled orders, not a generic country pressure score.
  for (const c of states.filter(
    (c) => !shippingLinks.some((l) => l.to === c.code),
  )) {
    const normal = shippingLinks
      .filter((l) => l.from === c.code)
      .reduce((n, l) => n + l.share * 100, 0);
    const sent = shipments
      .filter((s) => s.from === c.code && s.dispatched === week)
      .reduce((n, s) => n + s.quantity, 0);
    // Half of this illustrative supplier sector's demand depends on modeled exports.
    const exportOutput =
      normal > 0 ? 50 + 50 * Math.min(1, sent / normal) : 100;
    const previousOutput = c.shipping!.output;
    c.shipping!.output = Math.min(previousOutput, exportOutput);
    c.shipping!.inventory += previousOutput - c.shipping!.output;
    c.shipping!.cash = clamp(c.shipping!.cash + (sent - normal) * 0.05);
  }
  for (const c of states) {
    const s = c.shipping!;
    for (const h of s.households) {
      h.action =
        s.decisions.find((d) => d.actor === h.income)?.action ?? "maintain";
      const essential =
        h.income === "low" ? 0.9 : h.income === "middle" ? 0.7 : 0.45;
      const wages =
        1 - ((100 - s.output) / 100) * (h.income === "high" ? 0.15 : 0.5);
      const bill =
        (essential * s.priceIndex) / 100 +
        (h.action === "defer" ? 0.02 : 1 - essential);
      const transfer = week < s.reliefUntil && h.income === "low" ? 0.12 : 0;
      const resources = h.savings + wages + transfer;
      h.strain = clamp(
        (bill - wages - transfer) * 100 + Math.max(0, bill - resources) * 100,
      );
      h.savings = Math.max(0, resources - bill);
    }
    c.productionPressure = (100 - s.output) / 100;
    c.householdStrain =
      s.households.reduce((n, h) => n + h.strain * h.share, 0) / 100;
    c.pressure = (c.productionPressure + c.householdStrain) / 2;
    c.policyResponse =
      plan.publicBudget > 0
        ? (plan.publicBudget - s.budget) / plan.publicBudget
        : 0;
  }
  return frame(week, states, {
    shipments,
    backlog,
    delivered: arriving.reduce((n, s) => n + s.quantity, 0),
    dispatched,
    events,
  });
}
export function shippingResult(
  plan: ShippingPlan,
  frames: SimulationFrame[],
  audit?: ShippingAudit,
): SimulationResult {
  return {
    scenario: {
      title: plan.title,
      description: plan.description,
      family: "trade",
      severity: plan.severity,
      durationWeeks: plan.durationWeeks,
      shockDurationWeeks: plan.shockDurationWeeks,
      seed: 42,
      shipping: plan,
    },
    frames,
    providerMode: audit?.requests.length ? "openrouter" : "deterministic",
    providerPolicy: audit?.requests.length ? "openrouter" : "deterministic",
    methodology:
      "Annual UN Comtrade 2023 HS85 import value shares connect three Asian suppliers to five European buyers. Weekly input units, household composition, prices, cash, budgets and lead times are explicit scenario assumptions. Supplier orders queue; deliveries arrive after a delay; factories consume inventory; households spend income and savings. Public policies cost a finite budget and take time. Outputs are illustrative conditional scenarios, not calibrated forecasts.",
    audit: audit ?? {
      engine: SHIPPING_ENGINE,
      prompt: SHIPPING_PROMPT,
      data: "comtrade-2023-hs85-2026-10-10",
      requests: [],
      reviewWeeks: shippingReviews(plan.durationWeeks),
      warnings: [],
    },
  };
}
export function runShipping(input: ShippingPlan): SimulationResult {
  const plan = shippingPlanSchema.parse(input),
    frames = [initialShippingFrame(plan)];
  for (let week = 1; week <= plan.durationWeeks; week++)
    frames.push(stepShipping(frames.at(-1)!, plan, week));
  return shippingResult(plan, frames);
}
export function branchShipping(
  parent: SimulationResult,
  policy: Policy,
  at: number,
): SimulationResult {
  if (
    !parent.scenario.shipping ||
    !Number.isInteger(at) ||
    at < 0 ||
    at >= parent.frames.length - 1
  )
    throw new Error("Invalid shipping checkpoint");
  const plan = shippingPlanSchema.parse({
    ...parent.scenario.shipping,
    policy,
    policyWeek: at + 1,
  });
  const frames = structuredClone(parent.frames.slice(0, at + 1));
  for (let week = at + 1; week <= plan.durationWeeks; week++) {
    // A controlled experiment fixes recorded non-policy decisions in both arms.
    const decisions = parent.frames[week].countries
      .flatMap((c) => c.shipping!.decisions)
      .map((d) => ({ ...d, source: "reused" as const }));
    frames.push(stepShipping(frames.at(-1)!, plan, week, decisions));
  }
  const result = shippingResult(plan, frames, {
    ...structuredClone(parent.audit!),
    comparison: `Same checkpoint and recorded household/firm decisions; only public policy changes after week ${at}. This estimates a controlled policy effect, not adaptive AI behavior.`,
  });
  result.scenario.branchWeek = at;
  if (parent.id) result.scenario.parentSimulationId = parent.id;
  result.providerMode = parent.providerMode;
  result.providerPolicy = parent.providerPolicy;
  return result;
}
