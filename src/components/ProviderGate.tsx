"use client";
import { useState, useRef, useEffect } from "react";
import { KeyRound } from "lucide-react";
export type ProviderKeys = {
  openrouter?: string;
};
export default function ProviderGate({
  onConnect,
}: {
  onConnect: (keys: ProviderKeys) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : document.getElementById("simulation-lab");
    const modal = dialog.current;
    modal?.showModal();
    modal?.querySelector("input")?.focus();
    return () => {
      modal?.close();
      previous?.focus();
    };
  }, []);
  const [openrouter, setOpenrouter] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function connect() {
    setLoading(true);
    setError("");
    try {
      const keys = { openrouter: openrouter.trim() },
        response = await fetch("/api/providers/validate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(keys),
        }),
        body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Provider validation failed.");
      onConnect(keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Provider validation failed.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="provider-gate"
      onCancel={(e) => {
        e.preventDefault();
        onConnect({});
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const nodes = Array.from(
          dialog.current!.querySelectorAll<HTMLElement>(
            "input,a,button:not(:disabled)",
          ),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
      aria-modal="true"
      aria-labelledby="provider-title"
    >
      <div className="gate-icon">
        <KeyRound />
      </div>
      <p className="eyebrow">PRIVATE SESSION</p>
      <h1 id="provider-title">Connect OpenRouter</h1>
      <p>
        Your key stays in this tab, travels only to WorldSim&apos;s server, and
        is forgotten when you refresh. It powers both simulation decisions and
        narration.
      </p>
      <label htmlFor="openrouter-key">OpenRouter API key</label>
      <input
        id="openrouter-key"
        type="password"
        autoComplete="off"
        value={openrouter}
        onChange={(e) => setOpenrouter(e.target.value)}
        placeholder="sk-or-…"
      />
      <a
        href="https://openrouter.ai/settings/keys"
        target="_blank"
        rel="noreferrer"
      >
        Get an OpenRouter key ↗
      </a>
      {error && (
        <p className="gate-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="primary"
        disabled={loading || !openrouter.trim()}
        onClick={connect}
      >
        {loading ? "Checking key…" : "Connect OpenRouter"}
      </button>
      <button
        className="text-button"
        disabled={loading}
        onClick={() => onConnect({})}
      >
        Use deterministic mode
      </button>
    </dialog>
  );
}
