"use client";

import { useCallback, useEffect, useState } from "react";
import { loadAdminMessageTemplatesDoc } from "@/components/admin/AdminDealerSendDialog";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { normalizeWhatsAppPhoneDigits } from "@/lib/admin-whatsapp-phone";
import { dealerSendWhatsappUrl } from "@/lib/dealer-send-message";
import { renderTemplateById } from "@/lib/messages/render-template-id";
import { reportReadyVinVar } from "@/lib/messages/template-vars";
import { parseOrderClientMarks, type OrderClientMarks } from "@/lib/order-client-marks";
import {
  GOOGLE_REVIEW_URL,
  reviewAskStatusLine,
  reviewCarObject,
  type ReviewAskSkipReason,
} from "@/lib/review-ask";

type ReviewAskView = {
  plannedAt: string | null;
  skip: ReviewAskSkipReason | null;
  askedAt: string | null;
  car?: string | null;
  lang?: ClientReportLang | null;
};

const btn =
  "min-h-7 rounded-md border border-slate-300 bg-white px-2 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Pasūtījumā: «Atsauksme: lūgta 29.11» / «plānota 27.11» / «nav lūgta (indikators nav zaļš)»,
 * «Nelūgt», «Atcelt», WhatsApp ziņa (sūta Nils) un kopīgais iestatījums «Tikai zaļš indikators».
 */
export function AdminReviewAskPanel({
  sessionId,
  vin,
  phone,
}: {
  sessionId: string;
  vin?: string | null;
  phone?: string | null;
}) {
  const [marks, setMarks] = useState<OrderClientMarks | null>(null);
  const [ask, setAsk] = useState<ReviewAskView | null>(null);
  const [onlyGreen, setOnlyGreen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/admin/order-client-marks?sessionId=${encodeURIComponent(sessionId)}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { marks?: unknown; reviewAsk?: ReviewAskView | null; reviewSettings?: { onlyGreen?: boolean } } | null) => {
        if (!alive || !d) return;
        setMarks(parseOrderClientMarks(d.marks));
        setAsk(d.reviewAsk ?? null);
        setOnlyGreen(d.reviewSettings?.onlyGreen !== false);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/order-client-marks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { marks?: unknown; reviewSettings?: { onlyGreen?: boolean } };
      if (!res.ok) {
        setErr("Neizdevās saglabāt.");
        return null;
      }
      if (data.marks) setMarks(parseOrderClientMarks(data.marks));
      if (data.reviewSettings) setOnlyGreen(data.reviewSettings.onlyGreen !== false);
      return data;
    } catch {
      setErr("Tīkla kļūda.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  if (!marks) return null;

  const asked = marks.reviewRequestedAt ?? ask?.askedAt ?? null;
  const optOut = Boolean(marks.reviewOptOutAt);
  const status = reviewAskStatusLine({
    askedAt: asked,
    optOutAt: marks.reviewOptOutAt ?? null,
    plannedAt: ask?.plannedAt ?? null,
    skip: ask?.skip ?? null,
    channel: marks.reviewRequestChannel ?? null,
  });
  const phoneDigits = normalizeWhatsAppPhoneDigits(phone ?? null);

  const openWhatsapp = async () => {
    const doc = await loadAdminMessageTemplatesDoc();
    const lang = ask?.lang ?? "lv";
    const v = reportReadyVinVar(vin);
    const text =
      renderTemplateById(
        "wa.review_request",
        { vin: v, auto: reviewCarObject(lang, ask?.car ?? null, v), atsauksmes_saite: GOOGLE_REVIEW_URL },
        doc,
        { lang },
      )?.text ?? "";
    window.open(dealerSendWhatsappUrl(phoneDigits, text), "_blank", "noopener,noreferrer");
    if (!asked) void post({ action: "review_request", sessionId, channel: "whatsapp" });
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-[var(--color-apple-text)]">
      <span className="font-medium">{status}</span>
      {!asked ? (
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            disabled={busy}
            checked={optOut}
            onChange={(e) => void post({ action: "review_opt_out", sessionId, optOut: e.target.checked })}
          />
          Nelūgt
        </label>
      ) : null}
      {!asked && !optOut && ask?.plannedAt ? (
        <button type="button" className={btn} disabled={busy} onClick={() => void post({ action: "review_opt_out", sessionId, optOut: true })}>
          Atcelt
        </button>
      ) : null}
      {phoneDigits ? (
        <button type="button" className={btn} disabled={busy} onClick={() => void openWhatsapp()}>
          WhatsApp lūgums
        </button>
      ) : null}
      {onlyGreen != null ? (
        <label className="inline-flex items-center gap-1.5 text-[var(--color-provin-muted)]">
          <input
            type="checkbox"
            disabled={busy}
            checked={onlyGreen}
            onChange={(e) => void post({ action: "review_settings", onlyGreen: e.target.checked })}
          />
          Visiem: tikai zaļš indikators
        </label>
      ) : null}
      {err ? <span className="text-red-600">{err}</span> : null}
    </div>
  );
}
