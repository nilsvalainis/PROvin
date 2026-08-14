"use client";

import { useEffect, useState } from "react";
import { AdminAiGenerateWithPrefill } from "@/components/admin/AdminAiGenerateWithPrefill";
import { AdminListingPriceHistoryTable } from "@/components/admin/AdminListingPriceHistoryTable";
import { AdminSourceCommentField, type AdminAiSourceCommentSlot } from "@/components/admin/AdminSourceCommentField";
import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { ListedForSaleFieldChrome } from "@/components/admin/ListedForSaleFieldChrome";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { PriceDropArrowIcon } from "@/components/icons/PriceDropArrowIcon";
import {
  applyAdifyHistoryToTirgus,
  ADIFY_HISTORY_PAGE_URL,
  type AdifyListingHistorySnapshot,
} from "@/lib/adify-listing-history";
import type { TirgusFormFields } from "@/lib/admin-source-blocks";
import {
  emptyTirgusFields,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_HISTORY_SUBSECTION_TITLE,
  TIRGUS_LABEL_CREATED,
  TIRGUS_LABEL_LISTED,
  TIRGUS_LABEL_PRICE_DROP,
  tirgusPriceHistoryHasRows,
} from "@/lib/admin-source-blocks";
import { parseListedForSaleDays, shouldShowListedForSaleCriticalBanner } from "@/lib/tirgus-listed-ui";

import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";

const inp =
  "min-w-0 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const fetchBtn =
  "rounded-md border border-[var(--color-provin-accent)]/40 bg-[var(--color-provin-accent-soft)]/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-apple-text)] transition hover:bg-[var(--color-provin-accent-soft)]/70 disabled:opacity-50";

type StringTirgusKey = "listedForSale" | "listingCreated" | "priceDrop" | "comments" | "aiContextRaw";

type Props = {
  value?: TirgusFormFields | null;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: TirgusFormFields) => void;
  /** Ievietots „Sludinājuma analīzē” — bez atsevišķas „Tirgus dati” galvenes un ārējā kartītes. */
  variant?: "default" | "embedded";
  /** Zemāks augstums (admin kompaktais skats). */
  compact?: boolean;
  aiComment?: AdminAiSourceCommentSlot;
  /** ss.lv + IRISS EU izsoles + LV tirgus — strukturēta AI analīze. */
  marketAiAllowed?: boolean;
  marketAiBusy?: boolean;
  marketAiError?: string | null;
  onMarketAiAnalyze?: (operatorNotes: string, modelTier: AiAdminModelTier) => void;
  /** Pasūtījuma sludinājuma URL — Adify vēstures ielādei. */
  listingUrl?: string | null;
};

export function AdminTirgusSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  variant = "default",
  compact = false,
  aiComment,
  marketAiAllowed = false,
  marketAiBusy = false,
  marketAiError = null,
  onMarketAiAnalyze,
  listingUrl = "",
}: Props) {
  const val = value ?? emptyTirgusFields();
  const setField = (key: StringTirgusKey, v: string) => {
    onChange({ ...val, [key]: v });
  };

  const [urlDraft, setUrlDraft] = useState(listingUrl?.trim() ?? "");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = listingUrl?.trim() ?? "";
    if (next) setUrlDraft(next);
  }, [listingUrl]);

  const loadAdify = async () => {
    const url = urlDraft.trim();
    if (!url || disabled || readOnly || busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/adify-history", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json().catch(() => ({}))) as AdifyListingHistorySnapshot & {
        error?: string;
      };
      if (!res.ok) {
        setError(
          data.error === "invalid_url"
            ? "Nederīga sludinājuma saite"
            : data.error === "unauthorized"
              ? "Nav admin sesijas"
              : "Neizdevās ielādēt Adify vēsturi",
        );
        return;
      }
      if (!data.found) {
        setError(data.message || "Meklētais objekts netika atrasts");
        return;
      }
      onChange(applyAdifyHistoryToTirgus(val, data));
      setStatus(data.message);
    } catch {
      setError("Neizdevās savienoties ar Adify");
    } finally {
      setBusy(false);
    }
  };

  const shell =
    variant === "embedded"
      ? "w-full min-w-0 flex flex-col"
      : "flex h-full min-h-0 flex-col rounded-lg border border-slate-200/90 bg-white p-2 shadow-sm";

  const embDense = variant === "embedded" && compact;
  const cellPad = embDense ? "px-1.5 py-0.5" : "px-2 py-1";

  const historyRows = val.priceHistory ?? [];
  const historyPriceChange =
    historyRows.length > 0 ? historyRows[0]!.price - historyRows[historyRows.length - 1]!.price : 0;
  const historyDays = parseListedForSaleDays(val.listedForSale);

  const adifyFetchRow =
    readOnly ? null : (
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="url"
            className={`${inp} min-w-[12rem] flex-1`}
            placeholder="Iekopē sludinājuma saiti (ss.lv)"
            value={urlDraft}
            disabled={disabled || busy}
            onChange={(e) => setUrlDraft(e.target.value)}
            aria-label="Sludinājuma saite Adify vēsturei"
          />
          <button
            type="button"
            disabled={disabled || busy || !urlDraft.trim()}
            onClick={() => void loadAdify()}
            className={fetchBtn}
          >
            {busy ? "Ielasu…" : "Ielasīt no Adify"}
          </button>
          <a
            href={ADIFY_HISTORY_PAGE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-semibold text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            adify.lv/history
          </a>
        </div>
        {error ? (
          <p className="text-[10px] font-medium text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );

  const historyTable = tirgusPriceHistoryHasRows(historyRows) ? (
    <AdminListingPriceHistoryTable
      rows={historyRows}
      priceChangeEur={historyPriceChange}
      durationDays={historyDays}
      foundMessage={status}
    />
  ) : null;

  const tableBlock = (
    <div className="min-h-0 w-full overflow-x-auto rounded-lg border border-slate-200/90">
      <table className={`w-full min-w-[280px] border-collapse ${embDense ? "text-[10px]" : "text-[11px]"}`}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90 text-left text-[10px] font-medium text-[var(--color-provin-muted)]">
            <th className={cellPad}>{TIRGUS_LABEL_LISTED}</th>
            <th className={cellPad}>{TIRGUS_LABEL_CREATED}</th>
            <th className={cellPad}>{TIRGUS_LABEL_PRICE_DROP}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className={`${cellPad} align-top`}>
              <ListedForSaleFieldChrome value={val.listedForSale}>
                {readOnly ? (
                  <span
                    className={
                      shouldShowListedForSaleCriticalBanner(val.listedForSale)
                        ? "font-semibold"
                        : "text-[var(--color-provin-muted)]"
                    }
                  >
                    {val.listedForSale.trim() || "—"}
                  </span>
                ) : (
                  <input
                    type="text"
                    className={`${inp} min-w-0`}
                    placeholder="piem., 22"
                    value={val.listedForSale}
                    disabled={disabled}
                    onChange={(e) => setField("listedForSale", e.target.value)}
                    aria-label={TIRGUS_LABEL_LISTED}
                  />
                )}
              </ListedForSaleFieldChrome>
            </td>
            <td className={`${cellPad} align-top`}>
              {readOnly ? (
                <span className="text-[var(--color-provin-muted)]">{val.listingCreated.trim() || "—"}</span>
              ) : (
                <input
                  type="text"
                  className={inp}
                  placeholder="piem., 20.05.2026"
                  value={val.listingCreated}
                  disabled={disabled}
                  onChange={(e) => setField("listingCreated", e.target.value)}
                  aria-label={TIRGUS_LABEL_CREATED}
                />
              )}
            </td>
            <td className={`${cellPad} align-top`}>
              {readOnly ? (
                val.priceDrop.trim() ? (
                  <span className="inline-flex items-center gap-1.5 text-[var(--color-provin-muted)]">
                    <PriceDropArrowIcon />
                    {val.priceDrop.trim()}
                  </span>
                ) : (
                  <span className="text-[var(--color-provin-muted)]">—</span>
                )
              ) : (
                <span className="inline-flex w-full min-w-0 items-center gap-1.5">
                  <PriceDropArrowIcon className="shrink-0" />
                  <input
                    type="text"
                    className={`${inp} min-w-0 flex-1`}
                    placeholder='piem., "€ -3 790"'
                    value={val.priceDrop}
                    disabled={disabled}
                    onChange={(e) => setField("priceDrop", e.target.value)}
                    aria-label={TIRGUS_LABEL_PRICE_DROP}
                  />
                </span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );

  const commentsReadonlyClassEmbedded = embDense
    ? "min-h-[32px] whitespace-pre-wrap rounded border border-emerald-100 bg-white/95 px-1.5 py-1 text-[10px] text-[var(--color-provin-muted)]"
    : "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100 bg-white/95 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]";
  const commentsReadonlyClassDefault =
    "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-100 bg-white/90 px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)]";

  const commentsBlock =
    variant === "embedded" ? (
      <>
        <AdminSourceCommentField
          value={val.comments}
          onChange={(next) => setField("comments", next)}
          readOnly={readOnly}
          disabled={disabled}
          compact={embDense}
          ai={aiComment}
          readonlyClassName={commentsReadonlyClassEmbedded}
          aria-label={`${LISTING_HISTORY_SUBSECTION_TITLE} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
        />
        <AdminAiContextRawField
          value={val.aiContextRaw}
          onChange={(next) => setField("aiContextRaw", next)}
          readOnly={readOnly}
          disabled={disabled}
          ariaLabel="Tirgus — AI papildu konteksts"
        />
      </>
    ) : (
      <div className="mt-auto w-full min-w-0 shrink-0 pt-2">
        <AdminSourceCommentField
          value={val.comments}
          onChange={(next) => setField("comments", next)}
          readOnly={readOnly}
          disabled={disabled}
          ai={aiComment}
          readonlyClassName={commentsReadonlyClassDefault}
          aria-label={`Tirgus — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
        />
        <AdminAiContextRawField
          value={val.aiContextRaw}
          onChange={(next) => setField("aiContextRaw", next)}
          readOnly={readOnly}
          disabled={disabled}
          ariaLabel="Tirgus — AI papildu konteksts"
        />
      </div>
    );

  const marketAnalyzeRow =
    onMarketAiAnalyze ? (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <AdminAiGenerateWithPrefill
          label="Analizēt tirgu (ss.lv + EU izsoles)"
          busy={marketAiBusy}
          disabled={!marketAiAllowed}
          demoOnly={!marketAiAllowed}
          onGenerate={(notes, tier) => onMarketAiAnalyze(notes, tier)}
        />
        {marketAiError ? (
          <p className="w-full text-[9px] leading-snug text-amber-800/90" title={marketAiError}>
            {marketAiError}
          </p>
        ) : null}
      </div>
    ) : null;

  if (variant === "embedded") {
    return (
      <div className={shell}>
        <div className={embDense ? "space-y-1.5" : "space-y-2"}>
          {marketAnalyzeRow}
          {adifyFetchRow}
          {historyTable}
          {tableBlock}
          {commentsBlock}
        </div>
      </div>
    );
  }

  return (
    <div className={shell}>
      <AdminSourceBlockHeader blockKey="tirgus" className="mb-2 shrink-0" />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {adifyFetchRow}
        {historyTable}
        {tableBlock}
      </div>
      {commentsBlock}
    </div>
  );
}
