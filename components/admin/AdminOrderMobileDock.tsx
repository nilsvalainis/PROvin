"use client";

import { useEffect, useState } from "react";
import {
  Bot,
  FileText,
  MessageSquareText,
  MoreHorizontal,
  Quote,
  Save,
  Sparkles,
  X,
} from "lucide-react";

import { AdminClipboardButton } from "@/components/admin/AdminClipboardButton";
import { AdminVinCopyButton } from "@/components/admin/AdminVinClipboardAndLinks";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
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
  onOpenPhrases: () => void;
  onGoSummary: () => void;
  onGeneratePdf: () => void;
  onGenerateDealerPdf: () => void;
  onGenerateAsvPdf: () => void;
  onGenerateOemPdf: () => void;
  onGeneratePrintInkPdf: () => void;
  vin: string;
  plate: string;
  listingUrl: string | null;
  customerPhone?: string | null;
  onVinCopied: () => void;
};

const dockItem =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[9px] font-medium tracking-wide transition active:opacity-70 disabled:opacity-35";

const sheetRow =
  "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-medium text-[var(--color-apple-text)] transition hover:bg-black/[0.04] disabled:opacity-40 dark:hover:bg-white/[0.06]";

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
  onOpenPhrases,
  onGoSummary,
  onGeneratePdf,
  onGenerateDealerPdf,
  onGenerateAsvPdf,
  onGenerateOemPdf,
  onGeneratePrintInkPdf,
  vin,
  plate,
  listingUrl,
  customerPhone,
  onVinCopied,
}: Props) {
  const [sheet, setSheet] = useState<null | "flash" | "more" | "pdf">(null);
  const listingHref = listingUrl?.trim() && isValidHttpUrl(listingUrl.trim()) ? listingUrl.trim() : null;
  const flashDisabled = !aiAllowed || !workspaceHydrated || prepareDraftBusy || flashMaxBusy;

  const runFlash = (selection: FlashMaxSelection) => {
    setSheet(null);
    onFlashMax(selection);
  };

  const runPdf = (fn: () => void) => {
    setSheet(null);
    fn();
  };

  return (
    <>
      {/* Instagram-stila peldoša kapsula: paceļas virs drošās zonas, noapaļota. */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 md:hidden"
        aria-label="Ātrās darbības"
      >
        <div className="pointer-events-auto flex w-full max-w-md items-stretch gap-0.5 rounded-[1.35rem] border border-black/10 bg-[var(--admin-surface-elevated)]/92 px-1.5 py-1 shadow-[0_8px_28px_rgba(15,23,42,0.18)] backdrop-blur-xl dark:border-white/10 dark:shadow-[0_8px_28px_rgba(0,0,0,0.45)]">
          <button
            type="button"
            className={`${dockItem} ${flashMaxBusy ? "text-[var(--color-provin-accent)]" : "text-[var(--color-apple-text)]"}`}
            disabled={flashDisabled}
            onClick={() => setSheet("flash")}
          >
            <Sparkles className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden />
            {flashMaxBusy ? "…" : "FLASH"}
          </button>
          <button
            type="button"
            className={`${dockItem} ${copilotOpen || copilotBusy ? "text-[var(--color-provin-accent)]" : "text-[var(--color-apple-text)]"}`}
            disabled={!aiAllowed}
            onClick={onOpenCopilot}
          >
            <Bot className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden />
            Copilot
          </button>
          <button
            type="button"
            className={`${dockItem} text-[var(--color-apple-text)]`}
            onClick={() => setSheet("pdf")}
          >
            <FileText className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden />
            PDF
          </button>
          <button
            type="button"
            className={`${dockItem} text-[var(--color-apple-text)]`}
            onClick={() => setSheet("more")}
          >
            <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={1.5} aria-hidden />
            Vairāk
          </button>
        </div>
      </nav>

      {sheet === "flash" ? (
        <Sheet title="FLASH MAX" onClose={() => setSheet(null)}>
          <button type="button" className={sheetRow} onClick={() => runFlash(defaultFlashMaxSelection())}>
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

      {sheet === "pdf" ? (
        <Sheet title="Ģenerēt PDF" onClose={() => setSheet(null)}>
          <button type="button" className={sheetRow} onClick={() => runPdf(onGeneratePdf)}>
            <FileText className="h-4 w-4 shrink-0 text-emerald-600" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">Ģenerēt PDF</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Pilnā PROVIN atskaite</span>
            </span>
          </button>
          <button type="button" className={sheetRow} onClick={() => runPdf(onGenerateDealerPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-sky-600" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">Ģenerēt dīlera PDF</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tikai oficiālā dīlera dati</span>
            </span>
          </button>
          <button type="button" className={sheetRow} onClick={() => runPdf(onGenerateAsvPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-blue-700" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">Ģenerēt ASV PDF</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tikai ASV vēsture</span>
            </span>
          </button>
          <button type="button" className={sheetRow} onClick={() => runPdf(onGenerateOemPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">OEM dīlera PDF</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Oriģinālie API dati bez tulkojuma</span>
            </span>
          </button>
          <button type="button" className={sheetRow} onClick={() => runPdf(onGeneratePrintInkPdf)}>
            <FileText className="h-4 w-4 shrink-0 text-amber-700" strokeWidth={1.5} aria-hidden />
            <span className="min-w-0">
              <span className="block">Drukājamā versija</span>
              <span className="block text-[11px] font-normal text-[var(--color-provin-muted)]">Tumšāks teksts papīra drukai</span>
            </span>
          </button>
        </Sheet>
      ) : null}

      {sheet === "more" ? (
        <Sheet title="Vairāk" onClose={() => setSheet(null)}>
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
            {saveBusy ? "Saglabā…" : "Saglabāt tagad"}
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

          <div className="mt-1 border-t border-[var(--admin-border-subtle)] px-3 pt-3">
            <div className="flex items-center gap-2 text-[11px] text-[var(--color-provin-muted)]">
              <span className="min-w-0 flex-1 truncate font-mono">{vin || "- VIN -"}</span>
              {vin ? <AdminVinCopyButton value={vin} onCopied={onVinCopied} /> : null}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--color-provin-muted)]">
              <span className="min-w-0 flex-1 truncate font-mono">{plate || "- Reģ. nr. -"}</span>
              <AdminClipboardButton
                value={plate}
                titleReady="Kopēt reģistrācijas numuru"
                titleCopied="Kopēts"
                ariaReady="Kopēt reģistrācijas numuru starpliktuvē"
                ariaCopied="Reģistrācijas numurs nokopēts"
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <AdminWhatsAppOpenButton phone={customerPhone ?? ""} />
              {listingHref ? (
                <a
                  href={listingHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-[var(--admin-border-subtle)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-apple-text)]"
                >
                  Sludinājums
                </a>
              ) : null}
            </div>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
