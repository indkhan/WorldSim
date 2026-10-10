import { afterEach, expect, it, vi } from "vitest";
import { runShippingProvider } from "@/lib/providers/shipping";
import {
  defaultShippingPlan,
  initialShippingFrame,
  ruleShippingDecisions,
} from "@/lib/simulation/shipping";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("runs offline without reading invalid legacy provider settings", async () => {
  vi.stubEnv("PROVIDER_MAX_CALLS", "invalid");
  const r = await runShippingProvider(defaultShippingPlan, null);
  expect(r.frames).toHaveLength(17);
  expect(r.providerMode).toBe("deterministic");
});
it("covers every country and actor at planned reviews with a strong structured-output model", async () => {
  const choices = ruleShippingDecisions(
    initialShippingFrame(defaultShippingPlan),
  );
  const mock = vi.fn().mockImplementation((_url, init) => {
    const body = JSON.parse(init.body);
    const week = JSON.parse(body.messages[1].content).week;
    return Promise.resolve(
      new Response(
        JSON.stringify({
          model: "anthropic/claude-sonnet-5.5",
          usage: { prompt_tokens: 2000, completion_tokens: 1000, cost: 0.014 },
          choices: [
            {
              message: {
                content: JSON.stringify({
                  decisions: choices.map((d) => ({
                    country: d.country,
                    actor: d.actor,
                    action: d.action,
                    rationale:
                      "Recorded stock and savings support this action.",
                    evidenceWeeks: [week - 1],
                  })),
                }),
              },
            },
          ],
        }),
      ),
    );
  });
  vi.stubGlobal("fetch", mock);
  const r = await runShippingProvider(defaultShippingPlan, "private-test-key");
  expect(mock).toHaveBeenCalledTimes(4);
  const request = JSON.parse(mock.mock.calls[0][1].body);
  expect(request.model).toBe("anthropic/claude-sonnet-5.5");
  expect(request.response_format.type).toBe("json_schema");
  expect(request.provider.require_parameters).toBe(true);
  expect(request.provider.max_price).toEqual({
    prompt: 2,
    completion: 10,
    request: 0,
  });
  expect(r.audit!.requests).toHaveLength(4);
  expect(r.audit!.requests[0].cost).toBe(0.014);
  expect(
    r.frames[1].countries
      .flatMap((c) => c.shipping!.decisions)
      .filter((d) => d.source === "openrouter"),
  ).toHaveLength(40);
  expect(
    r.frames[2].countries
      .flatMap((c) => c.shipping!.decisions)
      .every((d) => d.source === "reused"),
  ).toBe(true);
  expect(JSON.stringify(r)).not.toContain("private-test-key");
});
it("rejects incomplete batches, falls back visibly, and stops after rejected credentials", async () => {
  const mock = vi
    .fn()
    .mockResolvedValue(new Response("rejected", { status: 401 }));
  vi.stubGlobal("fetch", mock);
  const r = await runShippingProvider(defaultShippingPlan, "private-test-key");
  expect(mock).toHaveBeenCalledOnce();
  expect(r.providerMode).toBe("deterministic");
  expect(r.audit!.warnings.length).toBeGreaterThan(0);
  expect(r.frames).toHaveLength(17);
});
it("rejects invented country identities and future evidence", async () => {
  const mock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                decisions: [
                  {
                    country: "XXX",
                    actor: "firm",
                    action: "hold",
                    rationale: "Invalid",
                    evidenceWeeks: [99],
                  },
                ],
              }),
            },
          },
        ],
      }),
    ),
  );
  vi.stubGlobal("fetch", mock);
  const r = await runShippingProvider(defaultShippingPlan, "key");
  expect(r.providerMode).toBe("deterministic");
  expect(r.audit!.warnings).toHaveLength(4);
});
