"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { useHoldAdminOverlayCover } from "@/lib/admin-overlay-cover";
import {
  AdminClientSendShell,
  cachedAdminMessageTemplatesDoc,
  ClientSendChannelTabs,
  ClientSendSubjectField,
  ClientSendTextField,
  clientSendBtnClass,
  clientSendPrimaryClass,
  clientSendSegClass,
  clientSendWaBtnClass,
  loadAdminMessageTemplatesDoc,
} from "@/components/admin/AdminClientSendShell";
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
import { applyB2bSignature } from "@/lib/messages/localized-templates";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import type { OrderClientMarks } from "@/lib/order-client-marks";
import { dealerToAuditPricing, formatEurFromCents } from "@/lib/order-upsell";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
import { openWindowSyncThen, PDF_PREPARING_HTML } from "@/lib/admin-open-window";
import type { DealerShadowFeedback, DealerShadowGate } from "@/lib/dealer-shadow-types";
import { AdminDealerShadowFeedback } from "@/components/admin/AdminDealerShadowGate";
import type { DealerReviewScore } from "@/lib/dealer-review-score";
import { AdminDealerReviewIndicator } from "@/components/admin/AdminDealerReviewCard";
import { AdminClientLangSegments } from "@/components/admin/AdminClientLangControl";
import { AdminDealerSendExtraFiles, type DealerExtraItem } from "@/components/admin/AdminDealerSendExtraFiles";
import { dealerExtraFilesError } from "@/lib/dealer-send-extra-files";
import {
  AuctionArchiveSendSection,
  auctionArchiveErrorLv,
  postAuctionArchive,
  useAuctionArchiveState,
} from "@/components/admin/AdminAuctionArchive";
import type { AuctionArchiveManualSource } from "@/lib/auction-archive-offer";
import {
  dealerSignalsMessageBlock,
  dealerSignalsMissingTranslations,
  dealerSignalsPdfRows,
  type DealerSignalKind,
  type DealerSignalsState,
} from "@/lib/dealer-signals";
import { dealerSignalsReportTranslate } from "@/components/admin/AdminDealerSignalsMenu";
import {
  auctionArchiveOfferSubject,
  auctionArchiveOfferText,
  auctionArchiveOfferWhatsappText,
  auctionArchiveReadySubject,
  auctionArchiveReadyText,
  auctionArchiveReadyWhatsappText,
} from "@/lib/email/auction-archive-email";

/** Sūtīšanas loga situācija: 3 dīlera situācijas + «Izsoļu arhīvs» (Nils 23.11). */
export type DealerSendMode = DealerSendSituation | "archive";

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
  /** Pasūtījuma laiks (Stripe `created`, sekundes) - Black Friday piemaksai 79,99 €. */
  orderCreatedUnix?: number | null;
  /** Dīlera PDF sadaļa «Signāli ārpus dīlera datiem» ieslēgta (ar ķeksētu signālu) -> rinda e-pastā. */
  dealerSignalsOn?: boolean;
  /**
   * Saglabātais «Signāli» stāvoklis: «Datu nav (atmaksa)» gadījumā (dīlera datu nav, PDF nesūta)
   * ieslēgtie signāli nonāk pašā ziņā (Nils 28.11).
   */
  dealerSignals?: DealerSignalsState | null;
  /** `forSend` - tikai «Sūtīt»: «Signāli» piedāvājums top tagad un tā saite ir PDF (Nils 27.11). */
  prepareDealerPdf: (lang: ClientReportLang, opts?: { forSend?: boolean }) => Promise<SendReportPrepared>;
  /** Tas pats servera ceļš kā «Sūtīt atskaiti» (versijas, Dropbox, «Izpildīts»), ar admina tekstu. */
  sendDealerReport: (input: {
    prepared: SendReportPrepared;
    lang: ClientReportLang;
    subject: string;
    text: string;
    /** Serveris ieraksta sūtījumu klienta saziņas žurnālā. */
    dealerSend?: { situation: DealerSendSituation; offer: boolean; review: boolean };
    /** Papildu faili/bildes e-pastā blakus dīlera PDF (Nils 27.11). */
    extraFiles?: File[];
  }) => Promise<{ sentTo: string; dealerMarks?: OrderClientMarks }>;
  /**
   * Pēc veiksmīgas dīlera datu (PDF) nosūtīšanas e-pastā: saglabā melnrakstu un atgriežas uz pasūtījumu sarakstu.
   * Atgriež kļūdas tekstu, ja saglabāšana neizdevās (tad paliek pasūtījumā).
   */
  onDealerDataSent?: (info: { sentTo: string }) => Promise<string | null>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  vin: string;
  b2b: boolean;
  customerEmail: string;
  defaultSituation: DealerSendMode;
  refundCents: number | null;
  pdfLang: ClientReportLang;
  bridge?: DealerSendBridge | null;
  onSent: (marks: OrderClientMarks | null, notice: string) => void;
  shadow?: DealerSendShadow | null;
  /** «Atsauksmes iespēja»: tikai indikators pie ķekša (ķeksis pats neieslēdzas). */
  review?: DealerReviewScore | null;
};

const seg = clientSendSegClass;
const btn = clientSendBtnClass;
const primary = clientSendPrimaryClass;
const waBtn = clientSendWaBtnClass;

/** Saderībai: citi logi to importē no šejienes. */
export { loadAdminMessageTemplatesDoc };

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
  const [situation, setSituation] = useState<DealerSendMode>(defaultSituation);
  const [opts, setOpts] = useState<DealerSendOptions>({ offer: false, review: false });
  const [offer, setOffer] = useState<DealerSendOffer | null>(null);
  const [doc, setDoc] = useState<MessageTemplatesDoc | null>(cachedAdminMessageTemplatesDoc);
  // Sākuma temats un teksts jau pirmajā renderēšanā (no veidnes), nevis tukši līdz efektam.
  // «Datu nav (atmaksa)»: signāli ziņā (Nils 28.11) - ķeksis redzams, ja sadaļa ieslēgta un ir ķeksēts signāls.
  const signalsState = bridge?.dealerSignals ?? null;
  const signalsCount = useMemo(() => dealerSignalsPdfRows(signalsState, "lv").length, [signalsState]);
  const [signalsInText, setSignalsInText] = useState(true);
  const [signalsTr, setSignalsTr] = useState<Partial<Record<DealerSignalKind, string>> | null>(null);
  const signalsBlockFor = (sit: DealerSendMode): string | null =>
    sit === "no_data" && signalsInText && signalsCount > 0 ? dealerSignalsMessageBlock(signalsState, pdfLang, signalsTr) || null : null;
  const [initialMsg] = useState(() =>
    buildDealerSendMessage({
      channel: "email",
      situation: defaultSituation === "archive" ? "no_data" : defaultSituation,
      b2b,
      vin,
      refundCents,
      doc: cachedAdminMessageTemplatesDoc(),
      lang: pdfLang,
      signalsLine: bridge?.dealerSignalsOn === true,
      signalsBlock: signalsBlockFor(defaultSituation),
    }),
  );
  // Izsoļu arhīvs: stāvoklis tikai kamēr logs atvērts.
  const { state: arch, setState: setArch } = useAuctionArchiveState(sessionId, open);
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [manualSources, setManualSources] = useState<AuctionArchiveManualSource[]>([]);
  // «Rādīt izsoļu cenas» (Nils 23.11, lēmums 4): noklusējumā izslēgts - cenas nav ne tekstā, ne PDF.
  const [showPrices, setShowPrices] = useState(false);
  const archMode = situation === "archive";
  const archReady = archMode && arch?.offer?.status === "chose_archive";
  const archBlocked =
    archMode && (arch?.offer?.status === "chose_refund" || arch?.offer?.status === "archive_sent" || arch?.offer?.status === "refunded");
  const archVisible = Boolean(arch && (arch.eligible || arch.offer)) || defaultSituation === "archive";
  const archSuggested = Boolean(arch?.eligible && !arch.offer && defaultSituation === "no_data");
  const [subject, setSubject] = useState(initialMsg.subject ?? "");
  const [text, setText] = useState(initialMsg.text);
  const [busy, setBusy] = useState<null | "offer" | "pdf" | "send">(null);
  const [err, setErr] = useState<string | null>(null);
  const [pdfLink, setPdfLink] = useState<SendReportPrepared | null>(null);
  const [extraItems, setExtraItems] = useState<DealerExtraItem[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Logs vienmēr atveras augšā (kanāls, situācija, piedāvājums redzami).
  useLayoutEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setChannel("email");
    setSituation(defaultSituation);
    setOpts({ offer: false, review: false });
    setErr(null);
    setPdfLink(null);
    setExtraItems([]);
    setPreviewIds([]);
    setManualSources([]);
    setShowPrices(false);
    setSignalsInText(true);
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
  const orderCreatedUnix = bridge?.orderCreatedUnix ?? null;
  const offerPreview = useMemo(() => {
    const prior = paidCents != null && paidCents > 0 ? paidCents : null;
    if (prior == null) return null;
    return dealerToAuditPricing({ priorCents: prior, b2b, createdUnix: orderCreatedUnix });
  }, [paidCents, b2b, orderCreatedUnix]);
  const priceBox = offer ?? offerPreview;

  // Teksts pārģenerējas pēc katras izvēles (kanāls, situācija, ķekši).
  useEffect(() => {
    if (!open || situation !== "archive" || !arch) return;
    const ready = arch.offer?.status === "chose_archive";
    const sum = arch.offer && ready ? arch.offer.summary : arch.summary;
    // B2B paraksts tikai «PROVIN» (Nils 25.11).
    const sign = (t: string) => (b2b ? applyB2bSignature(t) : t);
    if (channel === "whatsapp") {
      setSubject("");
      setText(sign(ready ? auctionArchiveReadyWhatsappText(sum, pdfLang) : auctionArchiveOfferWhatsappText(sum, arch.paidCents, showPrices, pdfLang)));
    } else {
      setSubject(ready ? auctionArchiveReadySubject(sum, pdfLang) : auctionArchiveOfferSubject(sum, pdfLang));
      setText(sign(ready ? auctionArchiveReadyText(sum, showPrices, pdfLang) : auctionArchiveOfferText(sum, arch.paidCents, showPrices, pdfLang)));
    }
  }, [open, situation, channel, arch, showPrices, b2b, pdfLang]);

  // Piedāvājumā jau saglabātā izvēle (piem. «Sūtīt izsoļu arhīvu» pēc klienta «Jā»).
  const archOfferShowPrices = arch?.offer?.showPrices === true;
  useEffect(() => {
    if (open) setShowPrices(archOfferShowPrices);
  }, [open, archOfferShowPrices]);

  // Noklusējuma 2 bildes: pirmā + odometrs (makets 5A); Nils var mainīt.
  useEffect(() => {
    if (!open || !arch || previewIds.length > 0) return;
    const withThumb = arch.photos.filter((p) => p.thumb);
    if (withThumb.length === 0) return;
    const odo = withThumb.find((p) => /odomet/i.test(p.caption));
    setPreviewIds([withThumb[0]!.id, ...(odo && odo.id !== withThumb[0]!.id ? [odo.id] : withThumb[1] ? [withThumb[1].id] : [])]);
  }, [open, arch, previewIds.length]);

  // Labotā signālu teksta tulkojums klienta valodā (tas pats ceļš kā PDF); bez tā - standarta teksts klienta valodā.
  const signalsMissingKey = useMemo(() => {
    if (!open || situation !== "no_data" || signalsCount === 0 || pdfLang === "lv") return "";
    const missing = dealerSignalsMissingTranslations(signalsState, pdfLang);
    return Object.keys(missing).length > 0 ? JSON.stringify(missing) : "";
  }, [open, situation, signalsCount, signalsState, pdfLang]);
  useEffect(() => {
    setSignalsTr(null);
    if (!signalsMissingKey || pdfLang === "lv") return;
    let cancelled = false;
    const missing = JSON.parse(signalsMissingKey) as Partial<Record<DealerSignalKind, string>>;
    void dealerSignalsReportTranslate(sessionId)(pdfLang, missing)
      .then((tr) => {
        if (!cancelled) setSignalsTr(tr);
      })
      .catch(() => {
        /* standarta teksts klienta valodā */
      });
    return () => {
      cancelled = true;
    };
  }, [signalsMissingKey, pdfLang, sessionId]);
  const signalsBlock = signalsBlockFor(situation);

  useEffect(() => {
    if (!open || situation === "archive") return;
    const m = buildDealerSendMessage({
      channel,
      situation,
      b2b,
      vin,
      refundCents,
      offer: opts.offer ? offer : null,
      review: opts.review,
      doc,
      lang: pdfLang,
      signalsLine: bridge?.dealerSignalsOn === true,
      signalsBlock,
    });
    setSubject(m.subject ?? "");
    setText(m.text);
  }, [open, channel, situation, b2b, vin, refundCents, opts, offer, doc, pdfLang, bridge?.dealerSignalsOn, signalsBlock]);

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

  const sendFlags = () => {
    const sit: DealerSendSituation = situation === "archive" ? "no_data" : situation;
    return { situation: sit, offer: sit === "ready" && opts.offer, review: sit === "ready" && opts.review };
  };

  /** «Izsoļu arhīvs»: piedāvājums (pirms klienta izvēles) vai PDF (tikai pēc klienta «Jā»). */
  const sendArchive = async () => {
    if (!arch) return;
    if (archBlocked) {
      setErr("Klients jau izvēlējās atmaksu vai piedāvājums noslēgts.");
      return;
    }
    if (channel === "email" && !customerEmail.trim()) {
      setErr("Nav klienta e-pasta (sadaļa «Klienta dati»).");
      return;
    }
    if (channel === "email" && !subject.trim()) {
      setErr("Temats ir tukšs.");
      return;
    }
    setBusy("send");
    try {
      if (archReady && channel === "whatsapp") {
        // WhatsApp: PDF sagatavo un atver, Nils to pievieno ziņai; pēc tam atzīme «Arhīvs nosūtīts».
        const pdf = await postAuctionArchive({ action: "pdf", sessionId, showPrices });
        if (!pdf.ok || typeof pdf.data.url !== "string") {
          setErr(auctionArchiveErrorLv(pdf.data.error));
          return;
        }
        window.open(`${pdf.data.url}&dl=1`, "_blank", "noopener,noreferrer");
        window.open(dealerSendWhatsappUrl(bridge?.customerPhoneDigits, text.trim()), "_blank", "noopener,noreferrer");
        if (!window.confirm("PDF lejupielādēts un WhatsApp atvērts. Atzīmēt «Arhīvs nosūtīts», kad PDF aizsūtīts?")) return;
      }
      const post = (confirmRecipientOverride: boolean) =>
        postAuctionArchive({
          action: archReady ? "send_archive" : "send_offer",
          sessionId,
          channel,
          subject: subject.trim(),
          text: text.trim(),
          customerEmail: customerEmail.trim(),
          previewIds,
          manualSources,
          showPrices,
          // Klienta valoda: izvēles lapa, e-pasta HTML un atgādinājums tajā pašā valodā kā teksts.
          lang: pdfLang,
          ...(confirmRecipientOverride ? { confirmRecipientOverride: true } : {}),
        });
      let r = await post(false);
      if (
        r.status === 409 &&
        r.data.error === "recipient_mismatch" &&
        window.confirm(`${String(r.data.message ?? "Saņēmējs atšķiras no pasūtījumā saglabātā.")}\n\nSūtīt uz ${String(r.data.requested ?? customerEmail.trim())}?`)
      ) {
        r = await post(true);
      }
      if (!r.ok) {
        setErr(typeof r.data.message === "string" ? r.data.message : auctionArchiveErrorLv(r.data.error));
        return;
      }
      if (r.data.offer) setArch({ ...arch, offer: r.data.offer as NonNullable<typeof arch.offer> });
      if (!archReady && channel === "whatsapp") {
        window.open(dealerSendWhatsappUrl(bridge?.customerPhoneDigits, text.trim()), "_blank", "noopener,noreferrer");
      }
      onSent(
        null,
        archReady
          ? channel === "email"
            ? `Izsoļu arhīvs (PDF) nosūtīts uz ${String(r.data.to ?? customerEmail)}.`
            : "Atzīmēts: izsoļu arhīvs nosūtīts (WhatsApp)."
          : channel === "email"
            ? `Piedāvājums nosūtīts uz ${String(r.data.to ?? customerEmail)} - gaida klienta izvēli.`
            : "WhatsApp atvērts - gaida klienta izvēli (atbildi «1/2» atzīmē pasūtījumā).",
      );
      onClose();
    } finally {
      setBusy(null);
    }
  };

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
    if (situation === "archive") {
      if (!text.trim()) {
        setErr("Teksts ir tukšs.");
        return;
      }
      await sendArchive();
      return;
    }
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
      const extraFiles = extraItems.map((x) => x.file);
      const preErr = dealerExtraFilesError(extraFiles);
      if (preErr) {
        setErr(preErr);
        return;
      }
      setBusy("pdf");
      try {
        const prepared = await bridge.prepareDealerPdf(pdfLang, { forSend: true });
        recheckWithPdf(prepared);
        // PDF (ar bildēm) + faili kopā e-pasta limitā (18 MB) - kļūda logā pirms sūtīšanas.
        const sizeErr = dealerExtraFilesError(extraFiles, prepared.bytes);
        if (sizeErr) {
          setErr(sizeErr);
          return;
        }
        setBusy("send");
        const r = await bridge.sendDealerReport({
          prepared,
          lang: pdfLang,
          subject: subject.trim(),
          text: text.trim(),
          dealerSend: sendFlags(),
          ...(extraFiles.length > 0 ? { extraFiles } : {}),
        });
        const withFiles = extraFiles.length > 0 ? ` un ${extraFiles.length} ${extraFiles.length === 1 ? "failu" : "failiem"}` : "";
        await finish(`E-pasts ar PDF${withFiles} nosūtīts uz ${r.sentTo}.`, r.dealerMarks ?? null);
        if (bridge.onDealerDataSent) {
          const navErr = await bridge.onDealerDataSent({ sentTo: r.sentTo });
          if (navErr) window.alert(navErr);
        }
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
            lang: pdfLang,
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
  // 22.11 (Nils, dators): uz body logs manto vietnes tumšās tēmas baltu teksta krāsu - krāsas čaulā norādītas tieši.
  const dialog = (
    <AdminClientSendShell
      kind="dealer"
      titleId="dealer-send-title"
      title="Sūtīt klientam"
      subtitle={<p className="amx-mut mt-0.5 truncate font-mono text-[11px] text-slate-500 max-md:text-[13px]">{vin}</p>}
      onClose={onClose}
      closeDisabled={busy !== null}
      backdropProps={busyClose}
      scrollRef={scrollRef}
      footer={
        <>
          <button type="button" className={`${btn} amx-btn max-md:flex-none`} disabled={busy !== null} onClick={onClose}>
            ← Atpakaļ
          </button>
          <button
            type="button"
            className={`${channel === "email" ? primary : waBtn} amx-btn amx-btn--primary max-md:flex-1`}
            disabled={busy !== null || (archMode && (!arch || archBlocked))}
            onClick={() => void send()}
          >
            {busy === "pdf" && channel === "email"
              ? "Gatavo PDF…"
              : busy === "send"
                ? "Sūta…"
                : channel === "email"
                  ? archMode
                    ? archReady
                      ? "Sūtīt izsoļu arhīvu"
                      : "Sūtīt piedāvājumu"
                    : "Sūtīt e-pastu"
                  : "Atvērt WhatsApp"}
          </button>
        </>
      }
    >
      <AdminClientLangSegments disabled={busy !== null} />
      <ClientSendChannelTabs channel={channel} onChange={setChannel} />

      <div>
        <p className="amx-mut mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500 max-md:text-[11.5px]">Situācija</p>
        <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Situācija">
          {(archVisible ? (["ready", "no_data", "archive", "cancelled"] as const) : (["ready", "no_data", "cancelled"] as const)).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={situation === s} className={seg(situation === s)} onClick={() => setSituation(s)}>
              {s === "archive" ? (
                <>
                  {archSuggested ? <span aria-label="Ieteikts" className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#0061D2] align-middle" /> : null}
                  Izsoļu arhīvs
                </>
              ) : (
                DEALER_SEND_SITUATION_LV[s]
              )}
            </button>
          ))}
        </div>
      </div>

      {archMode ? (
        arch ? (
          <AuctionArchiveSendSection
            state={arch}
            previewIds={previewIds}
            onPreviewIds={setPreviewIds}
            manualSources={manualSources}
            onManualSources={setManualSources}
            disabled={busy !== null}
            showPrices={showPrices}
            onShowPrices={setShowPrices}
          />
        ) : (
          <p className="amx-mut text-[11.5px] text-slate-500">Ielādē izsoļu arhīvu…</p>
        )
      ) : ready ? (
        <div className="space-y-1.5">
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
                onChange={(e) => void toggle("offer", e.target.checked)}
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
                {busy === "offer" ? <div className="text-[11px] text-slate-500">Veido saiti…</div> : null}
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
              onChange={(e) => void toggle("review", e.target.checked)}
            />
            <div>
              <div className="amx-tx text-[12.5px] font-medium text-slate-900 max-md:text-[15px]">Google atsauksmes lūgums</div>
              {review ? <AdminDealerReviewIndicator review={review} /> : null}
            </div>
          </label>
        </div>
      ) : (
        <div className="space-y-1.5">
          {situation === "no_data" && signalsCount > 0 ? (
            <label
              data-dealer-send-signals
              className={`amx-card flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 max-md:min-h-[54px] max-md:items-center max-md:gap-3 max-md:px-3.5 ${
                signalsInText ? "border-slate-900" : "border-slate-200"
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 max-md:mt-0 max-md:h-[22px] max-md:w-[22px] max-md:accent-[var(--amx-acc)]"
                checked={signalsInText}
                disabled={busy !== null}
                onChange={(e) => setSignalsInText(e.target.checked)}
              />
              <div className="amx-tx text-[12.5px] font-medium text-slate-900 max-md:text-[15px]">
                Signāli tekstā ({signalsCount})
              </div>
            </label>
          ) : null}
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
        </div>
      )}

      {channel === "email" ? (
        <ClientSendSubjectField
          id="dealer-send-subj"
          value={subject}
          onChange={setSubject}
          disabled={busy !== null}
          recipient={customerEmail}
        />
      ) : null}

      <ClientSendTextField id="dealer-send-msg" value={text} onChange={setText} disabled={busy !== null} />

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

      {ready && channel === "email" && bridge ? (
        <AdminDealerSendExtraFiles items={extraItems} onChange={setExtraItems} disabled={busy !== null} />
      ) : null}

      {archReady ? (
        <div className="amx-card flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 max-md:min-h-[54px] max-md:px-3.5">
          <div className="amx-tx flex min-w-0 items-center gap-2 text-[11.5px] text-slate-700 max-md:text-[14px]">
            <span className="rounded bg-rose-600 px-1 py-px text-[9px] font-bold text-white">PDF</span>
            <span className="truncate">Izsoļu arhīvs · {arch?.offer?.photos.length ?? 0} bildes</span>
          </div>
          <span className="amx-mut text-[11px] text-slate-500 max-md:text-[13px]">
            {channel === "email" ? "PDF pievienos automātiski" : "PDF lejupielādēsies"}
          </span>
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
    </AdminClientSendShell>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
