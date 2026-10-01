# WorldSim

WorldSim is a Vercel-first, interactive global scenario laboratory. Introduce an event, simulate how heterogeneous household, business and government cohorts respond across 190+ countries/territories, watch effects propagate through international links, inspect a country down to demographic/sector cohorts, branch a timeline, and compare it with a no-shock baseline.

> WorldSim is an exploratory simulator, **not a forecasting system**. Synthetic cohorts, proxy exposure variables and model decisions must not be interpreted as measured public opinion or verified probabilities.

## Product capabilities

- Full-screen 3D globe with pressure points and animated international propagation links.
- Week-by-week simulation playback with global household, production and aggregate pressure metrics.
- Country drill-down into **different groups within the same country**: household/business/government actor type, low/middle/high income, urban/rural location and economic sector.
- Population weighting: approximately 100 synthetic agents per 1B residents, capped at 100 and with a minimum of 3 for small countries. Agents are compressed into inspectable cohorts without losing their represented population weight.
- Energy, trade, technology, health, climate and custom event families.
- Explicit exposure, resilience, adaptation and cross-border propagation mechanics.
- Optional OpenRouter-powered Jev decisions for representative high-impact cohorts **during the simulation loop**. Decisions affect subsequent state through bounded action effects; unqueried cohorts use deterministic fallback rules.
- Optional OpenRouter narrative that explains already-computed outputs without owning numerical state. One OpenRouter key powers both features.
- No-shock baseline comparison.
- Persisted simulations and replay with PostgreSQL/Prisma.
- Timeline branching from an actual historical frame; pre-branch state is preserved.
- Seeded deterministic fallback mode for reproducible tests and zero-cost local development.
- Vercel Node runtime, server-only secrets, long-duration route support, CI, schema validation and provider timeout/budget handling.

## Quick start

```bash
cp .env.example .env
npm ci
npm run db:generate
# only when DATABASE_URL is configured
npm run db:push
npm run dev
```

Open `http://localhost:3000`. The core simulator works without a database or AI key. Persistence/branching require PostgreSQL. Provider features use a supplied OpenRouter key. A server key can only be selected by an authenticated private owner. Production requires WORLDSIM_PASSWORD (at least 16 characters) and HTTP Basic authentication; local development works without it. Use HTTPS in production.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | for persistence | PostgreSQL connection used by Prisma |
| `OPENROUTER_API_KEY` | no | Server key, accessible only to the authenticated private owner |
| `WORLDSIM_PASSWORD` | in production | Unique private deployment password, at least 16 characters |
| `WORLDSIM_USERNAME` | no | HTTP Basic username (default `worldsim`) |
| `PROVIDER_MAX_CALLS` | no | Total requests per run, including narration; default 24, maximum 60 |
| `PROVIDER_MAX_SECONDS` | no | Total provider time budget; default 60, maximum 120 seconds |
| `DECISION_MAX_COUNTRIES` | no | Countries evaluated per week (1-12, default 6) |
| `OPENROUTER_MODEL` | no | OpenRouter narration model slug |
| `NEXT_PUBLIC_APP_URL` | recommended | Application URL used in OpenRouter attribution headers |

Never commit `.env` or provider keys. All provider calls are made from server routes.

## Quality gates

```bash
npm run typecheck
npm run lint
npm test
npm run build
# all gates
npm run check
```

GitHub Actions runs `npm ci` and `npm run check` on pushes to `main` and pull requests.

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import it into Vercel.
3. Add the environment variables from `.env.example`.
4. Provision PostgreSQL and set `DATABASE_URL` if you want history/branching.
5. Run `npm run db:push` for this pet-project schema (for a production team, replace this with committed Prisma migrations).
6. Deploy.

The simulation route uses the Node runtime and a 300-second maximum duration. Responses use lossless compressed weekly patches plus static metadata. For larger workloads, move provider batches to Vercel Queues/Workflow while keeping the same checkpoint/state contracts; see `docs/ARCHITECTURE.md`.

## Repository map

```text
src/app/                     Next.js App Router pages + API routes
src/components/              Simulation workspace and globe
src/data/                    bundled global country snapshot
src/lib/simulation/          domain types, mechanics, provider-aware runner
src/lib/providers/           OpenRouter boundary
src/lib/db/                  Prisma singleton
prisma/                      persistence schema
tests/                       simulation invariants
.github/workflows/           CI
docs/                        architecture, methodology, data and operations
```

## Read before interpreting results

- `docs/SIMULATION.md` — exact mechanics and limitations.
- `docs/ARCHITECTURE.md` — boundaries, provider execution and Vercel scaling path.
- `docs/DATA.md` — what is measured vs synthetic/proxy.
- `docs/OPERATIONS.md` — deployment, cost controls, observability and failure modes.
- `docs/TESTING.md` — quality strategy and recommended additional tests.

## Verification

Use Node 22.12+ and npm (the CI package manager). See `docs/IMPLEMENTATION.md` for the measured results and persistence limitations.

Viewing horizon (1-104 weeks) only extends observation. Shock decay and adaptation have separate 12-week defaults. The deterministic engine does not interpret event description or assumptions as numerical instructions. All actor weights, exposure/capacity fields and international links are synthetic.
