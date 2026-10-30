"use client";

import { Phone } from "lucide-react";
import { IrissGoogleContactStatusRow } from "@/components/admin/IrissGoogleContactStatusRow";
import { IrissOrderSectionSaveButton } from "@/components/admin/IrissOrderSectionSaveButton";
import { irissClientNameInputValue, splitIrissClientNameInput } from "@/lib/iriss-client-name-input";
import { irissOverviewEmailDisplay } from "@/lib/iriss-order-overview-view";
import type { IrissOrderSaveResult } from "@/lib/iriss-order-section-save";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className ?? "h-4 w-4 fill-current"} aria-hidden>
      <path d="M12.04 2C6.55 2 2.1 6.45 2.1 11.94c0 1.93.55 3.81 1.59 5.43L2 22l4.8-1.61a9.9 9.9 0 0 0 5.24 1.5h.01c5.49 0 9.95-4.45 9.95-9.95A9.96 9.96 0 0 0 12.04 2Zm0 18.1h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-2.85.95.95-2.78-.19-.29a8.1 8.1 0 0 1-1.25-4.33c0-4.49 3.65-8.14 8.14-8.14a8.1 8.1 0 0 1 5.76 2.38 8.08 8.08 0 0 1 2.38 5.76c0 4.48-3.65 8.13-8.14 8.13Zm4.46-6.06c-.24-.12-1.43-.7-1.65-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.22a7.34 7.34 0 0 1-1.35-1.67c-.14-.24-.01-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.4 1.37.51.58.18 1.11.15 1.53.09.47-.07 1.43-.58 1.63-1.13.2-.56.2-1.04.14-1.13-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

export function IrissOrderClientDataCard({
  rec,
  fieldClass,
  phoneWarning,
  canCall,
  canEmail,
  busy,
  onPatch,
  onPatchRecord,
  onSave,
  onCall,
  onWhatsapp,
  onEmail,
  googleContactsConfigured,
  googleContactBusy,
  onRetryGoogleContact,
  buttonClass,
  whatsappClass,
}: {
  rec: IrissPasutijumsRecord;
  fieldClass: string;
  phoneWarning: string | null;
  canCall: boolean;
  canEmail: boolean;
  busy: boolean;
  onPatch: <K extends keyof IrissPasutijumsRecord>(key: K, value: IrissPasutijumsRecord[K]) => void;
  onPatchRecord: (patch: Partial<IrissPasutijumsRecord>) => void;
  onSave: () => Promise<IrissOrderSaveResult>;
  onCall: () => void;
  onWhatsapp: () => void;
  onEmail: () => void;
  googleContactsConfigured: boolean;
  googleContactBusy: boolean;
  onRetryGoogleContact?: () => void;
  buttonClass: string;
  whatsappClass: string;
}) {
  return (
    <section className="min-w-0 rounded-[22px] bg-[var(--s1)] p-4 shadow-[var(--sh)]">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--ink3)]">Klienta dati</p>
      <p className="mb-3 text-[12px] text-[var(--ink2)]">Vienā blokā: kontakti un dati. Labo uzreiz, saglabā šeit.</p>
      <div className="grid grid-cols-1 gap-3">
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--iriss-ink-2)]">Vārds, uzvārds</span>
          <input
            className={fieldClass}
            value={irissClientNameInputValue(rec)}
            autoComplete="name"
            onChange={(e) => onPatchRecord(splitIrissClientNameInput(e.target.value))}
          />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--iriss-ink-2)]">Tālrunis</span>
          <input
            className={fieldClass}
            value={rec.phone}
            inputMode="tel"
            autoComplete="tel"
            onChange={(e) => onPatch("phone", e.target.value)}
          />
          {phoneWarning ? <p className="mt-1 text-[11px] text-amber-800">{phoneWarning}</p> : null}
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--iriss-ink-2)]">E-pasts</span>
          <input
            className={fieldClass}
            value={rec.email}
            inputMode="email"
            autoComplete="email"
            placeholder={rec.email.trim() ? undefined : "e-pasts nav norādīts"}
            onChange={(e) => onPatch("email", e.target.value)}
          />
          {rec.email.trim() ? (
            <p className="mt-1 text-[11px] text-[var(--ink3)]">{irissOverviewEmailDisplay(rec.email)}</p>
          ) : null}
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--iriss-ink-2)]">Pasūtījuma datums</span>
          <input
            className={fieldClass}
            type="date"
            value={rec.orderDate}
            onChange={(e) => onPatch("orderDate", e.target.value)}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`${buttonClass} md:hidden`} disabled={!canCall} onClick={onCall}>
          <Phone className="h-3.5 w-3.5" aria-hidden />
          Zvanīt
        </button>
        <button type="button" className={whatsappClass} disabled={!canCall} onClick={onWhatsapp}>
          <WhatsAppGlyph className="h-4 w-4" />
          WhatsApp
        </button>
        {canEmail ? (
          <button type="button" className={buttonClass} onClick={onEmail}>
            E-pasts
          </button>
        ) : null}
      </div>
      <IrissGoogleContactStatusRow
        rec={rec}
        configured={googleContactsConfigured}
        busy={googleContactBusy}
        onRetry={onRetryGoogleContact}
        buttonClass={buttonClass}
      />
      <IrissOrderSectionSaveButton disabled={busy} onSave={onSave} />
    </section>
  );
}
