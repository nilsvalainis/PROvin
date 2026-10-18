"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ADMIN_B2B_BTN, ADMIN_B2B_BTN_SOLID, AdminB2bActionLabel } from "@/components/admin/AdminB2bAction";
import {
  COMPANY_VERIFY_CHECK_LABELS,
  decisionLabel,
  overallLabel,
  type CompanyVerifyCheck,
  type CompanyVerifyDecision,
  type CompanyVerifyOverall,
  type CompanyVerifySubjectKind,
  type CompanyVerifyTone,
  type CompanyVerifyView,
} from "@/lib/b2b-company-verify";

const TONE_CLASS: Record<CompanyVerifyTone, string> = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  yellow: "border-amber-200 bg-amber-50 text-amber-950",
  red: "border-rose-200 bg-rose-50 text-rose-900",
  unavailable: "border-slate-200 bg-slate-100 text-slate-600",
};

const OVERALL_CLASS: Record<CompanyVerifyOverall, string> = {
  derigs: "border-emerald-300 bg-emerald-600 text-white",
  saubigs: "border-amber-300 bg-amber-500 text-white",
};

function toneDot(tone: CompanyVerifyTone): string {
  if (tone === "green") return "bg-emerald-500";
  if (tone === "yellow") return "bg-amber-400";
  if (tone === "red") return "bg-rose-500";
  return "bg-slate-400";
}

export function AdminB2bCompanyVerifySummary({
  view,
  busy,
  error,
  onRefresh,
  onDecision,
}: {
  view: CompanyVerifyView;
  busy?: boolean;
  error?: string;
  onRefresh?: () => void;
  onDecision?: (decision: CompanyVerifyDecision) => void;
}) {
  return (
    <section className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Uzņēmuma pārbaude</p>
          <span
            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.04em] ${OVERALL_CLASS[view.report.overall]}`}
          >
            {overallLabel(view.report.overall)}
          </span>
          <span className="text-[11px] text-slate-500">{decisionLabel(view.decision)}</span>
          {view.cached ? <span className="text-[10px] text-slate-400">kešs</span> : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {onRefresh ? (
            <button type="button" className={ADMIN_B2B_BTN} disabled={busy} onClick={onRefresh}>
              <AdminB2bActionLabel>Atsvaidzināt</AdminB2bActionLabel>
            </button>
          ) : null}
          {onDecision ? (
            <>
              <button
                type="button"
                className={ADMIN_B2B_BTN_SOLID}
                disabled={busy || view.decision === "approved"}
                onClick={() => onDecision("approved")}
              >
                <AdminB2bActionLabel>Apstiprināt</AdminB2bActionLabel>
              </button>
              <button
                type="button"
                className={ADMIN_B2B_BTN}
                disabled={busy || view.decision === "rejected"}
                onClick={() => onDecision("rejected")}
              >
                <AdminB2bActionLabel>Noraidīt</AdminB2bActionLabel>
              </button>
            </>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-2 text-[12px] text-rose-600">{error}</p> : null}
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {view.report.checks.map((row) => (
          <VerifyCheckRow key={row.id} check={row} />
        ))}
      </ul>
    </section>
  );
}

function VerifyCheckRow({ check }: { check: CompanyVerifyCheck }) {
  return (
    <li className={`flex gap-2 rounded-lg border px-2.5 py-2 text-[12px] leading-snug ${TONE_CLASS[check.tone]}`}>
      <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${toneDot(check.tone)}`} aria-hidden />
      <span>
        <span className="font-semibold">{COMPANY_VERIFY_CHECK_LABELS[check.id]}</span>
        <span className="mt-0.5 block opacity-90">{check.detail}</span>
      </span>
    </li>
  );
}

export function AdminB2bCompanyVerifyPanel({
  kind,
  id,
  onDecision,
}: {
  kind: CompanyVerifySubjectKind;
  id: string;
  onDecision?: (decision: CompanyVerifyDecision) => void;
}) {
  const router = useRouter();
  const [view, setView] = useState<CompanyVerifyView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async (refresh = false) => {
    setBusy(true);
    setError("");
    try {
      const res = refresh
        ? await fetch("/api/admin/company-verify", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, id, refresh: true }),
          })
        : await fetch(`/api/admin/company-verify?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`, {
            credentials: "include",
          });
      const data = (await res.json().catch(() => ({}))) as CompanyVerifyView & { error?: string };
      if (!res.ok || !data.report) {
        setError("Pārbaudi neizdevās ielādēt.");
        return;
      }
      setView(data);
    } catch {
      setError("Pārbaudi neizdevās ielādēt.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load(false);
    // kind+id is the subject; reload when the card changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, id]);

  const decide = async (decision: CompanyVerifyDecision) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/company-verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, decision }),
      });
      const data = (await res.json().catch(() => ({}))) as CompanyVerifyView & { error?: string };
      if (!res.ok || !data.report) {
        setError("Lēmumu neizdevās saglabāt.");
        return;
      }
      setView(data);
      onDecision?.(data.decision);
      if (kind === "partner") router.refresh();
    } catch {
      setError("Lēmumu neizdevās saglabāt.");
    } finally {
      setBusy(false);
    }
  };

  if (!view) {
    return (
      <section className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-[12px] text-slate-500">
        {error || (busy ? "Pārbauda uzņēmumu…" : "Gaida pārbaudi")}
      </section>
    );
  }

  return (
    <AdminB2bCompanyVerifySummary
      view={view}
      busy={busy}
      error={error}
      onRefresh={() => void load(true)}
      onDecision={(decision) => void decide(decision)}
    />
  );
}
