"use client";

import { useState } from "react";
import { IrissOfferDeadlineField } from "@/components/admin/IrissOfferDeadlineField";
import {
  buildIrissOfferClientLinkMailto,
  buildIrissOfferClientLinkMessage,
  buildIrissOfferClientLinkWhatsAppUrl,
  formatIrissOfferLinkStamp,
  type IrissOfferClientLinkAdminView,
} from "@/lib/iriss-offer-client-link";
import { offerDeadlineRemainingLv } from "@/lib/iriss-offer-deadline-ui";
import { IRISS_OFFER_DEADLINE_MIN_LEAD_MS, formatOfferDeadlineLv, normalizeOfferValidUntilAt } from "@/lib/iriss-offer-valid-until";

const miniBtn =
  "inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-[13px] font-semibold text-[var(--color-apple-text)] disabled:opacity-40";

function statusClass(status: IrissOfferClientLinkAdminView["status"]): string {
  if (status === "approved") return "bg-emerald-50 text-emerald-800";
  if (status === "declined") return "bg-rose-50 text-rose-800";
  if (status === "answered") return "bg-amber-50 text-amber-900";
  if (status === "viewed") return "bg-sky-50 text-sky-900";
  if (status === "expired") return "bg-slate-200 text-slate-700";
  return "bg-slate-100 text-slate-600";
}

export function IrissOfferClientLinkBar({
  offerId,
  link,
  phone,
  email,
  vehicle,
  busy,
  deadlineAt = "",
  onCreate,
  onRevoke,
  onExtend,
}: {
  offerId: string;
  link: IrissOfferClientLinkAdminView | null;
  phone: string;
  email: string;
  vehicle: string;
  busy: boolean;
  /** Piedāvājuma termiņš (validUntilAt) - jaunai saitei obligāts. */
  deadlineAt?: string;
  onCreate: (expiresInDays: number | null) => void;
  onRevoke: () => void;
  onExtend?: (validUntilAt: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendIso, setExtendIso] = useState<string | null>(null);
  const deadline = normalizeOfferValidUntilAt(deadlineAt);
  const deadlineMs = deadline ? Date.parse(deadline) : null;
  // Jaunai saitei termiņš obligāts un nākotnē (>= 5 min); API saderībai vēl pieņem arī vecās saites bez termiņa.
  const deadlineReady = deadlineMs != null && deadlineMs >= Date.now() + IRISS_OFFER_DEADLINE_MIN_LEAD_MS;
  const canExtend = Boolean(onExtend && link && link.status !== "revoked" && !link.decision);
  const showExtendField = canExtend && (extendOpen || link?.status === "expired");
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
          {until && link.status !== "revoked" && !deadline ? <span>līdz {until}</span> : null}
        </p>
      ) : null}
      {deadline && link?.status !== "revoked" ? (
        <p className="text-[12px] text-[var(--color-provin-muted)]">
          Termiņš {formatOfferDeadlineLv(deadline)}
          {link && !link.decision && deadlineMs != null ? ` · ${offerDeadlineRemainingLv(deadlineMs, Date.now())}` : ""}
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
          {canExtend && link.status !== "expired" && !extendOpen ? (
            <button type="button" className={miniBtn} disabled={busy} onClick={() => setExtendOpen(true)}>
              Pagarināt
            </button>
          ) : null}
          <button type="button" className={miniBtn} disabled={busy} onClick={onRevoke}>
            Atsaukt
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          <button
            type="button"
            className={miniBtn}
            disabled={busy || !deadlineReady}
            onClick={() => onCreate(null)}
          >
            {busy ? "Veido…" : link ? "Jauna saite" : "Izveidot saiti"}
          </button>
          {!deadlineReady ? (
            <p className="text-[12px] text-amber-800">
              {deadlineMs != null ? "Termiņš beidzies - ievadi jaunu" : "Vispirms ievadi piedāvājuma termiņu"} (Labot - Cenas) un saglabā.
            </p>
          ) : null}
        </div>
      )}
      {showExtendField ? (
        <div className="space-y-2 rounded-xl bg-slate-50 p-3">
          <IrissOfferDeadlineField
            idPrefix={`iriss-offer-extend-${offerId}`}
            label="Jauns termiņš"
            initial={{}}
            disabled={busy}
            onChange={({ iso }) => setExtendIso(iso)}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-[#373b45] px-4 text-[14px] font-semibold text-white disabled:opacity-40"
              disabled={busy || !extendIso}
              onClick={() => {
                if (!extendIso || !onExtend) return;
                onExtend(extendIso);
                setExtendOpen(false);
              }}
            >
              Pagarināt
            </button>
            {extendOpen && link?.status !== "expired" ? (
              <button type="button" className={miniBtn} disabled={busy} onClick={() => setExtendOpen(false)}>
                Atcelt
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
