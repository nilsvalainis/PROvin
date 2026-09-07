"use client";

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
  "inline-flex h-7 w-full items-center justify-center rounded-md border border-black/10 bg-white/50 px-1 text-[9px] font-semibold text-[var(--color-apple-text)] shadow-sm backdrop-blur-sm transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40";

function vinTail(vin: string): string {
  const t = vin.trim();
  if (!t) return "";
  return t.slice(-6);
}

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
  const vinShort = vinTail(vin);

  return (
    <aside
      className="pointer-events-none fixed right-1.5 top-28 z-30 hidden w-[4.5rem] flex-col gap-1 lg:flex"
      aria-label="Ātrās darbības"
    >
      <div className="pointer-events-auto flex flex-col gap-1 rounded-lg border border-white/40 bg-white/40 p-1 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-zinc-900/40">
        <div className="flex flex-col items-center gap-0.5 px-0.5">
          <span className="font-mono text-[8px] leading-none tracking-tight" title={vin || "VIN"}>
            {vinShort || "VIN"}
          </span>
          {vin ? <AdminVinCopyButton value={vin} onCopied={onVinCopied} /> : null}
        </div>
        <div className="flex flex-col items-center gap-0.5 px-0.5">
          <span className="max-w-full truncate font-mono text-[8px] leading-none" title={plate || "Reģ. nr."}>
            {plate || "Reģ."}
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
            ss.lv
          </a>
        ) : (
          <span className={`${railBtn} cursor-not-allowed opacity-40`} title="Nav sludinājuma saites">
            ss.lv
          </span>
        )}
        <AdminOrderCopilotTrigger
          compact
          open={copilotOpen}
          busy={copilotBusy}
          disabled={!aiAllowed}
          onOpen={onOpenCopilot}
        />
        {aiAllowed ? (
          <AdminFlashMaxButton
            compact
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
