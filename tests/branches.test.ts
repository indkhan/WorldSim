import { expect, it, vi, afterEach } from "vitest";
vi.mock("@/lib/db/prisma", () => ({
  hasDatabase: () => true,
  prisma: { simulation: { create: vi.fn(), findUnique: vi.fn() } },
}));
import { prisma } from "@/lib/db/prisma";
import { POST } from "@/app/api/simulations/[id]/branch/route";
import { runSimulation } from "@/lib/simulation/engine";
import { packResult } from "@/lib/simulation/transport-server";
import { unpackResult } from "@/lib/simulation/transport";
const s = {
  title: "Test",
  description: "Synthetic shock",
  family: "energy" as const,
  severity: 70,
  durationWeeks: 8,
  seed: 42,
};
const parent = runSimulation(s);
afterEach(() => vi.resetAllMocks());
it.each([
  { branchWeek: 9, durationWeeks: 12 },
  { branchWeek: 6, durationWeeks: 4 },
  { branchWeek: 2, providerPolicy: "openrouter" },
])("rejects invalid branch contracts %j", async (patch) => {
  vi.mocked(prisma.simulation.findUnique).mockResolvedValue({
    id: "parent",
    title: "Test",
    input: s,
    result: packResult(parent),
  } as never);
  const r = await POST(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ ...s, providerPolicy: "deterministic", ...patch }),
    }),
    { params: Promise.resolve({ id: "parent" }) },
  );
  expect(r.status).toBe(400);
  expect(prisma.simulation.create).not.toHaveBeenCalled();
});
it("preserves every historical frame and returns unsaved continuation on save failure", async () => {
  vi.mocked(prisma.simulation.findUnique).mockResolvedValue({
    title: "Test",
    input: s,
    result: packResult(parent),
  } as never);
  vi.mocked(prisma.simulation.create).mockRejectedValue(new Error("secret"));
  const r = await POST(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        ...s,
        severity: 10,
        branchWeek: 3,
        providerPolicy: "deterministic",
      }),
    }),
    { params: Promise.resolve({ id: "parent" }) },
  );
  expect(r.status).toBe(200);
  const child = await unpackResult(await r.json());
  expect(child.saveStatus).toBe("unsaved");
  expect(child.frames.slice(0, 4)).toEqual(parent.frames.slice(0, 4));
  expect(JSON.stringify(child)).not.toContain("secret");
});
it("compares a branch with a baseline from the same checkpoint", async () => {
  const input = {
    ...s,
    severity: 10,
    parentSimulationId: "parent",
    branchWeek: 3,
  };
  vi.mocked(prisma.simulation.findUnique)
    .mockResolvedValueOnce({
      title: "Child",
      input,
      result: packResult(parent),
    } as never)
    .mockResolvedValueOnce({ result: packResult(parent) } as never);
  vi.mocked(prisma.simulation.create).mockRejectedValue(new Error("offline"));
  const r = await POST(
    new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        ...input,
        baseline: true,
        providerPolicy: "deterministic",
      }),
    }),
    { params: Promise.resolve({ id: "child" }) },
  );
  const baseline = await unpackResult(await r.json());
  expect(baseline.scenario).toEqual({ ...input, severity: 0 });
  expect(baseline.frames.slice(0, 4)).toEqual(parent.frames.slice(0, 4));
  expect(baseline.frames[4].globalPressure).toBeLessThan(
    parent.frames[4].globalPressure,
  );
});
