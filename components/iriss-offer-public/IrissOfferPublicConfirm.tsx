"use client";

import { useEffect, useRef } from "react";
import { IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";

const btn =
  "inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50";

/** Apstiprinājuma solis: telefonā apakšējā lapa, datorā dialogs. */
export function IrissOfferPublicConfirm({
  action,
  vehicle,
  total,
  busy,
  onCancel,
  onConfirm,
}: {
  action: "approve" | "decline";
  vehicle: string;
  total: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const approve = action === "approve";
  const title = approve ? IRISS_OFFER_PUBLIC_LABELS.confirmApproveTitle : IRISS_OFFER_PUBLIC_LABELS.confirmDeclineTitle;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
      <button type="button" aria-label={IRISS_OFFER_PUBLIC_LABELS.cancel} className="absolute inset-0 cursor-default" onClick={busy ? undefined : onCancel} tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="iriss-offer-confirm-title"
        className="relative w-full max-w-[520px] rounded-t-3xl bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-xl sm:rounded-3xl sm:px-6 sm:pb-6 sm:pt-6"
      >
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[#d1d1d6] sm:hidden" aria-hidden="true" />
        <h2 id="iriss-offer-confirm-title" className="text-center text-[19px] font-bold text-[#111827]">
          {title}
        </h2>
        {vehicle || total ? (
          <div className="mt-3 flex items-baseline justify-between gap-3 rounded-xl border border-[#e4e4e7] px-3 py-2.5 text-[14px]">
            <span className="min-w-0 truncate text-[#111827]">{vehicle}</span>
            {total ? <span className="shrink-0 font-bold text-[#111827]">{total}</span> : null}
          </div>
        ) : null}
        <p className="mt-3 text-center text-[13px] text-[#52525b]">{IRISS_OFFER_PUBLIC_LABELS.confirmNote}</p>
        <div className="mt-4 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={`${btn} bg-white text-[#1d1d1f] shadow-[inset_0_0_0_1px_#d1d1d6]`}
          >
            {IRISS_OFFER_PUBLIC_LABELS.cancel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`${btn} ${approve ? "bg-[#F26522] text-white" : "bg-[#1d1d1f] text-white"}`}
          >
            {approve ? IRISS_OFFER_PUBLIC_LABELS.confirmApprove : IRISS_OFFER_PUBLIC_LABELS.confirmDecline}
          </button>
        </div>
      </div>
    </div>
  );
}
