"use client";

import { ExternalLink } from "lucide-react";
import { AdminClipboardButton } from "@/components/admin/AdminClipboardButton";
import { AdminFlashMaxButton } from "@/components/admin/AdminFlashMaxButton";
import { AdminVinCopyButton } from "@/components/admin/AdminVinClipboardAndLinks";
import { AdminOrderCopilotTrigger } from "@/components/admin/AdminOrderCopilotPanel";
import type { FlashMaxSelection } from "@/lib/admin-flash-max";
import { isValidHttpUrl } from "@/lib/order-field-validation";

type Props = {
  vin: string;
  plate: string;
  listingUrl: string | null;
  aiAllowed: boolean;
  workspaceHydrated: boolean;
  prepareDraftBusy: boolean;
  flashMaxBusy: boolean;
  flashMaxPhase: string | null;
  flashMaxNotice: string | null;
  flashMaxErr: string | null;
  onFlashMax: (selection: FlashMaxSelection) => void;
  copilotOpen: boolean;
  copilotBusy: boolean;
  onOpenCopilot: () => void;
  onVinCopied: () => void;
};

const railBtn =
  "inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1.5 text-[10px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/[0.06]";

/** Darbvirsmas labā mala: VIN / reģ. nr. / ss.lv / Copilot / FLASH MAX. Mobilajā nav. */
export function AdminOrderStickyActionRail({
  vin,
  plate,
  listingUrl,
  aiAllowed,
  workspaceHydrated,
  prepareDraftBusy,
  flashMaxBusy,
  flashMaxPhase,
  flashMaxNotice,
  flashMaxErr,
  onFlashMax,
  copilotOpen,
  copilotBusy,
  onOpenCopilot,
  onVinCopied,
}: Props) {
  const listingHref = listingUrl?.trim() && isValidHttpUrl(listingUrl.trim()) ? listingUrl.trim() : null;

  return (
    <aside
      className="pointer-events-none fixed right-2 top-28 z-30 hidden w-[8.5rem] flex-col gap-1.5 lg:flex"
      aria-label="Ātrās darbības"
    >
      <div className="pointer-events-auto flex flex-col gap-1.5 rounded-xl border border-[var(--admin-border-subtle)] bg-[var(--admin-nav-bg)]/95 p-1.5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between gap-1 px-0.5">
          <span className="min-w-0 truncate font-mono text-[8px]" title={vin || "VIN"}>
            {vin || "VIN"}
          </span>
          {vin ? <AdminVinCopyButton value={vin} onCopied={onVinCopied} /> : null}
        </div>
        <div className="flex items-center justify-between gap-1 px-0.5">
          <span className="min-w-0 truncate font-mono text-[8px]" title={plate || "Reģ. nr."}>
            {plate || "Reģ. nr."}
          </span>
          <AdminClipboardButton
            value={plate}
            titleReady="Kopēt reģistrācijas numuru"
            titleCopied="Kopēts"
            ariaReady="Kopēt reģistrācijas numuru starpliktuvē"
            ariaCopied="Reģistrācijas numurs nokopēts"
          />
        </div>
        {listingHref ? (
          <a
            href={listingHref}
            target="_blank"
            rel="noopener noreferrer"
            className={railBtn}
            title={listingHref}
          >
            <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            ss.lv
          </a>
        ) : (
          <span className={`${railBtn} cursor-not-allowed opacity-40`} title="Nav sludinājuma saites">
            ss.lv
          </span>
        )}
        <AdminOrderCopilotTrigger
          open={copilotOpen}
          busy={copilotBusy}
          disabled={!aiAllowed}
          onOpen={onOpenCopilot}
        />
        {aiAllowed ? (
          <AdminFlashMaxButton
            menuAlign="end"
            disabled={!workspaceHydrated || prepareDraftBusy}
            busy={flashMaxBusy}
            phase={flashMaxPhase}
            notice={flashMaxNotice}
            error={flashMaxErr}
            onRun={onFlashMax}
          />
        ) : null}
      </div>
    </aside>
  );
}
