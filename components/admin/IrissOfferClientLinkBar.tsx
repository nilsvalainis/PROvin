"use client";

import { useState } from "react";
import {
  IRISS_OFFER_LINK_EXPIRY_DAY_CHOICES,
  buildIrissOfferClientLinkMailto,
  buildIrissOfferClientLinkMessage,
  buildIrissOfferClientLinkWhatsAppUrl,
  formatIrissOfferLinkStamp,
  type IrissOfferClientLinkAdminView,
} from "@/lib/iriss-offer-client-link";

const miniBtn =
  "inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[var(--color-apple-text)] disabled:opacity-40";

function statusClass(status: IrissOfferClientLinkAdminView["status"]): string {
  if (status === "approved") return "bg-emerald-50 text-emerald-800";
  if (status === "declined") return "bg-rose-50 text-rose-800";
  if (status === "answered") return "bg-amber-50 text-amber-900";
  if (status === "viewed") return "bg-sky-50 text-sky-900";
  return "bg-slate-100 text-slate-600";
}

export function IrissOfferClientLinkBar({
  offerId,
  link,
  phone,
  email,
  vehicle,
  busy,
  onCreate,
  onRevoke,
}: {
  offerId: string;
  link: IrissOfferClientLinkAdminView | null;
  phone: string;
  email: string;
  vehicle: string;
  busy: boolean;
  onCreate: (expiresInDays: number | null) => void;
  onRevoke: () => void;
}) {
  const [days, setDays] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const active = Boolean(link && link.status !== "revoked");
  const stamp = link ? formatIrissOfferLinkStamp(link.statusAt) : "";
  const until = link?.expiresAt ? formatIrissOfferLinkStamp(link.expiresAt) : "";

  function shareMessage() {
    if (!link) return null;
    const url = `${window.location.origin}${link.path}`;
    return { url, message: buildIrissOfferClientLinkMessage({ url, vehicle }) };
  }

  return (
    <div className="space-y-2 border-t border-slate-100 pt-2">
      {link ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-snug text-[var(--color-provin-muted)]">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${statusClass(link.status)}`}>{link.statusLabel}</span>
          {stamp ? <span>{stamp}</span> : null}
          {link.viewCount > 0 ? <span>{link.viewCount}×</span> : null}
          {until && link.status !== "revoked" ? <span>līdz {until}</span> : null}
        </p>
      ) : null}
      {link?.question ? (
        <p className="line-clamp-2 text-[12px] leading-snug text-[var(--color-apple-text)]">{link.question}</p>
      ) : null}
      {active && link ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={miniBtn}
            disabled={busy}
            onClick={() => {
              const packed = shareMessage();
              if (!packed) return;
              void navigator.clipboard.writeText(packed.url).then(
                () => {
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                },
                () => setCopied(false),
              );
            }}
          >
            {copied ? "Nokopēts" : "Kopēt saiti"}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-full bg-[#25D366] px-3 text-[13px] font-semibold text-white disabled:opacity-40"
            disabled={busy}
            onClick={() => {
              const packed = shareMessage();
              if (!packed) return;
              const href = buildIrissOfferClientLinkWhatsAppUrl(phone, packed.message.text);
              window.open(href, "_blank", "noopener,noreferrer");
            }}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className={miniBtn}
            disabled={busy || !email.trim()}
            onClick={() => {
              const packed = shareMessage();
              if (!packed || !email.trim()) return;
              window.location.href = buildIrissOfferClientLinkMailto(email, packed.message);
            }}
          >
            E-pasts
          </button>
          <button type="button" className={miniBtn} disabled={busy} onClick={onRevoke}>
            Atsaukt
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`iriss-offer-link-days-${offerId}`}>
            Saites termiņš
          </label>
          <select
            id={`iriss-offer-link-days-${offerId}`}
            className="h-9 rounded-full border border-slate-200 bg-white px-2 text-[13px]"
            value={days}
            aria-label="Saites termiņš"
            disabled={busy}
            onChange={(e) => setDays(e.target.value)}
          >
            <option value="">Bez termiņa</option>
            {IRISS_OFFER_LINK_EXPIRY_DAY_CHOICES.map((choice) => (
              <option key={choice} value={String(choice)}>
                {choice} dienas
              </option>
            ))}
          </select>
          <button
            type="button"
            className={miniBtn}
            disabled={busy}
            onClick={() => onCreate(days ? Number.parseInt(days, 10) : null)}
          >
            {busy ? "Veido…" : link ? "Jauna saite" : "Izveidot saiti"}
          </button>
        </div>
      )}
    </div>
  );
}
