import Link from "next/link";
export default function Methodology() {
  return (
    <main className="prosepage">
      <Link href="/">← WorldSim</Link>
      <h1>How the shipping lab works</h1>
      <p>
        The home page explores an eight-country Asia–Europe electrical equipment
        supply chain. Outputs are conditional scenarios, not forecasts. The
        original world simulator remains at <Link href="/legacy">/legacy</Link>.
      </p>
      <h2>Data and assumptions</h2>
      <p>
        UN Comtrade 2023 annual HS85 aggregate import values determine supplier
        shares for China, South Korea and India supplying Germany, France, the
        UK, Italy and the Netherlands. These value shares do not measure weekly
        physical shipments or shipping-lane exposure. Source queries and
        aggregate flags are retained with the bundled data.
      </p>
      <p>
        Factory input units, route exposure, delivery lead time, starting
        stocks, prices, cash and public budgets are explicit assumptions.
        Household shares are 40/40/20 percent, with starting savings of 0.5/2/6
        income weeks. Firms and governments have separate accounts; they are not
        population groups. Half of supplier-sector demand is assumed
        export-dependent. Population in the map snapshot does not calibrate this
        engine.
      </p>
      <h2>The weekly clock</h2>
      <p>
        All actors observe the same previous checkpoint and recent history.
        Previously dispatched deliveries arrive, pending policies activate,
        feasible actions commit, factories consume inventory, and households
        settle wages and bills. Supplier output and cash respond to fulfilled
        export orders. Orders that exceed shipping capacity stay queued; each
        checkpoint retains deliveries, queues, resources, commitments and
        decisions.
      </p>
      <h2>Costs and delays</h2>
      <p>
        Expediting costs a firm 10 cash units and shortens new deliveries by one
        week. Rerouting costs 40 public units, activates after two weeks,
        reduces disruption to 35% of its original strength and adds one delivery
        week. Relief costs 20 public units, starts after one week and transfers
        0.12 weekly income units to low-income households for four weeks.
        Insufficient funds reject an action; existing shipments keep their
        arrival dates.
      </p>
      <h2>What the AI does</h2>
      <p>
        Sonnet 5.5 is the default through OpenRouter; GPT‑6.1 Sol is selectable.
        Description interpretation proposes editable controls for review. One
        structured batch reviews all 40 actors every four weeks, starting at
        week 1. IDs, actor-specific choices and observed evidence weeks are
        validated. Government observes while the experiment controls public
        policy. AI, retained decisions, rules and interventions are labeled.
        Numerical transitions belong to TypeScript; explanations cannot alter
        them.
      </p>
      <p>
        Request bytes, output tokens, call count, timeouts and provider price
        filters bound execution. Invalid batches visibly fall back; rejected
        credentials stop calls. Cost estimates are not an invoice. Missing usage
        remains unknown.{" "}
        <a href="https://openrouter.ai/docs/guides/routing/provider-selection">
          OpenRouter routing contract
        </a>
        .
      </p>
      <h2>Replay and policy comparison</h2>
      <p>
        Loading a saved or exported replay makes no model calls. JSON import
        validates engine/prompt/data versions, resource ranges and checkpoint
        identities, within 2 MB. A policy branch preserves its complete
        checkpoint and historical prefix. It fixes recorded household/firm
        actions and changes subsequent public policy. This estimates a
        controlled effect inside the model; it does not rerun adaptive AI
        behavior. Existing funded commitments survive a branch.
      </p>
      <p>
        The bounded 4–24 week runner streams real checkpoints. PostgreSQL saves
        completed runs and branches; export works without it. Interrupted
        partial execution cannot resume. Saved runs remain shared with visitors;
        API keys are never saved with a replay.
      </p>
      <h2>Original global simulator</h2>
      <p>The sections below describe the separate legacy engine at /legacy.</p>
      <p>
        WorldSim is an exploratory scenario simulator, not a forecasting system.
        It creates population-weighted synthetic representatives and propagates
        explicit shocks through deterministic state transitions. OpenRouter can
        provide bounded actor choices and explain recorded results.
      </p>
      <h2>Legacy population representation</h2>
      <p>
        The sample scales at approximately 100 agents per billion residents,
        with a minimum of three representatives per country. Each representative
        carries a population weight. More agents represent diversity; they are
        not real respondents.
      </p>
      <h2>Legacy numerical inputs</h2>
      <p>
        Family, severity, seed, targeted regions, shock decay scale and
        adaptation timescale affect numerical state. Viewing horizon only
        extends observation. Both timescales default to 12 weeks. Description
        and assumptions are descriptive text and are not interpreted by the
        deterministic engine; provider choices can depend on description and
        affect numerical state.
      </p>
      <p>
        Actor population shares are fixed at 80% households, 15% businesses and
        5% government. These are synthetic modeling weights, not measured
        demographic groups. Trade links, resilience, capacities and exposure
        fields are synthetic; displayed import/export/energy fields do not drive
        transitions.
      </p>
      <h2>Interpretation</h2>
      <p>
        A simulated frequency is not a verified probability of real-world
        behavior. Country differences should be interpreted as consequences of
        model inputs and assumptions, not national personality. Political
        actions shown are scenario outputs, not recommendations.
      </p>
      <h2>Reproducibility</h2>
      <p>
        The deterministic engine is seeded. External model providers can change,
        so production runs should retain model IDs and normalized outputs
        alongside the seed.
      </p>
    </main>
  );
}
