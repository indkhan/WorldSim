import { expect, it } from "vitest";
import {
  runSimulation,
  continueFromFrame,
  compareResults,
} from "@/lib/simulation/engine";
const s = {
  title: "Test shock",
  description: "A synthetic energy shock.",
  family: "energy" as const,
  severity: 70,
  durationWeeks: 12,
  seed: 42,
};
it("represents all actors with fixed population shares", () => {
  for (const c of runSimulation(s).frames[1].countries) {
    for (const [kind, share] of Object.entries({
      household: 0.8,
      business: 0.15,
      government: 0.05,
    })) {
      expect(
        c.cohorts
          .filter((x) => x.kind === kind)
          .reduce((a, x) => a + x.weight, 0) / c.population,
      ).toBeCloseTo(share, 10);
    }
    expect(c.productionPressure).toBeGreaterThan(0);
  }
});
it("rejects invalid branch points and end horizons", () => {
  const p = runSimulation(s);
  for (const w of [-1, 1.5, 13])
    expect(() => continueFromFrame(p, s, w)).toThrow();
  expect(() => continueFromFrame(p, { ...s, durationWeeks: 4 }, 6)).toThrow();
});
it("rejects incompatible comparisons", () =>
  expect(() =>
    compareResults(runSimulation(s), runSimulation({ ...s, durationWeeks: 4 })),
  ).toThrow());
it("viewing horizon extends rather than changes the numerical trajectory", () => {
  const short = runSimulation({ ...s, durationWeeks: 4 }),
    long = runSimulation({ ...s, durationWeeks: 12 });
  expect(long.frames.slice(0, 5)).toEqual(short.frames);
});
it("rejects comparisons that change provider policy", () => {
  const a = runSimulation(s);
  expect(() =>
    compareResults(
      { ...a, providerMode: "openrouter", providerPolicy: undefined },
      a,
    ),
  ).toThrow();
});
