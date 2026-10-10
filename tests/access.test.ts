import { expect, it, vi, afterEach } from "vitest";
import { POST } from "@/app/api/simulations/route";
import { middleware } from "@/middleware";
import { NextRequest } from "next/server";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each(["", "long-private-password"])(
  "ignores server keys with deployment password %j",
  async (password) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORLDSIM_PASSWORD", password);
    vi.stubEnv("OPENROUTER_API_KEY", "server-secret");
    vi.stubGlobal("fetch", vi.fn());
    const r = await POST(
      new Request("http://localhost", {
        method: "POST",
        headers: {
          authorization:
            "Basic " + Buffer.from(`worldsim:${password}`).toString("base64"),
        },
        body: JSON.stringify({
          title: "Test",
          description: "Synthetic shock",
          family: "energy",
          severity: 70,
          durationWeeks: 1,
          seed: 42,
        }),
      }),
    );
    expect(r.status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  },
);
it.each(["", "short", "long-private-password"])(
  "allows production pages regardless of deployment password %j",
  (password) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("WORLDSIM_PASSWORD", password);
    expect(middleware(new NextRequest("https://worldsim.example"))).toBeNull();
  },
);
it("validates production requests without a deployment password", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WORLDSIM_PASSWORD", "");
  const r = await POST(
    new Request("http://localhost", { method: "POST", body: "{}" }),
  );
  expect(r.status).toBe(400);
});
it("rejects cross-origin mutations without a deployment password", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WORLDSIM_PASSWORD", "");
  const r = await POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { origin: "https://attacker.example" },
      body: "{}",
    }),
  );
  expect(r.status).toBe(403);
});
