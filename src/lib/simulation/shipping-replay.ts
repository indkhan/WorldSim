import { z } from "zod";
import {
  SHIPPING_ENGINE,
  SHIPPING_PROMPT,
  shippingCountryCodes,
  shippingPlanSchema,
  ACTOR_OPTIONS,
  shippingLinks,
} from "./shipping";
import type { SimulationResult } from "./types";

const quantity = z.number().min(0).max(10000),
  index = z.number().min(0).max(300),
  ratio = z.number().min(0).max(1),
  week = z.number().int().min(0).max(30);
const code = z.enum(["CHN", "KOR", "IND", "DEU", "FRA", "GBR", "ITA", "NLD"]);
const decision = z
  .object({
    country: code,
    actor: z.enum(["low", "middle", "high", "firm", "government"]),
    action: z.string().max(30),
    requestedAction: z.string().max(30).optional(),
    rationale: z.string().max(1000),
    evidenceWeeks: z.array(week).max(4),
    source: z.enum(["rules", "openrouter", "reused", "intervention"]),
  })
  .refine(
    (d) => ACTOR_OPTIONS[d.actor].includes(d.action as never),
    "Invalid actor action",
  );
const resources = z.object({
  inventory: quantity,
  arrivals: quantity,
  output: z.number().min(0).max(100),
  priceIndex: index,
  cash: z.number().min(0).max(100),
  budget: z.number().min(0).max(200),
  rerouted: z.boolean(),
  reliefUntil: week,
  pendingPolicy: z
    .object({ action: z.enum(["reroute", "relief"]), effectiveWeek: week })
    .optional(),
  households: z
    .array(
      z.object({
        income: z.enum(["low", "middle", "high"]),
        share: z.number().min(0).max(1),
        savings: quantity,
        strain: index,
        action: z.enum(["maintain", "defer"]),
      }),
    )
    .length(3),
  decisions: z.array(decision).max(5),
});
const country = z.object({
  code,
  name: z.string().max(100),
  region: z.string().max(100),
  subregion: z.string().max(100),
  population: z.number().min(0).max(2e9),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  pressure: ratio,
  householdStrain: ratio,
  productionPressure: ratio,
  policyResponse: ratio,
  agents: z.literal(5),
  cohorts: z.array(z.never()).length(0),
  decisions: z.array(z.never()).length(0),
  imports: quantity,
  exports: quantity,
  energyExposure: quantity,
  adaptiveCapacity: quantity,
  shipping: resources,
});
const replaySchema = z.object({
  id: z.string().max(200).optional(),
  createdAt: z.string().max(100).optional(),
  scenario: z.object({
    title: z.string().max(120),
    description: z.string().max(2000),
    family: z.literal("trade"),
    severity: z.number().min(0).max(100),
    durationWeeks: z.number().int().min(4).max(24),
    shockDurationWeeks: z.number().int().min(1).max(16),
    seed: z.number().int(),
    shipping: shippingPlanSchema,
    branchWeek: week.optional(),
    parentSimulationId: z.string().max(200).optional(),
  }),
  frames: z
    .array(
      z.object({
        week,
        countries: z.array(country).length(8),
        flows: z
          .array(
            z.object({
              from: code,
              to: code,
              strength: z.number().min(0).max(1),
              kind: z.literal("trade"),
            }),
          )
          .max(30),
        globalPressure: ratio,
        globalHouseholdStrain: ratio,
        globalProductionPressure: ratio,
        shipping: z.object({
          shipments: z
            .array(
              z.object({
                from: code,
                to: code,
                quantity,
                dispatched: z.number().int().min(-4).max(24),
                arrival: week,
              }),
            )
            .max(450),
          backlog: z.record(z.string().regex(/^[A-Z]{3}-[A-Z]{3}$/), quantity),
          delivered: quantity,
          dispatched: quantity,
          events: z.array(z.string().max(300)).max(30),
        }),
      }),
    )
    .min(5)
    .max(25),
  methodology: z.string().max(4000),
  analysis: z.string().max(2000).nullable().optional(),
  providerMode: z.enum(["deterministic", "openrouter"]),
  providerPolicy: z.enum(["deterministic", "openrouter"]).optional(),
  warnings: z.array(z.string().max(400)).max(30).optional(),
  audit: z.object({
    engine: z.literal(SHIPPING_ENGINE),
    prompt: z.literal(SHIPPING_PROMPT),
    data: z.literal("comtrade-2023-hs85-2026-10-10"),
    requestedModel: z.string().max(200).optional(),
    attemptedCalls: z.number().int().min(0).max(8).optional(),
    reviewWeeks: z.array(week).max(6),
    comparison: z.string().max(1000).optional(),
    warnings: z.array(z.string().max(400)).max(30),
    requests: z
      .array(
        z.object({
          week,
          model: z.string().max(200),
          inputTokens: z.number().nonnegative().max(100000).nullable(),
          outputTokens: z.number().nonnegative().max(100000).nullable(),
          cost: z.number().nonnegative().max(10).nullable(),
        }),
      )
      .max(8),
  }),
});
export function parseShippingReplay(value: unknown): SimulationResult {
  const replay = replaySchema.parse(value);
  const routes = new Set(shippingLinks.map((l) => `${l.from}-${l.to}`));
  if (
    replay.frames.length !== replay.scenario.durationWeeks + 1 ||
    replay.scenario.shipping.durationWeeks !== replay.scenario.durationWeeks ||
    replay.frames.some(
      (f, i) =>
        f.week !== i ||
        f.shipping.shipments.some(
          (s) =>
            !routes.has(`${s.from}-${s.to}`) ||
            s.arrival <= f.week ||
            s.arrival <= s.dispatched,
        ) ||
        Object.keys(f.shipping.backlog).some((route) => !routes.has(route)) ||
        f.countries.some(
          (c, j) =>
            c.code !== shippingCountryCodes[j] ||
            c.shipping.households.some(
              (h, k) =>
                h.income !== ["low", "middle", "high"][k] ||
                h.share !== [0.4, 0.4, 0.2][k],
            ) ||
            c.shipping.decisions.length !== (i === 0 ? 0 : 5) ||
            new Set(c.shipping.decisions.map((d) => d.actor)).size !==
              c.shipping.decisions.length ||
            c.shipping.decisions.some(
              (d) =>
                d.country !== c.code ||
                d.evidenceWeeks.some((w) => w >= f.week),
            ),
        ),
    )
  )
    throw new Error("Replay checkpoint order or identities are invalid");
  return replay;
}
