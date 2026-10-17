"use client";

import { irissGoogleContactBadgeFromOrder } from "@/lib/iriss-google-contact-ui";
import type { IrissPasutijumsRecord } from "@/lib/iriss-pasutijumi-types";

export function IrissGoogleContactStatusRow({
  rec,
  configured,
  busy = false,
  onRetry,
  buttonClass,
}: {
  rec: IrissPasutijumsRecord;
  configured: boolean;
  busy?: boolean;
  onRetry?: () => void;
  buttonClass: string;
}) {
  const badge = irissGoogleContactBadgeFromOrder(rec, configured);
  const showRetry = Boolean(onRetry && configured && (badge || rec.phone.trim() || rec.email.trim() || rec.clientFirstName.trim()));
  if (!badge && !showRetry) return null;
  const tone =
    badge?.tone === "ok" ? "text-emerald-800" : badge?.tone === "err" ? "text-red-800" : "text-[#6b7280]";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {badge ? <span className={`text-[11.5px] font-medium ${tone}`}>{badge.text}</span> : null}
      {showRetry ? (
        <button type="button" className={buttonClass} disabled={busy} onClick={onRetry}>
          {busy ? "Saglabā…" : "Mēģināt vēlreiz"}
        </button>
      ) : null}
    </div>
  );
}
