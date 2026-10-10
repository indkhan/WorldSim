# Shipping lab — 2026-10-10

The home page uses `shipping-1.0`; `/legacy` retains the original engine. No dependency or database migration was added. `shipping.ts` owns numerical state, `shipping-replay.ts` validates saved/imported states, and `providers/shipping.ts` owns structured AI calls.

## Data

`src/data/shipping-trade.json` retains UN Comtrade public preview queries and 2023 annual HS85 aggregate import records, retrieved 2026-10-10. Each buyer has its world total and China/South Korea/India import values. `bilateral value / world import value` provides a modeled input share. The unmodeled remainder arrives normally. France uses reporter 251, not obsolete reporter 250.

These are **annual value shares**, not physical volumes, weekly observations or measured route exposure. Records are aggregates (`isAggregate=true`, `isReported=false` in this API response); their flags remain in the snapshot. Old map population data is unused for calibration. Route exposure and all weekly numerical parameters are assumptions.

## Clock and balances

All actors observe a frozen previous checkpoint and preceding three weeks. Arrivals and pending policies activate; feasible actions commit; factories consume stock; supplier demand responds to actual dispatches; households settle wages and bills; deliveries join the pipeline; an immutable frame is appended.

- `inventory_next = inventory_previous + arrivals - output`
- `in_transit_next = in_transit_previous + dispatches - deliveries`
- `queue_next = queue_previous + normal_orders - dispatches`

Recovering capacity clears queues at 150% of normal. Past shipments retain their due dates. Buyers normally consume 100 normalized input units/week; household deferral reduces demand by 12% times the deferring household shares. Stock bounds output. Prices respond to scarcity, not discretionary demand reductions. Half of supplier-sector demand is assumed export-dependent; blocked orders lower output, wages and export cash. This is not a unit-consistent national accounting system.

Household shares are 40/40/20%; initial savings are 0.5/2/6 income weeks, with essential spending fractions 0.9/0.7/0.45. Output reductions lower low/middle-income wages by half the output shortfall, high-income wages by 15%. Savings cannot become negative. Strain is an illustrative index, not a probability. Public authorities and firms have distinct budget/cash accounts, not population weights.

## Actions

| Action | Cost | Effect |
| --- | --- | --- |
| Household maintain / defer | Income and savings | Deferral reduces discretionary bills and factory demand |
| Firm expedite | 10 firm cash units | New deliveries arrive one week earlier; minimum one week |
| Public reroute | 40 public units | Active after two weeks; disruption is 35% of original, lead adds a week |
| Low-income relief | 20 public units | Active after one week; 0.12 income units/week for four weeks |

Public policy is a user-controlled experiment. Government AI observes instead of changing that control. Unaffordable actions are rejected. Requested and rejected firm actions remain inspectable; existing commitments survive branches.

## AI

Shipping uses `anthropic/claude-sonnet-5.5` or `openai/gpt-6.1-sol` through OpenRouter chat completions. Accepted batches contain all 40 country/actor IDs exactly once, actor-specific options and actual observed evidence weeks. Own resources and recent history inform decisions. Reviews occur at weeks 1/5/9/13/17/21 as applicable; intervening choices are retained and labeled. Invalid batches visibly use rules until the next review. Fatal rejections stop calls.

Requests use strict schemas and `provider.require_parameters=true`. Byte limits include the schema; output caps at 6,500 tokens. Provider `max_price` excludes routes above $2/M prompt or $10/M completion tokens and per-request surcharges. A request times out at 25 seconds, within the shared review deadline. Six reviews plus one explanation reserve about $0.85 in capped token costs; fees and provider billing are separate. Missing cost/tokens are null, not zero; attempts and returned model IDs are recorded. Interpretation is a separate user-triggered request returning an editable draft. Narration receives recorded outcomes and cannot alter frames.

## Replay and comparisons

Existing gzip patches preserve nested shipping states. Frames retain pending policies, shipments and backlog. Controlled comparisons reuse recorded household/firm choices and change only subsequent public controls. They do not model adaptive AI reconsideration. Historical prefixes remain exactly equal; changing policy does not reset the original shock clock.

Export/import works without a database, within 2 MB. Import validates versions, resource ranges, country/household identities and checkpoint order. Imported row identity is removed from the active run rather than trusting it on another server. Optional completed-run/branch saves use existing Prisma Simulation rows. Keys are never stored. Saved database history remains shared.

The 4–24 week route streams real completed checkpoints, then an optional explanation and packed final output. Partial execution is not durable and cannot resume. No queue, vector store, agents framework, private accounts or live data pipeline was added. No calibrated forecast, external causal identification or measured national behavior is claimed.

Contracts: [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs). Data: [UN Comtrade](https://comtradeplus.un.org/). [IMF PortWatch](https://portwatch.imf.org/) provides context; it is not ingested.
