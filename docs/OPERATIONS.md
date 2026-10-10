# Operations

The home page now uses the shipping lab described in [SHIPPING.md](SHIPPING.md). The original global engine, setup and earlier verification described below remain relevant to `/legacy`.

## Cost controls

Decision fan-out is controlled by `DECISION_MAX_COUNTRIES`. The runner queries only representative cohorts in the highest-pressure countries through OpenRouter. Default to 6 (maximum 12). PROVIDER_MAX_CALLS (default 24, maximum 60) and PROVIDER_MAX_SECONDS (default 60, maximum 120) apply across all weeks and narration. Calls are serial, with five-second timeouts and no paid retries. Credential/billing rejection stops all later calls. Request cancellation prevents later calls when the server observes the abort. Keep deterministic mode available for development and demos.

OpenRouter narration runs once after a simulation and never owns numerical state.

## Failure behavior

- OpenRouter decision timeout/error: that cohort falls back to deterministic rules; warning recorded.
- OpenRouter error: simulation succeeds; warning recorded; narration omitted.
- Database absent: simulations still run in-memory; history/branching endpoints requiring persistence return a clear error.
- Invalid request: Zod rejects it with HTTP 400.

## Observability for a public deployment

Add structured logs with simulation ID, duration, provider call count, provider latency, fallback count and estimated provider cost. Do not log API keys or full user-entered sensitive scenario text by default.

## Scaling path

For personal use, a bounded long-running Vercel Function is simple. For public/high-concurrency use, use Vercel Queues/Workflow and the existing Checkpoint model. Consumers must be idempotent and should use `(simulationId, week)` as a natural deduplication key.

## Database changes

`db:push` is convenient for a pet project. Once multiple environments/users depend on the database, create and commit Prisma migrations and apply them in a controlled release step.

## Visitor keys and optional persistence

No deployment password or server provider key is needed. Visitors supply their own OpenRouter key in the app or continue in deterministic mode. Saved simulations are shared with all visitors. Use HTTPS and never put credentials in URLs/logs. Separate private user histories require ownership columns/queries and identity; public scaling requires distributed quotas/rate limits.

DATABASE_URL defaults to blank. Set it only for real PostgreSQL, then run npm run db:push. A save outage retains usable results marked unsaved; history/replay outages return 503. No schema migration is required for the compact JSON storage contract. Existing rows are read without rewriting history.

Security dependency overrides pin Next PostCSS to a patched 8.5 release and Prisma config DeepmergeTS to 8.0.2+. Prisma uses the unchanged deepmerge entry point for plain configuration records; circular-reference fixes and changed custom metadata/deepmergeInto behavior do not affect this use. Vitest 4.1.11 is patched; its Vite dependency stays on 7 to avoid npm 10 failure in Vite 8 optional devtools peer resolution. Remove overrides when upstream dependencies adopt patched releases.
