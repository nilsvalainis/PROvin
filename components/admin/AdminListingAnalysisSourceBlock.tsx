"use client";

/**
 * Sludinājuma analīze: Groq pārdošanas konteksts + Gemini pārdevēja analīze (DEMO).
 */

import { Loader2 } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
import { AdminGeminiGenerateWithPrefill } from "@/components/admin/AdminGeminiGenerateWithPrefill";
import { AdminGeminiContextRawField } from "@/components/admin/AdminGeminiContextRawField";
import { AdminRichCommentReadonly } from "@/components/admin/AdminInternalRichCommentEditor";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { ListingAnalysisSubsectionHeading } from "@/components/admin/AdminListingAnalysisSectionChrome";
import {
  emptyListingAnalysisBlock,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_ANALYSIS_EXTRA_SELLER_LABEL,
  LISTING_ANALYSIS_LISTING_PASTE_LABEL,
  LISTING_ANALYSIS_SUBSECTIONS,
  type ListingAnalysisBlockState,
} from "@/lib/admin-source-blocks";
import { LISTING_ANALYSIS_FIELD_LUCIDE } from "@/lib/admin-lucide-registry";
import { geminiPlainTextToRichHtml, adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import { formatAdminGeminiFetchError, parseAdminGeminiResponse } from "@/lib/admin-gemini-client-errors";

const ta =
  "min-h-[72px] w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20";

export type GeminiListingAnalysisPayload = {
  sessionId: string;
  vin: string | null;
  listingUrl: string | null;
  customerName: string | null;
  notes: string | null;
  sourceBlocks: unknown;
  iriss: string;
  apskatesPlāns: string;
  cenasAtbilstiba: string;
  internalComment?: string;
  mileageComment?: string;
};

type Props = {
  value?: ListingAnalysisBlockState | null;
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: ListingAnalysisBlockState) => void;
  /** Ārējā „SLUDINĀJUMA ANALĪZE” prioritārā josla — bez atkārtota bloka galvenes. */
  variant?: "default" | "priority";
  /** Zemāks augstums (admin kompaktais skats). */
  compact?: boolean;
  /** Teksta lauku augstums pēc scrollHeight (+ aptuveni viena rinda). */
  autoGrow?: boolean;
  /** Gemini — ja atļauts šim pasūtījumam (skat. GEMINI_DEMO_ONLY). */
  geminiAllowed?: boolean;
  buildGeminiPayload?: () => GeminiListingAnalysisPayload;
};

export function AdminListingAnalysisSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  variant = "default",
  compact = false,
  autoGrow = false,
  geminiAllowed = true,
  buildGeminiPayload,
}: Props) {
  const v = value ?? emptyListingAnalysisBlock();
  const L = LISTING_ANALYSIS_SUBSECTIONS;

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [sellerAnalyzing, setSellerAnalyzing] = useState(false);
  const [sellerAnalyzeErr, setSellerAnalyzeErr] = useState<string | null>(null);
  const refPaste = useRef<HTMLTextAreaElement>(null);

  const bumpTa = useCallback((el: HTMLTextAreaElement | null) => {
    if (!autoGrow || !el) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + lh}px`;
  }, [autoGrow]);

  useLayoutEffect(() => {
    if (!autoGrow || readOnly) return;
    bumpTa(refPaste.current);
  }, [autoGrow, readOnly, bumpTa, v.listingPasteRaw]);

  const canRunSellerGemini =
    geminiAllowed &&
    Boolean(buildGeminiPayload) &&
    (v.extraSellerName.trim().length > 0 || v.listingPasteRaw.trim().length > 0);

  const runSellerGeminiAnalyze = useCallback(
    async (operatorNotes: string) => {
      if (!canRunSellerGemini || sellerAnalyzing || disabled || readOnly || !buildGeminiPayload) return;
      setSellerAnalyzing(true);
      setSellerAnalyzeErr(null);
      try {
        const base = buildGeminiPayload();
        const res = await fetch("/api/admin/gemini/seller-analysis", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...base,
            extraSellerName: v.extraSellerName,
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(v.sellerPortrait).trim(),
          }),
        });
        const { data, parseFailed } = await parseAdminGeminiResponse(res);
        if (!res.ok) {
          setSellerAnalyzeErr(
            parseFailed
              ? `Gemini: servera atbilde nav lasāma (HTTP ${res.status})`
              : formatAdminGeminiFetchError(data, res, "Gemini: neizdevās analizēt pārdevēju"),
          );
          return;
        }
        if (typeof data.text === "string" && data.text.trim()) {
          onChange({ ...v, sellerPortrait: geminiPlainTextToRichHtml(data.text) });
        }
      } catch {
        setSellerAnalyzeErr("Gemini: neizdevās savienoties");
      } finally {
        setSellerAnalyzing(false);
      }
    },
    [buildGeminiPayload, canRunSellerGemini, disabled, onChange, readOnly, sellerAnalyzing, v],
  );

  const runListingAnalyze = useCallback(async () => {
    const t = v.listingPasteRaw.trim();
    if (!t || disabled || analyzing) return;
    setAnalyzing(true);
    setAnalyzeErr(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      });
      const data = (await res.json()) as { text?: string; error?: string; detail?: string };
      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail.trim() : "";
        if (data.error === "missing_groq_key") {
          setAnalyzeErr("Nav GROQ_API_KEY");
        } else if (res.status === 401 || data.error === "unauthorized") {
          setAnalyzeErr("Groq: nav admin piekļuves");
        } else if (data.error === "analysis_failed") {
          setAnalyzeErr(
            detail
              ? `Groq: neizdevās ģenerēt pārdošanas kontekstu — ${detail}`
              : "Groq: neizdevās ģenerēt pārdošanas kontekstu",
          );
        } else {
          setAnalyzeErr(detail ? `Groq: ${detail}` : "Groq: neizdevās");
        }
        return;
      }
      if (typeof data.text === "string") {
        onChange({ ...v, listingSalesContext: geminiPlainTextToRichHtml(data.text) });
      }
    } catch {
      setAnalyzeErr("Groq: neizdevās savienoties");
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, disabled, onChange, v]);

  const shell =
    variant === "priority"
      ? "w-full min-w-0 flex flex-col"
      : "flex h-full min-h-0 flex-col rounded-xl border-0 bg-transparent p-2 shadow-[0_2px_22px_rgba(15,23,42,0.055)]";

  const taPriority =
    "min-h-[72px] w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 dark:focus:border-emerald-400/80";
  const taPriorityCompact =
    "min-h-[52px] w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-1.5 py-1 text-[10px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-emerald-500/70 focus:outline-none focus:ring-1 focus:ring-emerald-500/25 dark:focus:border-emerald-400/80";
  const inputClass =
    "w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20";

  const pri = variant === "priority";
  const dense = compact && pri;

  const pasteTaClass = pri ? (dense ? taPriorityCompact : taPriority) : ta;

  const roBox = (denseInner: boolean) =>
    denseInner
      ? "min-h-[32px] rounded border border-emerald-100/50 bg-transparent px-1.5 py-1 text-[10px] text-slate-500"
      : "min-h-[48px] rounded-md border border-emerald-100/50 bg-transparent px-2 py-1.5 text-[11px] text-slate-500";

  const roDefault = "min-h-[48px] rounded-md border border-slate-200/40 bg-transparent px-2 py-1.5 text-[11px] text-slate-500";

  return (
    <div className={shell}>
      {variant === "default" ? (
        <AdminSourceBlockHeader blockKey="listing_analysis" className="mb-1.5" />
      ) : null}
      <div className={dense ? "space-y-3" : "space-y-4"}>
        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.sellerPortrait}
          title={L.sellerPortrait}
          compact={dense}
        >
          <label className="mb-2 block min-w-0">
            <span
              className={
                dense
                  ? "mb-0.5 block text-[9px] font-medium text-slate-400"
                  : "mb-0.5 block text-[10px] font-medium text-slate-400"
              }
            >
              {LISTING_ANALYSIS_EXTRA_SELLER_LABEL}
            </span>
            {readOnly ? (
              <div className={pri ? roBox(!!dense) : roDefault}>{v.extraSellerName.trim() || "—"}</div>
            ) : (
              <input
                type="text"
                className={dense ? `${inputClass} py-1 text-[10px]` : inputClass}
                disabled={disabled}
                value={v.extraSellerName}
                onChange={(e) => onChange({ ...v, extraSellerName: e.target.value })}
                placeholder="piem., SIA Auto Centrs"
                autoComplete="off"
                aria-label={LISTING_ANALYSIS_EXTRA_SELLER_LABEL}
              />
            )}
          </label>
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            <AdminGeminiGenerateWithPrefill
              label="Analizēt Pārdevēju"
              busy={sellerAnalyzing}
              disabled={!canRunSellerGemini || readOnly || disabled}
              demoOnly={!geminiAllowed}
              onGenerate={(operatorNotes) => void runSellerGeminiAnalyze(operatorNotes)}
            />
          </div>
          {sellerAnalyzeErr ? (
            <p className="mb-1.5 text-[9px] leading-snug text-amber-800/90" title={sellerAnalyzeErr}>
              {sellerAnalyzeErr}
            </p>
          ) : null}
          <p
            className={
              dense
                ? "mb-0.5 text-[9px] font-medium text-slate-400"
                : "mb-0.5 text-[10px] font-medium text-slate-400"
            }
          >
            {LISTING_ANALYSIS_COMMENT_LABEL}
          </p>
          {readOnly ? (
            <AdminRichCommentReadonly html={v.sellerPortrait} className={pri ? roBox(!!dense) : roDefault} />
          ) : (
            <AdminAiPolishRichCommentShell
              value={v.sellerPortrait}
              onChange={(next) => onChange({ ...v, sellerPortrait: next })}
              disabled={disabled}
              compact={pri && dense}
              aria-label={`${L.sellerPortrait} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
            />
          )}
        </ListingAnalysisSubsectionHeading>

        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.photoAnalysis}
          title={L.photoAnalysis}
          compact={dense}
        >
          <p
            className={
              dense
                ? "mb-0.5 text-[9px] font-medium text-slate-400"
                : "mb-0.5 text-[10px] font-medium text-slate-400"
            }
          >
            {LISTING_ANALYSIS_COMMENT_LABEL}
          </p>
          {readOnly ? (
            <AdminRichCommentReadonly html={v.photoAnalysis} className={pri ? roBox(!!dense) : roDefault} />
          ) : (
            <AdminAiPolishRichCommentShell
              value={v.photoAnalysis}
              onChange={(next) => onChange({ ...v, photoAnalysis: next })}
              disabled={disabled}
              compact={pri && dense}
              aria-label={`${L.photoAnalysis} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
            />
          )}
        </ListingAnalysisSubsectionHeading>

        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.listingPasteRaw}
          title={LISTING_ANALYSIS_LISTING_PASTE_LABEL}
          compact={dense}
        >
          <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-blue-700 bg-blue-600 px-3 py-1.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={readOnly || disabled || analyzing || !v.listingPasteRaw.trim()}
              onClick={() => void runListingAnalyze()}
              title="No iekopētā apraksta ģenerē profesionālu tekstu laukā „Pārdošanas sludinājuma konteksts” (Groq)"
              aria-busy={analyzing}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
              ) : null}
              Ģenerēt pārdošanas kontekstu
            </button>
          </div>
          {analyzeErr ? (
            <p className="mb-1.5 text-[9px] leading-snug text-amber-800/90" title={analyzeErr}>
              {analyzeErr}
            </p>
          ) : null}
          {readOnly ? (
            <div
              className={
                pri
                  ? dense
                    ? "min-h-[32px] whitespace-pre-wrap rounded border border-emerald-100/50 bg-transparent px-1.5 py-1 text-[10px] text-slate-500"
                    : "min-h-[48px] whitespace-pre-wrap rounded-md border border-emerald-100/50 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
                  : "min-h-[48px] whitespace-pre-wrap rounded-md border border-slate-200/40 bg-transparent px-2 py-1.5 text-[11px] text-slate-500"
              }
            >
              {v.listingPasteRaw.trim() || "—"}
            </div>
          ) : (
            <AdminAiPolishTextareaShell
              value={v.listingPasteRaw}
              disabled={disabled}
              onPolished={(next) => onChange({ ...v, listingPasteRaw: next })}
            >
              <textarea
                ref={refPaste}
                className={`${pasteTaClass} ${autoGrow && !readOnly ? "resize-none overflow-hidden" : ""}`}
                disabled={disabled}
                rows={dense ? 2 : 4}
                value={v.listingPasteRaw}
                onChange={(e) => onChange({ ...v, listingPasteRaw: e.target.value })}
                placeholder=""
                aria-label={`${LISTING_ANALYSIS_LISTING_PASTE_LABEL} — ievade analīzei (nav PDF)`}
              />
            </AdminAiPolishTextareaShell>
          )}
        </ListingAnalysisSubsectionHeading>

        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.listingSalesContext}
          title={L.listingSalesContext}
          compact={dense}
        >
          <p
            className={
              dense
                ? "mb-0.5 text-[9px] font-medium text-slate-400"
                : "mb-0.5 text-[10px] font-medium text-slate-400"
            }
          >
            {LISTING_ANALYSIS_COMMENT_LABEL}
          </p>
          {readOnly ? (
            <AdminRichCommentReadonly html={v.listingSalesContext} className={pri ? roBox(!!dense) : roDefault} />
          ) : (
            <AdminAiPolishRichCommentShell
              value={v.listingSalesContext}
              onChange={(next) => onChange({ ...v, listingSalesContext: next })}
              disabled={disabled}
              compact={pri && dense}
              aria-label={`${L.listingSalesContext} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
            />
          )}
        </ListingAnalysisSubsectionHeading>
      </div>
      <AdminGeminiContextRawField
        value={v.geminiContextRaw}
        onChange={(next) => onChange({ ...v, geminiContextRaw: next })}
        readOnly={readOnly}
        disabled={disabled}
        ariaLabel="Sludinājuma analīze — Gemini AI papildu konteksts"
      />
    </div>
  );
}
