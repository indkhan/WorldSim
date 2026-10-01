import { expect, it } from "vitest";
import { runSimulation } from "@/lib/simulation/engine";
import { packResult, unpackStored } from "@/lib/simulation/transport-server";
import { unpackResult } from "@/lib/simulation/transport";
it("keeps default and maximum responses below 4.5 MB and roundtrips exactly", async () => {
  for (const durationWeeks of [12, 104]) {
    const result = runSimulation({
      title: "Test",
      description: "Synthetic shock",
      family: "energy",
      severity: 70,
      seed: 42,
      durationWeeks,
    });
    const packed = packResult(result),
      bytes = Buffer.byteLength(JSON.stringify(packed));
    process.stdout.write(`${durationWeeks} weeks: ${bytes} bytes\n`);
    expect(bytes).toBeLessThan(4500000);
    expect(unpackStored(packed)).toEqual(result);
    expect(await unpackResult(packed)).toEqual(result);
  }
}, 30000);
it("keeps varied maximum-horizon settings below the response budget", () => {
  for (const [family, seed, timing] of [
    ["energy", 1, 104],
    ["trade", 19, 52],
    ["climate", 99, 104],
    ["custom", 1234, 4],
  ] as const) {
    const result = runSimulation({
      title: "Stress test",
      description: "Synthetic shock",
      family,
      severity: 100,
      seed,
      durationWeeks: 104,
      shockDurationWeeks: timing,
      adaptationWeeks: timing,
    });
    const size = Buffer.byteLength(JSON.stringify(packResult(result)));
    process.stdout.write(`${family}/${seed}/${timing}: ${size} bytes\n`);
    expect(size).toBeLessThan(4500000);
  }
}, 30000);
import { continueFromFrame } from "@/lib/simulation/engine";
import { framePatches } from "@/lib/simulation/transport";
it("stores changed branch links once and restores exact history", () => {
  const s = {
    title: "Branch",
    description: "Synthetic shock",
    family: "energy" as const,
    severity: 70,
    seed: 42,
    durationWeeks: 8,
  };
  const parent = runSimulation(s);
  const child = continueFromFrame(parent, { ...s, family: "trade" }, 3);
  const patches = framePatches(child);
  expect(patches[4].flows).toBeDefined();
  expect(patches[5].flows).toBeUndefined();
  expect(unpackStored(packResult(child))).toEqual(child);
});
