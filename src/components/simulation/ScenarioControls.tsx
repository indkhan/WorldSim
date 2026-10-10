import { GitBranch, Play, Sparkles } from "lucide-react";
import type { EventFamily } from "@/lib/simulation/types";
const families: EventFamily[] = [
  "energy",
  "trade",
  "technology",
  "health",
  "climate",
  "custom",
];
type Props = {
  description: string;
  family: EventFamily;
  severity: number;
  duration: number;
  week: number;
  loading: boolean;
  hasRun: boolean;
  canBranch: boolean;
  shockDuration: number;
  adaptation: number;
  onShockDuration: (v: number) => void;
  onAdaptation: (v: number) => void;
  onDescription: (v: string) => void;
  onFamily: (v: EventFamily) => void;
  onSeverity: (v: number) => void;
  onDuration: (v: number) => void;
  onRun: () => void;
  onCompare: () => void;
  onBranch: () => void;
};
export function ScenarioControls(p: Props) {
  return (
    <aside className="panel controls">
      <div className="section-title">
        <Sparkles />
        Scenario
      </div>
      <label htmlFor="world-event">World event</label>
      <textarea
        id="world-event"
        name="world-event"
        autoComplete="off"
        value={p.description}
        onChange={(e) => p.onDescription(e.target.value)}
        placeholder="Describe the event that changes the world…"
      />
      <label>Event family</label>
      <div className="family-grid">
        {families.map((x) => (
          <button
            className={p.family === x ? "active" : ""}
            onClick={() => p.onFamily(x)}
            key={x}
            aria-pressed={p.family === x}
          >
            {x}
          </button>
        ))}
      </div>
      <label htmlFor="severity">
        Severity <b>{p.severity} / 100</b>
      </label>
      <input
        id="severity"
        aria-label="Severity"
        type="range"
        min="0"
        max="100"
        value={p.severity}
        onChange={(e) => p.onSeverity(+e.target.value)}
      />
      <label htmlFor="horizon">
        Viewing horizon <b>{p.duration} weeks</b>
      </label>
      <input
        id="horizon"
        aria-label="Horizon in weeks"
        type="range"
        min="4"
        max="104"
        value={p.duration}
        onChange={(e) => p.onDuration(+e.target.value)}
      />
      <details className="advanced">
        <summary>Advanced settings</summary>
        <label htmlFor="shock-duration">Shock decay scale (weeks)</label>
        <input
          id="shock-duration"
          type="number"
          min="1"
          max="104"
          value={p.shockDuration}
          onChange={(e) => p.onShockDuration(+e.target.value)}
        />
        <label htmlFor="adaptation">Adaptation timescale (weeks)</label>
        <input
          id="adaptation"
          type="number"
          min="1"
          max="104"
          value={p.adaptation}
          onChange={(e) => p.onAdaptation(+e.target.value)}
        />
        <p className="field-help">
          In rules mode, settings drive results; event text is descriptive.
        </p>
      </details>
      <button
        className="primary"
        disabled={p.loading || p.description.trim().length < 10}
        onClick={p.onRun}
      >
        <Play size={16} />
        {p.loading ? "Simulating…" : "Run world"}
      </button>
      <button
        className="secondary"
        disabled={p.loading || !p.hasRun}
        title={p.hasRun ? undefined : "Run a scenario first"}
        onClick={p.onCompare}
      >
        <GitBranch size={15} />
        Compare to baseline
      </button>
      <button
        className="secondary"
        disabled={p.loading || !p.canBranch}
        title="Requires a saved run and a horizon after the selected week. Continuation uses deterministic rules."
        onClick={p.onBranch}
      >
        <GitBranch size={15} />
        Branch from week {p.week}
      </button>
      <p className="fineprint">
        Exploratory results, not forecasts.
      </p>
    </aside>
  );
}
