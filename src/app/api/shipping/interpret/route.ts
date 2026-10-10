import { NextResponse } from "next/server";
import { z } from "zod";
import { privateAccess } from "@/lib/access";
import { shippingPlanSchema } from "@/lib/simulation/shipping";
import {
  interpretShipping,
  shippingModelSchema,
} from "@/lib/providers/shipping";
export const runtime = "nodejs";
const inputSchema = z.object({
  description: z.string().min(10).max(2000),
  current: shippingPlanSchema,
  model: shippingModelSchema.default("anthropic/claude-sonnet-5.5"),
});
export async function POST(req: Request) {
  const denied = privateAccess(req);
  if (denied) return denied;
  let input;
  try {
    input = inputSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Provide a valid description and scenario controls" },
      { status: 400 },
    );
  }
  const key = req.headers.get("x-openrouter-api-key");
  if (!key)
    return NextResponse.json(
      { error: "Connect OpenRouter to interpret your description" },
      { status: 400 },
    );
  try {
    return NextResponse.json(
      await interpretShipping(
        input.description,
        input.current,
        key,
        input.model,
        req.signal,
      ),
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Interpretation unavailable. Edit the scenario controls directly or try again.",
      },
      { status: 502 },
    );
  }
}
