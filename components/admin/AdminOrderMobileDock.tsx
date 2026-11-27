"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { openWindowSyncThen } from "@/lib/admin-open-window";
import { useAdminOverlayCover } from "@/lib/admin-overlay-cover";
import {
  Bot,
  Eye,
  FileText,
  MessageCircle,
  MessageSquareText,
  Quote,
  Save,
} from "lucide-react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";

import { copyTextToClipboard } from "@/components/admin/AdminClipboardButton";
import { AdminMobileActionDock, type AdminMobileDockStatus } from "@/components/admin/mobile/AdminMobileChrome";
import { fetchAdminWhatsappPrefill } from "@/lib/admin-whatsapp-prefill-client";
import {
  ADMIN_MOBILE_VIN_SCAN_EVENT,
  ADMIN_MOBILE_VIN_SCAN_STATE_EVENT,
  type AdminMobileVinScanState,
} from "@/lib/admin-mobile-ds";
import { normalizeWhatsAppPhoneDigits, whatsAppChatUrl } from "@/lib/admin-whatsapp-phone";
import {
  type FlashMaxSelection,
} from "@/lib/admin-flash-max";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  AdminFlashMaxPanel,
  flashMaxDraftToSelection,
  flashMaxRunnableCount,
  useFlashMaxDraft,
} from "@/components/admin/AdminFlashMaxPanel";
import { AdminResponsiveModal } from "@/components/admin/AdminResponsiveModal";
import { DealerExtraList } from "@/components/admin/AdminDealerExtraMenu";
import type { DealerExtraAvailability, DealerExtraKey } from "@/lib/dealer-pdf-extra";
import {
  DealerSignalsEditor,
  dealerSignalsEditorView,
  dealerSignalsReportTranslate,
} from "@/components/admin/AdminDealerSignalsMenu";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { dealerSignalsSectionOn, regenerateDealerSignals, type DealerSignalKind, type DealerSignalsState } from "@/lib/dealer-signals";
import { isValidHttpUrl } from "@/lib/order-field-validation";

/**
 * Telefona apakšējais doks (Instagram stilā: peldoša kapsula virs drošās zonas).
 * Uz md+ to nav. PDF pogas šeit aizstāj fiksēto kājeni, kas citādi uzkāpa virsū dokam.
 */

type Props = {
  aiAllowed: boolean;
  workspaceHydrated: boolean;
  prepareDraftBusy: boolean;
  flashMaxBusy: boolean;
  onFlashMax: (selection: FlashMaxSelection) => void;
  /** Avotu bloki - lai FLASH MAX logā redzams, kurām sadaļām ir dati. */
  sourceBlocks?: WorkspaceSourceBlocks | null;
  copilotOpen: boolean;
  copilotBusy: boolean;
  onOpenCopilot: () => void;
  onSave: () => void;
  saveBusy: boolean;
  saveFailed?: boolean;
  onOpenPhrases: () => void;
  onGoSummary: () => void;
  onGeneratePdf: () => void;
  onGenerateBusinessPdf: () => void;
  onGenerateBusinessPdfEn: () => void;
  onGenerateBusinessPdfRu: () => void;
  onGenerateBusinessPdfDe: () => void;
  onGenerateDealerPdf: () => void;
  onGenerateDealerPdfEn: () => void;
  onGenerateDealerPdfRu: () => void;
  onGeneratePdfEn: () => void;
  onGeneratePdfRu: () => void;
  onGeneratePdfDe: () => void;
  onGenerateDealerPdfDe: () => void;
  /** Dīlera PDF «+ Extra»: izvēle (lapas stāvoklis) un pieejamās sadaļas. */
  dealerExtra?: readonly DealerExtraKey[];
  onDealerExtraChange?: (next: DealerExtraKey[]) => void;
  getDealerExtraItems?: (selected: readonly DealerExtraKey[]) => DealerExtraAvailability[];
  /** «Signāli ārpus dīlera datiem» (saglabāts workspace). */
  dealerSignals?: DealerSignalsState | null;
  onDealerSignalsChange?: (next: DealerSignalsState) => void;
  detectDealerSignals?: () => DealerSignalKind[];
  /** Signālu priekšskats klienta valodā (+ labotā teksta tulkojums). */
  dealerSignalsPreviewLang?: ClientReportLang;
  dealerSignalsSessionId?: string | null;
  /** «Priekšskats» - nobraukums un negadījumi kā PDF, pilnekrāna logā. */
  onPreview?: () => void;
  pdfProgressKey?: string | null;
  pdfProgressPct?: number | null;
  onGenerateAsvPdf: () => void;
  onGenerateAsvPdfEn: () => void;
  onGenerateAsvPdfRu: () => void;
  onGenerateAsvPdfDe: () => void;
  onGenerateOemPdf: () => void;
  onGeneratePrintInkPdf: () => void;
  /** «Izvilkums» ķeksītis klienta PDF (ūdenszīme, kājenes piezīme). */
  izvilkums?: boolean;
  onIzvilkumsChange?: (next: boolean) => void;
  pdfLangLock?: "lv" | "en" | "ru" | "de" | null;
  onUnlockPdfLang?: () => void;
  vin: string;
  plate: string;
  listingUrl: string | null;
  customerPhone?: string | null;
  whatsappPrefill?: string;
  onVinCopied: () => void;
  onMore?: () => void;
  /** Katra palielināšana atver FLASH MAX izvēli (no izvēlnes „Darbības”). */
  flashRequest?: number;
  flashMaxPhase?: string | null;
  flashMaxNotice?: string | null;
  flashMaxErr?: string | null;
  /** FLASH MAX noslēguma pārbaudes neizlemtie ieteikumi (poga statusā atver sarakstu). */
  finalReviewPending?: number;
  onOpenFinalReview?: () => void;
  /** Katra palielināšana atver PDF izvēli (no «Vairāk» lapas). */
  pdfRequest?: number;
  /** «Sūtīt» joslā (zilā): AUDITS/PRO - «Sūtīt atskaiti» logs; dīlera pasūtījumam - B1 bloks. */
  onSend?: () => void;
  /** Ārējs paziņojums (piem. „Reģ. numurs nokopēts”, maksas avota ielāde). */
  notice?: AdminMobileDockStatus | null;
  onDismissNotice?: () => void;
};

const sheetRow =
  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-[var(--color-apple-text)] transition hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]";

function PdfLangRow({
  progressKey,
  progressPct,
  keys,
  onEn,
  onRu,
  onDe,
  lockLang = null,
}: {
  progressKey?: string | null;
  progressPct?: number | null;
  keys: { en: string; ru: string; de: string };
  onEn: () => void;
  onRu: () => void;
  onDe: () => void;
  lockLang?: "lv" | "en" | "ru" | "de" | null;
}) {
  const chip = (key: string, label: string, lang: "en" | "ru" | "de", onClick: () => void) => {
    const lockedOut = Boolean(lockLang) && lockLang !== lang;
    return (
      <button
        type="button"
        disabled={lockedOut}
        onClick={onClick}
        className="rounded-full border border-[var(--admin-border-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-provin-muted)] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {progressKey === key ? `${progressPct ?? 0}%` : label}
      </button>
    );
  };
  return (
    <details className="mb-1 px-3 pb-1">
      <summary className="cursor-pointer text-[11px] font-medium text-[var(--color-provin-muted)]">EN, RU, DE</summary>
      <div className="mt-1 flex items-center gap-1.5">
        {chip(keys.en, "EN", "en", onEn)}
        {chip(keys.ru, "RU", "ru", onRu)}
        {chip(keys.de, "DE", "de", onDe)}
      </div>
    </details>
  );
}

export function AdminOrderMobileDock({
  aiAllowed,
  workspaceHydrated,
  prepareDraftBusy,
  flashMaxBusy,
  onFlashMax,
  copilotOpen,
  copilotBusy,
  onOpenCopilot,
  onSave,
  saveBusy,
  saveFailed = false,
  onOpenPhrases,
  onGoSummary,
  onGeneratePdf,
  onGenerateBusinessPdf,
  onGenerateBusinessPdfEn,
  onGenerateBusinessPdfRu,
  onGenerateBusinessPdfDe,
  onGenerateDealerPdf,
  onGenerateDealerPdfEn,
  onGenerateDealerPdfRu,
  onGeneratePdfEn,
  onGeneratePdfRu,
  onGeneratePdfDe,
  onGenerateDealerPdfDe,
  dealerExtra = [],
  onDealerExtraChange,
  getDealerExtraItems,
  dealerSignals,
  onDealerSignalsChange,
  detectDealerSignals,
  dealerSignalsPreviewLang = "lv",
  dealerSignalsSessionId = null,
  onPreview,
  pdfProgressKey = null,
  pdfProgressPct = null,
  onGenerateAsvPdf,
  onGenerateAsvPdfEn,
  onGenerateAsvPdfRu,
  onGenerateAsvPdfDe,
  onGenerateOemPdf,
  onGeneratePrintInkPdf,
  izvilkums,
  onIzvilkumsChange,
  pdfLangLock = null,
  onUnlockPdfLang,
  vin,
  plate,
  listingUrl,
  customerPhone,
  whatsappPrefill,
  onVinCopied,
  onMore,
  sourceBlocks,
  flashRequest = 0,
  pdfRequest = 0,
  onSend,
  flashMaxPhase = null,
  flashMaxNotice = null,
  flashMaxErr = null,
  finalReviewPending = 0,
  onOpenFinalReview,
  notice = null,
  onDismissNotice,
}: Props) {
  const [sheet, setSheet] = useState<null | "flash" | "more" | "pdf">(null);
  const [extraOpen, setExtraOpen] = useState(false);
  const [signalsOpen, setSignalsOpen] = useState(false);
  const signalsTranslate = useMemo(
    () => (dealerSignalsSessionId ? dealerSignalsReportTranslate(dealerSignalsSessionId) : null),
    [dealerSignalsSessionId],
  );
  const signalsView = useMemo(
    () =>
      sheet === "pdf" && signalsOpen && detectDealerSignals
        ? dealerSignalsEditorView(dealerSignals, detectDealerSignals)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, signalsOpen, dealerSignals],
  );
  const extraItems = useMemo(
    () => (sheet === "pdf" && extraOpen && getDealerExtraItems ? getDealerExtraItems(dealerExtra) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheet, extraOpen, dealerExtra],
  );
  const flashDraft = useFlashMaxDraft();
  const [localNotice, setLocalNotice] = useState<AdminMobileDockStatus | null>(null);
  const [flashResultHidden, setFlashResultHidden] = useState(false);
  const noticeTimer = useRef<number | null>(null);
  const showLocal = useCallback((next: AdminMobileDockStatus | null, ms = 0) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = null;
    setLocalNotice(next);
    if (next && ms > 0) noticeTimer.current = window.setTimeout(() => setLocalNotice(null), ms);
  }, []);
  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  // „Darbības” → FLASH MAX: atver izvēli, nevis uzreiz palaiž bez redzama progresa.
  useEffect(() => {
    if (flashRequest > 0) setSheet("flash");
  }, [flashRequest]);

  useEffect(() => {
    if (pdfRequest > 0) setSheet("pdf");
  }, [pdfRequest]);
  // Jauns FLASH MAX rezultāts - rādām vēlreiz.
  useEffect(() => {
    if (flashMaxBusy) setFlashResultHidden(false);
  }, [flashMaxBusy]);

  useEffect(() => {
    const onState = (e: Event) => {
      const d = (e as CustomEvent<AdminMobileVinScanState>).detail;
      if (!d) return;
      if (d.phase === "running") showLocal({ text: "VIN SCAN: pārbauda bezmaksas avotus…", busy: true });
      else if (d.phase === "done")
        showLocal({ text: `VIN SCAN pabeigts: ${d.found} no ${d.total} avotiem ar informāciju.`, tone: "ok" }, 5000);
      else showLocal({ text: "VIN SCAN neizdevās. Mēģini vēlreiz.", tone: "error" }, 6000);
    };
    document.addEventListener(ADMIN_MOBILE_VIN_SCAN_STATE_EVENT, onState);
    return () => document.removeEventListener(ADMIN_MOBILE_VIN_SCAN_STATE_EVENT, onState);
  }, [showLocal]);

  const flashStatus: AdminMobileDockStatus | null = flashMaxBusy
    ? { text: flashMaxPhase?.trim() || "FLASH MAX: ģenerē tekstus…", busy: true }
    : flashResultHidden
      ? null
      : flashMaxErr
        ? { text: flashMaxErr, tone: "error" }
        : flashMaxNotice
          ? {
              text: flashMaxNotice,
              tone: "ok",
              ...(finalReviewPending > 0 && onOpenFinalReview
                ? { action: { label: `Skatīt (${finalReviewPending})`, onClick: onOpenFinalReview } }
                : {}),
            }
          : null;
  const dockStatus = flashStatus ?? notice ?? localNotice;
  const dockCovered = useAdminOverlayCover();
  useEffect(() => {
    if (dockCovered) setSheet(null);
  }, [dockCovered]);
  const listingHref = listingUrl?.trim() && isValidHttpUrl(listingUrl.trim()) ? listingUrl.trim() : null;
  const flashDisabled = !aiAllowed || !workspaceHydrated || prepareDraftBusy || flashMaxBusy;
  const whatsappDigits = useMemo(() => normalizeWhatsAppPhoneDigits(customerPhone ?? ""), [customerPhone]);

  const flashCount = sheet === "flash" ? flashMaxRunnableCount(flashDraft, sourceBlocks) : 0;
  const runFlash = () => {
    if (flashCount === 0) return;
    setSheet(null);
    onFlashMax(flashMaxDraftToSelection(flashDraft, sourceBlocks));
  };

  const runPdf = (fn: () => void) => {
    setSheet(null);
    fn();
  };
  const lockedPdf = (lv: () => void, en: () => void, ru: () => void, de: () => void) => {
    if (pdfLangLock === "en") return en;
    if (pdfLangLock === "ru") return ru;
    if (pdfLangLock === "de") return de;
    return lv;
  };

  const copyVin = async () => {
    const v = vin.trim();
    if (!v) return;
    if (await copyTextToClipboard(v)) {
      onVinCopied();
      showLocal({ text: `VIN nokopēts: ${v}`, tone: "ok" }, 2500);
    } else {
      showLocal({ text: "Neizdevās nokopēt VIN.", tone: "error" }, 4000);
    }
  };

  const runFreeVinScan = () => {
    try {
      document.dispatchEvent(new CustomEvent(ADMIN_MOBILE_VIN_SCAN_EVENT, { detail: { vin: vin.trim() } }));
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      {dockCovered ? null : (
        <AdminMobileActionDock
          actions={[
            { id: "vin", label: "Kopēt VIN", icon: "kopet", onClick: () => void copyVin(), disabled: !vin.trim() },
            { id: "scan", label: "VIN SCAN", icon: "vinParbaude", onClick: runFreeVinScan, disabled: !vin.trim() },
            {
              id: "pdf",
              label: pdfProgressKey ? `${pdfProgressPct ?? 0}%` : "PDF",
              icon: "pdf",
              onClick: () => setSheet("pdf"),
              disabled: pdfProgressKey !== null,
            },
            // 22.11 makets v2: «Sūtīt» joslā; «Sludinājums» pārcelts uz «Vairāk» lapu.
            onSend
              ? { id: "send", label: "Sūtīt", icon: "sutit" as const, onClick: onSend, primary: true }
              : {
                  id: "listing",
                  label: "Sludinājums",
                  icon: "sludinajums" as const,
                  href: listingHref ?? undefined,
                  disabled: !listingHref,
                },
          ]}
          glass
          more={() => {
            if (onMore) onMore();
            else setSheet("more");
          }}
          status={dockStatus}
          onDismissStatus={() => {
            if (flashStatus) setFlashResultHidden(true);
            else if (notice) onDismissNotice?.();
            else showLocal(null);
          }}
        />
      )}

      {/* 17.11: tas pats izvēles saturs kā datorā (sadaļas, platums, modelis, piezīmes); tukšās sadaļas izķeksētas. */}
      <AdminResponsiveModal
        open={sheet === "flash" && !dockCovered}
        title="FLASH MAX"
        onClose={() => setSheet(null)}
        zClass="z-[70]"
        footer={
          <>
            <button
              type="button"
              className="min-h-11 rounded-full bg-slate-100 px-4 text-[15px] font-semibold text-slate-700"
              onClick={() => setSheet(null)}
            >
              Atcelt
            </button>
            <button
              type="button"
              className="min-h-11 flex-1 rounded-full bg-teal-600 px-4 text-[15px] font-semibold text-white disabled:opacity-45"
              disabled={flashDisabled || flashCount === 0}
              onClick={runFlash}
            >
              Ģenerēt {flashCount}
            </button>
          </>
        }
      >
        {flashDisabled ? (
          <p className="pb-2 text-[13px] leading-snug text-[#b42318]">
            {!aiAllowed
              ? "AI šim pasūtījumam nav atļauts."
              : flashMaxBusy
                ? "FLASH MAX jau darbojas."
                : "Pasūtījums vēl ielādējas. Pagaidi dažas sekundes."}
          </p>
        ) : null}
        <AdminFlashMaxPanel draft={flashDraft} sourceBlocks={sourceBlocks} busy={flashDisabled} size="touch" />
      </AdminResponsiveModal>

      {sheet === "pdf" && !dockCovered ? (
        <AdminMobileSheet open title="Ģenerēt PDF" onClose={() => setSheet(null)}>
          {onIzvilkumsChange ? (
            <label className={`${sheetRow} cursor-pointer select-none`}>
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-slate-300 text-[var(--color-provin-accent)]"
                checked={izvilkums === true}
                onChange={(e) => onIzvilkumsChange(e.target.checked)}
              />
              <span>Izvilkums</span>
            </label>
          ) : null}
          {pdfLangLock && onUnlockPdfLang ? (
            <button type="button" className={`${sheetRow} text-[var(--color-provin-muted)]`} onClick={onUnlockPdfLang}>
              Mainīt valodu ({pdfLangLock.toUpperCase()})
            </button>
          ) : null}
          <button
            type="button"
            className={sheetRow}
            onClick={() => runPdf(lockedPdf(onGeneratePdf, onGeneratePdfEn, onGeneratePdfRu, onGeneratePdfDe))}
          >
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-apple-text)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">{pdfProgressKey === "pdf" ? `${pdfProgressPct ?? 0}%` : "Ģenerēt PDF"}</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Pilnā PROVIN atskaite</span>
            </span>
          </button>
          <PdfLangRow
            progressKey={pdfProgressKey}
            progressPct={pdfProgressPct}
            keys={{ en: "pdf-en", ru: "pdf-ru", de: "pdf-de" }}
            lockLang={pdfLangLock}
            onEn={() => runPdf(onGeneratePdfEn)}
            onRu={() => runPdf(onGeneratePdfRu)}
            onDe={() => runPdf(onGeneratePdfDe)}
          />
          <button
            type="button"
            className={sheetRow}
            onClick={() =>
              runPdf(lockedPdf(onGenerateBusinessPdf, onGenerateBusinessPdfEn, onGenerateBusinessPdfRu, onGenerateBusinessPdfDe))
            }
          >
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">{pdfProgressKey === "business" ? `${pdfProgressPct ?? 0}%` : "Ģenerēt BUSINESS PDF"}</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">
                Virsraksts Business Datu atskaite
              </span>
            </span>
          </button>
          <PdfLangRow
            progressKey={pdfProgressKey}
            progressPct={pdfProgressPct}
            keys={{ en: "business-en", ru: "business-ru", de: "business-de" }}
            lockLang={pdfLangLock}
            onEn={() => runPdf(onGenerateBusinessPdfEn)}
            onRu={() => runPdf(onGenerateBusinessPdfRu)}
            onDe={() => runPdf(onGenerateBusinessPdfDe)}
          />
          <button
            type="button"
            className={sheetRow}
            onClick={() =>
              runPdf(lockedPdf(onGenerateDealerPdf, onGenerateDealerPdfEn, onGenerateDealerPdfRu, onGenerateDealerPdfDe))
            }
          >
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">{pdfProgressKey === "dealer" ? `${pdfProgressPct ?? 0}%` : "Ģenerēt dīlera PDF"}</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tikai oficiālā dīlera dati</span>
            </span>
          </button>
          {onDealerExtraChange && getDealerExtraItems ? (
            <div data-mobile-dealer-extra>
              <button
                type="button"
                className={`${sheetRow} pl-10`}
                aria-expanded={extraOpen}
                onClick={() => setExtraOpen((v) => !v)}
              >
                <span className="min-w-0 flex-1">+ Extra</span>
                {dealerExtra.length > 0 ? (
                  <span className="rounded-full bg-[var(--color-provin-accent)] px-2 text-[11px] font-bold leading-[18px] text-white tabular-nums">
                    {dealerExtra.length}
                  </span>
                ) : null}
                <span aria-hidden className="text-[var(--color-provin-muted)]">{extraOpen ? "▴" : "▾"}</span>
              </button>
              {extraOpen ? (
                <div className="pb-1 pl-7">
                  <DealerExtraList
                    size="touch"
                    items={extraItems}
                    selected={dealerExtra}
                    onToggle={(key, on) => {
                      const set = new Set(dealerExtra);
                      if (on) set.add(key);
                      else set.delete(key);
                      onDealerExtraChange([...set]);
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {onDealerSignalsChange && detectDealerSignals ? (
            <div data-mobile-dealer-signals>
              <button
                type="button"
                className={`${sheetRow} pl-10`}
                aria-expanded={signalsOpen}
                onClick={() => setSignalsOpen((v) => !v)}
              >
                <span className="min-w-0 flex-1">Signāli</span>
                {dealerSignalsSectionOn(dealerSignals) ? (
                  <span aria-label="Ir PDF" className="h-2.5 w-2.5 rounded-full bg-[#047857]" />
                ) : null}
                <span aria-hidden className="text-[var(--color-provin-muted)]">{signalsOpen ? "▴" : "▾"}</span>
              </button>
              {signalsOpen && signalsView ? (
                <div className="pb-2 pl-4">
                  <DealerSignalsEditor
                    size="touch"
                    state={signalsView}
                    previewLang={dealerSignalsPreviewLang}
                    translate={signalsTranslate}
                    onChange={onDealerSignalsChange}
                    onRegenerate={() =>
                      onDealerSignalsChange(regenerateDealerSignals(signalsView, detectDealerSignals(), { keepEdits: false }))
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <PdfLangRow
            progressKey={pdfProgressKey}
            progressPct={pdfProgressPct}
            keys={{ en: "dealer-en", ru: "dealer-ru", de: "dealer-de" }}
            lockLang={pdfLangLock}
            onEn={() => runPdf(onGenerateDealerPdfEn)}
            onRu={() => runPdf(onGenerateDealerPdfRu)}
            onDe={() => runPdf(onGenerateDealerPdfDe)}
          />
          <button
            type="button"
            className={sheetRow}
            onClick={() => runPdf(lockedPdf(onGenerateAsvPdf, onGenerateAsvPdfEn, onGenerateAsvPdfRu, onGenerateAsvPdfDe))}
          >
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">{pdfProgressKey === "asv" ? `${pdfProgressPct ?? 0}%` : "Ģenerēt ASV PDF"}</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tikai ASV vēsture</span>
            </span>
          </button>
          <PdfLangRow
            progressKey={pdfProgressKey}
            progressPct={pdfProgressPct}
            keys={{ en: "asv-en", ru: "asv-ru", de: "asv-de" }}
            lockLang={pdfLangLock}
            onEn={() => runPdf(onGenerateAsvPdfEn)}
            onRu={() => runPdf(onGenerateAsvPdfRu)}
            onDe={() => runPdf(onGenerateAsvPdfDe)}
          />
          <button type="button" className={sheetRow} onClick={() => runPdf(onGenerateOemPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">OEM dīlera PDF</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Oriģinālie API dati bez tulkojuma</span>
            </span>
          </button>
          {onPreview ? (
            <button type="button" className={sheetRow} data-mobile-report-preview onClick={() => runPdf(onPreview)}>
              <Eye className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
              <span className="block">Priekšskats</span>
            </button>
          ) : null}
          <button type="button" className={sheetRow} onClick={() => runPdf(onGeneratePrintInkPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">{pdfProgressKey === "ink" ? `${pdfProgressPct ?? 0}%` : "Drukājamā versija"}</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tumšāks teksts papīra drukai</span>
            </span>
          </button>
        </AdminMobileSheet>
      ) : null}

      {sheet === "more" && !dockCovered ? (
        <AdminMobileSheet open title="Vairāk" onClose={() => setSheet(null)}>
          <button
            type="button"
            className={sheetRow}
            disabled={!whatsappDigits}
            onClick={() => {
              if (!whatsappDigits) return;
              setSheet(null);
              const opened = openWindowSyncThen();
              void (async () => {
                const message =
                  whatsappPrefill ??
                  (await fetchAdminWhatsappPrefill({ templateId: "wa.report_ready.audits" }));
                if (message) opened.navigate(whatsAppChatUrl(whatsappDigits, message));
                else opened.close();
              })();
            }}
          >
            <MessageCircle className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            WhatsApp
          </button>
          <button
            type="button"
            className={sheetRow}
            disabled={!aiAllowed}
            onClick={() => {
              setSheet(null);
              onOpenCopilot();
            }}
          >
            <Bot className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            Copilot{copilotOpen || copilotBusy ? "…" : ""}
          </button>
          <button
            type="button"
            className={sheetRow}
            disabled={!workspaceHydrated || saveBusy}
            onClick={() => {
              setSheet(null);
              onSave();
            }}
          >
            <Save className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            {saveBusy ? "Saglabā…" : saveFailed ? "Nav saglabāts!" : "Saglabāt tagad"}
          </button>
          <button
            type="button"
            className={sheetRow}
            onClick={() => {
              setSheet(null);
              onGoSummary();
            }}
          >
            <MessageSquareText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            Pāriet uz kopsavilkumu
          </button>
          <button
            type="button"
            className={sheetRow}
            onClick={() => {
              setSheet(null);
              onOpenPhrases();
            }}
          >
            <Quote className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            Biežās frāzes
          </button>
        </AdminMobileSheet>
      ) : null}
    </>
  );
}
