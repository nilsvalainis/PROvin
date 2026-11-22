"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useHoldAdminOverlayCover } from "@/lib/admin-overlay-cover";
import type { SendReportPrepared } from "@/components/admin/AdminSendReportDialog";
import { buildProvinDilerisPdfFilename } from "@/lib/audit-report-pdf-filename";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  buildDealerSendMessage,
  dealerSendWhatsappUrl,
  DEALER_SEND_SITUATION_LV,
  toggleDealerSendOption,
  type DealerSendChannel,
  type DealerSendOffer,
  type DealerSendOptions,
  type DealerSendSituation,
} from "@/lib/dealer-send-message";
import { messageTemplatesDocFromOverrides } from "@/lib/messages/shared-block-vars";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import type { OrderClientMarks } from "@/lib/order-client-marks";
import { dealerToAuditTargetCents, formatEurFromCents } from "@/lib/order-upsell";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
import { openWindowSyncThen, PDF_PREPARING_HTML } from "@/lib/admin-open-window";
import type { DealerShadowFeedback, DealerShadowGate } from "@/lib/dealer-shadow-types";
import { AdminDealerShadowFeedback } from "@/components/admin/AdminDealerShadowGate";
import type { DealerReviewScore } from "@/lib/dealer-review-score";
import { AdminDealerReviewIndicator } from "@/components/admin/AdminDealerReviewCard";

/** Ēnu režīms (Nils 22.11): spriedums + atsauksme sūtīšanas formā. Sūtīšanu NEbloķē. */
export type DealerSendShadow = {
  gate: DealerShadowGate | null | undefined;
  feedback: DealerShadowFeedback | null | undefined;
  busy: boolean;
  /** Pārbaude vēlreiz: atverot formu un pēc servera PDF (ar tā ceļu). */
  recheck: (trigger: "send_dialog" | "pdf", pdf?: { pathname: string } | null) => void;
  submitFeedback: (correct: boolean, note: string) => void;
};

/** Pasūtījuma darba zonas funkcijas, ko dīlera bloks saņem caur props (servera PDF + sūtīšana). */
export type DealerSendBridge = {
  customerPhoneDigits: string | null;
  /** Samaksātais centos (Stripe / maks). */
  paidCents: number | null;
  prepareDealerPdf: (lang: ClientReportLang) => Promise<SendReportPrepared>;
  /** Tas pats servera ceļš kā «Sūtīt atskaiti» (versijas, Dropbox, «Izpildīts»), ar admina tekstu. */
  sendDealerReport: (input: {
    prepared: SendReportPrepared;
    lang: ClientReportLang;
    subject: string;
    text: string;
    /** Serveris ieraksta sūtījumu klienta saziņas žurnālā. */
    dealerSend?: { situation: DealerSendSituation; offer: boolean; review: boolean };
  }) => Promise<{ sentTo: string; dealerMarks?: OrderClientMarks }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  vin: string;
  b2b: boolean;
  customerEmail: string;
  defaultSituation: DealerSendSituation;
  refundCents: number | null;
  pdfLang: ClientReportLang;
  bridge?: DealerSendBridge | null;
  onSent: (marks: OrderClientMarks | null, notice: string) => void;
  shadow?: DealerSendShadow | null;
  /** «Atsauksmes iespēja»: tikai indikators pie ķekša (ķeksis pats neieslēdzas). */
  review?: DealerReviewScore | null;
};

const seg = (on: boolean) =>
  `min-h-9 flex-1 rounded-md px-2 text-[12px] font-medium transition ${
    on ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-slate-600 hover:text-slate-900"
  }`;
const btn =
  "min-h-9 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "min-h-9 rounded-md border border-transparent bg-[#1d1d1f] px-4 text-[12px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50";
const waBtn =
  "min-h-9 rounded-md border border-transparent bg-[#1f9d55] px-4 text-[12px] font-semibold text-white hover:bg-[#178246] disabled:cursor-not-allowed disabled:opacity-50";

let templatesDocCache: MessageTemplatesDoc | null = null;

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

async function recordSend(body: Record<string, unknown>): Promise<OrderClientMarks | null> {
  try {
    const res = await fetch("/api/admin/order-client-marks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "dealer_send", ...body }),
    });
    const data = (await res.json().catch(() => ({}))) as { marks?: OrderClientMarks };
    return data.marks ?? null;
  } catch {
    return null;
  }
}

export function AdminDealerSendDialog({
  open,
  onClose,
  sessionId,
  vin,
  b2b,
  customerEmail,
  defaultSituation,
  refundCents,
  pdfLang,
  bridge,
  onSent,
  shadow = null,
  review = null,
}: Props) {
  const [channel, setChannel] = useState<DealerSendChannel>("email");
  const [situation, setSituation] = useState<DealerSendSituation>(defaultSituation);
  const [opts, setOpts] = useState<DealerSendOptions>({ offer: false, review: false });
  const [offer, setOffer] = useState<DealerSendOffer | null>(null);
  const [doc, setDoc] = useState<MessageTemplatesDoc | null>(templatesDocCache);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "offer" | "pdf" | "send">(null);
  const [err, setErr] = useState<string | null>(null);
  const [pdfLink, setPdfLink] = useState<SendReportPrepared | null>(null);

  useEffect(() => {
    if (!open) return;
    setChannel("email");
    setSituation(defaultSituation);
    setOpts({ offer: false, review: false });
    setErr(null);
    setPdfLink(null);
    void loadAdminMessageTemplatesDoc().then((d) => d && setDoc(d));
  }, [open, defaultSituation]);

  // Ēnu režīms: atverot formu - pārbaude vēlreiz ar jaunāko melnrakstu (tikai spriedums).
  const shadowRef = useRef(shadow);
  useEffect(() => {
    shadowRef.current = shadow;
  }, [shadow]);
  useEffect(() => {
    if (open) shadowRef.current?.recheck("send_dialog");
  }, [open]);
  const recheckWithPdf = (prepared: SendReportPrepared) => shadowRef.current?.recheck("pdf", { pathname: prepared.pdfPathname });

  const paidCents = bridge?.paidCents ?? null;
  const offerPreview = useMemo(() => {
    const prior = paidCents != null && paidCents > 0 ? paidCents : null;
    if (prior == null) return null;
    const target = dealerToAuditTargetCents(b2b);
    return prior < target ? { priorCents: prior, chargeCents: target - prior, targetCents: target } : null;
  }, [paidCents, b2b]);
  const priceBox = offer ?? offerPreview;

  // Teksts pārģenerējas pēc katras izvēles (kanāls, situācija, ķekši).
  useEffect(() => {
    if (!open) return;
    const m = buildDealerSendMessage({
      channel,
      situation,
      b2b,
      vin,
      refundCents,
      offer: opts.offer ? offer : null,
      review: opts.review,
      doc,
    });
    setSubject(m.subject ?? "");
    setText(m.text);
  }, [open, channel, situation, b2b, vin, refundCents, opts, offer, doc]);

  const busyClose = useModalBackdropClose(onClose, busy === null);
  // 22.11 (Nils, iPhone): telefona doks (Kopēt VIN · VIN SCAN · PDF …) nedrīkst aizsegt «Sūtīt e-pastu».
  useHoldAdminOverlayCover(open);

  const toggle = useCallback(
    async (which: keyof DealerSendOptions, checked: boolean) => {
      setErr(null);
      setOpts((cur) => toggleDealerSendOption(cur, which, checked));
      if (which !== "offer" || !checked || offer) return;
      setBusy("offer");
      try {
        const res = await fetch("/api/admin/order-upsell", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, kind: "dealer_to_audit" }),
        });
        const data = (await res.json().catch(() => ({}))) as Partial<DealerSendOffer> & { error?: string };
        if (!res.ok || !data.url || data.chargeCents == null || data.priorCents == null || data.targetCents == null) {
          setOpts((cur) => ({ ...cur, offer: false }));
          setErr(data.error === "already_settled" ? "Piedāvājums jau apmaksāts." : "Piedāvājuma saiti neizdevās izveidot.");
          return;
        }
        setOffer({ url: data.url, priorCents: data.priorCents, chargeCents: data.chargeCents, targetCents: data.targetCents });
      } catch {
        setOpts((cur) => ({ ...cur, offer: false }));
        setErr("Tīkla kļūda.");
      } finally {
        setBusy(null);
      }
    },
    [offer, sessionId],
  );

  const sendFlags = () => ({
    situation,
    offer: situation === "ready" && opts.offer,
    review: situation === "ready" && opts.review && !opts.offer,
  });

  /** E-pastu ieraksta serveris (atgriež `serverMarks`); WhatsApp vai servera ieraksta kļūdas gadījumā - šeit. */
  const finish = async (notice: string, serverMarks?: OrderClientMarks | null) => {
    const marks = serverMarks ?? (await recordSend({ sessionId, channel, ...sendFlags() }));
    onSent(marks, notice);
    onClose();
  };

  const downloadPdf = async () => {
    if (!bridge || busy) return;
    // Telefonā (iOS Safari) logs jāatver sinhroni pieskāriena brīdī, citādi pēc `await` to bloķē.
    const phonePre =
      typeof window !== "undefined" && window.matchMedia(ADMIN_MOBILE_MQ).matches ? openWindowSyncThen() : null;
    phonePre?.writeHtml(PDF_PREPARING_HTML);
    setBusy("pdf");
    setErr(null);
    try {
      const prepared = await bridge.prepareDealerPdf(pdfLang);
      setPdfLink(prepared);
      recheckWithPdf(prepared);
      if (phonePre) phonePre.navigate(prepared.downloadUrl);
      else window.open(prepared.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      phonePre?.close();
      setErr(e instanceof Error ? e.message : "PDF netika izveidots.");
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (busy) return;
    setErr(null);
    if (!text.trim()) {
      setErr("Teksts ir tukšs.");
      return;
    }
    if (channel === "whatsapp") {
      window.open(dealerSendWhatsappUrl(bridge?.customerPhoneDigits, text.trim()), "_blank", "noopener,noreferrer");
      setBusy("send");
      await finish("WhatsApp atvērts.");
      setBusy(null);
      return;
    }
    if (!customerEmail.trim()) {
      setErr("Nav klienta e-pasta (sadaļa «Klienta dati»).");
      return;
    }
    if (!subject.trim()) {
      setErr("Temats ir tukšs.");
      return;
    }
    if (situation === "ready") {
      if (!bridge) {
        setErr("PDF sūtīšana šeit nav pieejama.");
        return;
      }
      setBusy("pdf");
      try {
        const prepared = await bridge.prepareDealerPdf(pdfLang);
        recheckWithPdf(prepared);
        setBusy("send");
        const r = await bridge.sendDealerReport({
          prepared,
          lang: pdfLang,
          subject: subject.trim(),
          text: text.trim(),
          dealerSend: sendFlags(),
        });
        await finish(`E-pasts ar PDF nosūtīts uz ${r.sentTo}.`, r.dealerMarks ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Neizdevās nosūtīt.");
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy("send");
    try {
      type NotifyBody = {
        ok?: boolean;
        to?: string;
        message?: string;
        error?: string;
        requested?: string;
        marks?: OrderClientMarks;
      };
      const post = async (confirmRecipientOverride: boolean) => {
        const res = await fetch("/api/admin/dealer-data/notify-email", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            customerEmail: customerEmail.trim(),
            subject: subject.trim(),
            text: text.trim(),
            ...(confirmRecipientOverride ? { confirmRecipientOverride: true } : {}),
            ...sendFlags(),
          }),
        });
        return { res, body: (await res.json().catch(() => ({}))) as NotifyBody };
      };
      let { res, body } = await post(false);
      if (
        res.status === 409 &&
        body.error === "recipient_mismatch" &&
        window.confirm(`${body.message ?? "Saņēmējs atšķiras no pasūtījumā saglabātā."}\n\nSūtīt uz ${body.requested ?? customerEmail.trim()}?`)
      ) {
        ({ res, body } = await post(true));
      }
      if (!res.ok || !body.ok) {
        setErr(body.message || body.error || `Nosūtīšana neizdevās (${res.status}).`);
        return;
      }
      await finish(`E-pasts nosūtīts uz ${body.to ?? customerEmail}.`, body.marks ?? null);
    } catch {
      setErr("Neizdevās sazināties ar serveri.");
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  const ready = situation === "ready";
  const filename = buildProvinDilerisPdfFilename(vin, pdfLang);
  const refundLabel =
    refundCents != null && refundCents > 0
      ? `${b2b ? "Atgriezts atlikumā" : "Atmaksāts"} ${formatEurFromCents(refundCents)}`
      : null;

  // Portālā uz body: dīlera bloka vecāku stacking konteksts citādi ielika logu zem telefona doka.
  const dialog = (
    <div
      data-dealer-send-dialog
      className="fixed inset-0 z-[80] flex bg-black/40 sm:items-center sm:justify-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dealer-send-title"
      {...busyClose}
    >
      <div
        className="amx amx-surface flex h-full max-h-[100dvh] w-full flex-col bg-white sm:h-auto sm:max-h-[min(92vh,760px)] sm:max-w-lg sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 max-md:items-center max-md:border-b-0 max-md:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h3 id="dealer-send-title" className="amx-tx text-[15px] font-semibold text-slate-900 max-md:text-[17px]">
              Sūtīt klientam
            </h3>
            <p className="amx-mut mt-0.5 truncate font-mono text-[11px] text-slate-500 max-md:text-[13px]">{vin}</p>
          </div>
          <button
            type="button"
            aria-label="Aizvērt"
            className="h-8 w-8 rounded-md text-[18px] leading-none text-slate-500 hover:bg-slate-100 max-md:h-11 max-md:w-11 max-md:shrink-0 max-md:rounded-full max-md:border max-md:border-[var(--amx-edge)] max-md:bg-[var(--amx-glass)] max-md:text-[22px] max-md:text-[var(--amx-tx)]"
            disabled={busy !== null}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 max-md:space-y-2.5">
          <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Kanāls">
            {(["email", "whatsapp"] as const).map((c) => (
              <button key={c} type="button" role="tab" aria-selected={channel === c} className={seg(channel === c)} onClick={() => setChannel(c)}>
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

          <div>
            <p className="amx-mut mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]">Situācija</p>
            <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Situācija">
              {(["ready", "no_data", "cancelled"] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={situation === s} className={seg(situation === s)} onClick={() => setSituation(s)}>
                  {DEALER_SEND_SITUATION_LV[s]}
                </button>
              ))}
            </div>
          </div>

          {ready ? (
            <div className="space-y-1.5">
              {priceBox ? (
                <label
                  className={`amx-card flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 max-md:min-h-[54px] max-md:items-center max-md:gap-3 max-md:px-3.5 ${
                    opts.offer ? "border-slate-900" : "border-slate-200"
                  } ${opts.review ? "opacity-50" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 max-md:mt-0 max-md:h-[22px] max-md:w-[22px] max-md:accent-[var(--amx-acc)]"
                    checked={opts.offer}
                    disabled={opts.review || busy !== null}
                    onChange={(e) => void toggle("offer", e.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="amx-tx text-[12.5px] font-medium text-slate-900 max-md:text-[15px]">Piedāvājums PROVIN AUDITS</div>
                    {opts.review ? <div className="text-[11px] text-slate-500">Nevar kopā ar atsauksmes lūgumu</div> : null}
                    {opts.offer ? (
                      <div className="mt-1 grid grid-cols-[auto_auto] justify-start gap-x-4 text-[12px] text-slate-700">
                        <span>Jau samaksāts</span>
                        <span className="tabular-nums">{formatEurFromCents(priceBox.priorCents)}</span>
                        <span>Piemaksa</span>
                        <span className="tabular-nums">{formatEurFromCents(priceBox.chargeCents)}</span>
                        <span className="font-semibold">Kopā</span>
                        <span className="font-semibold tabular-nums">{formatEurFromCents(priceBox.targetCents)}</span>
                      </div>
                    ) : null}
                    {busy === "offer" ? <div className="text-[11px] text-slate-500">Veido saiti…</div> : null}
                  </div>
                </label>
              ) : null}
              <label
                className={`amx-card flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 max-md:min-h-[54px] max-md:items-center max-md:gap-3 max-md:px-3.5 ${
                  opts.review ? "border-slate-900" : "border-slate-200"
                } ${opts.offer ? "opacity-50" : ""}`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 max-md:mt-0 max-md:h-[22px] max-md:w-[22px] max-md:accent-[var(--amx-acc)]"
                  checked={opts.review}
                  disabled={opts.offer || busy !== null}
                  onChange={(e) => void toggle("review", e.target.checked)}
                />
                <div>
                  <div className="amx-tx text-[12.5px] font-medium text-slate-900 max-md:text-[15px]">Google atsauksmes lūgums</div>
                  {review ? <AdminDealerReviewIndicator review={review} /> : null}
                  {opts.offer ? <div className="text-[11px] text-slate-500">Nevar kopā ar piedāvājumu</div> : null}
                </div>
              </label>
            </div>
          ) : (
            <div>
              {refundLabel ? (
                <span className="inline-flex rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  {refundLabel}
                </span>
              ) : (
                <span className="inline-flex rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                  Nav atmaksāts
                </span>
              )}
            </div>
          )}

          {channel === "email" ? (
            <div>
              <label htmlFor="dealer-send-subj" className="amx-mut mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]">
                Temats
              </label>
              <input
                id="dealer-send-subj"
                className="amx-fld w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12.5px]"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={busy !== null}
              />
              <p className="amx-mut mt-0.5 truncate text-[11px] text-slate-500 max-md:mt-1 max-md:text-[13px]">
                Kam: {customerEmail.trim() || <span className="text-rose-600">nav e-pasta</span>}
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor="dealer-send-msg" className="amx-mut mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]">
              Teksts
            </label>
            <textarea
              id="dealer-send-msg"
              spellCheck={false}
              className="amx-fld amx-fld--ta min-h-[220px] w-full rounded-md border border-slate-300 px-2 py-1.5 text-[12.5px] leading-relaxed"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={busy !== null}
            />
          </div>

          {ready ? (
            <div className="amx-card flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 max-md:min-h-[54px] max-md:px-3.5">
              <div className="amx-tx flex min-w-0 items-center gap-2 text-[11.5px] text-slate-700 max-md:text-[14px]">
                <span className="rounded bg-rose-600 px-1 py-px text-[9px] font-bold text-white">PDF</span>
                <span className="truncate">{filename}</span>
              </div>
              {channel === "email" ? (
                <span className="flex items-center gap-2">
                  <span className="amx-mut text-[11px] text-slate-500 max-md:text-[13px]">PDF pievienos automātiski</span>
                  {/* Telefonā: servera PDF jaunā cilnē pilnā platumā (tas pats PDF, kas pievienosies). */}
                  <button
                    type="button"
                    className="amx-btn amx-btn--sm md:hidden"
                    disabled={busy !== null || !bridge}
                    onClick={() => void downloadPdf()}
                  >
                    {busy === "pdf" ? "Gatavo…" : "Skatīt"}
                  </button>
                </span>
              ) : pdfLink ? (
                <a className={btn + " amx-btn amx-btn--sm inline-flex items-center"} href={pdfLink.downloadUrl} target="_blank" rel="noopener noreferrer">
                  Atvērt PDF
                </a>
              ) : (
                <button type="button" className={`${btn} amx-btn amx-btn--sm`} disabled={busy !== null || !bridge} onClick={() => void downloadPdf()}>
                  {busy === "pdf" ? "Gatavo PDF…" : "Lejupielādēt PDF"}
                </button>
              )}
            </div>
          ) : null}

          {shadow?.gate ? (
            <AdminDealerShadowFeedback
              gate={shadow.gate}
              feedback={shadow.feedback}
              busy={shadow.busy}
              onSubmit={shadow.submitFeedback}
            />
          ) : null}

          {err ? <p className="amx-tx--red text-[11.5px] text-rose-700 max-md:text-[14px]">{err}</p> : null}
        </div>

        <div
          data-dealer-send-footer
          className="sticky bottom-0 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] amx-dock"
        >
          <button type="button" className={`${btn} amx-btn max-md:flex-none`} disabled={busy !== null} onClick={onClose}>
            ← Atpakaļ
          </button>
          <button
            type="button"
            className={`${channel === "email" ? primary : waBtn} amx-btn amx-btn--primary max-md:flex-1`}
            disabled={busy !== null}
            onClick={() => void send()}
          >
            {busy === "pdf" && channel === "email"
              ? "Gatavo PDF…"
              : busy === "send"
                ? "Sūta…"
                : channel === "email"
                  ? "Sūtīt e-pastu"
                  : "Atvērt WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
