# Simulation methodology

## Representation

WorldSim scales country population into a small weighted synthetic population. `agentCount(population)` targets 100 agents for one billion residents, caps at 100 and keeps at least three agents for small countries. Agents with the same actor/income/urbanity/sector combination are compressed into cohorts. Every country reserves household, business and government representation. Their fixed aggregate shares are 80%, 15% and 5%, independent of sample size. `weight` allocates the country population across these synthetic actor channels; weights sum to country population. These are modeling weights, not measured actor demographics. All country aggregation uses this weight.

This is a computational sampling device, not survey microdata.

## Within-country heterogeneity

Cohorts vary across:

- actor: household, business, government;
- income: low, middle, high;
- settlement: urban or rural;
- sector: services, industry, agriculture, energy, technology;
- resilience: seeded synthetic capacity to absorb a shock;
- event exposure: calculated from event family plus cohort attributes.

For example, an energy-sector business and a low-income household in the same country receive different exposure, resilience, actions and resulting pressure.

## State transition

Each week combines:

- event shock intensity and exponential decay (`exp(-week / max(4, shockDurationWeeks * 1.45))`);
- whether the event targets the country's region;
- cohort-specific exposure;
- pressure arriving through international links;
- country adaptive capacity and time adaptation (`min(0.55, week / adaptationWeeks * (0.22 + capacity * 0.25))`);
- cohort resilience;
- mitigation from the cohort's previous action.

All continuous state is clamped to `[0,1]`. Country pressure is the represented-population-weighted mean of cohort pressure. Household and production metrics aggregate only their corresponding actor cohorts.

## Decisions

Without OpenRouter, deterministic thresholds choose from bounded actions. When configured, representative high-impact cohorts receive a decision from OpenRouter's `~typesafe/jev-latest` model each week. That choice is converted to a bounded mitigation/adaptation coefficient and therefore affects the next state transition. Every cohort records whether its decision came from `rules` or `openrouter`.

Decision confidence describes confidence over the supplied options. It is **not** the probability that a real population, company or government will take that action.

## International propagation

Each country receives a small set of links prioritizing regional proximity and population-scale economic weight. The link kind follows the scenario family (trade, energy or generic regional). Incoming pressure contributes to subsequent cohort pressure.

These links are proxies, not a measured global input-output table. A future data upgrade should replace them with versioned trade, energy and supply-chain matrices.

## Baselines and branches

A baseline takes the completed scenario settings, changing only severity to zero. Edited controls do not affect it. New runs, branches and replay clear the previous baseline; incompatible settings/endpoints are rejected. A branch baseline starts at the same parent checkpoint as the branch. Independently queried provider choices can differ; deltas are model comparisons, not clean causal attribution. A branch preserves all parent frames through the selected week and then evolves from that exact state under changed branch assumptions. This is preferable to restarting from week zero and merely relabeling the run.

## Interpretation

Appropriate statement: “Under these model assumptions, low-income urban household cohorts experienced more simulated pressure than high-income cohorts.”

Inappropriate statement: “There is an 82% chance low-income residents will behave this way.”

WorldSim does not establish causal effects, public opinion, government intent, election outcomes, market forecasts or individual behavior.

## Numerical inputs and engine version 2

Family, severity, seed, target regions, shockDurationWeeks and adaptationWeeks affect deterministic state. durationWeeks is only the viewing horizon; both timing parameters default to 12. Changing the horizon preserves an identical prefix. The shock duration parameter is a decay scale, not a hard cutoff.

Description and assumptions are descriptive; the deterministic engine does not interpret them. Provider decisions may depend on description and feed bounded action effects into numerical state. Displayed import/export/energy exposure fields are unused by transitions. Links and capacities are synthetic proxies. Actor weighting and timing changed from engine 1.1; saved history is preserved, but new continuations use engine 2 mechanics.
