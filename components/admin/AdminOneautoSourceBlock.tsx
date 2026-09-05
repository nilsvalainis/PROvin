"use client";

import { useMemo, useState } from "react";
import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { AdminSourceBlockHeaderTools } from "@/components/admin/AdminClearSourceBlockButton";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import {
  AdminSourceCommentField,
  type AdminAiSourceCommentSlot,
} from "@/components/admin/AdminSourceCommentField";
import type { TrafficFillLevel } from "@/lib/admin-block-traffic-status";
import { SOURCE_BLOCK_LABELS, emptyOneautoBlock, type OneautoBlockState } from "@/lib/admin-source-blocks";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  ONEAUTO_PRODUCTS,
  formatOneautoCostEur,
  oneautoDisplayHasRows,
  oneautoProductsCostCents,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const subhead = "mb-1.5 mt-3 text-[10px] font-medium uppercase tracking-wide text-slate-500";

type Props = {
  value: OneautoBlockState;
  orderVin: string;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: OneautoBlockState) => void;
  trafficFillLevel?: TrafficFillLevel;
  sessionId: string;
  aiComment?: AdminAiSourceCommentSlot;
};

function oneautoFetchErrorLv(code: string): string {
  switch (code) {
    case "insufficient_balance":
      return "Nepietiekams OneAutoAPI konta atlikums.";
    case "invalid_vin":
      return "Nederīgs VIN.";
    case "missing_oneauto_credentials":
      return "Serverī nav ONEAUTO_API_KEY.";
    case "no_products_selected":
      return "Atzīmē vismaz vienu produktu.";
    case "unauthorized":
      return "Admin sesija beigusies. Ielādē lapu no jauna.";
    default:
      return "OneAutoAPI neatbildēja. Mēģini vēlreiz.";
  }
}

export function AdminOneautoSourceBlock({
  value,
  orderVin,
  readOnly,
  disabled,
  onChange,
  trafficFillLevel,
  sessionId,
  aiComment,
}: Props) {
  const editable = !readOnly && !disabled;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveVin = normalizeVin(value.vinOverride || orderVin);
  const estimatedCost = formatOneautoCostEur(oneautoProductsCostCents(value.selectedProducts));
  const cachedForVin =
    Boolean(value.lastFetchedVin) && normalizeVin(value.lastFetchedVin) === effectiveVin;
  const hasDisplay = oneautoDisplayHasRows(value.display);

  const selectedSet = useMemo(() => new Set(value.selectedProducts), [value.selectedProducts]);

  const toggleProduct = (id: OneautoProductId, checked: boolean) => {
    const next = checked
      ? [...ONEAUTO_PRODUCTS.map((p) => p.id).filter((pid) => pid === id || selectedSet.has(pid))]
      : value.selectedProducts.filter((pid) => pid !== id);
    onChange({ ...value, selectedProducts: next });
  };

  const fetchData = async () => {
    if (!editable || busy) return;
    if (value.selectedProducts.length === 0) {
      setError(oneautoFetchErrorLv("no_products_selected"));
      return;
    }
    if (cachedForVin && hasDisplay) {
      const ok = window.confirm(
        `Šim VIN jau ir saglabāti OneAuto dati. Ielādēt no jauna? Tas atkārtoti iekasēs ${estimatedCost}.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources/oneautoapi", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: effectiveVin, products: value.selectedProducts }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        vin?: string;
        costEur?: string;
        results?: OneautoBlockState["results"];
        display?: OneautoBlockState["display"];
      };
      if (!res.ok && !body.results) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
        return;
      }
      if (body.error && res.status === 402) {
        setError(oneautoFetchErrorLv("insufficient_balance"));
      } else if (!res.ok) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
      }
      onChange({
        ...value,
        lastFetchedVin: body.vin ?? effectiveVin,
        fetchedAt: new Date().toISOString(),
        lastCostEur: body.costEur ?? estimatedCost,
        results: body.results ?? value.results,
        display: body.display ?? value.display,
        source: "oneautoapi",
      });
    } catch {
      setError(oneautoFetchErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="oneauto"
      header={
        <AdminSourceBlockHeader
          blockKey="oneauto"
          trafficFillLevel={trafficFillLevel}
          className="mb-0 shrink-0"
        />
      }
      headerActions={
        <AdminSourceBlockHeaderTools
          sourceLabel={SOURCE_BLOCK_LABELS.oneauto}
          readOnly={readOnly}
          disabled={disabled}
          onClear={() => onChange(emptyOneautoBlock())}
        />
      }
    >
      <div className={`flex h-full min-h-0 flex-col overflow-hidden ${trafficFillLevel ? "p-0" : "p-2"}`}>
        <div className={`min-h-0 flex-1 overflow-y-auto ${trafficFillLevel ? "px-2 pt-2" : ""}`}>
          <label className="mb-2 block">
            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
              VIN
            </span>
            <input
              className={inp}
              value={value.vinOverride || orderVin}
              disabled={!editable}
              data-provin-handoff-vin={effectiveVin || undefined}
              spellCheck={false}
              autoCapitalize="characters"
              onChange={(e) => onChange({ ...value, vinOverride: e.target.value.toUpperCase() })}
            />
          </label>

          <fieldset className="space-y-1.5">
            <legend className={subhead}>Produkti</legend>
            {ONEAUTO_PRODUCTS.map((p) => {
              const result = value.results[p.id];
              return (
                <label key={p.id} className="flex items-start gap-2 text-[11px] text-[var(--color-apple-text)]">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedSet.has(p.id)}
                    disabled={!editable || busy}
                    onChange={(e) => toggleProduct(p.id, e.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="font-medium">
                      {p.label} ({formatOneautoCostEur(p.priceCents)})
                    </span>
                    {p.hint ? (
                      <span className="ml-1 text-[var(--color-provin-muted)]">- {p.hint}</span>
                    ) : null}
                    {result ? (
                      <span
                        className={`ml-1 ${result.ok ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {result.ok ? "ielādēts" : result.error ?? "kļūda"}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </fieldset>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
            <p className="text-[11px] font-medium text-[var(--color-apple-text)]">
              Paredzamās izmaksas: {estimatedCost}
            </p>
            <button
              type="button"
              disabled={!editable || busy || !effectiveVin}
              onClick={() => void fetchData()}
              className="rounded-md bg-[var(--color-provin-accent)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Ielādē…" : "Ielādēt datus"}
            </button>
          </div>

          {cachedForVin ? (
            <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
              Saglabāti dati VIN {value.lastFetchedVin}
              {value.fetchedAt ? ` · ${value.fetchedAt.slice(0, 16).replace("T", " ")}` : ""}
              {value.lastCostEur ? ` · ${value.lastCostEur}` : ""}. Atkārtota ielāde nav nepieciešama.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-[11px] text-rose-700">{error}</p> : null}

          {value.display.powertrain.length > 0 ? (
            <section>
              <h3 className={subhead}>Dzinēja / kārbas specifikācija</h3>
              <KvTable rows={value.display.powertrain} />
            </section>
          ) : null}
          {value.display.equipment.length > 0 ? (
            <section>
              <h3 className={subhead}>Gatavā komplektācija</h3>
              <KvTable rows={value.display.equipment} />
            </section>
          ) : null}
          {value.display.serviceTimeline.length > 0 ? (
            <section>
              <h3 className={subhead}>Servisu vēstures laika skala</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200/90">
                <table className="w-full min-w-[280px] border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
                      <th className="px-1.5 py-0.5">Datums</th>
                      <th className="px-1.5 py-0.5">Km</th>
                      <th className="px-1.5 py-0.5">Vieta</th>
                      <th className="px-1.5 py-0.5">Darbi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {value.display.serviceTimeline.map((ev, i) => (
                      <tr key={`${ev.date}-${i}`} className="border-b border-slate-100">
                        <td className="px-1.5 py-0.5">{ev.date}</td>
                        <td className="px-1.5 py-0.5">{ev.odometer}</td>
                        <td className="px-1.5 py-0.5">{ev.place}</td>
                        <td className="px-1.5 py-0.5">{ev.works}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <AdminSourceCommentField
            value={value.comments}
            onChange={(html) => onChange({ ...value, comments: html })}
            readOnly={readOnly}
            disabled={disabled}
            compact
            ai={aiComment}
          />
          <AdminAiContextRawField
            value={value.aiContextRaw}
            onChange={(next) => onChange({ ...value, aiContextRaw: next })}
            readOnly={readOnly}
            disabled={disabled}
          />
        </div>
      </div>
    </AdminCollapsibleShell>
  );
}

function KvTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200/90">
      <table className="w-full min-w-[240px] border-collapse text-[11px]">
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.label}:${row.value}`} className="border-b border-slate-100">
              <td className="w-[38%] px-1.5 py-0.5 font-medium text-slate-600">{row.label}</td>
              <td className="px-1.5 py-0.5">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
