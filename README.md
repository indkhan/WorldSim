# WorldSim

The home page is now an **eight-country shipping disruption lab**: a key-free sixteen-week demo, country histories, queued orders, delayed deliveries, finite firm/public budgets and household savings. It uses actual UN Comtrade annual HS85 import value shares with explicit weekly assumptions. AI uses **Sonnet 5.5 by default**, or GPT‑6.1 Sol, reviewing all 40 actors at planned intervals. AI choices are validated; TypeScript owns numerical effects.

Policy comparisons preserve the complete checkpoint and recorded household/firm actions. Replay export/import works without a database or model calls; PostgreSQL additionally saves runs and comparisons using the existing schema. Real completed weeks stream from the server. Imported files are validated and capped at 2 MB. See [shipping mechanics and limits](docs/SHIPPING.md).

Shipping supports 4–24 weeks and at most six reviews plus one explanation. Reviews use the configured provider deadline; explanation has a separate 25-second cap. Provider routing enforces maximum token rates, and prompt/output sizes reserve under $1/run at those rates, excluding fees. Interpretation is separately triggered. Interrupted partial runs cannot resume. No dependencies or migration were added.

## Original simulator — /legacy

WorldSim is a Vercel-first, interactive global scenario laboratory. Introduce an event, simulate how heterogeneous household, business and government cohorts respond across 190+ countries/territories, watch effects propagate through international links, inspect a country down to demographic/sector cohorts, branch a timeline, and compare it with a no-shock baseline.

> WorldSim is an exploratory simulator, **not a forecasting system**. Synthetic cohorts, proxy exposure variables and model decisions must not be interpreted as measured public opinion or verified probabilities.

## Product capabilities

- Full-screen 3D globe with pressure points and animated international propagation links.
- Natural-color Earth with terrain, ocean highlights, atmosphere and a cloud layer. Country selection focuses the camera; playback animates pressure waves and propagation links. Rotation can be paused, and reduced-motion preferences are respected.
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

Earth imagery is static, and overlays represent the selected simulation week rather than live conditions. Cloud and ocean specular textures are vendored from the [Three.js r186 example assets](https://github.com/mrdoob/three.js/tree/r186/examples/textures/planets); the cloud layer is decorative, not live weather.

## Quick start

```bash
cp .env.example .env
npm ci
npm run db:generate
# only when DATABASE_URL is configured
npm run db:push
npm run dev
```

Open `http://localhost:3000`. The demo and local policy comparisons work without a database or AI key. Persisted history/branches require PostgreSQL. Visitors supply their own OpenRouter key for AI features. Saved database simulations are shared with all visitors. Use HTTPS in production.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | for persistence | PostgreSQL connection used by Prisma |
| `PROVIDER_MAX_CALLS` | no | Total requests per run, including narration; default 24, maximum 60 |
| `PROVIDER_MAX_SECONDS` | no | Total provider time budget; default 60, maximum 120 seconds |
| `DECISION_MAX_COUNTRIES` | no | Countries evaluated per week (1-12, default 6) |
| `OPENROUTER_MODEL` | no | Legacy narration slug, default Sonnet 5.5; shipping selection is explicit in the UI |
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
