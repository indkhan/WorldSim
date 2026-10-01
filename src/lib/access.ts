import { timingSafeEqual, createHash } from "node:crypto";
import { NextResponse } from "next/server";
export function authenticated(req: Request) {
  const password = process.env.WORLDSIM_PASSWORD;
  if (!password || password.length < 16) return false;
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;
  const actual = Buffer.from(header.slice(6), "base64").toString(),
    expected = `${process.env.WORLDSIM_USERNAME || "worldsim"}:${password}`;
  return timingSafeEqual(
    createHash("sha256").update(actual).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
export function privateAccess(req: Request) {
  const origin = req.headers.get("origin");
  if (!["GET", "HEAD"].includes(req.method) && origin) {
    const host = req.headers.get("host") || new URL(req.url).host;
    try {
      if (new URL(origin).host !== host)
        return NextResponse.json(
          { error: "Cross-origin requests are not allowed" },
          { status: 403 },
        );
    } catch {
      return NextResponse.json(
        { error: "Invalid request origin" },
        { status: 403 },
      );
    }
  }
  if (process.env.NODE_ENV !== "production" && !process.env.WORLDSIM_PASSWORD)
    return null;
  if (
    !process.env.WORLDSIM_PASSWORD ||
    process.env.WORLDSIM_PASSWORD.length < 16
  )
    return NextResponse.json(
      {
        error:
          "Private deployment requires WORLDSIM_PASSWORD (at least 16 characters)",
      },
      { status: 503 },
    );
  if (!authenticated(req))
    return NextResponse.json(
      { error: "Private deployment authentication required" },
      {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="WorldSim", charset="UTF-8"',
        },
      },
    );
  return null;
}
