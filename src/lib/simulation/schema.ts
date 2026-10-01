import { z } from "zod";
export const scenarioSchema = z.object({
  title: z.string().min(2).max(120),
  description: z.string().min(10).max(6000),
  family: z.enum([
    "energy",
    "trade",
    "technology",
    "health",
    "climate",
    "custom",
  ]),
  severity: z.number().min(0).max(100),
  durationWeeks: z.number().int().min(1).max(104),
  shockDurationWeeks: z.number().int().min(1).max(104).default(12),
  adaptationWeeks: z.number().int().min(1).max(104).default(12),
  seed: z.number().int(),
  targetRegions: z.array(z.string()).max(20).optional(),
  assumptions: z.array(z.string().max(300)).max(20).optional(),
});
