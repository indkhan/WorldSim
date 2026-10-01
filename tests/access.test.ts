import { expect, it, vi, afterEach } from "vitest";
import { POST } from "@/app/api/simulations/route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("does not spend a server key on an anonymous request", async () => {
  vi.stubEnv("OPENROUTER_API_KEY", "server-secret");
  vi.stubGlobal("fetch", vi.fn());
  const r = await POST(
    new Request("http://localhost", {
      method: "POST",
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
});
it("fails closed in production without private access configuration", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WORLDSIM_PASSWORD", "");
  const r = await POST(
    new Request("http://localhost", { method: "POST", body: "{}" }),
  );
  expect(r.status).toBe(503);
});
it("requires authenticated access to history and paid execution in production", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("WORLDSIM_PASSWORD", "long-private-password");
  vi.stubGlobal("fetch", vi.fn());
  const r = await POST(
    new Request("http://localhost", { method: "POST", body: "{}" }),
  );
  expect(r.status).toBe(401);
  expect(fetch).not.toHaveBeenCalled();
});
it("rejects cross-origin mutations even with private credentials", async () => {
  vi.stubEnv("WORLDSIM_PASSWORD", "long-private-password");
  const authorization =
    "Basic " + Buffer.from("worldsim:long-private-password").toString("base64");
  const r = await POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { authorization, origin: "https://attacker.example" },
      body: "{}",
    }),
  );
  expect(r.status).toBe(403);
});
