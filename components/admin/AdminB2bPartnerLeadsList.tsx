"use client";

import { useState } from "react";
import { AdminB2bCompanyVerifyPanel } from "@/components/admin/AdminB2bCompanyVerifyPanel";
import type { B2bPartnerLead } from "@/lib/b2b-partner-lead";
import { decisionLabel, type CompanyVerifyDecision } from "@/lib/b2b-company-verify";

function formatAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function AdminB2bPartnerLeadsList({ initialLeads }: { initialLeads: B2bPartnerLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const toggle = async (lead: B2bPartnerLead) => {
    setBusyId(lead.id);
    setError("");
    const handled = !lead.handledAt;
    try {
      const res = await fetch(`/api/admin/partner-leads/${encodeURIComponent(lead.id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled }),
      });
      if (!res.ok) {
        setError("Neizdevās saglabāt statusu.");
        return;
      }
      setLeads((prev) =>
        prev.map((row) => (row.id === lead.id ? { ...row, handledAt: handled ? new Date().toISOString() : null } : row)),
      );
    } catch {
      setError("Neizdevās saglabāt statusu.");
    } finally {
      setBusyId(null);
    }
  };

  if (leads.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-12 text-center shadow-sm">
        <p className="font-medium text-[var(--color-apple-text)]">Pieteikumu vēl nav</p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-3">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {leads.map((lead) => (
        <article
          key={lead.id}
          className={`rounded-2xl border bg-white p-4 shadow-[0_2px_24px_rgba(15,23,42,0.05)] ${lead.handledAt ? "border-slate-200/70 opacity-70" : "border-rose-200"}`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-[var(--color-apple-text)]">
                {lead.companyName}
                {lead.handledAt ? null : (
                  <span className="inline-flex h-5 items-center rounded-full bg-rose-600 px-1.5 text-[11px] font-bold uppercase leading-none text-white">
                    Jauns
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[13px] text-slate-600">
                {lead.contactName}
                {" · "}
                <a href={`tel:${lead.phone.replace(/\s+/g, "")}`} className="text-[var(--color-provin-accent)] hover:underline">
                  {lead.phone}
                </a>
                {" · "}
                <a href={`mailto:${lead.email}`} className="text-[var(--color-provin-accent)] hover:underline">
                  {lead.email}
                </a>
              </p>
              <p className="mt-0.5 text-[12px] text-slate-500">
                {formatAt(lead.createdAt)} · {lead.locale.toUpperCase()}
                {lead.companyReg ? ` · Reģ. ${lead.companyReg}` : ""}
                {lead.vatNumber ? ` · PVN ${lead.vatNumber}` : ""}
              </p>
              {lead.companyAddress ? <p className="mt-0.5 text-[12px] text-slate-500">{lead.companyAddress}</p> : null}
              {lead.decision !== "pending" ? (
                <p className="mt-1 text-[12px] font-semibold text-slate-600">{decisionLabel(lead.decision)}</p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={busyId === lead.id}
              onClick={() => void toggle(lead)}
              className="inline-flex shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {lead.handledAt ? "Atzīmēt kā neapstrādātu" : "Atzīmēt kā apstrādātu"}
            </button>
          </div>
          {lead.message ? (
            <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 px-3 py-2 text-[13px] text-slate-700">{lead.message}</p>
          ) : null}
          <AdminB2bCompanyVerifyPanel
            kind="lead"
            id={lead.id}
            onDecision={(decision: CompanyVerifyDecision) => {
              setLeads((prev) =>
                prev.map((row) =>
                  row.id === lead.id
                    ? {
                        ...row,
                        decision,
                        decidedAt: decision === "pending" ? null : new Date().toISOString(),
                        handledAt: decision === "pending" ? null : new Date().toISOString(),
                      }
                    : row,
                ),
              );
            }}
          />
        </article>
      ))}
    </div>
  );
}
