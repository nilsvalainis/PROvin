"use client";

import type { HTMLAttributes, ReactNode, RefObject } from "react";
import { messageTemplatesDocFromOverrides } from "@/lib/messages/shared-block-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";

/**
 * Kopīgā klienta sūtīšanas loga čaula (Nils 27.11): dīlera «Sūtīt klientam» un AUDITS «Sūtīt atskaiti».
 * Tikai izkārtojums - fons, virsma, galvene, ritināmā daļa un piestiprinātā pogu josla (telefonā ar drošo zonu).
 * Portālu uz body un telefona doka slēpšanu dara pats logs (`createPortal`, `useHoldAdminOverlayCover`).
 * `wide` - AUDITS forma datorā (2 kolonnas, līdz 1060 px); dīlera logs paliek šaurs (max-w-lg).
 */

export const clientSendSegClass = (on: boolean) =>
  `min-h-9 flex-1 rounded-md px-2 text-[12px] font-medium transition ${
    on ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-slate-600 hover:text-slate-900"
  }`;
export const clientSendBtnClass =
  "min-h-9 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
export const clientSendPrimaryClass =
  "min-h-9 rounded-md border border-transparent bg-[#1d1d1f] px-4 text-[12px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50";
export const clientSendWaBtnClass =
  "min-h-9 rounded-md border border-transparent bg-[#1f9d55] px-4 text-[12px] font-semibold text-white hover:bg-[#178246] disabled:cursor-not-allowed disabled:opacity-50";
export const clientSendLabelClass =
  "amx-mut mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]";

let templatesDocCache: MessageTemplatesDoc | null = null;

/** Sinhroni - jau ielādētais šablonu dokuments (pirmajai renderēšanai). */
export function cachedAdminMessageTemplatesDoc(): MessageTemplatesDoc | null {
  return templatesDocCache;
}

export async function loadAdminMessageTemplatesDoc(): Promise<MessageTemplatesDoc | null> {
  if (templatesDocCache) return templatesDocCache;
  try {
    const res = await fetch("/api/admin/message-templates", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { templates?: { id: string; override?: { subject?: string; body: string } | null }[] };
    const overrides: Record<string, { subject?: string; body: string }> = {};
    for (const t of data.templates ?? []) if (t.override?.body) overrides[t.id] = t.override;
    templatesDocCache = messageTemplatesDocFromOverrides(overrides);
    return templatesDocCache;
  } catch {
    return null;
  }
}

export type ClientSendChannel = "email" | "whatsapp";

/** Kanāls E-pasts / WhatsApp (telefonā WhatsApp ar zaļu ikonu). */
export function ClientSendChannelTabs({
  channel,
  onChange,
  disabled,
}: {
  channel: ClientSendChannel;
  onChange: (c: ClientSendChannel) => void;
  disabled?: boolean;
}) {
  return (
    <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Kanāls">
      {(["email", "whatsapp"] as const).map((c) => (
        <button
          key={c}
          type="button"
          role="tab"
          aria-selected={channel === c}
          className={clientSendSegClass(channel === c)}
          {...(disabled ? { disabled: true } : {})}
          onClick={() => onChange(c)}
        >
          {c === "whatsapp" ? (
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="mr-1.5 hidden h-[17px] w-[17px] align-[-3px] max-md:inline-block"
              fill="none"
              stroke="#1c8a4d"
              strokeWidth={1.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 20l1.3-4A8 8 0 118 18.7z" />
            </svg>
          ) : null}
          {c === "email" ? "E-pasts" : "WhatsApp"}
        </button>
      ))}
    </div>
  );
}

/** Temats (tikai e-pastam) + «Kam: …». */
export function ClientSendSubjectField({
  id,
  value,
  onChange,
  disabled,
  recipient,
  recipientLabel = "Kam",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  recipient: string;
  recipientLabel?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={clientSendLabelClass}>
        Temats
      </label>
      <input
        id={id}
        className="amx-fld w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] text-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
      <p className="amx-mut mt-0.5 truncate text-[11px] text-slate-500 max-md:mt-1 max-md:text-[13px]">
        {recipientLabel}: {recipient.trim() || <span className="text-rose-600">nav e-pasta</span>}
      </p>
    </div>
  );
}

/** Ziņas teksts (rediģējams; nekas netiek iezīmēts automātiski). */
export function ClientSendTextField({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className={clientSendLabelClass}>
        Teksts
      </label>
      <textarea
        id={id}
        spellCheck={false}
        className="amx-fld amx-fld--ta min-h-[220px] w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] leading-relaxed text-slate-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

type ShellProps = {
  /** Datu atribūts testiem / stiliem: `data-<kind>-send-dialog`, `data-<kind>-send-footer`. */
  kind: "dealer" | "audit";
  titleId: string;
  title: string;
  /** Čipi blakus virsrakstam (piem. «PROVIN AUDITS», «B2B · diskrēts»). */
  titleExtra?: ReactNode;
  /** Rinda zem virsraksta (VIN, saņēmējs, «Vecā forma»). */
  subtitle: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  /** Fona klikšķa aizvēršana (`useModalBackdropClose`). */
  backdropProps?: HTMLAttributes<HTMLDivElement>;
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** Pogu josla apakšā (piestiprināta, telefonā virs drošās zonas). */
  footer: ReactNode;
  wide?: boolean;
  children: ReactNode;
};

/**
 * 22.11 (Nils, dators): portālā uz body logs manto vietnes tumšās tēmas baltu teksta krāsu (--site-body-fg),
 * tāpēc krāsas šeit norādītas tieši.
 */
export function AdminClientSendShell({
  kind,
  titleId,
  title,
  titleExtra,
  subtitle,
  onClose,
  closeDisabled,
  backdropProps,
  scrollRef,
  footer,
  wide = false,
  children,
}: ShellProps) {
  const dialogAttr = { [`data-${kind}-send-dialog`]: true };
  const footerAttr = { [`data-${kind}-send-footer`]: true };
  const panel = wide
    ? "amx amx-surface flex h-full max-h-[100dvh] w-full flex-col bg-white md:text-slate-900 sm:h-auto sm:max-h-[min(94vh,860px)] sm:max-w-[1060px] sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-xl"
    : "amx amx-surface flex h-full max-h-[100dvh] w-full flex-col bg-white md:text-slate-900 sm:h-auto sm:max-h-[min(92vh,760px)] sm:max-w-lg sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-xl";
  const heading = (
    <h3 id={titleId} className="amx-tx text-[15px] font-semibold text-slate-900 max-md:text-[17px]">
      {title}
    </h3>
  );
  return (
    <div
      {...dialogAttr}
      className="fixed inset-0 z-[80] flex bg-black/40 sm:items-center sm:justify-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      {...backdropProps}
    >
      <div className={panel} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 max-md:items-center max-md:border-b-0 max-md:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            {titleExtra ? (
              <div className="flex flex-wrap items-center gap-2">
                {heading}
                {titleExtra}
              </div>
            ) : (
              heading
            )}
            {subtitle}
          </div>
          <button
            type="button"
            aria-label="Aizvērt"
            className="h-8 w-8 rounded-md text-[18px] leading-none text-slate-500 hover:bg-slate-100 max-md:h-11 max-md:w-11 max-md:shrink-0 max-md:rounded-full max-md:border max-md:border-[var(--amx-edge)] max-md:bg-[var(--amx-glass)] max-md:text-[22px] max-md:text-[var(--amx-tx)]"
            disabled={closeDisabled}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div
          ref={scrollRef}
          className={
            wide
              ? "min-h-0 flex-1 overflow-y-auto px-4 py-3"
              : "min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 max-md:space-y-2.5"
          }
        >
          {children}
        </div>

        <div
          {...footerAttr}
          className="sticky bottom-0 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] amx-dock"
        >
          {footer}
        </div>
      </div>
    </div>
  );
}
