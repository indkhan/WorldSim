import { gzipSync, gunzipSync } from "node:zlib";
import { framePatches, restoreFrames, type PackedResult } from "./transport";
import type { SimulationResult } from "./types";
export function packResult(value: SimulationResult): PackedResult {
  const { frames, ...result } = value;
  return {
    ...result,
    format: "worldsim-v2",
    metadata: frames[0],
    timeline: gzipSync(JSON.stringify(framePatches(value)), {
      level: 9,
    }).toString("base64"),
  };
}
export function unpackStored(
  value: PackedResult | SimulationResult,
): SimulationResult {
  if (!("format" in value)) return value;
  const { metadata, timeline, ...result } = value;
  delete (result as Partial<PackedResult>).format;
  return {
    ...result,
    frames: restoreFrames(
      metadata,
      JSON.parse(gunzipSync(Buffer.from(timeline, "base64")).toString()),
    ),
  };
}
