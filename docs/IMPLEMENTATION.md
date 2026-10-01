# Implementation and verification (2026-10-01)

Starting point: docs/REVIEW.md at 6ede638. Findings were checked against current code before changes. The pre-existing untracked review was preserved. No AGENTS.md instructions were found in the repository or its ancestor directories. No push, deployment or paid provider call was made.

## Changes

1. Static initial metadata and lossless gzip weekly patches replace repeated full-frame API/storage JSON. Both server and browser round trips preserve all values. Changed branch links are stored once. Legacy saved results are compacted on read; row identity/timestamps and save status are restored.
2. Every country has household, business and government representation. Their synthetic population shares are 80/15/5 percent and total weights equal population, independent of sample size.
3. Baselines use completed settings and preserve requested provider policy, changing only severity. Runs, branches and replay clear old baselines. Comparison rejects incompatible settings/endpoints/provider policies. Branch baselines continue from the same original checkpoint.
4. Branch points must exist, and end horizons must be after them and at most 104 weeks. History remains exact. Continuations explicitly use deterministic rules and warn when historical provider decisions remain. Optional save outages return usable unsaved results; history/replay/checkpoint outages return 503 and malformed input returns 400 without infrastructure details.
5. Zod rejects missing/unknown choices and invalid confidence. Provider errors use deterministic fallback with warnings. All requests, including body parsing, validation and narration, have five-second timeouts. Calls are serial; decisions/narration share a 24-call/60-second default budget (hard ceilings 60/120). Fatal credential/billing failures stop later calls. No paid retries. Cancellation prevents further calls when the server receives the abort.
6. Production pages/APIs fail closed behind private single-owner HTTP Basic authentication. Anonymous requests cannot use a server key, including during development. Cross-origin mutations are rejected. Keys are not logged or persisted. Public multiuser mode is unsupported until real identity/ownership and distributed quotas/rate limits are added.
7. Native modal behavior, initial focus, keyboard containment/restoration, country search, playback, saved history/replay, save status and parent ancestry are available. Methodology remains visible on mobile. UI/docs explain synthetic weights, numerical inputs, unused exposure fields and descriptive event text. Viewing horizon is independent of 12-week shock/adaptation defaults.
8. DATABASE_URL defaults to blank. npm is the sole package manager. Prisma generation runs after install so clean deterministic setup and route tests work without PostgreSQL. Unused country data wrapper, pnpm configuration and tracked TypeScript build metadata were removed. Touched source was formatted consistently with Prettier 3.6.2; lint warnings were removed.
9. Vitest 4.1.11 fixes its mocker advisory. Scoped overrides select PostCSS 8.5.28 and DeepmergeTS 8.0.2, retaining Next 15 and Prisma 6. The Prisma plain-record configuration path was inspected and smoke-tested. Vitest keeps the existing Vite 7 line to avoid npm 10's Vite 8 optional devtools peer-resolution crash. No forced audit upgrade/downgrade was used.

## Verified results

| Check | Result |
| --- | --- |
| Clean npm ci | Passed; postinstall Prisma generation, no PostgreSQL required |
| npm run typecheck | Passed |
| npm run lint | Passed, zero warnings |
| npm test | 45 tests passed across nine files |
| npm run build | Passed, Next 15 production build |
| npm run test:e2e | 11 tests passed on isolated WorldSim port 3117, reuse disabled |
| npm audit | Zero advisories after compatible fixes |
| npm audit --omit=dev | Zero advisories |
| Prisma config compatibility | prisma validate with disposable local config passed; no connection attempted |
| Production access | Anonymous page, Methodology and history requests returned 401 |
| Production deterministic API | Authenticated requests returned 200 and usable unsaved results without a database |
| Live PostgreSQL | Not run: Docker installed but daemon unavailable; psql unavailable |
| Providers | Mocked only; no live paid calls |

Regression checks cover actor shares/coverage, bounded numerical state, exact response round trips and branch history, response sizes, horizon prefix invariance, baseline compatibility/lifecycle, replay metadata, branch bounds/policy/checkpoints, persistence failures, malformed provider decisions, credential stop behavior, deadlines/call budgets, private access and modal keyboard behavior. Browser history uses mocked saved rows; it does not establish database connectivity.

## Response measurements

Exact UTF-8 JSON response body bytes, including the base64 compressed timeline. Vercel documents a 4.5 MB request/response limit: https://vercel.com/docs/functions/limitations#request-body-size.

Production API measurements use energy, severity 65, seed 42, default shock/adaptation timing, no database or provider:

| Viewing horizon | Bytes | Local elapsed time |
| --- | ---: | ---: |
| Default: 12 weeks | 934,478 | 322 ms |
| Maximum: 104 weeks | 3,911,775 | 1,656 ms |

Lossless round-trip fixture (energy, severity 70, seed 42): 936,052 bytes at 12 weeks and 3,914,497 bytes at 104 weeks. Maximum-horizon severity-100 stress cases across energy/trade/climate/custom, different seeds and 4/52/104-week timing settings: 3,740,616 to 4,162,402 bytes. These checks use conservative 4,500,000-byte assertions. This is local verification, not a Vercel deployment test.

## Setup and limitations

- No database schema migration is needed. For optional persistence, set a real PostgreSQL DATABASE_URL and run npm run db:push. Live create/list/replay/branch database integration remains to be verified with disposable PostgreSQL.
- Use Node 22.12+ and npm ci. For production, set a unique WORLDSIM_PASSWORD of at least 16 characters and use HTTPS. WORLDSIM_USERNAME defaults to worldsim. Local deterministic development needs neither PostgreSQL nor a provider key.
- New runs use engine-2 actor weights and independent timing. Saved historical frames are retained, but new continuations use current mechanics. External providers remain nondeterministic; baseline differences are not clean causal attribution.
- The client expands exact frames for inspection/playback; maximum horizons still consume browser memory. Modern DecompressionStream/native dialog support is required.
- A call budget bounds requests, not a dollar amount: model prices/provider billing remain external. Public multiuser release needs per-owner storage, authenticated identities and distributed spend/rate/concurrency controls.
- Measured data ingestion, sensitivity analysis and charts are deferred as requested. Inputs remain synthetic/proxy except the unversioned bundled population snapshot; outputs are not validated probabilities.
- Clean install emitted an ESLint 9 maintenance/deprecation notice and Playwright emitted NO_COLOR/FORCE_COLOR environment notices. Neither is a lint warning or failing gate. A separate ESLint major migration is deferred.
