"use client";

import { ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";

import { normalizeVin } from "@/lib/order-field-validation";
import type { SpeckrOrderSnapshot } from "@/lib/speckr-order";

function speckrErrorLv(code: string): string {
  switch (code) {
    case "missing_speckr_credentials":
      return "Serverī nav SPECKR_API_KEY.";
    case "invalid_vin":
      return "Nederīgs VIN.";
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    case "insufficient_credits":
      return "Nav pietiekami Speckr kredītu.";
    default:
      return "Speckr neatbildēja. Mēģini vēlreiz.";
  }
}

const OUTCOME_DOT: Record<string, string> = {
  ok: "bg-emerald-600",
  no_data: "bg-slate-400",
  needs_payment: "bg-amber-500",
  error: "bg-rose-600",
  not_configured: "bg-slate-300",
};

type Props = {
  orderVin: string;
  snapshot?: SpeckrOrderSnapshot;
  editable: boolean;
  onSnapshotChange: (next: SpeckrOrderSnapshot | undefined) => void;
};

export function AdminSpeckrCompactBar({ orderVin, snapshot, editable, onSnapshotChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const vin = useMemo(() => normalizeVin(orderVin), [orderVin]);
  const vinOk = vin.length === 17;
  const result = snapshot?.result;
  const dot = result ? OUTCOME_DOT[result.outcome] ?? "bg-slate-400" : "bg-slate-200";

  const load = async () => {
    if (!editable || busy || !vinOk) return;
    if (
      snapshot?.fetchedAt &&
      snapshot.vin === vin &&
      !window.confirm("Šim VIN jau ir Speckr ielāde. Ielādēt no jauna? Tas var atkārtoti iekasēt 1 kredītu.")
    ) {
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/sources/speckr", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ vin }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        fetchedAt?: string;
        result?: SpeckrOrderSnapshot["result"];
      };
      if (!res.ok) {
        setErr(speckrErrorLv(body.error ?? "upstream_error"));
        if (body.result && body.fetchedAt) {
          onSnapshotChange({ vin, fetchedAt: body.fetchedAt, result: body.result });
        }
        return;
      }
      if (!body.result || !body.fetchedAt) {
        setErr(speckrErrorLv("upstream_error"));
        return;
      }
      onSnapshotChange({ vin, fetchedAt: body.fetchedAt, result: body.result });
    } catch {
      setErr(speckrErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  const previewLines = result?.lines?.slice(0, 6) ?? [];

  return (
    <div className="mb-2 rounded-md border border-slate-200/90 bg-slate-50/80 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Speckr (Tesla specs)</span>
        <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        {editable ? (
          <button
            type="button"
            disabled={!vinOk || busy}
            onClick={() => void load()}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-provin-accent)] hover:bg-slate-50 disabled:opacity-50"
            title="1 Speckr kredīts par veiksmīgu pieprasījumu"
          >
            {busy ? "Ielādē…" : "Ielādēt (maksas)"}
          </button>
        ) : null}
        {result?.openUrl ? (
          <a
            href={result.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-provin-accent)] hover:underline"
          >
            speckr.com
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        ) : null}
      </div>
      {!vinOk ? (
        <p className="mt-1 text-[10px] text-slate-500">Ievadi 17 simbolu VIN pasūtījuma galvenē.</p>
      ) : null}
      {err ? <p className="mt-1 text-[10px] text-rose-700">{err}</p> : null}
      {result?.summary ? (
        <p className="mt-1 text-[11px] font-medium text-[var(--color-apple-text)]">{result.summary}</p>
      ) : null}
      {previewLines.length > 0 ? (
        <ul className="mt-1 space-y-0.5 text-[10px] leading-snug text-[var(--color-provin-muted)]">
          {previewLines.map((line) => (
            <li key={`${line.label}-${line.value}`}>
              <span className="text-slate-500">{line.label}:</span> {line.value}
            </li>
          ))}
          {(result?.lines?.length ?? 0) > previewLines.length ? (
            <li className="text-slate-400">+{(result?.lines?.length ?? 0) - previewLines.length} rindiņas</li>
          ) : null}
        </ul>
      ) : result && result.outcome !== "ok" && result.summary && !err ? (
        <p className="mt-1 text-[10px] text-[var(--color-provin-muted)]">{result.summary}</p>
      ) : null}
    </div>
  );
}
