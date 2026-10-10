"use client";
import { Activity, GitBranch, Globe2, Info, Users } from "lucide-react";
import { useEffect, useMemo, useState, useRef } from "react";
import type { EventFamily, SimulationResult } from "@/lib/simulation/types";
import WorldMap from "./WorldMap";
import ProviderGate, { type ProviderKeys } from "./ProviderGate";
import { ScenarioControls } from "./simulation/ScenarioControls";
import { CountryInspector } from "./simulation/CountryInspector";
import { ComparisonPanel, WorldSummary } from "./simulation/AnalysisPanels";
import { unpackResult } from "@/lib/simulation/transport";
import type { ScenarioInput } from "@/lib/simulation/types";
import { continueFromFrame } from "@/lib/simulation/engine";
import { scenarioSchema } from "@/lib/simulation/schema";
type Tab = "world" | "country" | "compare";
export default function SimulationLab({
  initial,
}: {
  initial: SimulationResult;
}) {
  const pending = useRef<AbortController | null>(null);
  const [query, setQuery] = useState(""),
    [shockDuration, setShockDuration] = useState(12),
    [adaptation, setAdaptation] = useState(12);
  const [result, setResult] = useState(initial),
    [baseline, setBaseline] = useState<SimulationResult | null>(null),
    [branchCheckpoint, setBranchCheckpoint] = useState<{
      parent: SimulationResult;
      week: number;
    } | null>(null),
    [week, setWeek] = useState(0),
    [playing, setPlaying] = useState(false),
    [code, setCode] = useState<string | null>(null),
    [tab, setTab] = useState<Tab>("world"),
    [description, setDescription] = useState(initial.scenario.description),
    [family, setFamily] = useState<EventFamily>("energy"),
    [severity, setSeverity] = useState(65),
    [duration, setDuration] = useState(12),
    [loading, setLoading] = useState(false),
    [error, setError] = useState<string | null>(null),
    [keys, setKeys] = useState<ProviderKeys | null>(null);
  const hasRun = Boolean(result.scenario.title),
    frame = result.frames[Math.min(week, result.frames.length - 1)],
    selected = frame.countries.find((c) => c.code === code) || null,
    top = useMemo(
      () =>
        [...frame.countries]
          .sort((a, b) => b.pressure - a.pressure)
          .slice(0, 10),
      [frame],
    );
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setWeek((current) => {
          if (current >= result.frames.length - 1) {
            setPlaying(false);
            return current;
          }
          return current + 1;
        }),
      700,
    );
    return () => clearInterval(timer);
  }, [playing, result.frames.length]);
  async function request(
    input: ScenarioInput,
    useProvider = Boolean(keys?.openrouter),
  ) {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (useProvider && keys?.openrouter)
      headers["x-openrouter-api-key"] = keys.openrouter;
    else headers["x-provider-mode"] = "deterministic";
    const r = await fetch("/api/simulations", {
      method: "POST",
      headers,
      signal: pending.current?.signal,
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => null);
      throw new Error(body?.error || `Simulation request failed (${r.status})`);
    }
    return unpackResult(await r.json());
  }
  async function execute(task: () => Promise<void>) {
    setLoading(true);
    setPlaying(false);
    setError(null);
    pending.current = new AbortController();
    try {
      await task();
    } catch (e) {
      const message =
        e instanceof Error && e.name === "AbortError"
          ? "Request cancelled."
          : e instanceof Error
            ? e.message
            : "Something went wrong";
      setError(
        message === "Failed to fetch"
          ? "WorldSim could not reach the simulation server. Check the deployment and try again."
          : message,
      );
    } finally {
      setLoading(false);
    }
  }
  const run = () =>
      execute(async () => {
        setBaseline(null);
        setBranchCheckpoint(null);
        setResult(
          await request({
            title: "Custom world event",
            description,
            family,
            severity,
            durationWeeks: duration,
            shockDurationWeeks: shockDuration,
            adaptationWeeks: adaptation,
            seed: 42,
          }),
        );
        setWeek(0);
        setPlaying(true);
        setCode(null);
        setTab("world");
      }),
    compare = () =>
      execute(async () => {
        if (
          (result.providerPolicy ?? result.providerMode) === "openrouter" &&
          !keys?.openrouter
        )
          throw new Error(
            "This run used OpenRouter. Reload and connect OpenRouter before generating its baseline.",
          );
        if (branchCheckpoint) {
          setBaseline(
            continueFromFrame(
              branchCheckpoint.parent,
              { ...result.scenario, severity: 0 },
              branchCheckpoint.week,
            ),
          );
        } else
          setBaseline(
            await request(
              { ...result.scenario, severity: 0 },
              (result.providerPolicy ?? result.providerMode) === "openrouter",
            ),
          );
        setTab("compare");
      }),
    branch = () =>
      execute(async () => {
        setBaseline(null);
        setPlaying(false);
        const input = {
          ...scenarioSchema.parse({
            ...result.scenario,
            title: `Branch: ${result.scenario.title}`.slice(0, 120),
            description,
            severity,
            family,
            durationWeeks: duration,
            shockDurationWeeks: shockDuration,
            adaptationWeeks: adaptation,
          }),
          branchWeek: week,
        };
        const next = continueFromFrame(result, input, week);
        setBranchCheckpoint({ parent: result, week });
        setResult(next);
        setCode(null);
        setTab("world");
      });
  const select = (c: { code: string }) => {
    setCode(c.code);
    setTab("country");
  };
  return (
    <main className="shell" id="simulation-lab" tabIndex={-1}>
      <a className="skip-link" href="#simulation-lab">
        Skip to simulator
      </a>
      {!keys && <ProviderGate onConnect={setKeys} />}
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">
            <Globe2 />
          </span>
          <div>
            <h1>WorldSim</h1>
          </div>
        </div>
        <nav>
          <a href="/methodology">
            <Info size={14} />
            Methodology
          </a>
        </nav>
      </header>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="layout">
        <ScenarioControls
          description={description}
          family={family}
          severity={severity}
          duration={duration}
          week={week}
          loading={loading}
          hasRun={hasRun}
          canBranch={hasRun && week < duration}
          shockDuration={shockDuration}
          adaptation={adaptation}
          onShockDuration={setShockDuration}
          onAdaptation={setAdaptation}
          onDescription={setDescription}
          onFamily={setFamily}
          onSeverity={setSeverity}
          onDuration={setDuration}
          onRun={run}
          onCompare={compare}
          onBranch={branch}
        />
        <section className="center">
          {loading && (
            <button onClick={() => pending.current?.abort()}>
              Cancel request
            </button>
          )}
          <div className="metricstrip">
            <Metric n="Global pressure" v={frame.globalPressure} />
            <Metric n="Household strain" v={frame.globalHouseholdStrain} />
            <Metric n="Production" v={frame.globalProductionPressure} />
            {hasRun && (
              <div>
                <small>Active links</small>
                <strong>{frame.flows.length}</strong>
              </div>
            )}
          </div>
          <WorldMap
            countries={frame.countries}
            flows={frame.flows}
            selectedCode={code}
            playing={playing}
            week={week}
            onSelect={select}
          />
          <div className="timeline panel">
            <div>
              <b>WEEK {week}</b>
              <span>
                {result.scenario.title || "Describe an event to begin"}
              </span>
            </div>
            <input
              aria-label="Simulation week"
              disabled={!hasRun}
              type="range"
              min="0"
              max={result.frames.length - 1}
              value={week}
              onChange={(e) => {
                setPlaying(false);
                setWeek(+e.target.value);
              }}
            />
            <div className="playback">
              <button
                disabled={!hasRun || loading}
                onClick={() => {
                  if (week >= result.frames.length - 1) setWeek(0);
                  setPlaying(!playing);
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                disabled={!hasRun || loading}
                onClick={() => {
                  setWeek(0);
                  setPlaying(false);
                }}
              >
                Restart
              </button>
            </div>
            <div className="ticks">
              <span>Event</span>
              <span>Propagation</span>
              <span>Adaptation</span>
            </div>
          </div>
        </section>
        <aside className="panel analysis">
          <div className="country-search">
            <label htmlFor="country-search">Search countries</label>
            <input
              id="country-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label htmlFor="country-select">Inspect country</label>
            <select
              id="country-select"
              value={code || ""}
              onChange={(e) => select({ code: e.target.value })}
            >
              <option value="">Select a country</option>
              {frame.countries
                .filter((c) =>
                  `${c.name} ${c.code}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="tabs">
            <button
              className={tab === "world" ? "active" : ""}
              onClick={() => setTab("world")}
            >
              <Activity />
              World
            </button>
            <button
              disabled={!hasRun}
              className={tab === "country" ? "active" : ""}
              onClick={() => setTab("country")}
            >
              <Users />
              Country
            </button>
            <button
              disabled={!hasRun}
              className={tab === "compare" ? "active" : ""}
              onClick={() => setTab("compare")}
            >
              <GitBranch />
              Compare
            </button>
          </div>
          {tab === "country" && selected ? (
            <CountryInspector country={selected} />
          ) : tab === "compare" ? (
            <ComparisonPanel current={result} baseline={baseline} />
          ) : hasRun ? (
            <WorldSummary
              top={top}
              analysis={result.analysis}
              providerMode={result.providerMode}
              warnings={result.warnings}
              select={select}
            />
          ) : (
            <div className="empty">
              <Activity />
              <h3>Start a simulation</h3>
              <p>
                Run a scenario to explore its impact.
              </p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
function Metric({ n, v }: { n: string; v: number }) {
  return (
    <div>
      <small>{n}</small>
      <strong>{(v * 100).toFixed(1)}%</strong>
    </div>
  );
}
