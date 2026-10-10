> Historical report. Database persistence and saved-run history have since been removed. See README.md and SHIPPING.md for the current setup.

# WorldSim repository review

Reviewed 2026-10-01 at commit `6ede638`. This is a whole-repository review, not a review against an originating issue or a branch diff. No application fixes were applied.

## Verification

| Check | Result |
| --- | --- |
| `npm run typecheck` | Passed |
| `npm run lint` | No errors; one anonymous default export warning in `postcss.config.mjs` |
| `npm test` | All 15 tests passed |
| `npm run build` | Passed; Prisma client generated and production Next.js build completed |
| Existing Playwright suite | All 5 tests passed against the production server on port 3107 |
| Additional focused audit checks | Reproduced cohort coverage, description equivalence, branch horizon, saved replay metadata, malformed provider response, baseline lifecycle and dialog focus issues below |
| Local production API request | HTTP 200; eight-week response was 5,472,718 bytes (5.22 MiB) |
| `npm audit --json` | 7 affected dependency entries: 4 high, 3 moderate; no critical entries |

The default Playwright configuration initially reused an unrelated application on port 3000. Those initial failures are not WorldSim failures. A temporary configuration ran against WorldSim on port 3107 instead. One additional audit test initially raced the completion of a new run; it passed after waiting for the run button to become enabled.

Database persistence was exercised with a mocked Prisma boundary, not a live PostgreSQL instance. OpenRouter responses were mocked; no paid calls were made. Vercel deployment was not exercised. The collaborative preview loaded the application but snapshot capture repeatedly failed, so this review does not claim comprehensive visual QA. Dependencies were already installed; a clean `npm ci` was not verified.

## Fix first

### 1. Full simulation responses exceed the deployment payload limit

**Priority: high.** `src/app/api/simulations/route.ts:8` returns every country's complete cohort state for every week. The actual local production API response for eight weeks was 5.22 MiB. A 104-week engine result was approximately 61.68 MiB. This also increases browser memory, network transfer and database storage.

Vercel documents a 4.5 MB function request/response body limit. The current ordinary JSON response exceeds that limit even for this short run. This is a deployment incompatibility inferred from measured output and the platform limit, not a reproduced deployment failure.

**Change:** stop repeating static country/cohort metadata and identical flow arrays in every serialized frame. Return a compact timeline and fetch detailed country/week state on demand; measure the resulting response before choosing further infrastructure. If complete exports are needed, deliver them through storage or a suitable streaming path.

Source: [Vercel function limits](https://vercel.com/docs/functions/limitations#request-body-size).

### 2. Most countries have no business representation

**Priority: high.** `src/lib/simulation/engine.ts:10` makes the first business agent at index 8. Countries with fewer than nine agents receive no businesses. The bundled snapshot produced **216 countries without business cohorts out of 231**. Their production pressure is always zero because the weighted business aggregation has no members. The Business inspector is empty for these countries.

**Change:** reserve representation for household, business and government before distributing the remaining sample. Review actor weights as well: assigning one government representative an equal population weight makes government contribute one third of aggregate country pressure when the country has three agents. Keep total represented population consistent and explicitly define what actor weighting means.

**Regression check:** every included country contains all three actor kinds, weights sum to its population, and a nonzero shock can produce nonzero business pressure.

### 3. Baseline comparisons can silently compare different experiments

**Priority: high.** `src/components/SimulationLab.tsx:15-17` builds a baseline using the current editable controls, rather than `result.scenario`. A browser check ran a 12-week scenario, changed the horizon to four weeks, and observed a four-week baseline request. The comparison panel compares their final frames despite different endpoints. A new run also retains the previous baseline; the browser check confirmed that the old comparison remains available.

**Change:** derive baseline family, horizon, seed and targeting from the completed scenario, changing only the shock. Clear the baseline when running or branching. Guard comparison compatibility. For provider-backed comparisons, document that independently queried decisions can vary and that the displayed delta is not clean causal attribution. A branch baseline should continue from the same checkpoint if the intended comparison is the effect of the branch intervention.

### 4. Saved replay results lose their identity

**Priority: medium.** Creation and branching save `result` before assigning `result.id` and `result.createdAt`. `src/app/api/simulations/[id]/route.ts:1` returns only that stored JSON. The route check confirmed a creation response containing `saved-id`, followed by a replay response with no ID or creation time.

**Change:** merge the database row's ID and timestamp into replay responses. Without that metadata, a replay loaded into the current client cannot be branched because the client requires `result.id`.

### 5. Invalid branch horizons are accepted; branches change provider policy

**Priority: medium.** `src/lib/simulation/engine.ts:22` preserves frames through the branch point even when the requested end horizon is earlier. Branching at week six with a four-week horizon returned a scenario declaring four weeks but ending at week six. Out-of-range branch weeks are silently clamped instead of rejected.

The branch route always calls the deterministic engine and accepts no provider key. An OpenRouter parent therefore gets a rules-only continuation, while the copied historical frames may still contain OpenRouter decisions.

**Change:** validate the branch point against the parent and require an end horizon after the branch point, or define a separate continuation duration. Preserve the chosen provider policy or clearly display the switch and mixed historical provenance. Disable branching when persistence is unavailable instead of waiting for a click to fail.

### 6. Provider boundaries need stricter validation and bounded total execution

**Priority: medium; high for a public provider-backed deployment.** `src/lib/providers/openrouter.ts:18-19` accepts an HTTP 200 response containing `{}` as a successful `maintain routine` decision with confidence 0.5. This was reproduced. Unknown choices similarly become a default action rather than a warning and deterministic fallback.

`narrate` and key validation use bare `fetch` without an application timeout. Individual decision calls have timeouts/retries, but the sequential weekly loop has no overall deadline. At the default selection ceiling, up to 72 decisions can be attempted per week, or 7,488 over 104 weeks before retries. Invalid credentials are rejected without retry inside one call, but the runner continues attempting other cohorts and later weeks. A nonnumeric `DECISION_MAX_COUNTRIES` becomes `NaN` and selects no countries silently.

**Change:** validate provider responses with the existing Zod dependency; reject unknown choices and nonfinite confidence values. Apply timeouts to every provider request, validate environment configuration, stop repeated calls after an unrecoverable credential failure, and cap total calls/time per run. Add progress/cancellation. Use durable execution only if the bounded synchronous workload still cannot meet the route's 300-second deadline.

### 7. Public routes have no access or spend controls

**Priority: high before public exposure; deployment-dependent.** The routes have no authentication, ownership checks, quotas or rate limits. With `OPENROUTER_API_KEY` configured, an ordinary POST without a client key can invoke the server's paid provider credentials. History lists all saved runs, and detail/branch endpoints have no ownership boundary. Zod input validation does not address these concerns.

**Change:** for private use, protect the deployment. For a multiuser release, enforce ownership, authenticated access, per-user rate limits and a server-side call/spend budget. Keep supplied provider keys out of request-header logs. No abuse or unauthorized data access was attempted during this review.

### 8. Provider dialog is not keyboard-modal

**Priority: medium.** `src/components/ProviderGate.tsx:7` declares `aria-modal`, but does not trap focus or make the background inert. A browser check tabbed from the key input through the dialog into Methodology, the event textarea and event-family buttons behind the overlay.

**Change:** use a native modal dialog or implement focus containment, initial focus, background inertness and focus restoration. Add a regression check that tabbing cannot reach background controls while the dialog is open.

## Improvements to the simulation and product

1. **Make event semantics explicit.** Changing only the description between a shipping disruption and a medical breakthrough produced identical deterministic frames. `description` and `assumptions` do not enter the numerical engine; branching on text alone also has no deterministic effect. Either explain that the text is descriptive, or translate it into inspectable structured inputs such as event family, affected regions/sectors, start week and intensity. Show the interpreted inputs before running. Keep arithmetic in the engine.
2. **Separate shock duration from viewing horizon.** `durationWeeks` controls the number of frames, shock decay and adaptation speed. Requesting more weeks therefore changes the early trajectory, rather than just extending observation. Give decay/adaptation explicit documented parameters, or clearly explain this coupling. Add a prefix-invariance check if the horizon is intended to be a viewing choice.
3. **Improve model provenance before adding complexity.** Import/export/energy exposure values are displayed but do not drive transitions. Link selection uses regional proximity and simple latitude/longitude differences; it is not a measured trade network. Label these values as synthetic, hide unused metrics or connect them to documented mechanics. Record observation years and source versions for real population data. Prefer upgrading one meaningful exposure channel before expanding the number of modeled features.
4. **Show sensitivity rather than a single precise-looking score.** Offer a small set of severity/seed variants and show their spread as model sensitivity, not a probability or validated confidence interval. Explain which inputs contributed to country pressure. Provider confidence should remain separate from simulated pressure.
5. **Finish the replay workflow.** Persistence APIs exist, but the UI has no saved-run list or load control. Add history, a run name, explicit save status, export/import and a branch-parent breadcrumb. Start with the existing routes rather than a new backend.
6. **Improve exploration controls.** Add searchable country selection so users can inspect any country without a globe click or the top-ten list. Add play/pause/restart controls and an optional compact pressure-over-time chart. Keep Methodology accessible on mobile; the current mobile CSS hides its navigation link.
7. **Strengthen tests where the current suite is thin.** Add permanent regression tests for actor coverage, response size, baseline compatibility/reset, replay metadata, branch bounds and provider response validation. Add route tests for validation and database/provider failure behavior. Run one integration test against disposable PostgreSQL when verifying persistence. The current 15 unit tests and five browser tests do not establish these guarantees.

## Maintenance and setup

- `.env.example` contains a nonempty placeholder `DATABASE_URL`. Copying it as directed makes `hasDatabase()` true, so an otherwise valid deterministic run attempts persistence to the placeholder host. Default it to blank and put the sample URL in a comment, or require an explicit persistence setting.
- Simulation creation treats database failures as HTTP 400 and discards the computed result. Decide whether optional persistence failure should return a usable result with an unsaved warning; return suitable server errors for infrastructure failures. List/detail routes also need controlled database error responses.
- `README.md` still says full quality gates could not run; this review ran them successfully. `docs/ARCHITECTURE.md` claims a 1,800-second route duration, while source declares 300 seconds, and claims provider keys never enter client components, while the gate holds user keys in React state. Correct these statements. Server environment keys do remain server-side; user-supplied keys take a different path.
- Choose one package manager and lockfile. CI uses npm, while a pnpm lockfile and a workspace file with unresolved build-permission placeholder strings also exist. Remove the unused package-manager configuration or complete and verify it.
- Stop tracking incremental `tsconfig.tsbuildinfo`; running typecheck updates it. Remove unused `src/data/countries.ts`, after confirming no imports. Format compressed source with the project's existing tooling or one consistent formatter so validation/error paths are reviewable. Fix the one PostCSS export warning.
- Dependency audit reports seven affected package entries, including transitive Prisma tooling, PostCSS and Vitest. These are not seven independently proven application exploits. Check each dependency path and upgrade compatible packages, then rerun all gates. Avoid blindly applying forced major-version changes or the suggested Prisma downgrade.

Relevant advisory details: [DeepmergeTS recursive graph exhaustion](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), [Vitest mocker file read](https://github.com/advisories/GHSA-82fw-gwwq-j7x9), [PostCSS source map file read](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp). These findings concern specific input/server conditions; this review did not establish that WorldSim exposes those conditions.

## Recommended order

1. Compact responses, guarantee actor coverage, fix baseline lifecycle and replay/branch contracts.
2. Bound provider execution, validate responses, correct dialog focus and local setup.
3. Apply deployment access/cost controls before public exposure; review dependency advisories.
4. Add focused regression coverage, history/search/playback improvements and clear event semantics.
5. Improve data provenance and model sensitivity after the correctness gaps are closed.

The existing pure engine, provider boundary, schema validation, deterministic seed and CI are useful foundations. These findings do not justify a full rewrite.
