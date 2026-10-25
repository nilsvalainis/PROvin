"use client";

import { formatRigaIsoShort } from "@/lib/riga-datetime";
import { useMemo, useState } from "react";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  ONEAUTO_PRODUCTS,
  buildOneautoDisplay,
  filledOneautoServiceEvents,
  formatOneautoCostEur,
  oneautoChargedCostCents,
  oneautoDisplayHasRows,
  oneautoProductStatusLabel,
  oneautoProductsCostCents,
  oneautoProductsInSoftCooldown,
  oneautoResultIsNoData,
  oneautoResultIsPending,
  oneautoResultIsUnavailable,
  oneautoResultTone,
  oneautoSelectedHaveProblem,
  oneautoServiceHistoryIsEmpty,
  type OneautoDisplaySections,
  type OneautoProductId,
} from "@/lib/oneauto-catalog";
import { ONEAUTO_IMAGE_MAX_VIEWS, formatOneautoImageCostEur } from "@/lib/oneauto-images";
import {
  emptyOneautoIngest,
  mergeOneautoProductResults,
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
    case "api_unavailable":
      return "Šis OneAuto produkts šobrīd nav pieejams. Raksti help@oneautoapi.com.";
    case "no_images":
      return "OneAuto neatrada kataloga foto šim VIN.";
    case "store_disabled":
      return "Foto krātuve nav ieslēgta (Blob / drafts).";
    case "invalid_session":
      return "Pasūtījuma sesija nav derīga foto saglabāšanai.";
    default:
      return "OneAutoAPI neatbildēja. Mēģini vēlreiz.";
  }
}

const STATUS_TEXT: Record<ReturnType<typeof oneautoResultTone>, string> = {
  ok: "text-emerald-700",
  pending: "text-amber-700",
  problem: "text-rose-700",
};

const STATUS_DOT: Record<ReturnType<typeof oneautoResultTone>, string> = {
  ok: "bg-emerald-600",
  pending: "bg-amber-500",
  problem: "bg-rose-600",
};

type Props = {
  ingest: AutoRecordsOneautoIngest;
  orderVin: string;
  sessionId?: string;
  photosEnabled?: boolean;
  editable: boolean;
  hasMappedData: boolean;
  onIngestChange: (next: AutoRecordsOneautoIngest) => void;
  onFetched: (ingest: AutoRecordsOneautoIngest, display: OneautoDisplaySections) => void;
  onImagesFetched?: (photoIds: string[], groupTitle: string) => void;
};

export function AdminOneautoIngestBar({
  ingest,
  orderVin,
  sessionId = "",
  photosEnabled = false,
  editable,
  hasMappedData,
  onIngestChange,
  onFetched,
  onImagesFetched,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [imagesBusy, setImagesBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagesNote, setImagesNote] = useState<string | null>(null);
  const value = ingest.lastFetchedVin || ingest.selectedProducts.length ? ingest : emptyOneautoIngest();
  const effectiveVin = normalizeVin(value.vinOverride || orderVin);
  const estimatedCost = formatOneautoCostEur(oneautoProductsCostCents(value.selectedProducts));
  const chargedCost = formatOneautoCostEur(
    oneautoChargedCostCents(value.selectedProducts, value.results),
  );
  const imageCostHint = formatOneautoImageCostEur(ONEAUTO_IMAGE_MAX_VIEWS);
  const selectedSet = useMemo(() => new Set(value.selectedProducts), [value.selectedProducts]);
  const cachedForVin =
    Boolean(value.lastFetchedVin) && normalizeVin(value.lastFetchedVin) === effectiveVin;
  const historyResult = value.results.oe_service_history;
  const historyPending = Boolean(historyResult && oneautoResultIsPending(historyResult));
  const historyEmpty = Boolean(
    historyResult && oneautoServiceHistoryIsEmpty(historyResult.payload),
  );
  const selectedHaveProblem = oneautoSelectedHaveProblem(value.selectedProducts, value.results);
  const cooldownProducts = cachedForVin
    ? oneautoProductsInSoftCooldown(value.selectedProducts, value.results, value.fetchedAt)
    : [];
  const canFetchImages = Boolean(sessionId && photosEnabled && onImagesFetched);

  const toggleProduct = (id: OneautoProductId, checked: boolean) => {
    const next = checked
      ? [...ONEAUTO_PRODUCTS.map((p) => p.id).filter((pid) => pid === id || selectedSet.has(pid))]
      : value.selectedProducts.filter((pid) => pid !== id);
    onIngestChange({ ...value, selectedProducts: next });
  };

  const fetchData = async () => {
    if (!editable || busy || imagesBusy) return;
    if (value.selectedProducts.length === 0) {
      setError(oneautoFetchErrorLv("no_products_selected"));
      return;
    }
    let productsToFetch = [...value.selectedProducts];
    if (cooldownProducts.length > 0) {
      const labels = cooldownProducts
        .map((id) => ONEAUTO_PRODUCTS.find((p) => p.id === id)?.label ?? id)
        .join(", ");
      const override = window.confirm(
        `Šim VIN pēdējās 24h jau ir ielādēts: ${labels}. Ielādēt šos produktus no jauna? Tas var atkārtoti iekasēt maksu.`,
      );
      if (!override) {
        productsToFetch = productsToFetch.filter((id) => !cooldownProducts.includes(id));
        if (productsToFetch.length === 0) return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/sources/oneautoapi", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: effectiveVin, products: productsToFetch }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        vin?: string;
        costEur?: string;
        results?: AutoRecordsOneautoIngest["results"];
        display?: OneautoDisplaySections;
        displayOriginal?: OneautoDisplaySections;
      };
      if (!res.ok && !body.results) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
        return;
      }
      const resultRows = Object.values(body.results ?? {});
      const onlyNoData =
        resultRows.length > 0 && resultRows.every((r) => r && oneautoResultIsNoData(r));
      const onlyUnavailable =
        resultRows.length > 0 &&
        resultRows.every((r) => r && (oneautoResultIsUnavailable(r) || oneautoResultIsNoData(r))) &&
        resultRows.some((r) => r && oneautoResultIsUnavailable(r));
      if (body.error && res.status === 402) {
        setError(oneautoFetchErrorLv("insufficient_balance"));
      } else if (body.error === "pending" || res.status === 202) {
        setError(oneautoFetchErrorLv("pending"));
      } else if (onlyNoData) {
        setError(null);
      } else if (onlyUnavailable) {
        setError(oneautoFetchErrorLv("api_unavailable"));
      } else if (!res.ok) {
        setError(oneautoFetchErrorLv(body.error ?? "upstream_error"));
      }
      // Merge product results so empty/no_data cannot wipe a prior service history payload.
      const nextResults = mergeOneautoProductResults(value.results, body.results ?? {});
      const payloads: Partial<Record<OneautoProductId, unknown>> = {};
      for (const id of Object.keys(nextResults) as OneautoProductId[]) {
        payloads[id] = nextResults[id]?.payload;
      }
      const rebuiltOriginal = buildOneautoDisplay(payloads);
      const originalFromApi = oneautoDisplayHasRows(body.displayOriginal)
        ? body.displayOriginal!
        : rebuiltOriginal;
      const freshOriginalTimeline = filledOneautoServiceEvents(originalFromApi.serviceTimeline);
      const serviceTimelineOriginal =
        freshOriginalTimeline.length > 0
          ? freshOriginalTimeline
          : filledOneautoServiceEvents(value.serviceTimelineOriginal);
      const nextDisplay: OneautoDisplaySections = oneautoDisplayHasRows(body.display)
        ? body.display!
        : rebuiltOriginal;
      const nextIngest: AutoRecordsOneautoIngest = {
        ...value,
        lastFetchedVin: body.vin ?? effectiveVin,
        fetchedAt: new Date().toISOString(),
        lastCostEur: formatOneautoCostEur(oneautoChargedCostCents(value.selectedProducts, nextResults)),
        results: nextResults,
        serviceTimelineOriginal,
      };
      onFetched(nextIngest, nextDisplay);
    } catch {
      setError(oneautoFetchErrorLv("upstream_error"));
    } finally {
      setBusy(false);
    }
  };

  const fetchImages = async () => {
    if (!editable || busy || imagesBusy || !canFetchImages || !effectiveVin) return;
    const ok = window.confirm(
      `Ielādēt OneAuto kataloga foto pēc VIN? Orientējoši līdz ${imageCostHint} (meklēšana + līdz ${ONEAUTO_IMAGE_MAX_VIEWS} skatiem).`,
    );
    if (!ok) return;
    setImagesBusy(true);
    setError(null);
    setImagesNote(null);
    try {
      const res = await fetch("/api/admin/sources/oneautoapi/images", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vin: effectiveVin, sessionId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        photoIds?: string[];
        groupTitle?: string;
        costEur?: string;
        label?: string;
      };
      if (!res.ok || !body.photoIds?.length) {
        setError(oneautoFetchErrorLv(body.error ?? "no_images"));
        return;
      }
      onImagesFetched?.(body.photoIds, body.groupTitle ?? "OneAuto kataloga foto");
      setImagesNote(
        `Pievienoti ${body.photoIds.length} foto${body.label ? ` (${body.label})` : ""}${
          body.costEur ? ` · ${body.costEur}` : ""
        }.`,
      );
    } catch {
      setError(oneautoFetchErrorLv("upstream_error"));
    } finally {
      setImagesBusy(false);
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
          const tone = result ? oneautoResultTone(result) : null;
          const detail =
            result && tone === "problem"
              ? [result.httpStatus ? `HTTP ${result.httpStatus}` : "", result.message ?? ""]
                  .filter(Boolean)
                  .join(" · ")
              : "";
          return (
            <label
              key={p.id}
              className="flex items-start gap-2 text-[11px] text-[var(--color-apple-text)]"
            >
              <input
                type="checkbox"
                className="mt-0.5"
                checked={selectedSet.has(p.id)}
                disabled={!editable || busy || imagesBusy}
                onChange={(e) => toggleProduct(p.id, e.target.checked)}
              />
              <span className="min-w-0">
                <span className="font-medium">
                  {p.label} ({formatOneautoCostEur(p.priceCents)})
                </span>
                {p.hint ? (
                  <span className="ml-1 text-[var(--color-provin-muted)]">- {p.hint}</span>
                ) : null}
                {result && tone ? (
                  <span className={`ml-1 inline-flex items-center gap-1 ${STATUS_TEXT[tone]}`}>
                    <span
                      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[tone]}`}
                      aria-hidden
                    />
                    {oneautoProductStatusLabel(result)}
                  </span>
                ) : null}
                {detail ? (
                  <span className="mt-0.5 block text-[10px] leading-snug text-rose-700">{detail}</span>
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
          disabled={!editable || busy || imagesBusy || !effectiveVin}
          onClick={() => void fetchData()}
          data-admin-paid="oneauto"
          className="admin-paid-load rounded-md bg-[var(--color-provin-accent)] px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Ielādē…" : "Ielādēt datus"}
        </button>
      </div>
      {canFetchImages ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2">
          <p className="text-[11px] text-[var(--color-provin-muted)]">
            Image Search by VIN (kataloga foto, līdz {imageCostHint})
          </p>
          <button
            type="button"
            disabled={!editable || busy || imagesBusy || !effectiveVin}
            onClick={() => void fetchImages()}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-apple-text)] disabled:opacity-50"
          >
            {imagesBusy ? "Ielādē foto…" : "Ielādēt foto"}
          </button>
        </div>
      ) : null}
      {cachedForVin && selectedHaveProblem ? (
        <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
          VIN {value.lastFetchedVin}
          {value.fetchedAt ? ` · ${formatRigaIsoShort(value.fetchedAt)}` : ""}
          {` · ${chargedCost}`}. Daļai produktu nav datu vai ir kļūda. Atkārtota ielāde ir
          iespējama.
        </p>
      ) : cachedForVin && hasMappedData ? (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
          Saglabāti dati VIN {value.lastFetchedVin}
          {value.fetchedAt ? ` · ${formatRigaIsoShort(value.fetchedAt)}` : ""}
          {` · ${chargedCost}`}. Atkārtota ielāde nav nepieciešama.
        </p>
      ) : null}
      {cachedForVin && historyPending ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-950">
          OEM vēl nav atgriezis servisa vēsturi. Spied Ielādēt datus, lai pārbaudītu (parasti bez
          jaunas maksas).
        </p>
      ) : null}
      {cachedForVin && historyEmpty && !hasMappedData && oneautoIngestHasMeta(value) ? (
        <p className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
          Ielādēts. OEM atbilde šim VIN ir tukša: servisa ierakstu nav.
        </p>
      ) : null}
      {imagesNote ? (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
          {imagesNote}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[11px] text-rose-700">{error}</p> : null}
    </section>
  );
}
