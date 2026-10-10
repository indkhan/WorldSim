# WorldSim

An eight-country shipping disruption lab: a key-free sixteen-week demo, a trade network and globe, country timelines, delayed deliveries, finite budgets and household savings. Optional OpenRouter decisions are validated; TypeScript owns numerical effects.

**No database, accounts or saved-run history.** The current run and policy comparison live in browser memory. Refresh starts a fresh session. Download/upload a validated JSON replay to keep or share a result; replay makes no model calls. We deliberately do not add IndexedDB or localStorage when history is unnecessary.

## Quick start

```bash
npm ci
npm run dev
```

Open http://localhost:3000. No environment setup or API key is needed for the demo. Connect your own OpenRouter key in the app for AI; the key stays in tab memory and is sent only to the server provider boundary. Use HTTPS when deployed.

## What you can explore

- Eight countries, fifteen trade links and forty bounded actors.
- Actual UN Comtrade 2023 annual HS85 import value weights, with explicit weekly assumptions.
- Queued orders, in-transit shipments, factory inventories, prices and household savings.
- A controlled policy branch from the current checkpoint, computed locally with recorded household/firm actions.
- Sonnet 5.5 or GPT-6.1 Sol through OpenRouter, reviewing actors at planned intervals.
- JSON replay download/upload, capped at 2 MB. API keys are excluded.

The original global simulator is still available at /legacy, with in-memory branching and baseline comparisons. Neither simulator writes runs to the server.

## Visual explainer

Open [public/explainer.html](public/explainer.html) directly in a browser, or visit /explainer.html. It is self-contained and offline, with eight diagram styles, weekly controls and recorded policy comparisons. Charts are a snapshot of the default shipping-1.0 rules run and week-three branches; tests detect drift if the engine or trade data changes.

## Optional environment variables

All settings in [.env.example](.env.example) are optional provider budgets, model defaults or app attribution. Visitors enter their own provider keys; there is no server-key fallback. Never commit credentials.

## Verify and deploy

```bash
npm run check
npm run test:e2e
```

Use Node 22.12+ and npm. GitHub Actions runs these checks. Deploy this repository as a single Next.js app on Vercel; no storage service or schema setup is needed. Routes execute bounded simulations and stream completed shipping weeks. Interrupted partial runs cannot resume.

## Mechanics and limits

- [Shipping mechanics](docs/SHIPPING.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Data sources](docs/DATA.md)
- [Operations](docs/OPERATIONS.md)
- [Testing](docs/TESTING.md)
- [Legacy mechanics](docs/SIMULATION.md)

WorldSim explores mechanisms and conditional policy differences. Weekly quantities, behavior and starting resources are illustrative assumptions, not calibrated forecasts. Earth imagery is static; globe overlays show the selected simulation week. Earth/cloud textures are vendored from Three.js examples, with decorative clouds.
