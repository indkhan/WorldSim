"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowRight,
  Download,
  Globe2,
  KeyRound,
  Pause,
  Play,
  RotateCcw,
  Ship,
} from "lucide-react";
import ProviderGate from "./ProviderGate";
import {
  branchShipping,
  defaultShippingPlan,
  runShipping,
  shippingLinks,
  shippingPlanSchema,
  type ShippingPlan,
} from "@/lib/simulation/shipping";
import { unpackResult } from "@/lib/simulation/transport";
import type { SimulationResult } from "@/lib/simulation/types";
import { parseShippingReplay } from "@/lib/simulation/shipping-replay";
const WorldMap = dynamic(() => import("./WorldMap"), {
  ssr: false,
  loading: () => <p>Loading the world view…</p>,
});
type History = {
  id: string;
  title: string;
  input: { shipping?: ShippingPlan };
};
type Metric = "output" | "inventory" | "priceIndex";
const metricLabels = {
  output: "Output · baseline = 100",
  inventory: "Inventory · normalized input units",
  priceIndex: "Price · baseline = 100",
};
const number = (v: number) => v.toFixed(1);
function HistoryChart({
  result,
  comparison,
  code,
  week,
  metric,
}: {
  result: SimulationResult;
  comparison: SimulationResult | null;
  code: string;
  week: number;
  metric: Metric;
}) {
  const series = (r: SimulationResult) =>
    r.frames.map(
      (f) => f.countries.find((c) => c.code === code)!.shipping![metric],
    );
  const values = series(result),
    alt = comparison ? series(comparison) : [];
  const max = Math.max(120, ...values, ...alt),
    width = 720,
    height = 220;
  const x = (i: number) =>
    44 + (i / Math.max(1, values.length - 1)) * (width - 64);
  const y = (v: number) => 12 + (1 - v / max) * (height - 42);
  const points = (v: number[]) => v.map((n, i) => `${x(i)},${y(n)}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Country ${metric === "output" ? "output" : metric === "inventory" ? "inventory" : "price"} history`}
      className="ship-chart"
    >
      <title>{`${metricLabels[metric]}; orange is the parent run, blue is the policy comparison.`}</title>
      {[0, max / 2, max].map((v) => (
        <g key={v}>
          <line x1="44" x2={width - 20} y1={y(v)} y2={y(v)} stroke="#dbe5ec" />
          <text x="36" y={y(v) + 4} textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      {metric !== "inventory" && (
        <line
          x1="44"
          x2={width - 20}
          y1={y(100)}
          y2={y(100)}
          stroke="#7d94a3"
          strokeDasharray="5 5"
        />
      )}
      <polyline
        points={points(values)}
        stroke="#b85f24"
        strokeWidth="3"
        fill="none"
      />
      {alt.length > 0 && (
        <polyline
          points={points(alt)}
          stroke="#176dbe"
          strokeWidth="3"
          fill="none"
        />
      )}
      <line
        x1={x(week)}
        x2={x(week)}
        y1="8"
        y2={height - 30}
        stroke="#102b3a"
        strokeDasharray="3 4"
      />
      <circle cx={x(week)} cy={y(values[week])} r="4" fill="#b85f24" />
      {values.map((_, i) =>
        i % 4 === 0 || i === values.length - 1 ? (
          <text key={i} x={x(i)} y={height - 7} textAnchor="middle">
            W{i}
          </text>
        ) : null,
      )}
    </svg>
  );
}
export default function ShippingLab({
  initial,
}: {
  initial: SimulationResult;
}) {
  const [result, setResult] = useState(initial),
    [draft, setDraft] = useState(defaultShippingPlan),
    [week, setWeek] = useState(0);
  const [selected, setSelected] = useState("DEU"),
    [comparison, setComparison] = useState<SimulationResult | null>(null);
  const [model, setModel] = useState("anthropic/claude-sonnet-5.5"),
    [key, setKey] = useState<string | null>(null),
    [gate, setGate] = useState(false);
  const [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [status, setStatus] = useState("Demo ready · no API key required"),
    [error, setError] = useState("");
  const [view, setView] = useState<"chain" | "globe">("chain"),
    [metric, setMetric] = useState<Metric>("output"),
    [history, setHistory] = useState<History[]>([]);
  const controller = useRef<AbortController | null>(null),
    replayFile = useRef<HTMLInputElement | null>(null);
  const frame = result.frames[Math.min(week, result.frames.length - 1)],
    country = frame.countries.find((c) => c.code === selected)!;
  const resources = country.shipping!,
    plan = result.scenario.shipping!;
  useEffect(() => {
    const c = new AbortController();
    fetch("/api/simulations", { signal: c.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) =>
        setHistory(
          Array.isArray(rows)
            ? rows.filter((r: History) => r.input?.shipping)
            : [],
        ),
      )
      .catch(() => {});
    return () => {
      c.abort();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(
      () =>
        setWeek((w) => {
          if (w >= result.frames.length - 1) {
            setPlaying(false);
            return w;
          }
          return w + 1;
        }),
      900,
    );
    return () => clearInterval(t);
  }, [playing, result.frames.length]);
  function update<K extends keyof ShippingPlan>(
    field: K,
    value: ShippingPlan[K],
  ) {
    setDraft((d) => ({ ...d, [field]: value }));
  }
  async function run() {
    setError("");
    const parsed = shippingPlanSchema.safeParse(draft);
    if (!parsed.success) {
      setError(
        "Check your controls: shock and intervention start weeks must fit within the horizon.",
      );
      return;
    }
    setBusy(true);
    setPlaying(false);
    setStatus("Starting the scenario…");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/shipping", {
        method: "POST",
        signal: controller.current.signal,
        headers: {
          "content-type": "application/json",
          ...(key
            ? { "x-openrouter-api-key": key }
            : { "x-provider-mode": "deterministic" }),
        },
        body: JSON.stringify({ plan: parsed.data, model, explain: !!key }),
      });
      if (!response.ok || !response.body)
        throw new Error(
          "Unable to start this scenario. Check the controls and try again.",
        );
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let pending = "",
        completed = false;
      for (;;) {
        const { value, done } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split("\n");
        pending = lines.pop()!;
        for (const line of lines.filter(Boolean)) {
          const record = JSON.parse(line);
          if (record.type === "error") throw new Error(record.error);
          if (record.type === "frame")
            setStatus(
              `Computed week ${record.frame.week} of ${draft.durationWeeks}${key ? " · reviewing actors every four weeks" : " · rules"}`,
            );
          if (record.type === "phase") setStatus(record.message);
          if (record.type === "result") {
            const next = await unpackResult(record.result);
            setResult(next);
            setWeek(next.frames.length - 1);
            setComparison(null);
            completed = true;
            setStatus(
              `Completed ${next.scenario.durationWeeks} weeks · ${next.providerMode === "openrouter" ? "AI decisions with recorded evidence" : "deterministic rules"} · ${next.saveStatus === "saved" ? "saved" : "export to keep this replay"}`,
            );
            if (next.id)
              setHistory((h) => [
                {
                  id: next.id!,
                  title: next.scenario.title,
                  input: { shipping: next.scenario.shipping },
                },
                ...h,
              ]);
          }
        }
        if (done) break;
      }
      if (!completed)
        throw new Error(
          "Run ended before a complete result arrived. Your previous replay is still available.",
        );
    } catch (e) {
      if (controller.current?.signal.aborted)
        setStatus("Run cancelled · previous replay preserved");
      else
        setError(
          e instanceof Error ? e.message : "Run unavailable. Try again.",
        );
    } finally {
      setBusy(false);
    }
  }
  async function interpret() {
    if (!key) {
      setGate(true);
      return;
    }
    setBusy(true);
    setError("");
    setStatus("Interpreting the description into editable controls…");
    controller.current = new AbortController();
    try {
      const r = await fetch("/api/shipping/interpret", {
        method: "POST",
        signal: controller.current.signal,
        headers: {
          "content-type": "application/json",
          "x-openrouter-api-key": key,
        },
        body: JSON.stringify({
          description: draft.description,
          current: draft,
          model,
        }),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error);
      setDraft(shippingPlanSchema.parse(value.plan));
      setStatus(
        "Draft interpreted · review the controls, then run the scenario",
      );
    } catch (e) {
      if (controller.current?.signal.aborted)
        setStatus("Interpretation cancelled");
      else
        setError(
          e instanceof Error ? e.message : "Interpretation unavailable.",
        );
    } finally {
      setBusy(false);
    }
  }
  function compare(policy: "reroute" | "relief") {
    setPlaying(false);
    if (week >= result.frames.length - 1) {
      setError(
        "Select a week before the final checkpoint to start a policy comparison.",
      );
      return;
    }
    setError("");
    setComparison(branchShipping(result, policy, week));
  }
  async function load(id: string) {
    setBusy(true);
    setPlaying(false);
    setError("");
    controller.current = new AbortController();
    try {
      const r = await fetch(`/api/simulations/${encodeURIComponent(id)}`, {
        signal: controller.current.signal,
      });
      if (!r.ok) throw new Error("Saved replay unavailable.");
      const next = parseShippingReplay(await unpackResult(await r.json()));
      setResult(next);
      setDraft(next.scenario.shipping!);
      setWeek(0);
      setComparison(null);
      setStatus("Saved replay loaded · no model calls");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saved replay unavailable.");
    } finally {
      setBusy(false);
    }
  }
  async function openReplay(file?: File) {
    if (!file) return;
    setError("");
    setPlaying(false);
    try {
      if (file.size > 2_000_000)
        throw new Error("Replay file must be under 2 MB.");
      const next = parseShippingReplay(JSON.parse(await file.text()));
      // A downloaded row ID is provenance, not proof the row exists on this server.
      delete next.id;
      delete next.createdAt;
      next.saveStatus = "unsaved";
      setResult(next);
      setDraft(next.scenario.shipping!);
      setWeek(0);
      setComparison(null);
      setStatus("Replay file loaded · no model calls");
    } catch {
      setError(
        "Invalid or incompatible replay. Choose a WorldSim shipping replay under 2 MB.",
      );
    } finally {
      if (replayFile.current) replayFile.current.value = "";
    }
  }
  async function saveComparison() {
    if (!result.id || !comparison) return;
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const r = await fetch(
        `/api/simulations/${encodeURIComponent(result.id)}/branch`,
        {
          method: "POST",
          signal: controller.current.signal,
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            policy: comparison.scenario.shipping!.policy,
            branchWeek: comparison.scenario.branchWeek,
          }),
        },
      );
      if (!r.ok)
        throw new Error(
          "Saving unavailable. Export this comparison to keep it.",
        );
      const next = parseShippingReplay(await unpackResult(await r.json()));
      setComparison(next);
      setStatus(
        next.saveStatus === "saved"
          ? "Policy comparison saved · no new model calls"
          : "Comparison unsaved · export to keep it",
      );
      if (next.id)
        setHistory((h) => [
          {
            id: next.id!,
            title: next.scenario.title,
            input: { shipping: next.scenario.shipping },
          },
          ...h,
        ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saving unavailable.");
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const replay = comparison ?? result,
      blob = new Blob([JSON.stringify(replay, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worldsim-${comparison ? "comparison" : "replay"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const decisions = result.frames
    .slice(1)
    .flatMap((f) => f.countries.flatMap((c) => c.shipping!.decisions));
  const aiCount = decisions.filter(
    (d) => d.source === "openrouter" || d.source === "reused",
  ).length;
  const requests = result.audit?.requests ?? [],
    costs = requests.filter((r) => r.cost !== null);
  const baseline = useMemo(
    () => runShipping({ ...plan, severity: 0, policy: "none" }),
    [plan],
  );
  const final = result.frames.at(-1)!,
    finalCountry = final.countries.find((c) => c.code === selected)!.shipping!;
  const outputLost = (run: SimulationResult) =>
    run.frames
      .slice(1)
      .reduce(
        (sum, f) =>
          sum +
          100 -
          f.countries.find((c) => c.code === selected)!.shipping!.output,
        0,
      );
  return (
    <main className="shipping-lab" id="simulation-lab" tabIndex={-1}>
      <a className="skip-link" href="#shipping-stage">
        Skip to replay
      </a>
      {gate && (
        <ProviderGate
          onConnect={(keys) => {
            setKey(keys.openrouter ?? null);
            setGate(false);
          }}
        />
      )}
      <header className="ship-header">
        <Link href="/" className="ship-brand">
          <Ship size={25} />
          <strong>WorldSim</strong>
          <span>Scenario laboratory</span>
        </Link>
        <nav>
          <Link href="/methodology">How it works</Link>
          <button onClick={() => setGate(true)} disabled={busy}>
            <KeyRound size={15} />
            {key ? "OpenRouter connected" : "Connect AI"}
          </button>
          {key && (
            <button disabled={busy} onClick={() => setKey(null)}>
              Disconnect
            </button>
          )}
        </nav>
      </header>
      <section className="ship-intro">
        <div>
          <p className="ship-kicker">ASIA → EUROPE / ELECTRICAL EQUIPMENT</p>
          <h1>
            Follow the disruption,
            <br />
            week by week.
          </h1>
          <p>
            Watch a shipping delay become a factory shortage. See who absorbs
            the cost, then test a different response from the same moment.
          </p>
        </div>
        <div className="ship-spec">
          <span>8 countries</span>
          <span>{plan.durationWeeks} weeks</span>
          <span>3 household groups</span>
          <small>
            Measured trade links. Explicit assumptions.
            <br />A conditional scenario, not a forecast.
          </small>
        </div>
      </section>
      <div className="ship-workspace">
        <aside className="ship-controls">
          <div className="ship-panel-heading">
            <span className="ship-kicker">YOUR EXPERIMENT</span>
            <button
              aria-label="Reset scenario controls"
              disabled={busy}
              onClick={() => setDraft(defaultShippingPlan)}
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <h2>Change the conditions.</h2>
          <label htmlFor="shipping-description">Scenario description</label>
          <textarea
            id="shipping-description"
            disabled={busy}
            value={draft.description}
            onChange={(e) => update("description", e.target.value)}
            maxLength={2000}
          />
          <button
            className="ship-interpret"
            disabled={busy || draft.description.length < 10}
            onClick={interpret}
          >
            {key ? "Interpret with AI" : "Connect AI to interpret"}
            <ArrowRight size={14} />
          </button>
          <p className="ship-help">
            Descriptions become editable controls when interpreted. Rules use
            the controls below.
          </p>
          <label htmlFor="shipping-severity">
            Lane capacity reduction <b>{draft.severity}%</b>
          </label>
          <input
            id="shipping-severity"
            type="range"
            min="0"
            max="100"
            disabled={busy}
            value={draft.severity}
            onChange={(e) => update("severity", +e.target.value)}
          />
          <div className="ship-fields">
            <div>
              <label htmlFor="shipping-start">Shock starts</label>
              <input
                id="shipping-start"
                type="number"
                min="1"
                max={draft.durationWeeks}
                disabled={busy}
                value={draft.shockStartWeek}
                onChange={(e) => update("shockStartWeek", +e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="shipping-duration">Lasts (weeks)</label>
              <input
                id="shipping-duration"
                type="number"
                min="1"
                max="16"
                disabled={busy}
                value={draft.shockDurationWeeks}
                onChange={(e) => update("shockDurationWeeks", +e.target.value)}
              />
            </div>
          </div>
          <label htmlFor="shipping-horizon">
            Observation horizon <b>{draft.durationWeeks} weeks</b>
          </label>
          <input
            id="shipping-horizon"
            type="range"
            min="4"
            max="24"
            step="1"
            disabled={busy}
            value={draft.durationWeeks}
            onChange={(e) => update("durationWeeks", +e.target.value)}
          />
          <label htmlFor="shipping-policy">Public intervention</label>
          <select
            id="shipping-policy"
            disabled={busy}
            value={draft.policy}
            onChange={(e) =>
              update("policy", e.target.value as ShippingPlan["policy"])
            }
          >
            <option value="none">No intervention</option>
            <option value="reroute">Fund rerouting · 40 budget units</option>
            <option value="relief">Low-income relief · 20 budget units</option>
          </select>
          <label htmlFor="shipping-policy-week">
            Intervention starts (week)
          </label>
          <input
            id="shipping-policy-week"
            type="number"
            min="1"
            max={draft.durationWeeks}
            disabled={busy}
            value={draft.policyWeek}
            onChange={(e) => update("policyWeek", +e.target.value)}
          />
          <details className="ship-advanced">
            <summary>Inventory, delivery and budget assumptions</summary>
            <label htmlFor="shipping-inventory">
              Starting inventory (weeks of inputs)
            </label>
            <input
              id="shipping-inventory"
              type="number"
              min="0"
              max="6"
              step=".5"
              disabled={busy}
              value={draft.inventoryWeeks}
              onChange={(e) => update("inventoryWeeks", +e.target.value)}
            />
            <label htmlFor="shipping-lead">Delivery lead time (weeks)</label>
            <input
              id="shipping-lead"
              type="number"
              min="1"
              max="4"
              disabled={busy}
              value={draft.leadWeeks}
              onChange={(e) => update("leadWeeks", +e.target.value)}
            />
            <label htmlFor="shipping-budget">
              Public budget (normalized units)
            </label>
            <input
              id="shipping-budget"
              type="number"
              min="0"
              max="200"
              disabled={busy}
              value={draft.publicBudget}
              onChange={(e) => update("publicBudget", +e.target.value)}
            />
          </details>
          <label htmlFor="shipping-model">AI model</label>
          <select
            id="shipping-model"
            disabled={busy}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            <option value="anthropic/claude-sonnet-5.5">
              Claude Sonnet 5.5 · default
            </option>
            <option value="openai/gpt-6.1-sol">
              GPT‑6.1 Sol · alternative
            </option>
          </select>
          <p className="ship-help">
            {key
              ? "All 40 actors reviewed every four weeks. Up to 7 calls including explanation; request caps reserve under $1 per run. Interpretation is a separate call."
              : "No key connected. Runs use reproducible resource-based rules; no model charges."}
          </p>
          <button className="ship-run" disabled={busy} onClick={run}>
            {busy ? "Working…" : "Run scenario"}
            <ArrowRight size={16} />
          </button>
          {busy && (
            <button
              className="ship-cancel"
              onClick={() => controller.current?.abort()}
            >
              Cancel
            </button>
          )}
          {history.length > 0 && (
            <details className="ship-advanced">
              <summary>Saved replays ({history.length})</summary>
              {history.map((h) => (
                <button
                  className="ship-saved"
                  disabled={busy}
                  key={h.id}
                  onClick={() => load(h.id)}
                >
                  {h.title}
                </button>
              ))}
            </details>
          )}
        </aside>
        <div className="ship-stage" id="shipping-stage" tabIndex={-1}>
          <div className="ship-status" role="status">
            {status}
          </div>
          {error && (
            <p className="ship-error" role="alert">
              {error}
            </p>
          )}
          <div className="ship-stage-heading">
            <div>
              <span className="ship-kicker">CURRENT REPLAY</span>
              <h2>{plan.title}</h2>
            </div>
            <div className="ship-replay-actions">
              <input
                type="file"
                accept=".json,application/json"
                aria-label="Open replay file"
                ref={replayFile}
                hidden
                onChange={(e) => openReplay(e.target.files?.[0])}
              />
              <button
                className="ship-open-replay"
                onClick={() => replayFile.current?.click()}
                disabled={busy}
              >
                Open replay
              </button>
              <button
                className="ship-export"
                onClick={download}
                disabled={busy}
              >
                <Download size={15} />
                Export replay
              </button>
            </div>
          </div>
          <div className="ship-timeline">
            <button
              aria-label={playing ? "Pause playback" : "Play playback"}
              disabled={busy}
              onClick={() => {
                if (week === result.frames.length - 1) setWeek(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? <Pause size={17} /> : <Play size={17} />}
            </button>
            <div>
              <label htmlFor="selected-week">
                Selected week{" "}
                <b>
                  W{week} / {plan.durationWeeks}
                </b>
              </label>
              <input
                id="selected-week"
                type="range"
                min="0"
                max={result.frames.length - 1}
                value={week}
                disabled={busy}
                onChange={(e) => {
                  setPlaying(false);
                  setWeek(+e.target.value);
                }}
              />
              <div className="ship-timeline-labels">
                <span>Before disruption</span>
                <span>
                  Shock W{plan.shockStartWeek}–
                  {Math.min(
                    plan.durationWeeks,
                    plan.shockStartWeek + plan.shockDurationWeeks - 1,
                  )}
                </span>
                <span>Recovery</span>
              </div>
            </div>
          </div>
          <div className="ship-view-tabs">
            <button
              aria-pressed={view === "chain"}
              onClick={() => setView("chain")}
            >
              Supply chain
            </button>
            <button
              aria-pressed={view === "globe"}
              onClick={() => setView("globe")}
            >
              <Globe2 size={14} />
              World view
            </button>
          </div>
          {view === "globe" ? (
            <WorldMap
              countries={frame.countries}
              flows={frame.flows}
              selectedCode={selected}
              playing={playing}
              week={week}
              onSelect={(c) => {
                if (frame.countries.some((x) => x.code === c.code))
                  setSelected(c.code);
              }}
            />
          ) : (
            <section className="ship-chain" aria-label="Connected supply chain">
              <div className="ship-chain-countries">
                <span className="ship-kicker">SUPPLIERS</span>
                {frame.countries.slice(0, 3).map((c) => (
                  <button
                    key={c.code}
                    aria-label={c.name}
                    aria-pressed={selected === c.code}
                    onClick={() => setSelected(c.code)}
                  >
                    <span>{c.name}</span>
                    <small>Export cash {number(c.shipping!.cash)}</small>
                  </button>
                ))}
              </div>
              <div className="ship-lane">
                <Ship size={32} />
                <span>Asia → Europe</span>
                <strong>
                  {frame.shipping!.shipments.length} deliveries in transit
                </strong>
                <div className="ship-lane-track">
                  <span />
                  <span />
                  <span />
                </div>
                <small>
                  {number(
                    Object.values(frame.shipping!.backlog).reduce(
                      (n, v) => n + v,
                      0,
                    ),
                  )}{" "}
                  input units queued
                  <br />
                  {number(frame.shipping!.delivered)} delivered this week
                </small>
                <span className="ship-lane-state">
                  {week >= plan.shockStartWeek &&
                  week < plan.shockStartWeek + plan.shockDurationWeeks &&
                  plan.severity > 0
                    ? "Lane disrupted"
                    : "Lane open"}
                </span>
              </div>
              <div className="ship-chain-countries">
                <span className="ship-kicker">BUYERS / OUTPUT INDEX</span>
                {frame.countries.slice(3).map((c) => (
                  <button
                    key={c.code}
                    aria-label={c.name}
                    aria-pressed={selected === c.code}
                    onClick={() => setSelected(c.code)}
                  >
                    <span>{c.name}</span>
                    <strong>{number(c.shipping!.output)}</strong>
                    <i style={{ width: `${c.shipping!.output}%` }} />
                  </button>
                ))}
              </div>
            </section>
          )}
          <section className="ship-country">
            <div className="ship-country-heading">
              <div>
                <span className="ship-kicker">COUNTRY HISTORY / W{week}</span>
                <h2>{country.name}</h2>
              </div>
              <div className="ship-country-role">
                {shippingLinks.some((l) => l.to === selected)
                  ? "Buyer & factory"
                  : "Supplier · export receipts exposed"}
              </div>
            </div>
            <div className="ship-metrics">
              <div>
                <small>Inventory cover</small>
                <strong>
                  {number(resources.inventory / 100)}
                  <em>weeks</em>
                </strong>
              </div>
              <div>
                <small>Factory output</small>
                <strong>
                  {number(resources.output)}
                  <em>/ 100</em>
                </strong>
              </div>
              <div>
                <small>Public budget</small>
                <strong>
                  {number(resources.budget)}
                  <em>units</em>
                </strong>
              </div>
              <div>
                <small>Price index</small>
                <strong>
                  {number(resources.priceIndex)}
                  <em>base 100</em>
                </strong>
              </div>
            </div>
            <div className="ship-chart-controls">
              <label htmlFor="history-metric">Country history</label>
              <select
                id="history-metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value as Metric)}
              >
                {Object.entries(metricLabels).map(([v, label]) => (
                  <option value={v} key={v}>
                    {label}
                  </option>
                ))}
              </select>
              <div>
                <span className="ship-orange-dot" />
                Parent{" "}
                {comparison && (
                  <>
                    <span className="ship-blue-dot" />
                    Policy
                  </>
                )}
              </div>
            </div>
            <HistoryChart
              result={result}
              comparison={comparison}
              code={selected}
              week={week}
              metric={metric}
            />
            <p className="ship-help">
              Unshocked rules reference: output{" "}
              {number(
                baseline.frames[week].countries.find(
                  (c) => c.code === selected,
                )!.shipping!.output,
              )}
              . This is an illustrative reference, not an AI counterfactual.
            </p>
            <div className="ship-actors">
              <h3>Who absorbs the cost?</h3>
              <div className="ship-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Household group</th>
                      <th>Share*</th>
                      <th>Savings (income weeks)</th>
                      <th>Strain index</th>
                      <th>Current action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.households.map((h) => (
                      <tr key={h.income}>
                        <th>
                          {h.income === "low"
                            ? "Low income"
                            : h.income === "middle"
                              ? "Middle income"
                              : "High income"}
                        </th>
                        <td>{h.share * 100}%</td>
                        <td>{number(h.savings)}</td>
                        <td>{number(h.strain)}</td>
                        <td>{h.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ship-help">
                *Assumed household shares. Firms and government have their own
                cash and budgets; they are not population groups.
              </p>
            </div>
            <details className="ship-evidence" open>
              <summary>Decisions and evidence at W{week}</summary>
              {resources.decisions.length ? (
                resources.decisions.map((d) => (
                  <div className="ship-decision" key={d.actor}>
                    <div>
                      <strong>
                        {d.actor === "firm"
                          ? "Sector firm"
                          : d.actor === "government"
                            ? "Government"
                            : `${d.actor} income`}
                      </strong>
                      <span>{d.action}</span>
                      <small>
                        {d.source === "openrouter"
                          ? "AI review"
                          : d.source === "reused"
                            ? "Retained decision"
                            : d.source === "intervention"
                              ? "Policy control"
                              : "Rules"}{" "}
                        · evidence W{d.evidenceWeeks.join(", W")}
                      </small>
                    </div>
                    <p>{d.rationale}</p>
                  </div>
                ))
              ) : (
                <p>
                  Initial checkpoint. Inventories, household buffers and the
                  delivery pipeline are initialized before any shock.
                </p>
              )}
            </details>
          </section>
          <section className="ship-comparison">
            <div>
              <span className="ship-kicker">TEST A DIFFERENT RESPONSE</span>
              <h2>Branch from week {week}.</h2>
              <p>
                Keep the same checkpoint and recorded household/firm actions.
                Change public policy, pay its cost, and wait for it to take
                effect.
              </p>
            </div>
            <div className="ship-compare-buttons">
              <button
                disabled={
                  busy ||
                  week >= result.frames.length - 1 ||
                  !shippingLinks.some((l) => l.to === selected)
                }
                onClick={() => compare("reroute")}
              >
                Compare rerouting
              </button>
              <button
                disabled={
                  busy ||
                  week >= result.frames.length - 1 ||
                  !shippingLinks.some((l) => l.to === selected)
                }
                onClick={() => compare("relief")}
              >
                Compare household relief
              </button>
              {comparison && (
                <button onClick={() => setComparison(null)}>
                  Clear comparison
                </button>
              )}
            </div>
            {comparison && (
              <div className="ship-comparison-result">
                <h3>Controlled policy comparison</h3>
                <p>{comparison.audit!.comparison}</p>
                <p>
                  Across {plan.durationWeeks} weeks, {country.name} loses{" "}
                  <strong>
                    {number(outputLost(result))} →{" "}
                    {number(outputLost(comparison))}
                  </strong>{" "}
                  normalized output units relative to steady production.
                  Low-income savings at the final checkpoint:{" "}
                  <strong>
                    {number(finalCountry.households[0].savings)} →{" "}
                    {number(
                      comparison.frames
                        .at(-1)!
                        .countries.find((c) => c.code === selected)!.shipping!
                        .households[0].savings,
                    )}
                  </strong>{" "}
                  income weeks.
                </p>
                <p>
                  {country.name} at W{plan.durationWeeks}: output{" "}
                  <strong>
                    {number(finalCountry.output)} →{" "}
                    {number(
                      comparison.frames
                        .at(-1)!
                        .countries.find((c) => c.code === selected)!.shipping!
                        .output,
                    )}
                  </strong>
                  ; public budget{" "}
                  <strong>
                    {number(finalCountry.budget)} →{" "}
                    {number(
                      comparison.frames
                        .at(-1)!
                        .countries.find((c) => c.code === selected)!.shipping!
                        .budget,
                    )}
                  </strong>
                  .
                </p>
                <small>
                  The blue line shows this branch. Its historical prefix is
                  preserved exactly. This comparison does not rerun adaptive AI
                  choices.
                </small>
                {result.id && comparison.saveStatus !== "saved" && (
                  <button disabled={busy} onClick={saveComparison}>
                    Save comparison
                  </button>
                )}
              </div>
            )}
          </section>
          <section className="ship-report">
            <h2>Trace the mechanism.</h2>
            <div className="ship-process">
              <span>Orders queue</span>
              <ArrowRight size={15} />
              <span>Inputs arrive late</span>
              <ArrowRight size={15} />
              <span>Inventory runs down</span>
              <ArrowRight size={15} />
              <span>Output & income change</span>
            </div>
            <ul className="ship-events">
              {frame.shipping!.events.length ? (
                frame.shipping!.events.map((event, i) => (
                  <li key={i}>
                    W{week} · {event}
                  </li>
                ))
              ) : (
                <li>
                  W{week} · No new shock or public policy event. Deliveries and
                  resource balances continue.
                </li>
              )}
            </ul>
            {result.analysis && (
              <div className="ship-narration">
                <h3>AI explanation of recorded outcomes</h3>
                <p>{result.analysis}</p>
              </div>
            )}
            <details>
              <summary>Data and assumptions</summary>
              <p>
                <strong>Annual trade data:</strong> UN Comtrade 2023, HS85
                electrical machinery and equipment, retrieved 10 October 2026.
                Annual import value shares provide supplier weights; they do not
                measure weekly physical shipments or how much trade uses this
                lane.
              </p>
              <p>
                <strong>Assumed:</strong> 100 input units per factory-week;
                homogeneous input substitution; other suppliers provide the
                unaffected share; weekly lead times; route exposure; 150%
                recovery capacity; 40/40/20 household shares; initial savings of
                0.5/2/6 income weeks; normalized wages, cash and budgets.
                Supplier cash tracks actual dispatch receipts; half of supplier
                sector demand is assumed to depend on modeled exports. This
                version models one sector firm and three household groups per
                country.
              </p>
              <p>
                <strong>Interventions:</strong> Rerouting costs 40 public units,
                becomes active after two weeks, reduces capacity disruption to
                35% of the original shock and adds one delivery week. Relief
                costs 20 units, starts after one week and transfers 0.12 weekly
                income units to the low-income group for four weeks. Expediting
                costs the firm 10 units and shortens newly dispatched deliveries
                by one week. Existing shipments cannot teleport.
              </p>
              <div className="ship-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Supplier → buyer</th>
                      <th>Annual import value</th>
                      <th>Share of buyer HS85 imports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shippingLinks.map((l) => (
                      <tr key={`${l.from}-${l.to}`}>
                        <td>
                          <a href={l.source} target="_blank" rel="noreferrer">
                            {l.from} → {l.to}
                          </a>
                        </td>
                        <td>${(l.annualValue / 1e9).toFixed(2)}bn</td>
                        <td>{(l.share * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <details>
              <summary>Run provenance and AI coverage</summary>
              <p>
                Engine {result.audit!.engine} · prompt {result.audit!.prompt} ·
                data {result.audit!.data}
              </p>
              <p>
                {result.providerMode === "openrouter"
                  ? `${aiCount} of ${decisions.length} decisions use AI or a retained AI choice.`
                  : "Deterministic run: no accepted AI decisions."}{" "}
                Planned review weeks: {result.audit!.reviewWeeks.join(", ")}.
                Provider responses recorded: {requests.length}; attempts:{" "}
                {result.audit!.attemptedCalls ?? requests.length}.
              </p>
              <p>
                Reported model cost:{" "}
                {costs.length
                  ? `$${costs.reduce((n, r) => n + r.cost!, 0).toFixed(4)}${costs.length < requests.length ? " plus unreported requests" : ""}`
                  : requests.length
                    ? "not returned by provider"
                    : result.audit!.attemptedCalls
                      ? "unknown: no usage returned"
                      : "$0"}
                . The model catalog prices can change; caps are estimates.
              </p>
              {requests.map((r, i) => (
                <p key={i}>
                  W{r.week} · {r.model} · {r.inputTokens ?? "unreported"} input
                  / {r.outputTokens ?? "unreported"} output tokens ·{" "}
                  {r.cost === null
                    ? "cost unreported"
                    : `$${r.cost.toFixed(4)}`}
                </p>
              ))}
              <p>
                Replay contains each weekly checkpoint, in-transit deliveries,
                queued orders and normalized decisions. Loading or exporting it
                makes no model calls. Policy branches use the same recorded
                non-policy actions. Database saves are optional; export an
                unsaved run to keep it.
              </p>
            </details>
            {(result.warnings ?? []).length > 0 && (
              <div className="ship-warnings">
                <h3>Run limitations</h3>
                {result.warnings!.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
      <footer className="ship-footer">
        <span>WorldSim · inspect the assumptions, follow the evidence.</span>
        <Link href="/legacy">Open the original world simulator</Link>
      </footer>
    </main>
  );
}
