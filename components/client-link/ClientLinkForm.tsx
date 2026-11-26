"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  formatClientLinkAmount,
  formatClientLinkExpiryLong,
  type ClientLinkPublicView,
} from "@/lib/client-link";
import { clientLinkCopy, clientLinkLegalHrefs } from "@/lib/client-link-i18n";
import {
  getVinOrPlateErrorKind,
  isValidVin,
  normalizeVin,
  sanitizeVinInput,
} from "@/lib/order-field-validation";
import { followStripeCheckoutUrl, trackMetaLead } from "@/lib/meta-pixel";

const inputClass =
  "mt-1.5 min-h-12 w-full rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-4 text-[16px] text-[#1d1d1f] outline-none placeholder:text-[#aeaeb2] focus:border-[#1d1d1f] focus:bg-white";


export function ClientLinkForm({ token, view }: { token: string; view: ClientLinkPublicView }) {
  const [email, setEmail] = useState(view.prefillEmail);
  const [vin, setVin] = useState(view.prefillVin);
  const [listingUrl, setListingUrl] = useState(view.prefillListingUrl);
  const [phone, setPhone] = useState(view.prefillPhone);
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const c = clientLinkCopy(view.lang);
  const fieldError: Record<string, string> = c.errors;
  const legal = clientLinkLegalHrefs(view.lang);
  const until = formatClientLinkExpiryLong(view.expiresAt);
  const amount = formatClientLinkAmount(view.amountCents);
  const vinHint = useMemo(() => {
    const n = normalizeVin(vin);
    if (!n) return c.vinHint(0);
    if (isValidVin(n) && n.length === 17) return c.vinHint(17);
    return c.vinHint(Math.min(n.length, 17));
  }, [vin, c]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const n = sanitizeVinInput(vin);
      if (view.require.vin || n) {
        const kind = getVinOrPlateErrorKind(n);
        if (kind === "vinLength") {
          setError(fieldError.vin_length);
          setLoading(false);
          return;
        }
        if (kind) {
          setError(fieldError.vin);
          setLoading(false);
          return;
        }
      }
      if (isValidVin(n) || n.length >= 3) trackMetaLead();
      const res = await fetch("/api/client-link/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          email,
          vin: n,
          listingUrl,
          phone,
          withdrawalConsent: consent,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        eventId?: string;
        value?: number;
        error?: string;
      };
      if (!res.ok || !followStripeCheckoutUrl(data)) {
        setError(fieldError[data.error ?? ""] ?? fieldError.session_failed);
        return;
      }
    } catch {
      setError(fieldError.network);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form lang={view.lang} onSubmit={(e) => void onSubmit(e)} className="mx-auto w-full max-w-[420px] px-4 pb-10 pt-2">
      <header className="mb-8 flex items-center justify-between px-1">
        <p className="text-[17px] font-bold tracking-tight text-[#1d1d1f]">PROVIN</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#aeaeb2]">PROVIN AUDITS</p>
      </header>

      <h1 className="text-[28px] font-bold leading-tight tracking-tight text-[#1d1d1f]">{view.productName}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-[#6e6e73]">
        {c.intro}
      </p>

      <section className="mt-6 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">{c.yourData}</p>
        {view.require.email ? (
          <label className="mt-3 block">
            <span className="text-[14px] font-semibold text-[#1d1d1f]">{c.email}</span>
            <input
              className={inputClass}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder={c.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        ) : null}
        {view.require.vin ? (
          <label className="mt-3 block">
            <span className="text-[14px] font-semibold text-[#1d1d1f]">{c.vin}</span>
            <input
              className={`${inputClass} uppercase`}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder="WBA..."
              value={vin}
              onChange={(e) => setVin(sanitizeVinInput(e.target.value))}
              onPaste={(e) => {
                e.preventDefault();
                setVin(sanitizeVinInput(e.clipboardData.getData("text")));
              }}
            />
            <span className="mt-1 block text-[12px] text-[#aeaeb2]">{vinHint}</span>
          </label>
        ) : null}
        {view.require.listingUrl ? (
          <label className="mt-3 block">
            <span className="text-[14px] font-semibold text-[#1d1d1f]">{c.listing}</span>
            <input
              className={inputClass}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://..."
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
            />
          </label>
        ) : null}
        {view.require.phone ? (
          <label className="mt-3 block">
            <span className="text-[14px] font-semibold text-[#1d1d1f]">{c.phone}</span>
            <input
              className={inputClass}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+371 ..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
        ) : null}
      </section>

      <section className="mt-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8e8e93]">{c.payment}</p>
        <div className="mt-3 flex items-start justify-between gap-3 text-[15px] text-[#1d1d1f]">
          <span>{view.productName.replace(/\sPRO$/i, " · PRO")}</span>
          <span>{amount}</span>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[#f2f2f7] pt-3 text-[16px] font-bold text-[#1d1d1f]">
          <span>{c.total}</span>
          <span>{amount}</span>
        </div>
      </section>

      <label className="mt-4 flex items-start gap-2.5 px-0.5 text-[12px] leading-snug text-[#6e6e73]">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d2d2d7]"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>
          {c.consent[0]}
          <Link href={legal.terms} className="underline" target="_blank">
            {c.consent[1]}
          </Link>
          {c.consent[2]}
          <Link href={legal.privacy} className="underline" target="_blank">
            {c.consent[3]}
          </Link>
          {c.consent[4]}
        </span>
      </label>

      {error ? <p className="mt-3 text-[13px] font-medium text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#22c55e] text-[17px] font-bold text-white shadow-sm transition hover:bg-[#16a34a] disabled:opacity-60"
      >
        {loading ? c.submitting : c.submit}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[#aeaeb2]">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        {c.secure}
      </p>
      <p className="mt-8 text-center text-[12px] leading-relaxed text-[#aeaeb2]">
        {c.validUntil(until)}
        <br />
        {c.afterPay}
      </p>
    </form>
  );
}
