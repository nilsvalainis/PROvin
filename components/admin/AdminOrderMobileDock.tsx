"use client";

import { useEffect, useMemo, useState } from "react";
import { openWindowSyncThen } from "@/lib/admin-open-window";
import { useAdminOverlayCover } from "@/lib/admin-overlay-cover";
import { useAdminScrollLock } from "@/lib/admin-scroll-lock";
import {
  Bot,
  FileText,
  MessageCircle,
  MessageSquareText,
  Quote,
  Save,
  Sparkles,
  X,
} from "lucide-react";

import { copyTextToClipboard } from "@/components/admin/AdminClipboardButton";
import { AdminMobileActionDock } from "@/components/admin/mobile/AdminMobileChrome";
import { fetchAdminWhatsappPrefill } from "@/lib/admin-whatsapp-prefill-client";
import { ADMIN_MOBILE_VIN_SCAN_EVENT } from "@/lib/admin-mobile-ds";
import { normalizeWhatsAppPhoneDigits, whatsAppChatUrl } from "@/lib/admin-whatsapp-phone";
import {
  defaultFlashMaxSelection,
  summaryOnlyFlashMaxSelection,
  type FlashMaxSelection,
} from "@/lib/admin-flash-max";
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
  pdfProgressKey?: string | null;
  pdfProgressPct?: number | null;
  onGenerateAsvPdf: () => void;
  onGenerateAsvPdfEn: () => void;
  onGenerateAsvPdfRu: () => void;
  onGenerateAsvPdfDe: () => void;
  onGenerateOemPdf: () => void;
  onGeneratePrintInkPdf: () => void;
  vin: string;
  plate: string;
  listingUrl: string | null;
  customerPhone?: string | null;
  whatsappPrefill?: string;
  onVinCopied: () => void;
  onMore?: () => void;
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
}: {
  progressKey?: string | null;
  progressPct?: number | null;
  keys: { en: string; ru: string; de: string };
  onEn: () => void;
  onRu: () => void;
  onDe: () => void;
}) {
  const chip = (key: string, label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--admin-border-subtle)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-provin-muted)]"
    >
      {progressKey === key ? `${progressPct ?? 0}%` : label}
    </button>
  );
  return (
    <details className="mb-1 px-3 pb-1">
      <summary className="cursor-pointer text-[11px] font-medium text-[var(--color-provin-muted)]">EN, RU, DE</summary>
      <div className="mt-1 flex items-center gap-1.5">
        {chip(keys.en, "EN", onEn)}
        {chip(keys.ru, "RU", onRu)}
        {chip(keys.de, "DE", onDe)}
      </div>
    </details>
  );
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useAdminScrollLock(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label={title}>
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-black/40"
        aria-label="Aizvērt"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300/80" aria-hidden />
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[13px] font-semibold text-[var(--color-apple-text)]">{title}</p>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--color-provin-muted)] transition hover:bg-black/[0.05] dark:hover:bg-white/[0.06]"
            aria-label="Aizvērt"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          </button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto px-2 pb-2">{children}</div>
      </div>
    </div>
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
  pdfProgressKey = null,
  pdfProgressPct = null,
  onGenerateAsvPdf,
  onGenerateAsvPdfEn,
  onGenerateAsvPdfRu,
  onGenerateAsvPdfDe,
  onGenerateOemPdf,
  onGeneratePrintInkPdf,
  vin,
  plate,
  listingUrl,
  customerPhone,
  whatsappPrefill,
  onVinCopied,
  onMore,
}: Props) {
  const [sheet, setSheet] = useState<null | "flash" | "more" | "pdf">(null);
  const dockCovered = useAdminOverlayCover();
  useEffect(() => {
    if (dockCovered) setSheet(null);
  }, [dockCovered]);
  const listingHref = listingUrl?.trim() && isValidHttpUrl(listingUrl.trim()) ? listingUrl.trim() : null;
  const flashDisabled = !aiAllowed || !workspaceHydrated || prepareDraftBusy || flashMaxBusy;
  const whatsappDigits = useMemo(() => normalizeWhatsAppPhoneDigits(customerPhone ?? ""), [customerPhone]);

  const runFlash = (selection: FlashMaxSelection) => {
    setSheet(null);
    onFlashMax(selection);
  };

  const runPdf = (fn: () => void) => {
    setSheet(null);
    fn();
  };

  const copyVin = async () => {
    const v = vin.trim();
    if (!v) return;
    if (await copyTextToClipboard(v)) onVinCopied();
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
              onClick: onGeneratePdf,
              disabled: pdfProgressKey !== null,
            },
            {
              id: "listing",
              label: "Sludinājums",
              icon: "sludinajums",
              href: listingHref ?? undefined,
              disabled: !listingHref,
            },
          ]}
          more={() => {
            if (onMore) onMore();
            else setSheet("more");
          }}
        />
      )}

      {sheet === "flash" && !dockCovered ? (
        <Sheet title="FLASH MAX" onClose={() => setSheet(null)}>
          <button type="button" className={sheetRow} disabled={flashDisabled} onClick={() => runFlash(defaultFlashMaxSelection())}>
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">Ikdienas komplekts</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">
                Visi avotu komentāri, riski, apskate un kopsavilkums
              </span>
            </span>
          </button>
          <button type="button" className={sheetRow} onClick={() => runFlash(summaryOnlyFlashMaxSelection())}>
            <MessageSquareText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">Tikai kopsavilkums</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">
                Pārģenerē noslēguma tekstus, avotus neaiztiek
              </span>
            </span>
          </button>
          <p className="px-3 py-2 text-[11px] leading-relaxed text-[var(--color-provin-muted)]">
            Pilna aģentu izvēle ar modeļiem pieejama uz datora.
          </p>
        </Sheet>
      ) : null}

      {sheet === "pdf" && !dockCovered ? (
        <Sheet title="Ģenerēt PDF" onClose={() => setSheet(null)}>
          <button type="button" className={sheetRow} onClick={() => runPdf(onGeneratePdf)}>
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
            onEn={() => runPdf(onGeneratePdfEn)}
            onRu={() => runPdf(onGeneratePdfRu)}
            onDe={() => runPdf(onGeneratePdfDe)}
          />
          <button type="button" className={sheetRow} onClick={() => runPdf(onGenerateBusinessPdf)}>
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
            onEn={() => runPdf(onGenerateBusinessPdfEn)}
            onRu={() => runPdf(onGenerateBusinessPdfRu)}
            onDe={() => runPdf(onGenerateBusinessPdfDe)}
          />
          <button type="button" className={sheetRow} onClick={() => runPdf(onGenerateDealerPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">{pdfProgressKey === "dealer" ? `${pdfProgressPct ?? 0}%` : "Ģenerēt dīlera PDF"}</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tikai oficiālā dīlera dati</span>
            </span>
          </button>
          <PdfLangRow
            progressKey={pdfProgressKey}
            progressPct={pdfProgressPct}
            keys={{ en: "dealer-en", ru: "dealer-ru", de: "dealer-de" }}
            onEn={() => runPdf(onGenerateDealerPdfEn)}
            onRu={() => runPdf(onGenerateDealerPdfRu)}
            onDe={() => runPdf(onGenerateDealerPdfDe)}
          />
          <button type="button" className={sheetRow} onClick={() => runPdf(onGenerateAsvPdf)}>
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
          <button type="button" className={sheetRow} onClick={() => runPdf(onGeneratePrintInkPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-[var(--color-provin-muted)]" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">{pdfProgressKey === "ink" ? `${pdfProgressPct ?? 0}%` : "Drukājamā versija"}</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tumšāks teksts papīra drukai</span>
            </span>
          </button>
        </Sheet>
      ) : null}

      {sheet === "more" && !dockCovered ? (
        <Sheet title="Vairāk" onClose={() => setSheet(null)}>
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
        </Sheet>
      ) : null}
    </>
  );
}
