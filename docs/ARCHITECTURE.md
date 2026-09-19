# Architecture

## Design goals

WorldSim keeps numerical state transitions explicit in TypeScript, treats model calls as bounded decision providers, keeps secrets server-side, remains useful without external AI, and is deployable as a single Next.js repository on Vercel.

## State hierarchy

`Scenario → World → Country → Cohort → Decision → Weighted country state → International propagation → Next tick`

A country is not a single persona. `initializeWorld` generates weighted synthetic agents and compresses identical attribute combinations into cohorts. Cohorts vary by actor kind, income band, urban/rural status and sector. Each carries represented population weight, resilience, exposure, pressure, action and decision provenance.

## Simulation loop

1. Initialize every country and cohort from the seed.
2. Construct international links.
3. For each week, optionally query Jev for representative cohorts in the highest-pressure countries.
4. Apply the bounded decisions to the state transition.
5. Compute event exposure, inbound international pressure, adaptation and prior-action mitigation.
6. Aggregate cohort pressure by represented population.
7. Store an immutable frame for playback/replay.
8. Optionally ask OpenRouter to narrate the final recorded result.

The provider-aware loop lives in `provider-runner.ts`; the pure deterministic engine remains independently testable.

## Jev boundary

Jev receives a textual state plus a fixed option set for the relevant actor type. It does not calculate economic arithmetic. Returned choices are mapped to bounded action-effect coefficients. Provider errors fall back to deterministic rules and are surfaced in `warnings` rather than corrupting the run.

`JEV_MAX_COUNTRIES` limits provider fan-out. Within each selected country, the runner queries a few high-weight representative cohorts per actor type. This gives demographic variation without turning every synthetic agent into a network request.

## OpenRouter boundary

OpenRouter is post-processing only. It receives scenario metadata, methodology and final computed state. A narration failure does not fail the simulation. The system prompt explicitly prohibits presenting simulation frequencies as verified probabilities.

## Persistence

`Simulation` stores input, output and model versions. `Checkpoint` is reserved for durable incremental execution. Branches record `parentSimulationId` in input and preserve parent frames through the branch week before applying changed assumptions.

## Vercel execution

The current route uses the Node runtime and `maxDuration=1800`. This is appropriate for a personal/pet deployment with bounded provider fan-out. For larger public workloads:

- create the Simulation row with status `queued`;
- publish one or more week/provider batches to Vercel Queues or Workflow;
- write each completed week to `Checkpoint`;
- make consumers idempotent because queue delivery is at-least-once;
- assemble completed frames into `Simulation.result`;
- stream/poll progress from the UI.

This avoids depending on in-memory process lifetime and allows retries without rerunning the whole world.

## Security

Provider keys never cross into client components. Zod validates public simulation input. Provider calls have timeouts/retries. Vercel headers disable unnecessary browser capabilities and add basic hardening. For a public deployment add authentication, per-user quotas, rate limiting and a server-side cost budget before enabling provider-backed runs.
