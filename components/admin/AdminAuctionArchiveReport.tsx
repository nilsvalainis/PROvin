"use client";

/**
 * «Izsoļu arhīvs» kā ATSEVIŠĶS PDF/pakalpojums jebkuram pasūtījumam (Nils 23.11, 3. punkts).
 * Papildus piedāvājumam «dīlera datu vietā» (sūtīšanas loga 4. situācija paliek kā ir).
 * Identiski dīlera datiem (`AdminDealerDataJobStrip` / `AdminDealerSendDialog`), pielāgots:
 * - `AdminAuctionArchiveReportStrip` - «Izsoļu portālu arhīvs» blokā: «Sūtīt klientam», «Ģenerēt PDF ▾»,
 *   «Skatīt PDF», «Rādīt izsoļu cenas», «Nosūtīts klientam: …»;
 * - `AuctionArchivePdfSplitButton` - tā pati poga datora apakšējā PDF joslā;
 * - `AdminAuctionArchiveSendDialog` - kanāls, situācija («Arhīvs gatavs» / «Datu nav» / «Atcelts»),
 *   AUDITS piedāvājums (ja attiecas), Google atsauksme, rediģējams teksts, pielikuma kartīte. Tikai LV.
 * Klientam sūta tikai pēc Nila pogas «Sūtīt e-pastu».
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useHoldAdminOverlayCover } from "@/lib/admin-overlay-cover";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
import { openWindowSyncThen, PDF_PREPARING_HTML } from "@/lib/admin-open-window";
import { ShowPricesCheckbox } from "@/components/admin/AdminAuctionArchive";
import { loadAdminMessageTemplatesDoc, type DealerSendBridge } from "@/components/admin/AdminDealerSendDialog";
import { lvCount, type AuctionArchiveSummary } from "@/lib/auction-archive-offer";
import {
  AUCTION_ARCHIVE_SEND_SITUATION_LV,
  auctionArchiveReportPdfFilename,
  buildAuctionArchiveSendMessage,
  type AuctionArchiveReportDoc,
  type AuctionArchiveSendSituation,
} from "@/lib/auction-archive-report";
import { dealerSendWhatsappUrl, type DealerSendChannel, type DealerSendOffer } from "@/lib/dealer-send-message";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import { dealerToAuditTargetCents, formatEurFromCents } from "@/lib/order-upsell";

const API = "/api/admin/auction-archive-report";

export type AuctionArchiveReportState = {
  vin: string;
  summary: AuctionArchiveSummary;
  eligible: boolean;
  report: AuctionArchiveReportDoc;
  statusLine: string;
  pdfUrl: string | null;
  filename: string;
};

async function postReport(body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(API, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status, data: ((await res.json().catch(() => ({}))) ?? {}) as Record<string, unknown> };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  }
}

export function auctionArchiveReportErrorLv(code: unknown): string {
  switch (code) {
    case "no_archive_data":
      return "Izsoļu arhīvā nav ierakstu - vispirms ielasi izsoles («Izsoļu portālu arhīvs»).";
    case "no_vin":
      return "Pasūtījumā nav VIN.";
    case "not_found":
      return "Pasūtījums nav atrasts.";
    case "email_failed":
      return "E-pasts netika nosūtīts.";
    case "pdf_failed":
      return "PDF netika izveidots.";
    case "order_not_eligible":
      return "Nepieciešams derīgs klienta e-pasts.";
    case "missing_subject_or_text":
      return "Temats vai teksts ir tukšs.";
    default:
      return "Neizdevās.";
  }
}

/**
 * Ģenerē servera PDF un atver to jaunā cilnē. Telefonā (iOS Safari) logu atver sinhroni pieskāriena brīdī.
 * Atgriež kļūdas tekstu vai null.
 */
export async function generateAuctionArchiveReportPdf(
  sessionId: string,
  showPrices: boolean,
): Promise<{ error: string | null; missingPhotos: number; data: Record<string, unknown> }> {
  const phonePre = typeof window !== "undefined" && window.matchMedia(ADMIN_MOBILE_MQ).matches ? openWindowSyncThen() : null;
  phonePre?.writeHtml(PDF_PREPARING_HTML);
  const r = await postReport({ action: "pdf", sessionId, showPrices });
  if (!r.ok || typeof r.data.url !== "string") {
    phonePre?.close();
    return { error: auctionArchiveReportErrorLv(r.data.error), missingPhotos: 0, data: r.data };
  }
  if (phonePre) phonePre.navigate(r.data.url);
  else window.open(r.data.url, "_blank", "noopener,noreferrer");
  return { error: null, missingPhotos: Number(r.data.missingPhotos) || 0, data: r.data };
}

export function useAuctionArchiveReport(sessionId: string, active: boolean) {
  const [state, setState] = useState<AuctionArchiveReportState | null>(null);
  const reload = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`${API}?sessionId=${encodeURIComponent(sessionId)}`, { credentials: "include", cache: "no-store" });
      if (res.ok) setState((await res.json()) as AuctionArchiveReportState);
    } catch {
      /* nav kritiski */
    }
  }, [sessionId]);
  useEffect(() => {
    if (active) void reload();
  }, [active, reload]);
  return { state, setState, reload };
}

/* ---------- «Ģenerēt izsoļu arhīva PDF ▾» (apakšējā josla + bloks) ---------- */

const PRICE_MENU = [
  { id: "plain", short: "Bez cenām", title: "noklusējums" },
  { id: "prices", short: "Ar izsoļu cenām", title: "cenas PDF" },
] as const;

/** Tas pats izskats kā «Ģenerēt dīlera PDF ▾»; ▾ - ar / bez izsoļu cenām (tikai LV). */
export function AuctionArchivePdfSplitButton({
  label,
  title,
  disabled,
  busyLabel,
  toneClass,
  dividerClass = "border-white/35",
  menuSide = "up",
  onGenerate,
  onPrimary,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  busyLabel?: string | null;
  toneClass: string;
  dividerClass?: string;
  menuSide?: "up" | "down";
  onGenerate: (showPrices: boolean) => void;
  /** Galvenā poga (noklusējums - bez cenām). */
  onPrimary?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const half =
    "inline-flex h-9 shrink-0 items-center justify-center text-[11px] font-semibold tracking-tight transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div ref={rootRef} className="relative inline-flex shrink-0" data-auction-archive-pdf-btn>
      <button type="button" disabled={disabled} title={title} onClick={() => (onPrimary ? onPrimary() : onGenerate(false))} className={`${half} ${toneClass} rounded-l-lg px-3`}>
        {busyLabel ?? label}
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`${label}: ar vai bez cenām`}
        title="Ar vai bez izsoļu cenām"
        onClick={() => setOpen((v) => !v)}
        className={`${half} ${toneClass} rounded-r-lg border-l ${dividerClass} px-1.5`}
      >
        <ChevronDown className={`h-3.5 w-3.5 ${open ? "rotate-180" : ""}`} strokeWidth={2.25} aria-hidden />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className={`absolute right-0 z-50 min-w-[10rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ${
            menuSide === "down" ? "top-full mt-1.5" : "bottom-full mb-1.5"
          }`}
        >
          {PRICE_MENU.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onGenerate(item.id === "prices");
              }}
            >
              {item.short}
              <span className="ml-3 text-[10px] font-medium text-slate-500">{item.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- Bloks «Izsoļu portālu arhīvs» ---------- */

const btn =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

export function AdminAuctionArchiveReportStrip({
  sessionId,
  customerEmail = "",
  b2bClient = false,
  bridge = null,
  refreshKey = 0,
}: {
  sessionId: string;
  customerEmail?: string | null;
  b2bClient?: boolean;
  /** Tālrunis WhatsApp un samaksātā summa (AUDITS piedāvājumam) - tas pats, ko saņem dīlera bloks. */
  bridge?: Pick<DealerSendBridge, "customerPhoneDigits" | "paidCents"> | null;
  /** Palielina, kad PDF ģenerēts no apakšējās joslas (atjauno «Skatīt PDF»). */
  refreshKey?: number;
}) {
  const { state, setState, reload } = useAuctionArchiveReport(sessionId, true);
  const [busy, setBusy] = useState<null | "pdf">(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [showPrices, setShowPrices] = useState<boolean | null>(null);
  useEffect(() => {
    if (refreshKey > 0) void reload();
  }, [refreshKey, reload]);
  if (!state) return null;
  const prices = showPrices ?? state.report.showPrices === true;
  const s = state.summary;

  const generate = async (withPrices: boolean) => {
    if (busy) return;
    setBusy("pdf");
    setNotice(null);
    const r = await generateAuctionArchiveReportPdf(sessionId, withPrices);
    setBusy(null);
    if (r.error) {
      setNotice(r.error);
      return;
    }
    setShowPrices(withPrices);
    setNotice(r.missingPhotos > 0 ? `PDF gatavs, ${r.missingPhotos} bildes neizdevās ielasīt.` : "PDF gatavs.");
    void reload();
  };

  return (
    <section className="mb-2 rounded-lg border border-slate-200/90 bg-white px-2 py-2" data-auction-archive-report>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Izsoļu arhīvs (PDF)</span>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${
            state.eligible ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-orange-200 bg-orange-50 text-orange-700"
          }`}
        >
          {state.eligible
            ? `${lvCount(s.auctions.length, "izsole", "izsoles")} · ${lvCount(s.photoCount, "bilde", "bildes")}`
            : "Izsoļu ierakstu nav"}
        </span>
      </div>

      <div className="mt-2">
        <button
          type="button"
          className="min-h-9 w-full rounded-md border border-transparent bg-[#1d1d1f] px-4 text-[12.5px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          disabled={busy !== null}
          onClick={() => setDialog(true)}
        >
          Sūtīt klientam
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <AuctionArchivePdfSplitButton
          label="Ģenerēt izsoļu arhīva PDF"
          disabled={busy !== null || !state.eligible}
          busyLabel={busy === "pdf" ? "Gatavo PDF…" : null}
          toneClass="border border-slate-300 bg-white text-slate-700 shadow-none hover:bg-slate-50"
          dividerClass="border-slate-200"
          menuSide="down"
          onPrimary={() => void generate(prices)}
          onGenerate={(withPrices) => void generate(withPrices)}
        />
        <button
          type="button"
          className={btn}
          disabled={!state.pdfUrl}
          onClick={() => state.pdfUrl && window.open(state.pdfUrl, "_blank", "noopener,noreferrer")}
        >
          Skatīt PDF
        </button>
        <ShowPricesCheckbox checked={prices} disabled={busy !== null} onChange={setShowPrices} />
      </div>

      <p className="mt-1.5 text-[10.5px] text-[var(--color-provin-muted)] [overflow-wrap:anywhere]">{state.statusLine}</p>
      {notice ? <p className="mt-1.5 text-[10px] text-[var(--color-provin-muted)]">{notice}</p> : null}

      <AdminAuctionArchiveSendDialog
        open={dialog}
        onClose={() => setDialog(false)}
        sessionId={sessionId}
        state={state}
        b2b={b2bClient}
        customerEmail={(customerEmail ?? "").trim()}
        bridge={bridge}
        showPrices={prices}
        onShowPrices={setShowPrices}
        onSent={(next, msg) => {
          setState(next);
          setNotice(msg);
        }}
      />
    </section>
  );
}

/* ---------- Sūtīšanas logs ---------- */

const seg = (on: boolean) =>
  `min-h-9 flex-1 rounded-md px-2 text-[12px] font-medium transition ${
    on ? "bg-white text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.12)]" : "text-slate-600 hover:text-slate-900"
  }`;
const dlgBtn =
  "min-h-9 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";
const primary =
  "min-h-9 rounded-md border border-transparent bg-[#1d1d1f] px-4 text-[12px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50";
const waBtn =
  "min-h-9 rounded-md border border-transparent bg-[#1f9d55] px-4 text-[12px] font-semibold text-white hover:bg-[#178246] disabled:cursor-not-allowed disabled:opacity-50";
const lbl = "amx-mut mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]";

export function AdminAuctionArchiveSendDialog({
  open,
  onClose,
  sessionId,
  state,
  b2b,
  customerEmail,
  bridge,
  showPrices,
  onShowPrices,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  state: AuctionArchiveReportState;
  b2b: boolean;
  customerEmail: string;
  bridge: Pick<DealerSendBridge, "customerPhoneDigits" | "paidCents"> | null;
  showPrices: boolean;
  onShowPrices: (v: boolean) => void;
  onSent: (next: AuctionArchiveReportState, notice: string) => void;
}) {
  const [channel, setChannel] = useState<DealerSendChannel>("email");
  const [situation, setSituation] = useState<AuctionArchiveSendSituation>(state.eligible ? "ready" : "no_data");
  const [opts, setOpts] = useState({ offer: false, review: false });
  const [offer, setOffer] = useState<DealerSendOffer | null>(null);
  const [doc, setDoc] = useState<MessageTemplatesDoc | null>(null);
  const [subject, setSubject] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<null | "offer" | "pdf" | "send">(null);
  const [err, setErr] = useState<string | null>(null);
  const busyClose = useModalBackdropClose(onClose, busy === null);
  useHoldAdminOverlayCover(open);

  useEffect(() => {
    if (!open) return;
    setChannel("email");
    setSituation(state.eligible ? "ready" : "no_data");
    setOpts({ offer: false, review: false });
    setErr(null);
    void loadAdminMessageTemplatesDoc().then((d) => d && setDoc(d));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const paidCents = bridge?.paidCents ?? null;
  const offerPreview = (() => {
    const prior = paidCents != null && paidCents > 0 ? paidCents : null;
    if (prior == null) return null;
    const target = dealerToAuditTargetCents(b2b);
    return prior < target ? { priorCents: prior, chargeCents: target - prior, targetCents: target } : null;
  })();
  const priceBox = offer ?? offerPreview;
  const ready = situation === "ready";

  // Teksts pārģenerējas pēc katras izvēles (kanāls, situācija, ķekši, cenas).
  useEffect(() => {
    if (!open) return;
    const m = buildAuctionArchiveSendMessage({
      channel,
      situation,
      b2b,
      vin: state.vin,
      summary: state.summary,
      showPrices,
      refundCents: paidCents,
      offer: opts.offer ? offer : null,
      review: opts.review,
      doc,
    });
    setSubject(m.subject ?? "");
    setText(m.text);
  }, [open, channel, situation, b2b, state.vin, state.summary, showPrices, paidCents, opts, offer, doc]);

  const toggleOffer = async (checked: boolean) => {
    setErr(null);
    setOpts((cur) => ({ ...cur, offer: checked }));
    if (!checked || offer) return;
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
  };

  const viewPdf = async () => {
    setBusy("pdf");
    setErr(null);
    const r = await generateAuctionArchiveReportPdf(sessionId, showPrices);
    setBusy(null);
    if (r.error) setErr(r.error);
  };

  const record = async (extra: Record<string, unknown>) => {
    const post = (confirmRecipientOverride: boolean) =>
      postReport({
        action: "send",
        sessionId,
        channel,
        situation,
        offer: ready && opts.offer,
        review: ready && opts.review,
        showPrices,
        ...extra,
        ...(confirmRecipientOverride ? { confirmRecipientOverride: true } : {}),
      });
    let r = await post(false);
    if (
      r.status === 409 &&
      r.data.error === "recipient_mismatch" &&
      window.confirm(`${String(r.data.message ?? "Saņēmējs atšķiras no pasūtījumā saglabātā.")}\n\nSūtīt uz ${String(r.data.requested ?? customerEmail)}?`)
    ) {
      r = await post(true);
    }
    return r;
  };

  const send = async () => {
    if (busy) return;
    setErr(null);
    if (!text.trim()) {
      setErr("Teksts ir tukšs.");
      return;
    }
    if (channel === "whatsapp") {
      if (ready) {
        // PDF lejupielādējas, Nils to pievieno ziņai (kā dīlera datiem).
        setBusy("pdf");
        const pdf = await postReport({ action: "pdf", sessionId, showPrices });
        setBusy(null);
        if (!pdf.ok || typeof pdf.data.url !== "string") {
          setErr(auctionArchiveReportErrorLv(pdf.data.error));
          return;
        }
        window.open(`${pdf.data.url}&dl=1`, "_blank", "noopener,noreferrer");
      }
      window.open(dealerSendWhatsappUrl(bridge?.customerPhoneDigits, text.trim()), "_blank", "noopener,noreferrer");
      setBusy("send");
      const r = await record({});
      setBusy(null);
      if (r.ok && r.data.report) {
        onSent({ ...state, report: r.data.report as AuctionArchiveReportDoc, statusLine: String(r.data.statusLine ?? state.statusLine) }, "WhatsApp atvērts.");
      }
      onClose();
      return;
    }
    if (!customerEmail) {
      setErr("Nav klienta e-pasta (sadaļa «Klienta dati»).");
      return;
    }
    if (!subject.trim()) {
      setErr("Temats ir tukšs.");
      return;
    }
    setBusy(ready ? "pdf" : "send");
    const r = await record({ subject: subject.trim(), text: text.trim(), customerEmail });
    setBusy(null);
    if (!r.ok) {
      setErr(typeof r.data.message === "string" ? r.data.message : auctionArchiveReportErrorLv(r.data.error));
      return;
    }
    const to = String(r.data.to ?? customerEmail);
    onSent(
      { ...state, report: (r.data.report as AuctionArchiveReportDoc) ?? state.report, statusLine: String(r.data.statusLine ?? state.statusLine) },
      ready ? `E-pasts ar PDF nosūtīts uz ${to}.` : `E-pasts nosūtīts uz ${to}.`,
    );
    onClose();
  };

  if (!open) return null;
  const filename = auctionArchiveReportPdfFilename(state.vin);
  const refundLabel = paidCents != null && paidCents > 0 ? `${b2b ? "Atgriezt atlikumā" : "Atmaksa"} ${formatEurFromCents(paidCents)}` : null;

  const dialog = (
    <div
      data-auction-archive-send-dialog
      className="fixed inset-0 z-[80] flex bg-black/40 sm:items-center sm:justify-center sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auction-archive-send-title"
      {...busyClose}
    >
      <div
        className="amx amx-surface flex h-full max-h-[100dvh] w-full flex-col bg-white md:text-slate-900 sm:h-auto sm:max-h-[min(92vh,760px)] sm:max-w-lg sm:rounded-xl sm:border sm:border-slate-200 sm:shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 max-md:items-center max-md:border-b-0 max-md:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <h3 id="auction-archive-send-title" className="amx-tx text-[15px] font-semibold text-slate-900 max-md:text-[17px]">
              Sūtīt klientam · Izsoļu arhīvs
            </h3>
            <p className="amx-mut mt-0.5 truncate font-mono text-[11px] text-slate-500 max-md:text-[13px]">{state.vin}</p>
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
                {c === "email" ? "E-pasts" : "WhatsApp"}
              </button>
            ))}
          </div>

          <div>
            <p className={lbl}>Situācija</p>
            <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Situācija">
              {(["ready", "no_data", "cancelled"] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={situation === s} className={seg(situation === s)} onClick={() => setSituation(s)}>
                  {AUCTION_ARCHIVE_SEND_SITUATION_LV[s]}
                </button>
              ))}
            </div>
          </div>

          {ready ? (
            <div className="space-y-1.5">
              <ShowPricesCheckbox checked={showPrices} disabled={busy !== null} onChange={onShowPrices} />
              {priceBox ? (
                <label
                  className={`amx-card flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 max-md:min-h-[54px] max-md:items-center max-md:gap-3 max-md:px-3.5 ${
                    opts.offer ? "border-slate-900" : "border-slate-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 max-md:mt-0 max-md:h-[22px] max-md:w-[22px] max-md:accent-[var(--amx-acc)]"
                    checked={opts.offer}
                    disabled={busy !== null}
                    onChange={(e) => void toggleOffer(e.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="amx-tx text-[12.5px] font-medium text-slate-900 max-md:text-[15px]">Piedāvājums PROVIN AUDITS</div>
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
                  </div>
                </label>
              ) : null}
              <label
                className={`amx-card flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 max-md:min-h-[54px] max-md:items-center max-md:gap-3 max-md:px-3.5 ${
                  opts.review ? "border-slate-900" : "border-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 max-md:mt-0 max-md:h-[22px] max-md:w-[22px] max-md:accent-[var(--amx-acc)]"
                  checked={opts.review}
                  disabled={busy !== null}
                  onChange={(e) => setOpts((cur) => ({ ...cur, review: e.target.checked }))}
                />
                <div className="amx-tx text-[12.5px] font-medium text-slate-900 max-md:text-[15px]">Google atsauksmes lūgums</div>
              </label>
            </div>
          ) : (
            <div>
              {refundLabel ? (
                <span className="inline-flex rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                  {refundLabel} - atmaksu veic esošajā ceļā
                </span>
              ) : null}
            </div>
          )}

          {channel === "email" ? (
            <div>
              <label htmlFor="auction-archive-send-subj" className={`${lbl} block`}>
                Temats
              </label>
              <input
                id="auction-archive-send-subj"
                className="amx-fld w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] text-slate-900"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={busy !== null}
              />
              <p className="amx-mut mt-0.5 truncate text-[11px] text-slate-500 max-md:mt-1 max-md:text-[13px]">
                Kam: {customerEmail || <span className="text-rose-600">nav e-pasta</span>}
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor="auction-archive-send-msg" className={`${lbl} block`}>
              Teksts
            </label>
            <textarea
              id="auction-archive-send-msg"
              spellCheck={false}
              className="amx-fld amx-fld--ta min-h-[220px] w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[12.5px] leading-relaxed text-slate-900"
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
              <span className="flex items-center gap-2">
                <span className="amx-mut text-[11px] text-slate-500 max-md:text-[13px]">
                  {channel === "email" ? "PDF pievienos automātiski" : "PDF lejupielādēsies"}
                </span>
                <button type="button" className={`${dlgBtn} amx-btn amx-btn--sm`} disabled={busy !== null || !state.eligible} onClick={() => void viewPdf()}>
                  {busy === "pdf" ? "Gatavo…" : "Skatīt"}
                </button>
              </span>
            </div>
          ) : null}

          <p className="amx-mut text-[10.5px] text-slate-500 [overflow-wrap:anywhere]">{state.statusLine}</p>
          {err ? <p className="amx-tx--red text-[11.5px] text-rose-700 max-md:text-[14px]">{err}</p> : null}
        </div>

        <div className="sticky bottom-0 flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] amx-dock">
          <button type="button" className={`${dlgBtn} amx-btn max-md:flex-none`} disabled={busy !== null} onClick={onClose}>
            ← Atpakaļ
          </button>
          <button
            type="button"
            className={`${channel === "email" ? primary : waBtn} amx-btn amx-btn--primary max-md:flex-1`}
            disabled={busy !== null || (ready && !state.eligible)}
            onClick={() => void send()}
          >
            {busy === "pdf" ? "Gatavo PDF…" : busy === "send" ? "Sūta…" : channel === "email" ? "Sūtīt e-pastu" : "Atvērt WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
