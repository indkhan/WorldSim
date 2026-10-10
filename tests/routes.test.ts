import { afterEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/simulations/route";
import { unpackResult } from "@/lib/simulation/transport";

afterEach(() => vi.unstubAllGlobals());

it("returns repeatable complete runs without persistence or external calls", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const run = () => POST(new Request("http://localhost/api/simulations", {
    method: "POST",
    headers: { "x-provider-mode": "deterministic" },
    body: JSON.stringify({
      title: "Test", description: "Synthetic shock", family: "energy",
      severity: 70, durationWeeks: 1, seed: 42,
    }),
  }));
  const response = await run();
  expect(response.status).toBe(200);
  const result = await unpackResult(await response.json());
  expect(result.frames).toHaveLength(2);
  expect(result).not.toHaveProperty("saveStatus");
  expect(result).not.toHaveProperty("id");
  expect((await unpackResult(await (await run()).json())).frames).toEqual(result.frames);
  expect(fetch).not.toHaveBeenCalled();
});

it("rejects invalid scenarios before execution", async () => {
  const response = await POST(new Request("http://localhost/api/simulations", {
    method: "POST", body: JSON.stringify({ durationWeeks: 105 }),
  }));
  expect(response.status).toBe(400);
});
