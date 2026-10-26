"use client";

import { useState } from "react";
import { IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";

const btn =
  "inline-flex h-12 min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-[15px] font-semibold disabled:opacity-50";

/** Klienta «Apstiprināt» (Piedāvājumu plūsma). Vizuāli `/p/` IrissOfferPublicActions stilā. */
export function PdApproveForm({ token, needsContact }: { token: string; needsContact: boolean }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function approve() {
    setErr("");
    if (needsContact && (name.trim().length < 2 || phone.replace(/\D/g, "").length < 6)) {
      setErr("Ievadiet vārdu un tālruni.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/iriss-piedavajums/respond", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, name, phone }),
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (data.ok) setDone(true);
      else if (data.error === "closed") setErr("Piedāvājums vairs nav spēkā.");
      else if (data.error === "contact") setErr("Ievadiet vārdu un tālruni.");
      else setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } catch {
      setErr(IRISS_OFFER_PUBLIC_LABELS.sendFailed);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-[#ecfdf3] px-4 py-5 text-center" role="status">
        <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-[#047857] text-white" aria-hidden="true">
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M5 10.5l3.2 3.2L15 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-[17px] font-bold text-[#047857]">{IRISS_OFFER_PUBLIC_LABELS.approvedTitle}</p>
        <p className="mt-1 text-[13px] text-[#52525b]">{IRISS_OFFER_PUBLIC_LABELS.contactSoon}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {needsContact ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block text-[13px] font-medium" htmlFor="pd-name">
            Vārds, uzvārds
            <input
              id="pd-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[16px] outline-none focus:border-[#F26522]"
            />
          </label>
          <label className="block text-[13px] font-medium" htmlFor="pd-phone">
            Tālrunis
            <input
              id="pd-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              inputMode="tel"
              className="mt-1 w-full rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[16px] outline-none focus:border-[#F26522]"
            />
          </label>
        </div>
      ) : null}
      {err ? (
        <p className="text-center text-[14px] font-medium text-[#1d1d1f]" role="alert">
          {err}
        </p>
      ) : null}
      <button type="button" className={`${btn} w-full bg-[#F26522] text-white`} disabled={busy} onClick={() => void approve()}>
        {busy ? "Sūta..." : IRISS_OFFER_PUBLIC_LABELS.approve}
      </button>
    </div>
  );
}
