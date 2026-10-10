import { NextResponse } from "next/server";
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
  return null;
}
