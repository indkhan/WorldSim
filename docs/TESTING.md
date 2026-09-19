# Testing strategy

The included Vitest suite checks the invariants most likely to silently invalidate results: population scaling, global coverage, within-country heterogeneity, population-weighted aggregation, bounded state, action effects, deterministic replay, international links, zero-shock baseline behavior and historical branching.

Before a public release, add:

- route tests for Zod validation and provider failures;
- mocked OpenRouter decision tests proving decisions alter the following week's state;
- mocked OpenRouter tests proving narration failure is non-fatal;
- Playwright tests for scenario creation, country drill-down, timeline playback, baseline comparison and branching;
- accessibility checks for keyboard navigation and contrast;
- load tests around maximum horizon/provider fan-out;
- golden scenario snapshots to detect accidental model-mechanics drift.

Run `npm run check` locally and in CI before merging.
