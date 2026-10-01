# Testing

Use Node 22.12+ and npm ci. Run npm run check and npm run test:e2e. The browser suite starts an isolated WorldSim server on port 3117 and refuses to reuse a running server. Database, server provider key and private-password environment settings are blanked for this local test server. Provider calls are mocked.

Regression coverage includes every-country actor shares and production, exact compact round trips and default/maximum payload sizes, horizon prefix invariance, baseline compatibility/lifecycle, same-checkpoint branch baselines, replay identity, branch validation/history, optional persistence failures, provider schema/confidence/failures/deadlines/call budgets and private access. Playwright covers native modal keyboard focus/restoration, baseline lifecycle, country search, playback, mobile Methodology, save status/history and ancestry.

Disposable PostgreSQL integration must be performed when a database service is available. Mocked Prisma boundaries verify contracts, not real connectivity or database transactions. See IMPLEMENTATION.md for the checks actually performed.

Follow-up: measured data ingestion, sensitivity analysis, charts, distributed ownership/quota tests if public multiuser support is built, and broader accessibility/visual/load testing. Model scores remain exploratory synthetic outputs, not validated probabilities.
