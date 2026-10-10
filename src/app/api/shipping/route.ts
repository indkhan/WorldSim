import { NextResponse } from "next/server";
import { z } from "zod";
import { privateAccess } from "@/lib/access";
import { shippingPlanSchema } from "@/lib/simulation/shipping";
import {
  runShippingProvider,
  explainShipping,
  shippingModelSchema,
} from "@/lib/providers/shipping";
import { packResult } from "@/lib/simulation/transport-server";

export const runtime = "nodejs";
export const maxDuration = 180;
const inputSchema = z.object({
  plan: shippingPlanSchema,
  model: shippingModelSchema.default("anthropic/claude-sonnet-5.5"),
  explain: z.boolean().default(false),
});
export async function POST(req: Request) {
  const denied = privateAccess(req);
  if (denied) return denied;
  let input;
  try {
    input = inputSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid shipping scenario settings" },
      { status: 400 },
    );
  }
  const key =
    req.headers.get("x-provider-mode") === "deterministic"
      ? null
      : req.headers.get("x-openrouter-api-key");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (value: unknown) => {
        if (!req.signal.aborted)
          controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
      };
      try {
        const result = await runShippingProvider(
          input.plan,
          key,
          input.model,
          req.signal,
          (frame) => emit({ type: "frame", frame }),
        );
        if (
          key &&
          input.explain &&
          !result.audit!.warnings.some((w) => w.includes("stopped"))
        ) {
          emit({ type: "phase", message: "Explaining recorded outcomes" });
          try {
            result.analysis = await explainShipping(
              result,
              key,
              input.model,
              req.signal,
            );
          } catch {
            result.audit!.warnings.push(
              "AI explanation unavailable; the recorded evidence remains available.",
            );
          }
        }
        if (req.signal.aborted) throw new Error("Cancelled");
        result.warnings = result.audit!.warnings;
        emit({ type: "result", result: packResult(result) });
      } catch {
        emit({
          type: "error",
          error: "Run interrupted. Previous results are preserved; try again.",
        });
      } finally {
        try {
          controller.close();
        } catch {
          /* Client cancelled the stream. */
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
