# Operations

## Cost controls

Jev fan-out is controlled by `JEV_MAX_COUNTRIES`. The runner queries only representative cohorts in the highest-pressure countries. Start at 6–12, inspect latency/cost, then raise deliberately. Keep deterministic mode available for development and demos.

OpenRouter runs once after a simulation and never owns numerical state.

## Failure behavior

- Jev timeout/error: that cohort falls back to deterministic rules; warning recorded.
- OpenRouter error: simulation succeeds; warning recorded; narration omitted.
- Database absent: simulations still run in-memory; history/branching endpoints requiring persistence return a clear error.
- Invalid request: Zod rejects it with HTTP 400.

## Observability for a public deployment

Add structured logs with simulation ID, duration, provider call count, provider latency, fallback count and estimated provider cost. Do not log API keys or full user-entered sensitive scenario text by default.

## Scaling path

For personal use, a bounded long-running Vercel Function is simple. For public/high-concurrency use, use Vercel Queues/Workflow and the existing Checkpoint model. Consumers must be idempotent and should use `(simulationId, week)` as a natural deduplication key.

## Database changes

`db:push` is convenient for a pet project. Once multiple environments/users depend on the database, create and commit Prisma migrations and apply them in a controlled release step.
