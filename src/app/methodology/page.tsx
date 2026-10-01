import Link from "next/link";
export default function Methodology() {
  return (
    <main className="prosepage">
      <Link href="/">← WorldSim</Link>
      <h1>Methodology & limitations</h1>
      <p>
        WorldSim is an exploratory scenario simulator, not a forecasting system.
        It creates population-weighted synthetic representatives and propagates
        explicit shocks through deterministic state transitions. OpenRouter can
        provide bounded actor choices and explain recorded results.
      </p>
      <h2>Population representation</h2>
      <p>
        The sample scales at approximately 100 agents per billion residents,
        with a minimum of three representatives per country. Each representative
        carries a population weight. More agents represent diversity; they are
        not real respondents.
      </p>
      <h2>Numerical inputs</h2>
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
