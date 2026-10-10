# Operations

## Setup and deployment

Run npm ci and npm run dev. The demo needs no environment variables or provider key. Deploy the Next.js repository directly to Vercel. There is no database service, schema generation, migration or history endpoint.

## Session lifecycle

Runs and comparisons live in browser memory. Refresh resets them. Download a shipping JSON replay before leaving to retain a result; upload validates it and makes no model calls. Partial runs cannot resume. No server storage or browser database is used.

## Provider controls

Visitors may connect their own OpenRouter key, or use deterministic mode. Keys stay in tab memory and are excluded from replay files. Use HTTPS; never put keys in URLs or logs.

Shipping has at most six planned actor reviews plus one explanation, 25-second request deadlines and a shared review time budget. Interpretation is a separate user-triggered request. Routing caps token rates and output size; actual billing comes from the provider. See SHIPPING.md.

Legacy fan-out uses DECISION_MAX_COUNTRIES (default 6, maximum 12), PROVIDER_MAX_CALLS (default 24, maximum 60) and PROVIDER_MAX_SECONDS (default 60, maximum 120). Requests are serial, with five-second deadlines and no paid retries. Credential/billing rejection stops later calls.

## Failure behavior

- Invalid input: HTTP 400 before execution.
- Provider failure: recorded rule fallback; optional explanation may be omitted.
- Cancellation or interrupted stream: the browser preserves its previous completed replay.
- Invalid import: the current run remains available.

Production dependency overrides cover Next PostCSS and Vitest's Vite dependency; keep their existing compatibility checks when updating dependencies. No Prisma dependency remains.
