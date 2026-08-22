"use client";

/**
 * Sludinājuma analīze: Groq pārdošanas konteksts + AI pārdevēja analīze (DEMO).
 */

import { ExternalLink, Loader2 } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { AdminAiPolishRichCommentShell } from "@/components/admin/AdminAiPolishRichCommentShell";
import { AdminAiPolishTextareaShell } from "@/components/admin/AdminAiPolishTextareaShell";
import { AdminAiFieldError } from "@/components/admin/AdminAiFieldError";
import { AdminAiGenerateWithPrefill } from "@/components/admin/AdminAiGenerateWithPrefill";
import { AdminListingAnalysisPhotos } from "@/components/admin/AdminListingAnalysisPhotos";
import { AdminListingPeekTopicChips } from "@/components/admin/AdminListingPeekTopicChips";
import { AdminAiContextRawField } from "@/components/admin/AdminAiContextRawField";
import { AdminRichCommentReadonly } from "@/components/admin/AdminInternalRichCommentEditor";
import { AdminSourceBlockHeader } from "@/components/admin/AdminSourceBlockHeader";
import { AdminSourceCommentField } from "@/components/admin/AdminSourceCommentField";
import { ListingAnalysisSubsectionHeading } from "@/components/admin/AdminListingAnalysisSectionChrome";
import {
  emptyListingAnalysisBlock,
  LISTING_ANALYSIS_COMMENT_LABEL,
  LISTING_ANALYSIS_EXTRA_SELLER_LABEL,
  LISTING_ANALYSIS_LISTING_PASTE_LABEL,
  LISTING_ANALYSIS_SUBSECTIONS,
  type ListingAnalysisBlockState,
} from "@/lib/admin-source-blocks";
import { ADMIN_LISTING_PASTE_RAW_MAX_LEN } from "@/lib/admin-raw-field-limits";
import { LISTING_ANALYSIS_FIELD_LUCIDE } from "@/lib/admin-lucide-registry";
import { aiExpertSourceCommentToRichHtml, adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";
import { LISTING_PEEK_TOPICS, type ListingPeekTone } from "@/lib/listing-peek-comment-presets";
import {
  applyGeneratedAdminAiText,
  parseAdminAiResponse,
  readGeneratedAdminAiText,
} from "@/lib/admin-ai-client-errors";
import { generateAdminAiText } from "@/lib/admin-ai-stream-client";
import { AdminAiStreamPreview } from "@/components/admin/AdminAiStreamPreview";
import type { AiListingCommentField } from "@/lib/admin-ai-listing-field";
import { AI_ADMIN_FIELD_DEFAULT_TIER } from "@/lib/ai-admin-field-defaults";
import type { AiAdminModelTier } from "@/lib/ai-admin-model-tier";
import { isValidHttpUrl } from "@/lib/order-field-validation";

const ta =
  "min-h-[72px] w-full rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] placeholder:text-[var(--admin-field-placeholder)] focus:border-[var(--color-provin-accent)]/60 focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/20";

const PHOTO_PEEK_PHRASES = LISTING_PEEK_TOPICS.find((t) => t.id === "photos")!.phrases;

function photoPeekSelectedTone(html: string): ListingPeekTone | null {
  const plain = adminRichHtmlToPlainText(html).trim();
  return PHOTO_PEEK_PHRASES.find((p) => p.text === plain || plain.includes(p.text))?.tone ?? null;
}

function applyPhotoPeekPhrase(currentHtml: string, phrase: string): string {
  const plain = adminRichHtmlToPlainText(currentHtml).trim();
  const presets = PHOTO_PEEK_PHRASES.map((p) => p.text);
  if (!plain || presets.includes(plain)) return plainTextToMinimalRichHtml(phrase);
  if (plain.includes(phrase)) return currentHtml;
  return `${currentHtml.trim()}<br /><br />${plainTextToMinimalRichHtml(phrase)}`;
}

export type AiListingAnalysisPayload = {
  sessionId: string;
  vin: string | null;
  listingUrl: string | null;
  customerName: string | null;
  notes: string | null;
  sourceBlocks: unknown;
  iriss: string;
  apskatesPlāns: string;
  tehniskoRiskuAnalize: string;
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
  /** AI — ja atļauts šim pasūtījumam (skat. AI_DEMO_ONLY). */
  aiAllowed?: boolean;
  buildAiPayload?: () => AiListingAnalysisPayload;
  sessionId?: string;
  photosPersistenceEnabled?: boolean;
  onListingPhotoGroupsStructuralCommit?: (next: ListingAnalysisBlockState["photoGroups"]) => void;
  /** Pasūtījuma sludinājuma saite — atvēršanai jaunā cilnē pie fotogrāfiju analīzes. */
  listingUrl?: string | null;
};

export function AdminListingAnalysisSourceBlock({
  value,
  readOnly,
  disabled,
  onChange,
  variant = "default",
  compact = false,
  autoGrow = false,
  aiAllowed = true,
  buildAiPayload,
  sessionId,
  photosPersistenceEnabled = false,
  onListingPhotoGroupsStructuralCommit,
  listingUrl,
}: Props) {
  const v = value ?? emptyListingAnalysisBlock();
  const L = LISTING_ANALYSIS_SUBSECTIONS;
  const listingOpenHref = listingUrl?.trim() && isValidHttpUrl(listingUrl.trim()) ? listingUrl.trim() : null;
  const openListingAction = listingOpenHref ? (
    <a
      href={listingOpenHref}
      target="_blank"
      rel="noopener noreferrer"
      title={listingOpenHref}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1 text-[10px] font-medium text-[var(--admin-field-text)] hover:bg-black/[0.03]"
    >
      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
      Atvērt sludinājumu
    </a>
  ) : null;

  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);
  const [sellerAnalyzing, setSellerAnalyzing] = useState(false);
  const [sellerAnalyzePreview, setSellerAnalyzePreview] = useState("");
  const [sellerAnalyzeErr, setSellerAnalyzeErr] = useState<string | null>(null);
  const [listingFieldBusy, setListingFieldBusy] = useState<AiListingCommentField | null>(null);
  const [listingFieldErr, setListingFieldErr] = useState<{
    field: AiListingCommentField;
    msg: string;
  } | null>(null);
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

  const canRunSellerAi =
    aiAllowed &&
    Boolean(buildAiPayload) &&
    (v.extraSellerName.trim().length > 0 || v.listingPasteRaw.trim().length > 0);

  const photoCount = (v.photoGroups ?? []).reduce((n, g) => n + (g.photos?.length ?? 0), 0);
  const canRunPhotoAi =
    aiAllowed && Boolean(buildAiPayload) && (v.listingPasteRaw.trim().length > 0 || photoCount > 0);
  const canRunSalesContextAi =
    aiAllowed && Boolean(buildAiPayload) && v.listingPasteRaw.trim().length > 0;

  const runListingFieldAi = useCallback(
    async (
      field: AiListingCommentField,
      operatorNotes: string,
      modelTier: AiAdminModelTier = AI_ADMIN_FIELD_DEFAULT_TIER.listing,
    ) => {
      if (!buildAiPayload || disabled || readOnly || listingFieldBusy) return;
      if (field === "photoAnalysis" && !canRunPhotoAi) return;
      if (field === "listingSalesContext" && !canRunSalesContextAi) return;
      setListingFieldBusy(field);
      setListingFieldErr(null);
      try {
        const base = buildAiPayload();
        const existing =
          field === "photoAnalysis"
            ? adminRichHtmlToPlainText(v.photoAnalysis).trim()
            : adminRichHtmlToPlainText(v.listingSalesContext).trim();
        const res = await fetch("/api/admin/ai/listing-field-comment", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...base,
            field,
            operatorNotes,
            existingDraftPlain: existing,
            modelTier,
          }),
        });
        const { data, parseFailed } = await parseAdminAiResponse(res);
        const generated = readGeneratedAdminAiText(
          res,
          data,
          parseFailed,
          "AI: neizdevās ģenerēt komentāru",
        );
        if (
          !applyGeneratedAdminAiText(
            generated,
            (text) => {
              const html = aiExpertSourceCommentToRichHtml(text);
              onChange(
                field === "photoAnalysis"
                  ? { ...v, photoAnalysis: html }
                  : { ...v, listingSalesContext: html },
              );
            },
            (error) => setListingFieldErr({ field, msg: error }),
          )
        ) {
          return;
        }
      } catch {
        setListingFieldErr({ field, msg: "AI: neizdevās savienoties" });
      } finally {
        setListingFieldBusy(null);
      }
    },
    [
      buildAiPayload,
      canRunPhotoAi,
      canRunSalesContextAi,
      disabled,
      listingFieldBusy,
      onChange,
      readOnly,
      v,
    ],
  );

  const runSellerAiAnalyze = useCallback(
    async (operatorNotes: string, modelTier: AiAdminModelTier = AI_ADMIN_FIELD_DEFAULT_TIER.seller) => {
      if (!canRunSellerAi || sellerAnalyzing || disabled || readOnly || !buildAiPayload) return;
      setSellerAnalyzing(true);
      setSellerAnalyzeErr(null);
      setSellerAnalyzePreview("");
      try {
        const generated = await generateAdminAiText(
          "/api/admin/ai/seller-analysis",
          {
            ...buildAiPayload(),
            extraSellerName: v.extraSellerName,
            operatorNotes,
            existingDraftPlain: adminRichHtmlToPlainText(v.sellerPortrait).trim(),
            modelTier,
          },
          "AI: neizdevās analizēt pārdevēju",
          { onPreview: setSellerAnalyzePreview },
        );
        applyGeneratedAdminAiText(
          generated,
          (text) => onChange({ ...v, sellerPortrait: aiExpertSourceCommentToRichHtml(text) }),
          setSellerAnalyzeErr,
        );
      } catch {
        setSellerAnalyzeErr("AI: neizdevās savienoties");
      } finally {
        setSellerAnalyzePreview("");
        setSellerAnalyzing(false);
      }
    },
    [buildAiPayload, canRunSellerAi, disabled, onChange, readOnly, sellerAnalyzing, v],
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
        onChange({ ...v, listingSalesContext: aiExpertSourceCommentToRichHtml(data.text) });
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
      <div className={dense ? "space-y-2" : "space-y-2.5"}>
        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.sellerPortrait}
          title={L.sellerPortrait}
          compact={dense}
          action={
            !readOnly ? (
              <AdminAiGenerateWithPrefill
                label="Analizēt Pārdevēju"
                busy={sellerAnalyzing}
                disabled={!canRunSellerAi || readOnly || disabled}
                demoOnly={!aiAllowed}
                recommendedTier={AI_ADMIN_FIELD_DEFAULT_TIER.seller}
                onGenerate={(operatorNotes, modelTier) => void runSellerAiAnalyze(operatorNotes, modelTier)}
              />
            ) : undefined
          }
        >
          <label className="mb-1.5 block min-w-0">
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
          <AdminAiFieldError message={sellerAnalyzeErr} />
          <AdminAiStreamPreview text={sellerAnalyzePreview} />
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
          action={openListingAction}
        >
          {readOnly ? (
            <AdminRichCommentReadonly html={v.photoAnalysis} className={pri ? roBox(!!dense) : roDefault} />
          ) : (
            <>
              <div className="mb-1.5">
                <AdminListingPeekTopicChips
                  topicId="photos"
                  selectedTone={photoPeekSelectedTone(v.photoAnalysis)}
                  disabled={disabled}
                  onSelect={(_tone, text) =>
                    onChange({ ...v, photoAnalysis: applyPhotoPeekPhrase(v.photoAnalysis, text) })
                  }
                />
              </div>
              <AdminSourceCommentField
                label=""
                value={v.photoAnalysis}
                onChange={(next) => onChange({ ...v, photoAnalysis: next })}
                disabled={disabled}
                compact={pri && dense}
                aria-label={`${L.photoAnalysis} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
                ai={{
                  allowed: aiAllowed,
                  busy: listingFieldBusy === "photoAnalysis",
                  error: listingFieldErr?.field === "photoAnalysis" ? listingFieldErr.msg : null,
                  hasSourceData: canRunPhotoAi,
                  onGenerate: (notes, tier) => void runListingFieldAi("photoAnalysis", notes, tier),
                }}
              />
            </>
          )}
          {sessionId && onListingPhotoGroupsStructuralCommit ? (
            <AdminListingAnalysisPhotos
              sessionId={sessionId}
              photoGroups={v.photoGroups ?? []}
              disabled={readOnly || disabled || !photosPersistenceEnabled}
              onPhotoGroupsStructuralCommit={(next) => onListingPhotoGroupsStructuralCommit(next)}
            />
          ) : null}
        </ListingAnalysisSubsectionHeading>

        <ListingAnalysisSubsectionHeading
          icon={LISTING_ANALYSIS_FIELD_LUCIDE.listingPasteRaw}
          title={LISTING_ANALYSIS_LISTING_PASTE_LABEL}
          compact={dense}
        >
          <AdminAiFieldError message={analyzeErr} />
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
              toolbarStart={
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
              }
              onPolished={(next) =>
                onChange({ ...v, listingPasteRaw: next.slice(0, ADMIN_LISTING_PASTE_RAW_MAX_LEN) })
              }
            >
              <textarea
                ref={refPaste}
                className={`${pasteTaClass} ${autoGrow && !readOnly ? "resize-none overflow-hidden" : ""}`}
                disabled={disabled}
                rows={dense ? 2 : 4}
                value={v.listingPasteRaw}
                maxLength={ADMIN_LISTING_PASTE_RAW_MAX_LEN}
                onChange={(e) =>
                  onChange({
                    ...v,
                    listingPasteRaw: e.target.value.slice(0, ADMIN_LISTING_PASTE_RAW_MAX_LEN),
                  })
                }
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
          {readOnly ? (
            <AdminRichCommentReadonly
              html={v.listingSalesContext}
              className={pri ? roBox(!!dense) : roDefault}
            />
          ) : (
            <AdminSourceCommentField
              label=""
              value={v.listingSalesContext}
              onChange={(next) => onChange({ ...v, listingSalesContext: next })}
              disabled={disabled}
              compact={pri && dense}
              aria-label={`${L.listingSalesContext} — ${LISTING_ANALYSIS_COMMENT_LABEL}`}
              ai={{
                allowed: aiAllowed,
                busy: listingFieldBusy === "listingSalesContext",
                error:
                  listingFieldErr?.field === "listingSalesContext" ? listingFieldErr.msg : null,
                hasSourceData: canRunSalesContextAi,
                onGenerate: (notes, tier) =>
                  void runListingFieldAi("listingSalesContext", notes, tier),
              }}
            />
          )}
        </ListingAnalysisSubsectionHeading>
      </div>
      <AdminAiContextRawField
        value={v.aiContextRaw}
        onChange={(next) => onChange({ ...v, aiContextRaw: next })}
        readOnly={readOnly}
        disabled={disabled}
        ariaLabel="Sludinājuma analīze — AI papildu konteksts"
      />
    </div>
  );
}
