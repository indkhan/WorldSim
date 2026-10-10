import { expect, it, vi, afterEach } from "vitest";
import { defaultShippingPlan } from "@/lib/simulation/shipping";
vi.mock("@/lib/db/prisma", () => ({ hasDatabase: () => false, prisma: {} }));
import { POST } from "@/app/api/shipping/route";
afterEach(() => vi.unstubAllGlobals());
it("streams real checkpoints and an unsaved, replayable result without a key", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await POST(
    new Request("http://localhost/api/shipping", {
      method: "POST",
      body: JSON.stringify({
        plan: defaultShippingPlan,
        model: "anthropic/claude-sonnet-5.5",
      }),
    }),
  );
  expect(response.status).toBe(200);
  const records = (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(
    records.filter((r) => r.type === "frame").map((r) => r.frame.week),
  ).toEqual(Array.from({ length: 17 }, (_, i) => i));
  expect(records.at(-1).result.saveStatus).toBe("unsaved");
  expect(records.at(-1).result.audit.engine).toBe("shipping-1.0");
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects invalid controls before any provider execution", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const response = await POST(
    new Request("http://localhost/api/shipping", {
      method: "POST",
      body: JSON.stringify({ plan: { ...defaultShippingPlan, severity: 101 } }),
    }),
  );
  expect(response.status).toBe(400);
  expect(fetch).not.toHaveBeenCalled();
});
