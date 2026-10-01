# Architecture

## Design goals

WorldSim keeps numerical state transitions explicit in TypeScript, treats model calls as bounded decision providers, keeps secrets server-side, remains useful without external AI, and is deployable as a single Next.js repository on Vercel.

## State hierarchy

`Scenario → World → Country → Cohort → Decision → Weighted country state → International propagation → Next tick`

A country is not a single persona. `initializeWorld` generates weighted synthetic agents and compresses identical attribute combinations into cohorts. Cohorts vary by actor kind, income band, urban/rural status and sector. Each carries represented population weight, resilience, exposure, pressure, action and decision provenance.

## Simulation loop

1. Initialize every country and cohort from the seed.
2. Construct international links.
3. For each week, optionally query Jev through OpenRouter for representative cohorts in the highest-pressure countries.
4. Apply the bounded decisions to the state transition.
5. Compute event exposure, inbound international pressure, adaptation and prior-action mitigation.
6. Aggregate cohort pressure by represented population.
7. Store an immutable frame for playback/replay.
8. Optionally ask OpenRouter to narrate the final recorded result.

The provider-aware loop lives in `provider-runner.ts`; the pure deterministic engine remains independently testable.

## OpenRouter decision boundary

OpenRouter's `~typesafe/jev-latest` decision model receives a textual state plus a fixed option set for the relevant actor type. It does not calculate economic arithmetic. Returned choices are mapped to bounded action-effect coefficients. Provider errors fall back to deterministic rules and are surfaced in `warnings` rather than corrupting the run.

`DECISION_MAX_COUNTRIES` limits provider fan-out. Within each selected country, the runner queries one high-weight representative cohort per actor type, serially. All decisions and narration share a total request budget (24 by default, at most 60) and deadline (60 seconds by default, at most 120). Every request including validation/narration times out after at most five seconds, including response body parsing. There are no paid retries; failures use deterministic fallback. Fatal credential/billing failures stop later calls. This gives demographic variation without turning every synthetic agent into a network request.

## OpenRouter boundary

The same OpenRouter key also powers optional post-processing narration. It receives scenario metadata, methodology and final computed state. A narration failure does not fail the simulation. The system prompt explicitly prohibits presenting simulation frequencies as verified probabilities.

## Persistence

`Simulation` stores input, output and model versions. `Checkpoint` is reserved for durable incremental execution. Branches record `parentSimulationId` in input and preserve parent frames through the branch week before applying changed assumptions.

## Vercel execution

The current route uses the Node runtime and `maxDuration=300`. This is appropriate for a personal/pet deployment with bounded provider fan-out. For larger public workloads:

- create the Simulation row with status `queued`;
- publish one or more week/provider batches to Vercel Queues or Workflow;
- write each completed week to `Checkpoint`;
- make consumers idempotent because queue delivery is at-least-once;
- assemble completed frames into `Simulation.result`;
- stream/poll progress from the UI.

This avoids depending on in-memory process lifetime and allows retries without rerunning the whole world.

## Security

Server environment keys remain server-side. User-supplied keys live in tab React state and travel to server routes over HTTPS; they are never persisted or logged. Zod validates simulation input and provider choices/confidence. Provider calls have timeouts and budgets. Vercel headers disable unnecessary browser capabilities and add basic hardening. Production is a private single-owner deployment protected by HTTP Basic authentication on pages and every API route. Missing/short WORLDSIM_PASSWORD fails closed. The same owner controls all saved runs; anonymous requests cannot spend an environment key even in development. Cross-origin mutations are rejected. Public multiuser operation is unsupported: replace private access with real identity, per-owner database queries and distributed quotas/rate limits before enabling it.

## Compact timeline contract

API and new stored results use `worldsim-v2`: a complete initial metadata frame plus base64 gzip weekly patches. Unchanged country/cohort fields and links are omitted; browser DecompressionStream and server node:zlib restore exact values. Numeric precision is retained. Legacy full-frame saved results are compacted on read. The in-memory engine/inspector contract stays unchanged.

Replay merges database identity and timestamps. Optional save failures return results with `saveStatus: unsaved` and a warning; list/detail/checkpoint infrastructure failures return 503. Branch requests explicitly select deterministic continuation, preserve historical provider decisions, validate the branch frame and require an end horizon after it.
