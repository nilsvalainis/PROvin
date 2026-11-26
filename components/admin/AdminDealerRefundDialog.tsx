"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useHoldAdminOverlayCover } from "@/lib/admin-overlay-cover";
import { loadAdminMessageTemplatesDoc } from "@/components/admin/AdminDealerSendDialog";
import { dealerStripeRefundButtonLabel, dealerStripeRefundErrorLv, type DealerRefundChannel } from "@/lib/admin-dealer-data-refund";
import { submitDealerStripeRefund } from "@/lib/admin-dealer-refund-submit";
import { CLIENT_REPORT_LANGS, type ClientReportLang } from "@/lib/client-report-i18n";
import type { DealerDataJob } from "@/lib/dealer-data-job-types";
import { buildDealerSendMessage, dealerSendWhatsappUrl } from "@/lib/dealer-send-message";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import type { OrderClientMarks } from "@/lib/order-client-marks";
import { formatEurFromCents } from "@/lib/order-upsell";
import { openWindowSyncThen } from "@/lib/admin-open-window";

/**
 * «Atgriezt maksājumu» logs (Nils 26.11): tieši kā atskaites sūtīšanas logs - summa, kanāls,
 * klienta valodā sagatavots temats un teksts (labojams), priekšskats. Nauda atgriežas un ziņa
 * aiziet TIKAI pēc pogas «Atgriezt X € un nosūtīt». Ja Stripe neizdodas - nekas netiek sūtīts.
 */

type Prep = {
  allowed: boolean;
  reason?: string;
  amountCents: number | null;
  lang: ClientReportLang;
  customerEmail: string;
  vin: string;
  override: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  vin: string;
  customerEmail: string;
  customerPhoneDigits?: string | null;
  /** Pēc veiksmīgas atmaksas (pirms atgriešanās uz pasūtījumu sarakstu). */
  onRefunded: (job: DealerDataJob | null, marks: OrderClientMarks | null, notice: string) => void;
};

const LANG_LABEL: Record<ClientReportLang, string> = { lv: "LV", en: "EN", ru: "RU", de: "DE" };

const seg = (on: boolean) =>
  `min-h-9 flex-1 rounded-md px-2 text-[12px] font-medium transition ${
    on ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-slate-600 hover:text-slate-900"
  }`;
const btn =
  "min-h-9 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const danger =
  "min-h-9 rounded-md border border-transparent bg-[#c62828] px-4 text-[12px] font-semibold text-white hover:bg-[#a51f1f] disabled:cursor-not-allowed disabled:opacity-50";

/** Pasūtījumu saraksts - turp atgriežas pēc veiksmīgas atmaksas (kā pēc «Sūtīt klientam»). */
export const DEALER_REFUND_DONE_HREF = "/admin/dashboard";

export function AdminDealerRefundDialog({ open, onClose, sessionId, vin, customerEmail, customerPhoneDigits, onRefunded }: Props) {
  const [prep, setPrep] = useState<Prep | null>(null);
  const [prepErr, setPrepErr] = useState<string | null>(null);
  const [doc, setDoc] = useState<MessageTemplatesDoc | null>(null);
  const [channel, setChannel] = useState<DealerRefundChannel>("email");
  const [lang, setLang] = useState<ClientReportLang>("lv");
  const [email, setEmail] = useState(customerEmail);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [edited, setEdited] = useState(false);
  const [busy, setBusy] = useState<null | "refund" | "preview" | "resend">(null);
  const [err, setErr] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  /** Atmaksa jau izdevās, bet e-pasts nē: poga sūta tikai e-pastu (naudu otrreiz neaiztiek). */
  const [refundedNoEmail, setRefundedNoEmail] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setPrep(null);
    setPrepErr(null);
    setErr(null);
    setPreview(null);
    setEdited(false);
    setRefundedNoEmail(false);
    setChannel("email");
    setEmail(customerEmail);
    void loadAdminMessageTemplatesDoc().then((d) => d && setDoc(d));
    void fetch(`/api/admin/dealer-data/refund?sessionId=${encodeURIComponent(sessionId)}`, { credentials: "include", cache: "no-store" })
      .then(async (r) => ({ ok: r.ok, body: (await r.json().catch(() => ({}))) as Partial<Prep> & { error?: string } }))
      .then(({ ok, body }) => {
        if (!ok) {
          setPrepErr(dealerStripeRefundErrorLv(body.error));
          return;
        }
        const l = (CLIENT_REPORT_LANGS as readonly string[]).includes(String(body.lang)) ? (body.lang as ClientReportLang) : "lv";
        setPrep({
          allowed: body.allowed === true,
          reason: body.reason,
          amountCents: typeof body.amountCents === "number" ? body.amountCents : null,
          lang: l,
          customerEmail: body.customerEmail ?? "",
          vin: body.vin ?? "",
          override: body.override === true,
        });
        setLang(l);
        if (!customerEmail.trim() && body.customerEmail) setEmail(body.customerEmail);
      })
      .catch(() => setPrepErr("Neizdevās sazināties ar serveri."));
  }, [open, sessionId, customerEmail]);

  const amountCents = prep?.amountCents ?? null;
  const carVin = (prep?.vin || vin || "").trim();

  // Klienta valodā sagatavots teksts no veidnes; pārģenerē, kamēr Nils nav sācis labot.
  useEffect(() => {
    if (!open || !prep || edited) return;
    const m = buildDealerSendMessage({ channel, situation: "no_data", b2b: false, vin: carVin, refundCents: amountCents, doc, lang });
    setSubject(m.subject ?? "");
    setText(m.text);
  }, [open, prep, channel, lang, doc, carVin, amountCents, edited]);

  const busyClose = useModalBackdropClose(onClose, busy === null);
  useHoldAdminOverlayCover(open);

  const resetTemplate = () => {
    setEdited(false);
    setPreview(null);
  };

  const loadPreview = async () => {
    if (busy || !text.trim()) return;
    setBusy("preview");
    setErr(null);
    try {
      const res = await fetch("/api/admin/dealer-data/refund/preview", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, text, lang, vin: carVin, amountCents }),
      });
      const body = (await res.json().catch(() => ({}))) as { html?: string; error?: string };
      if (!res.ok || !body.html) {
        setErr(dealerStripeRefundErrorLv(body.error));
        return;
      }
      setPreview(body.html);
    } catch {
      setErr("Neizdevās sazināties ar serveri.");
    } finally {
      setBusy(null);
    }
  };

  const done = (job: DealerDataJob | null, marks: OrderClientMarks | null, notice: string) => {
    onRefunded(job, marks, notice);
    onClose();
    // Kā pēc «Sūtīt klientam»: atpakaļ uz pasūtījumu sarakstu.
    window.location.assign(DEALER_REFUND_DONE_HREF);
  };

  /** Atmaksa jau veikta, e-pasts neaizgāja: sūta tikai e-pastu ar to pašu tekstu. */
  const resendEmail = async () => {
    if (busy) return;
    setBusy("resend");
    setErr(null);
    try {
      const res = await fetch("/api/admin/dealer-data/notify-email", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, customerEmail: email.trim(), subject: subject.trim(), text: text.trim(), lang, situation: "no_data" }),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; message?: string; to?: string; marks?: OrderClientMarks };
      if (!res.ok || !body.ok) {
        setErr(body.message || `E-pastu nosūtīt neizdevās (${body.error ?? res.status}). Nauda jau atgriezta.`);
        return;
      }
      done(null, body.marks ?? null, `E-pasts nosūtīts uz ${body.to ?? email}.`);
    } catch {
      setErr("Neizdevās sazināties ar serveri. Nauda jau atgriezta.");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (busy || !prep?.allowed) return;
    setErr(null);
    if (!text.trim()) return setErr("Teksts ir tukšs.");
    if (channel === "email" && !subject.trim()) return setErr("Temats ir tukšs.");
    if (channel === "email" && !email.trim()) return setErr("Nav klienta e-pasta (sadaļa «Klienta dati»).");
    // WhatsApp logs jāatver sinhroni klikšķī (iOS); ja atmaksa neizdodas - aizver.
    const wa = channel === "whatsapp" ? openWindowSyncThen() : null;
    setBusy("refund");
    try {
      const input = { sessionId, channel, subject, text, lang, customerEmail: email, override: prep.override };
      let r = await submitDealerStripeRefund(input);
      if (!r.ok && r.recipientMismatch && window.confirm(`${r.recipientMismatch.message}\n\nSūtīt uz ${r.recipientMismatch.requested}?`)) {
        r = await submitDealerStripeRefund({ ...input, confirmRecipientOverride: true });
      }
      if (!r.ok) {
        wa?.close();
        setErr(r.message);
        return;
      }
      const amount = amountCents ? formatEurFromCents(amountCents) : "";
      if (channel === "whatsapp") {
        wa?.navigate(dealerSendWhatsappUrl(customerPhoneDigits, text.trim()));
        done(r.job, r.marks, `Atmaksāts ${amount}. WhatsApp atvērts ar apstiprināto tekstu.`);
        return;
      }
      if (!r.emailSent) {
        // Nauda atgriezta, ziņa nē: logs paliek atvērts, poga sūta tikai e-pastu.
        setRefundedNoEmail(true);
        onRefunded(r.job, r.marks, `Atmaksāts ${amount}, bet e-pasts NAV nosūtīts.`);
        setErr(`Atmaksāts ${amount}, bet e-pastu nosūtīt neizdevās. Pārbaudi adresi un spied «Nosūtīt e-pastu».`);
        return;
      }
      done(r.job, r.marks, `Atmaksāts ${amount}. E-pasts nosūtīts uz ${r.to ?? email}.`);
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const blocked = prep != null && !prep.allowed;
  const primaryLabel =
    busy === "refund"
      ? "Atmaksā…"
      : busy === "resend"
        ? "Sūta…"
        : refundedNoEmail
          ? "Nosūtīt e-pastu"
          : dealerStripeRefundButtonLabel(amountCents, channel);

  const dialog = (
    <div
      data-dealer-refund-dialog
      className="fixed inset-0 z-[80] flex bg-black/40 sm:items-center sm:justify-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dealer-refund-title"
      {...busyClose}
    >
      <div
        className="amx amx-surface flex h-full max-h-[100dvh] w-full flex-col bg-white md:text-slate-900 sm:h-auto sm:max-h-[min(92vh,760px)] sm:max-w-lg sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 max-md:items-center max-md:border-b-0 max-md:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h3 id="dealer-refund-title" className="amx-tx text-[15px] font-semibold text-slate-900 max-md:text-[17px]">
              Atgriezt maksājumu
            </h3>
            <p className="amx-mut mt-0.5 truncate font-mono text-[11px] text-slate-500 max-md:text-[13px]">{carVin || "-"}</p>
          </div>
          <button
            type="button"
            aria-label="Aizvērt"
            className="h-8 w-8 rounded-md text-[18px] leading-none text-slate-500 hover:bg-slate-100 max-md:h-11 max-md:w-11"
            disabled={busy !== null}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 max-md:space-y-2.5">
          {prepErr ? <p className="text-[12px] text-rose-700">{prepErr}</p> : null}
          {!prep && !prepErr ? <p className="amx-mut text-[11.5px] text-slate-500">Ielādē…</p> : null}

          {prep ? (
            <>
              <div className="flex items-center justify-between rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                <span className="text-[12px] text-rose-800">Summa atgriešanai uz karti</span>
                <span className="text-[15px] font-semibold tabular-nums text-rose-800">
                  {amountCents ? formatEurFromCents(amountCents) : "-"}
                </span>
              </div>
              {blocked ? <p className="text-[12px] text-rose-700">{dealerStripeRefundErrorLv(prep.reason)}</p> : null}

              <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Kanāls">
                {(["email", "whatsapp"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="tab"
                    aria-selected={channel === c}
                    className={seg(channel === c)}
                    disabled={busy !== null || refundedNoEmail}
                    onClick={() => {
                      setChannel(c);
                      setPreview(null);
                    }}
                  >
                    {c === "email" ? "E-pasts" : "WhatsApp"}
                  </button>
                ))}
              </div>

              <div>
                <p className="amx-mut mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">Klienta valoda</p>
                <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Valoda">
                  {CLIENT_REPORT_LANGS.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="tab"
                      aria-selected={lang === l}
                      className={seg(lang === l)}
                      disabled={busy !== null}
                      onClick={() => {
                        setLang(l);
                        resetTemplate();
                      }}
                    >
                      {LANG_LABEL[l]}
                      {l === prep.lang ? " ·" : ""}
                    </button>
                  ))}
                </div>
              </div>

              {channel === "email" ? (
                <div className="space-y-2">
                  <div>
                    <label htmlFor="dealer-refund-to" className="amx-mut mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Kam
                    </label>
                    <input
                      id="dealer-refund-to"
                      type="email"
                      className="amx-fld w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] text-slate-900"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy !== null}
                    />
                  </div>
                  <div>
                    <label htmlFor="dealer-refund-subj" className="amx-mut mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Temats
                    </label>
                    <input
                      id="dealer-refund-subj"
                      className="amx-fld w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] text-slate-900"
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setEdited(true);
                        setPreview(null);
                      }}
                      disabled={busy !== null}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-0.5 flex items-center justify-between">
                  <label htmlFor="dealer-refund-msg" className="amx-mut block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    Teksts
                  </label>
                  {edited ? (
                    <button type="button" className="text-[11px] text-slate-500 underline" disabled={busy !== null} onClick={resetTemplate}>
                      Atjaunot no veidnes
                    </button>
                  ) : null}
                </div>
                <textarea
                  id="dealer-refund-msg"
                  spellCheck={false}
                  className="amx-fld amx-fld--ta min-h-[220px] w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] leading-relaxed text-slate-900"
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setEdited(true);
                    setPreview(null);
                  }}
                  disabled={busy !== null}
                />
              </div>

              <div>
                {channel === "email" ? (
                  preview ? (
                    <iframe
                      title="Priekšskats"
                      sandbox=""
                      srcDoc={preview}
                      className="h-[420px] w-full rounded-md border border-slate-200 bg-white"
                    />
                  ) : (
                    <button type="button" className={btn} disabled={busy !== null || !text.trim()} onClick={() => void loadPreview()}>
                      {busy === "preview" ? "Gatavo…" : "Priekšskats"}
                    </button>
                  )
                ) : (
                  <div className="rounded-lg bg-[#e7f7ec] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap text-slate-900">{text}</div>
                )}
              </div>
            </>
          ) : null}

          {err ? <p className="amx-tx--red text-[11.5px] text-rose-700">{err}</p> : null}
        </div>

        <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] amx-dock">
          <button type="button" className={`${btn} amx-btn`} disabled={busy !== null} onClick={onClose}>
            ← Atpakaļ
          </button>
          <button
            type="button"
            data-dealer-refund-submit
            className={`${danger} amx-btn max-md:flex-1`}
            disabled={busy !== null || !prep || (!refundedNoEmail && blocked)}
            onClick={() => void (refundedNoEmail ? resendEmail() : submit())}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
