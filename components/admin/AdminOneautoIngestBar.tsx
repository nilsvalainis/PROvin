"use client";

import { useMemo, useState } from "react";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  ONEAUTO_PRODUCTS,
  buildOneautoDisplay,
  formatOneautoCostEur,
  oneautoDisplayHasRows,
  oneautoPayloadIsNoData,
  oneautoPayloadIsPending,
  oneautoProductsCostCents,
  oneautoServiceHistoryIsEmpty,
  type OneautoDisplaySections,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import {
  emptyOneautoIngest,
  oneautoIngestHasMeta,
  type AutoRecordsOneautoIngest,
} from "@/lib/oneauto-to-auto-records";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

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
    case "pending":
      return "OEM vēl apstrādā pieprasījumu. Pagaidi un spied Ielādēt datus vēlreiz. Atkārtota pārbaude parasti neiekasē jaunu maksu.";
    case "no_data":
      return "OEM atbilde: šim VIN nav datu. Maksa nav iekasēta.";
    default:
      return "OneAutoAPI neatbildēja. Mēģini vēlreiz.";
  }
}

type Props = {
  ingest: AutoRecordsOneautoIngest;
  orderVin: string;
  editable: boolean;
  hasMappedData: boolean;
  onIngestChange: (next: AutoRecordsOneautoIngest) => void;
  onFetched: (ingest: AutoRecordsOneautoIngest, display: OneautoDisplaySections) => void;
};

export function AdminOneautoIngestBar({
  ingest,
  orderVin,
  editable,
  hasMappedData,
  onIngestChange,
  onFetched,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = ingest.lastFetchedVin || ingest.selectedProducts.length ? ingest : emptyOneautoIngest();
  const effectiveVin = normalizeVin(value.vinOverride || orderVin);
  const estimatedCost = formatOneautoCostEur(oneautoProductsCostCents(value.selectedProducts));
  const selectedSet = useMemo(() => new Set(value.selectedProducts), [value.selectedProducts]);
  const cachedForVin =
    Boolean(value.lastFetchedVin) && normalizeVin(value.lastFetchedVin) === effectiveVin;
  const historyResult = value.results.oe_service_history;
  const historyPending = Boolean(
    historyResult && (historyResult.error === "pending" || oneautoPayloadIsPending(undefined, historyResult.payload)),
  );
  const historyEmpty = Boolean(historyResult && oneautoServiceHistoryIsEmpty(historyResult.payload));

  const toggleProduct = (id: OneautoProductId, checked: boolean) => {
    const next = checked
      ? [...ONEAUTO_PRODUCTS.map((p) => p.id).filter((pid) => pid === id || selectedSet.has(pid))]
      : value.selectedProducts.filter((pid) => pid !== id);
    onIngestChange({ ...value, selectedProducts: next });
  };

  const fetchData = async () => {
    if (!editable || busy) return;
    if (value.selectedProducts.length === 0) {
      setError(oneautoFetchErrorLv("no_products_selected"));
      return;
    }
    if (cachedForVin && hasMappedData) {
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
        results?: AutoRecordsOneautoIngest["results"];
        display?: OneautoDisplaySections;
      };
      if (!res.ok && !body.results) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
        return;
      }
      const resultRows = Object.values(body.results ?? {});
      const onlyNoData =
        resultRows.length > 0 &&
        resultRows.every(
          (r) => r && (oneautoPayloadIsNoData(r.payload, r.error ?? "") || r.error === "no_data"),
        );
      if (body.error && res.status === 402) {
        setError(oneautoFetchErrorLv("insufficient_balance"));
      } else if (body.error === "pending" || res.status === 202) {
        setError(oneautoFetchErrorLv("pending"));
      } else if (onlyNoData) {
        setError(null);
      } else if (!res.ok) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
      }
      const nextResults = body.results ?? value.results;
      const payloads: Partial<Record<OneautoProductId, unknown>> = {};
      for (const id of Object.keys(nextResults) as OneautoProductId[]) {
        payloads[id] = nextResults[id]?.payload;
      }
      const nextDisplay: OneautoDisplaySections = oneautoDisplayHasRows(body.display)
        ? body.display
        : buildOneautoDisplay(payloads);
      const nextIngest: AutoRecordsOneautoIngest = {
        ...value,
        lastFetchedVin: body.vin ?? effectiveVin,
        fetchedAt: new Date().toISOString(),
        lastCostEur: body.costEur ?? estimatedCost,
        results: nextResults,
      };
      onFetched(nextIngest, nextDisplay);
    } catch {
      setError(oneautoFetchErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-3 rounded-lg border border-slate-200/90 bg-slate-50/70 px-2 py-2">
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        OneAuto API
      </p>
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
          onChange={(e) => onIngestChange({ ...value, vinOverride: e.target.value.toUpperCase() })}
          aria-label="OneAuto VIN"
        />
      </label>
      <fieldset className="space-y-1.5">
        <legend className="sr-only">OneAuto produkti</legend>
        {ONEAUTO_PRODUCTS.map((p) => {
          const result = value.results[p.id];
          const resultPending = Boolean(
            result &&
              (result.error === "pending" || oneautoPayloadIsPending(undefined, result.payload)),
          );
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
                    className={`ml-1 ${
                      resultPending
                        ? "text-amber-700"
                        : oneautoPayloadIsNoData(result.payload, result.error ?? "") ||
                            result.error === "no_data"
                          ? "text-slate-600"
                          : result.ok
                            ? "text-emerald-700"
                            : "text-rose-700"
                    }`}
                  >
                    {resultPending
                      ? "gaida OEM"
                      : oneautoPayloadIsNoData(result.payload, result.error ?? "") ||
                          result.error === "no_data"
                        ? "nav datu (nav iekasēts)"
                        : result.ok
                          ? "ielādēts"
                          : result.error ?? "kļūda"}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </fieldset>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
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
      {cachedForVin && hasMappedData ? (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
          Saglabāti dati VIN {value.lastFetchedVin}
          {value.fetchedAt ? ` · ${value.fetchedAt.slice(0, 16).replace("T", " ")}` : ""}
          {value.lastCostEur ? ` · ${value.lastCostEur}` : ""}. Atkārtota ielāde nav nepieciešama.
        </p>
      ) : null}
      {cachedForVin && historyPending ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950">
          OEM vēl nav atgriezis servisa vēsturi. Spied Ielādēt datus, lai pārbaudītu (parasti bez jaunas maksas).
        </p>
      ) : null}
      {cachedForVin && historyEmpty && !hasMappedData && oneautoIngestHasMeta(value) ? (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
          Ielādēts. OEM atbilde šim VIN ir tukša: servisa ierakstu nav.
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-rose-700">{error}</p> : null}
    </section>
  );
}
