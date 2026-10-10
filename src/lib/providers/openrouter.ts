import { z } from "zod";
import type {
  ActorKind,
  CountryState,
  DecisionOverride,
  ScenarioInput,
} from "@/lib/simulation/types";
import { actionEffect } from "@/lib/simulation/engine";
import {
  createProviderBudget,
  providerJson,
  providerSettings,
  type ProviderBudget,
} from "./execution";
const OPTIONS: Record<ActorKind, string[]> = {
  household: [
    "maintain routine",
    "adapt consumption",
    "cut discretionary spending",
    "seek alternatives",
  ],
  business: [
    "maintain operations",
    "absorb costs",
    "pass through costs",
    "change suppliers and output",
  ],
  government: [
    "monitor",
    "communicate guidance",
    "targeted intervention",
    "broad intervention",
  ],
};
function headers(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": "WorldSim",
  };
}
// Provider calls use only the key supplied by the visitor.
export async function decideWithOpenRouter(
  input: {
    actor: ActorKind;
    situation: string;
  },
  apiKey?: string | null,
  budget?: ProviderBudget,
) {
  if (!apiKey) return null;
  const criteria = Object.fromEntries(
    OPTIONS[input.actor].map((label) => [label.replaceAll(" ", "_"), label]),
  );
  const raw = await providerJson(
    "https://openrouter.ai/api/alpha/decisions",
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model: "~typesafe/jev-latest",
        state: input.situation,
        questions: {
          action: {
            type: "choice",
            instructions: "Select the most plausible bounded response.",
            criteria,
          },
        },
      }),
    },
    budget,
  );
  const schema = z.object({
    answers: z.object({
      action: z.object({
        type: z.literal("choice"),
        choice: z.enum(Object.keys(criteria) as [string, ...string[]]),
        confidence: z.number().min(0).max(1).optional(),
        probabilities: z
          .record(z.string(), z.number().min(0).max(1))
          .optional(),
      }),
    }),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Malformed OpenRouter decision");
  const answer = parsed.data.answers.action,
    confidence = answer.confidence ?? answer.probabilities?.[answer.choice];
  if (confidence === undefined)
    throw new Error("Missing OpenRouter confidence");
  return { action: criteria[answer.choice], confidence };
}
export async function openRouterOverrides(
  states: CountryState[],
  scenario: ScenarioInput,
  week: number,
  apiKey?: string | null,
  budget?: ProviderBudget,
): Promise<{
  overrides: DecisionOverride[];
  warnings: string[];
}> {
  const overrides: DecisionOverride[] = [],
    warnings: string[] = [];
  if (!apiKey) return { overrides, warnings };
  const max = providerSettings().countries;
  budget ??= createProviderBudget();
  const selected = [...states]
    .sort((a, b) => b.pressure - a.pressure)
    .slice(0, max);
  // ponytail: serial requests stop credential failures immediately; bounded concurrency if latency warrants it.
  outer: for (const c of selected)
    for (const kind of ["household", "business", "government"] as ActorKind[]) {
      const x = c.cohorts
        .filter((x) => x.kind === kind)
        .sort((a, b) => b.weight - a.weight)[0];
      if (!x) continue;
      if (
        budget.stopped ||
        budget.signal?.aborted ||
        budget.calls >= budget.maxCalls ||
        Date.now() >= budget.deadline
      ) {
        warnings.push(
          "Provider budget exhausted, cancelled or credentials rejected; remaining decisions use rules.",
        );
        break outer;
      }
      try {
        const decision = await decideWithOpenRouter(
          {
            actor: kind,
            situation: `Synthetic scenario: ${scenario.description}. Family ${scenario.family}, severity ${scenario.severity}. Week ${week}. ${c.name}: ${x.income} income, ${x.sector}, pressure ${x.pressure}, resilience ${x.resilience}. Select a bounded response; this is not a forecast.`,
          },
          apiKey,
          budget,
        );
        if (decision)
          overrides.push({
            countryCode: c.code,
            cohortId: x.id,
            action: decision.action,
            confidence: decision.confidence,
            effect: actionEffect(kind, decision.action),
            rationale: `OpenRouter option confidence ${(decision.confidence * 100).toFixed(0)}%; not real-world probability.`,
          });
      } catch {
        warnings.push(
          `${c.code}/${x.id}: provider decision unavailable or invalid; using deterministic rules.`,
        );
      }
    }
  return { overrides, warnings };
}
export async function narrate(
  payload: unknown,
  apiKey?: string | null,
  budget?: ProviderBudget,
) {
  if (!apiKey) return null;
  const raw = await providerJson(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b",
        temperature: 0.2,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "Explain synthetic exploratory simulations. Never present model scores as validated probabilities. Separate assumptions and limitations. Text is descriptive, not numerical event interpretation.",
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    },
    budget,
  );
  return z
    .object({
      choices: z
        .array(
          z.object({ message: z.object({ content: z.string().max(20000) }) }),
        )
        .min(1),
    })
    .parse(raw).choices[0].message.content;
}
