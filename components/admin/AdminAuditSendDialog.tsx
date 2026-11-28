"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  clientSendLabelClass,
  clientSendPrimaryClass,
  clientSendSegClass,
  clientSendWaBtnClass,
  loadAdminMessageTemplatesDoc,
  type ClientSendChannel,
} from "@/components/admin/AdminClientSendShell";
import type { SendReportPrepared, SendReportRecipientRole, SendReportResult } from "@/components/admin/AdminSendReportDialog";
import { AdminDealerSendExtraFiles, type DealerExtraItem } from "@/components/admin/AdminDealerSendExtraFiles";
import { CriticalSourceIssuesAlert } from "@/components/admin/AdminSourceConsistencyBar";
import { ADMIN_MOBILE_MQ } from "@/lib/admin-mobile-shell";
import { openWindowSyncThen, PDF_PREPARING_HTML } from "@/lib/admin-open-window";
import { sendReportAttachmentDisplay, type SendReportAttachmentInput } from "@/lib/admin-send-report-attachments";
import {
  AUDIT_SEND_CHECKS,
  AUDIT_SEND_CHECKS_EMPTY,
  AUDIT_SEND_SITUATION_LV,
  auditSendBlockedReason,
  auditSendChecksAfterPdfChange,
  auditSendChecksDone,
  auditSendLangOptions,
  auditSendReviewDefault,
  buildAuditSendMessage,
  type AuditSendChecks,
  type AuditSendSituation,
} from "@/lib/audits-send-message";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { dealerSendWhatsappUrl } from "@/lib/dealer-send-message";
import { DEALER_EXTRA_MAX_FILES, DEALER_SEND_MAX_TOTAL_BYTES, dealerExtraFilesError, formatFileSize } from "@/lib/dealer-send-extra-files";
import type { MessageTemplatesDoc } from "@/lib/messages/types";
import { formatRigaDateTime } from "@/lib/order-client-marks";
import { ReportRecipientMismatchError } from "@/lib/report-recipient-guard";
import type { SourceIssue } from "@/lib/source-consistency";

/** Vecā forma pieejama 2 nedēļas (Nils 27.11) - pēc tam saiti «Vecā forma» noņem. */
export const AUDIT_SEND_OLD_FORM_UNTIL = "2026-12-11";

export type AuditSendInput = {
  prepared: SendReportPrepared;
  lang: ClientReportLang;
  attachmentIds: string[];
  extraFiles: File[];
  markComplete: boolean;
  saveDropbox: boolean;
  subject: string;
  text: string;
  /** `review` - Google atsauksmes lūgums nākamajā darba dienā (B2B vienmēr `false`). */
  auditSend: { situation: AuditSendSituation; b2b: boolean; consult: boolean; review: boolean };
  confirmRecipientOverride?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  vin: string;
  /** «Audi A6 Avant 3.0 TDI» (B2C tekstam un pamatdatu pārbaudei). */
  car: string | null;
  /** Pamatdatu rinda pārbaudei (VIN · auto · numurs). */
  basicsLine: string;
  b2b: boolean;
  recipientRole: SendReportRecipientRole;
  customerEmail: string;
  customerPhoneDigits: string | null;
  /** Sākuma valoda (partnera fiksētā vai pasūtījuma klienta valoda). */
  initialLang: ClientReportLang;
  /** Automātiski noteiktā valoda (punkts pie pogas). */
  autoLang: ClientReportLang | null;
  /** Partnera fiksētā valoda; cita valoda - tikai pēc `onUnlockLang` apstiprinājuma. */
  lockedLang: ClientReportLang | null;
  onUnlockLang: () => boolean;
  /** Valodas maiņa saglabājas pasūtījumā (tikai, ja nav partnera valodas). */
  onLangPersist?: (lang: ClientReportLang) => void;
  attachments: ReadonlyArray<SendReportAttachmentInput>;
  criticalIssues?: readonly SourceIssue[];
  prepare: (lang: ClientReportLang) => Promise<SendReportPrepared>;
  send: (input: AuditSendInput) => Promise<SendReportResult>;
  /** WhatsApp: «Izpildīts» atzīme (e-pastam to dara serveris). */
  setComplete: (complete: boolean) => Promise<void>;
  /** WhatsApp sūtījuma ieraksts žurnālā. */
  recordWhatsapp: (input: { situation: AuditSendSituation; lang: ClientReportLang; b2b: boolean; review: boolean }) => Promise<void>;
  /** «Vecā forma» (AdminSendReportDialog). */
  onOpenOldForm: () => void;
  /** Pēc nosūtīšanas «Aizvērt»: saglabā melnrakstu un atgriežas sarakstā. */
  onDone: () => void;
  /** B2C pēc e-pasta: «WhatsApp: atskaite nosūtīta». */
  whatsappPingHref: string | null;
};

type Sent = {
  channel: ClientSendChannel;
  sentTo: string;
  version: number | null;
  files: number;
  bytes: number;
  dropbox: string;
  completed: boolean;
};

const UNDO_SECONDS = 30;

export function AdminAuditSendDialog(props: Props) {
  const {
    open,
    onClose,
    vin,
    car,
    basicsLine,
    b2b,
    recipientRole,
    customerEmail,
    customerPhoneDigits,
    initialLang,
    autoLang,
    lockedLang,
    onUnlockLang,
    onLangPersist,
    attachments,
    criticalIssues,
    prepare,
    send,
    setComplete,
    recordWhatsapp,
    onOpenOldForm,
    onDone,
    whatsappPingHref,
  } = props;
  const [channel, setChannel] = useState<ClientSendChannel>("email");
  const [situation, setSituation] = useState<AuditSendSituation>("ready");
  const [lang, setLang] = useState<ClientReportLang>(initialLang);
  const [doc, setDoc] = useState<MessageTemplatesDoc | null>(cachedAdminMessageTemplatesDoc);
  const [initialMsg] = useState(() =>
    buildAuditSendMessage({ channel: "email", situation: "ready", b2b, vin, car, lang: initialLang, doc: cachedAdminMessageTemplatesDoc() }),
  );
  const [subject, setSubject] = useState(initialMsg.subject ?? "");
  const [text, setText] = useState(initialMsg.text);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(attachments.map((a) => a.id)));
  const [extraItems, setExtraItems] = useState<DealerExtraItem[]>([]);
  const [consult, setConsult] = useState(!b2b);
  const [reviewAsk, setReviewAsk] = useState(() => auditSendReviewDefault(b2b));
  const [saveDropbox, setSaveDropbox] = useState(true);
  const [markDone, setMarkDone] = useState(true);
  const [checks, setChecks] = useState<AuditSendChecks>(AUDIT_SEND_CHECKS_EMPTY);
  const [prepared, setPrepared] = useState<{ p: SendReportPrepared; lang: ClientReportLang; at: string } | null>(null);
  const [busy, setBusy] = useState<null | "pdf" | "send">(null);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const [undone, setUndone] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (open && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setChannel("email");
    setSituation("ready");
    setLang(initialLang);
    setPicked(new Set(attachments.map((a) => a.id)));
    setExtraItems([]);
    setConsult(!b2b);
    setReviewAsk(auditSendReviewDefault(b2b));
    setSaveDropbox(true);
    setMarkDone(true);
    setChecks(AUDIT_SEND_CHECKS_EMPTY);
    setPrepared(null);
    setErr(null);
    setSent(null);
    setUndoLeft(0);
    setUndone(false);
    void loadAdminMessageTemplatesDoc().then((d) => d && setDoc(d));
    // Atverot tikai; pielikumu saraksts loga laikā nemainās.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Temats un teksts pārģenerējas pēc valodas, kanāla un situācijas (rediģēto tekstu pārraksta izvēles maiņa).
  useEffect(() => {
    if (!open) return;
    const m = buildAuditSendMessage({ channel, situation, b2b, vin, car, lang, doc });
    setSubject(m.subject ?? "");
    setText(m.text);
  }, [open, channel, situation, b2b, vin, car, lang, doc]);

  useEffect(() => {
    if (undoLeft <= 0) return;
    const t = window.setTimeout(() => setUndoLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(t);
  }, [undoLeft]);

  const busyClose = useModalBackdropClose(onClose, busy === null);
  // Telefona doks nedrīkst aizsegt «Sūtīt» pogu (22.11).
  useHoldAdminOverlayCover(open);

  const langOptions = auditSendLangOptions(b2b);
  const pdfFresh = prepared && prepared.lang === lang ? prepared : null;

  const totals = useMemo(() => {
    const port = attachments.filter((a) => picked.has(a.id));
    const files = port.length + extraItems.length;
    const bytes =
      port.reduce((s, a) => s + (typeof a.size === "number" && a.size > 0 ? a.size : 0), 0) +
      extraItems.reduce((s, x) => s + x.file.size, 0);
    return { files, bytes };
  }, [attachments, picked, extraItems]);

  const blocked = auditSendBlockedReason({ checks, busy: busy !== null, channel, email: customerEmail, subject, text });
  const done = auditSendChecksDone(checks);

  const changeLang = (l: ClientReportLang) => {
    if (l === lang || busy) return;
    if (lockedLang && l !== lockedLang && !onUnlockLang()) return;
    setLang(l);
    setChecks((c) => auditSendChecksAfterPdfChange(c));
    if (!lockedLang) onLangPersist?.(l);
  };
  const changeSituation = (s: AuditSendSituation) => {
    if (s === situation) return;
    setSituation(s);
    setChecks((c) => auditSendChecksAfterPdfChange(c));
  };

  const doPrepare = async (): Promise<SendReportPrepared> => {
    const p = await prepare(lang);
    setPrepared({ p, lang, at: new Date().toISOString() });
    return p;
  };

  const viewPdf = async (refresh: boolean) => {
    if (busy) return;
    if (!refresh && pdfFresh) {
      window.open(pdfFresh.p.downloadUrl, "_blank", "noopener,noreferrer");
      return;
    }
    // Telefonā (iOS Safari) logs jāatver sinhroni pieskāriena brīdī.
    const phonePre =
      typeof window !== "undefined" && window.matchMedia(ADMIN_MOBILE_MQ).matches ? openWindowSyncThen() : null;
    phonePre?.writeHtml(PDF_PREPARING_HTML);
    setBusy("pdf");
    setErr(null);
    try {
      const p = await doPrepare();
      if (refresh) setChecks((c) => auditSendChecksAfterPdfChange(c));
      if (phonePre) phonePre.navigate(p.downloadUrl);
      else window.open(p.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      phonePre?.close();
      setErr(e instanceof Error ? e.message : "PDF netika izveidots.");
    } finally {
      setBusy(null);
    }
  };

  const sendNow = async () => {
    if (blocked) return;
    setErr(null);
    if (channel === "whatsapp") {
      setBusy("pdf");
      try {
        const p = pdfFresh?.p ?? (await doPrepare());
        window.open(p.downloadUrl, "_blank", "noopener,noreferrer");
        window.open(dealerSendWhatsappUrl(customerPhoneDigits, text.trim()), "_blank", "noopener,noreferrer");
        setBusy("send");
        await recordWhatsapp({ situation, lang, b2b, review: !b2b && reviewAsk });
        let completed = false;
        if (markDone) {
          try {
            await setComplete(true);
            completed = true;
          } catch {
            setErr("Neizdevās atzīmēt «Izpildīts».");
          }
        }
        setSent({ channel, sentTo: "", version: null, files: 1, bytes: p.bytes, dropbox: "nav saglabāts (WhatsApp)", completed });
        if (completed) setUndoLeft(UNDO_SECONDS);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "PDF netika izveidots.");
      } finally {
        setBusy(null);
      }
      return;
    }
    const extraFiles = extraItems.map((x) => x.file);
    const preErr = dealerExtraFilesError(extraFiles);
    if (preErr) {
      setErr(preErr);
      return;
    }
    if (totals.files > DEALER_EXTRA_MAX_FILES) {
      setErr(`Var pievienot līdz ${DEALER_EXTRA_MAX_FILES} failiem.`);
      return;
    }
    setBusy("pdf");
    try {
      const p = pdfFresh?.p ?? (await doPrepare());
      if (totals.bytes + p.bytes > DEALER_SEND_MAX_TOTAL_BYTES) {
        setErr(
          `Par lielu e-pastam: PDF ${formatFileSize(p.bytes)} + pielikumi ${formatFileSize(totals.bytes)} (kopā līdz ${formatFileSize(DEALER_SEND_MAX_TOTAL_BYTES)}). Noņem kādu failu.`,
        );
        return;
      }
      setBusy("send");
      const input: AuditSendInput = {
        prepared: p,
        lang,
        attachmentIds: attachments.filter((a) => picked.has(a.id)).map((a) => a.id),
        extraFiles,
        markComplete: markDone,
        saveDropbox,
        subject: subject.trim(),
        text: text.trim(),
        auditSend: { situation, b2b, consult: !b2b && consult, review: !b2b && reviewAsk },
      };
      let r: SendReportResult;
      try {
        r = await send(input);
      } catch (e) {
        if (!(e instanceof ReportRecipientMismatchError)) throw e;
        if (!window.confirm(`${e.message}\n\nSaglabātais: ${e.stored || "-"}\nSūtīt uz ${e.requested}?`)) return;
        r = await send({ ...input, confirmRecipientOverride: true });
      }
      setPrepared(null);
      setSent({
        channel,
        sentTo: r.sentTo,
        version: r.version,
        files: 1 + totals.files,
        bytes: p.bytes + totals.bytes,
        dropbox: r.dropboxPath ?? r.dropboxError ?? "nav saglabāts",
        completed: Boolean(r.completedAt),
      });
      if (r.completedAt) setUndoLeft(UNDO_SECONDS);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās nosūtīt.");
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    setUndoLeft(0);
    try {
      await setComplete(false);
      setUndone(true);
    } catch {
      setErr("Neizdevās atsaukt atzīmi «Izpildīts».");
    }
  };

  if (!open) return null;

  const off = busy !== null;
  const segRow = (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <p className={clientSendLabelClass}>Valoda</p>
        <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Valoda">
          {langOptions.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              className={clientSendSegClass(lang === l)}
              disabled={off}
              title={lockedLang && l !== lockedLang ? `Partnera valoda: ${lockedLang.toUpperCase()}` : undefined}
              onClick={() => changeLang(l)}
            >
              {autoLang === l ? (
                <span aria-label="Noteikts automātiski" className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[#2563eb] align-middle" />
              ) : null}
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {lockedLang ? (
          <p className="amx-mut mt-0.5 text-[11px] text-slate-500 max-md:text-[13px]">Partnera valoda: {lockedLang.toUpperCase()}</p>
        ) : null}
      </div>
      <div>
        <p className={clientSendLabelClass}>Kanāls</p>
        <ClientSendChannelTabs channel={channel} onChange={setChannel} disabled={off} />
      </div>
    </div>
  );

  const situationRow = (
    <div>
      <p className={clientSendLabelClass}>Situācija</p>
      <div className="amx-seg flex rounded-lg bg-slate-100 p-[3px]" role="tablist" aria-label="Situācija">
        {(["ready", "fixed"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={situation === s}
            className={clientSendSegClass(situation === s)}
            disabled={off}
            onClick={() => changeSituation(s)}
          >
            {AUDIT_SEND_SITUATION_LV[s]}
          </button>
        ))}
      </div>
    </div>
  );

  const fields = (
    <div className="space-y-3">
      {channel === "email" ? (
        <ClientSendSubjectField id="audit-send-subj" value={subject} onChange={setSubject} disabled={off} recipient={customerEmail} />
      ) : (
        <p className="amx-mut text-[11px] text-slate-500 max-md:text-[13px]">
          WhatsApp: {customerPhoneDigits ? `+${customerPhoneDigits}` : <span className="text-rose-600">nav tālruņa - izvēle WhatsApp pusē</span>}
        </p>
      )}
      <ClientSendTextField id="audit-send-msg" value={text} onChange={setText} disabled={off} />
    </div>
  );

  const pdfCard = (
    <div data-audit-send-pdf>
      <p className={clientSendLabelClass}>Atskaite (PDF)</p>
      <div className="amx-card rounded-lg border border-slate-200 px-3 py-2 max-md:px-3.5">
        <div className="amx-tx flex min-w-0 items-center gap-2 text-[11.5px] text-slate-700 max-md:text-[14px]">
          <span className="rounded bg-rose-600 px-1 py-px text-[9px] font-bold text-white">PDF</span>
          <span className="truncate font-medium">{pdfFresh ? pdfFresh.p.filename : "Tiks izveidots no jaunākā melnraksta"}</span>
        </div>
        <p className="amx-mut mt-1 text-[11px] tabular-nums text-slate-500 max-md:text-[12.5px]">
          {pdfFresh
            ? `${situation === "fixed" ? "Labota versija · " : ""}${lang.toUpperCase()} · ${formatRigaDateTime(pdfFresh.at)} · ${formatFileSize(pdfFresh.p.bytes)}`
            : `${lang.toUpperCase()} · PDF top serverī, sūtot - automātiski`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={`${clientSendBtnClass} amx-btn amx-btn--sm`} disabled={off} onClick={() => void viewPdf(false)}>
            {busy === "pdf" ? "Gatavo PDF…" : "Skatīt PDF"}
          </button>
          {pdfFresh ? (
            <button type="button" className={`${clientSendBtnClass} amx-btn amx-btn--sm max-md:hidden`} disabled={off} onClick={() => void viewPdf(true)}>
              Atjaunot
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );

  const pct = Math.min(100, ((totals.bytes + (pdfFresh?.p.bytes ?? 0)) / DEALER_SEND_MAX_TOTAL_BYTES) * 100);
  const attachmentsCard =
    channel === "whatsapp" ? (
      <div>
        <p className={clientSendLabelClass}>Pielikumi</p>
        <p className="amx-card amx-mut rounded-lg border border-slate-200 px-3 py-2 text-[12px] text-slate-500 max-md:text-[13.5px]">
          WhatsApp: PDF lejupielādēsies, pievieno ziņai.
        </p>
      </div>
    ) : (
      <div data-audit-send-attachments>
        <p className={`${clientSendLabelClass} flex justify-between gap-2`}>
          <span>Pielikumi no portfeļa</span>
          <span className="normal-case tracking-normal tabular-nums">
            {1 + totals.files} / {DEALER_EXTRA_MAX_FILES}
          </span>
        </p>
        <div className="amx-card space-y-2 rounded-lg border border-slate-200 px-3 py-2 max-md:px-3.5">
          {attachments.length > 0 ? (
            <ul className="space-y-0.5" aria-label="Pielikumi no portfeļa">
              {attachments.map((a) => {
                const row = sendReportAttachmentDisplay(a);
                return (
                  <li key={a.id}>
                    <label className="flex min-h-[34px] cursor-pointer items-center gap-2.5 text-[12.5px] text-slate-800 max-md:min-h-11 max-md:text-[14px]">
                      <input
                        type="checkbox"
                        className="max-md:h-[22px] max-md:w-[22px]"
                        disabled={off}
                        checked={picked.has(a.id)}
                        onChange={(e) =>
                          setPicked((cur) => {
                            const n = new Set(cur);
                            if (e.target.checked) n.add(a.id);
                            else n.delete(a.id);
                            return n;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1 truncate" title={row.title}>
                        {row.name}
                      </span>
                      {row.sizeLabel ? <span className="shrink-0 text-[11.5px] tabular-nums text-slate-500">{row.sizeLabel}</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="amx-mut text-[12px] text-slate-500">Portfelī failu nav - tikai atskaites PDF.</p>
          )}
          <div>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              <i className="block h-full rounded-full bg-[#1d1d1f]" style={{ width: `${pct.toFixed(1)}%` }} />
            </div>
            <p className="amx-mut mt-1 text-[11px] tabular-nums text-slate-500">
              {formatFileSize(totals.bytes + (pdfFresh?.p.bytes ?? 0))} no {formatFileSize(DEALER_SEND_MAX_TOTAL_BYTES)}
              {pdfFresh ? " · ar PDF" : " · bez PDF"}
            </p>
          </div>
        </div>
        <div className="mt-2">
          <AdminDealerSendExtraFiles items={extraItems} onChange={setExtraItems} disabled={off} />
        </div>
      </div>
    );

  const optionRow = (label: string, checked: boolean, onChange: (v: boolean) => void, disabled = false, dataAttr?: string) => (
    <label
      {...(dataAttr ? { [dataAttr]: "" } : {})}
      className={`flex min-h-[34px] items-center gap-2.5 text-[12.5px] text-slate-800 max-md:min-h-11 max-md:text-[14px] ${disabled ? "opacity-50" : "cursor-pointer"}`}
    >
      <input
        type="checkbox"
        className="max-md:h-[22px] max-md:w-[22px]"
        disabled={off || disabled}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
  const optionsCard = (
    <div>
      <p className={clientSendLabelClass}>Opcijas</p>
      <div className="amx-card rounded-lg border border-slate-200 px-3 py-1 max-md:px-3.5">
        {!b2b && channel === "email" ? optionRow("Konsultācijas bloks e-pastā", consult, setConsult) : null}
        {/* Kā vecajā formā: B2B - izslēgts un neaktīvs. Lūgums - atsevišķs e-pasts nākamajā darba dienā. */}
        {optionRow("Lūgt Google atsauksmi", !b2b && reviewAsk, setReviewAsk, b2b, "data-audit-send-review")}
        {channel === "email" ? optionRow("Kopija Dropbox /_PROv/", saveDropbox, setSaveDropbox) : null}
        {optionRow("Pēc nosūtīšanas atzīmēt «Izpildīts»", markDone, setMarkDone)}
      </div>
    </div>
  );

  const issues = criticalIssues?.length ?? 0;
  const checkInfo: [string, string, boolean][] = [
    [
      AUDIT_SEND_CHECKS[0],
      pdfFresh
        ? `${pdfFresh.p.filename} · ${formatRigaDateTime(pdfFresh.at)} · ${formatFileSize(pdfFresh.p.bytes)}`
        : "Atver «Skatīt PDF» - jaunākais melnraksts",
      false,
    ],
    [AUDIT_SEND_CHECKS[1], "Visi lauki, par kuriem kādā avotā ir dati", false],
    [AUDIT_SEND_CHECKS[2], basicsLine || vin, false],
    [AUDIT_SEND_CHECKS[3], issues > 0 ? `Kritiskas pretrunas: ${issues}` : "0 kritisku pretrunu", issues > 0],
  ];
  const checklist = (
    <div data-audit-send-checklist className="amx-card overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 text-[12.5px] font-semibold text-slate-900 max-md:text-[14px]">
        <span>Pārbaude pirms sūtīšanas</span>
        <span
          className={`rounded-full px-2 py-px text-[11.5px] font-semibold tabular-nums ${
            done === AUDIT_SEND_CHECKS.length ? "bg-[#e6f6ec] text-[#15803d]" : "bg-slate-100 text-slate-700"
          }`}
        >
          {done} / {AUDIT_SEND_CHECKS.length}
        </span>
      </div>
      {checkInfo.map(([title, info, red], i) => (
        <label key={title} className="flex cursor-pointer items-start gap-2.5 border-t border-slate-100 px-3 py-2 first-of-type:border-t-0 max-md:py-2.5">
          <input
            type="checkbox"
            className="mt-0.5 max-md:h-[22px] max-md:w-[22px]"
            disabled={off}
            checked={checks[i]}
            onChange={(e) =>
              setChecks((c) => {
                const n = [...c] as [boolean, boolean, boolean, boolean];
                n[i] = e.target.checked;
                return n;
              })
            }
          />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-slate-900 max-md:text-[14px]">{title}</span>
            <span className={`block break-words text-[11.5px] tabular-nums max-md:text-[12.5px] ${red ? "text-rose-700" : "text-slate-500"}`}>
              {info}
            </span>
          </span>
        </label>
      ))}
    </div>
  );

  const sentView = sent ? (
    <div className="space-y-3 py-2 text-[13px] text-slate-900" data-audit-send="sent">
      <p className="text-[15px] font-semibold">
        {sent.channel === "email" ? `Nosūtīts uz ${sent.sentTo}` : "WhatsApp atvērts"}
        {sent.version ? ` · versija ${sent.version}${sent.version > 1 || situation === "fixed" ? " (labota)" : ""}` : ""}
      </p>
      <p className="amx-mut break-all text-[12.5px] text-slate-500">
        {sent.files} {sent.files === 1 ? "fails" : "faili"} · {formatFileSize(sent.bytes)}
      </p>
      <p className="amx-mut break-all text-[12.5px] text-slate-500">Dropbox: {sent.dropbox}</p>
      {sent.completed ? (
        <p className="flex flex-wrap items-center gap-2 text-[12.5px]">
          {undone ? "Atzīme «Izpildīts» atsaukta." : "Pasūtījums atzīmēts «Izpildīts»."}
          {!undone && undoLeft > 0 ? (
            <button type="button" className={`${clientSendBtnClass} amx-btn`} onClick={() => void undo()}>
              Atsaukt ({undoLeft})
            </button>
          ) : null}
        </p>
      ) : null}
      {!b2b && sent.channel === "email" && whatsappPingHref ? (
        <a href={whatsappPingHref} target="_blank" rel="noopener noreferrer" className={`${clientSendWaBtnClass} inline-flex items-center`}>
          WhatsApp: atskaite nosūtīta
        </a>
      ) : null}
      {err ? <p className="text-[11.5px] text-rose-700">{err}</p> : null}
    </div>
  ) : null;

  const footer = sent ? (
    <>
      <span />
      <button type="button" className={`${clientSendPrimaryClass} amx-btn amx-btn--primary max-md:flex-1`} onClick={onDone}>
        Aizvērt
      </button>
    </>
  ) : (
    <>
      <button type="button" className={`${clientSendBtnClass} amx-btn max-md:flex-none`} disabled={off} onClick={onClose}>
        ← Atpakaļ
      </button>
      <div className="flex items-center gap-3 max-md:flex-1">
        {blocked && done < AUDIT_SEND_CHECKS.length ? (
          <span className="amx-mut text-[12px] text-slate-500 max-md:hidden">
            Pārbaude {done} / {AUDIT_SEND_CHECKS.length}
          </span>
        ) : null}
        <button
          type="button"
          data-audit-send-submit
          className={`${channel === "email" ? clientSendPrimaryClass : clientSendWaBtnClass} amx-btn amx-btn--primary max-md:flex-1`}
          disabled={blocked !== null}
          title={blocked ?? undefined}
          onClick={() => void sendNow()}
        >
          {busy === "pdf" ? "Gatavo PDF…" : busy === "send" ? "Sūta…" : channel === "email" ? "Sūtīt e-pastu" : "Atvērt WhatsApp"}
          {done < AUDIT_SEND_CHECKS.length ? (
            <span className="ml-2 hidden rounded-full bg-white/25 px-1.5 text-[11px] font-semibold tabular-nums max-md:inline-block">
              {done}/{AUDIT_SEND_CHECKS.length}
            </span>
          ) : null}
        </button>
      </div>
    </>
  );

  const roleLabel = recipientRole === "partner" || b2b ? "B2B partneris" : "Klients";
  const dialog = (
    <AdminClientSendShell
      kind="audit"
      wide
      titleId="audit-send-title"
      title="Sūtīt atskaiti"
      titleExtra={
        <>
          <span className="rounded-md bg-slate-100 px-1.5 py-px text-[11px] font-semibold tracking-[0.2px] text-slate-700">PROVIN AUDITS</span>
          {b2b ? <span className="rounded-md bg-slate-100 px-1.5 py-px text-[11px] font-medium text-slate-500">B2B · diskrēts</span> : null}
        </>
      }
      subtitle={
        <p className="amx-mut mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11.5px] text-slate-500 max-md:text-[13px]">
          <span className="font-mono text-slate-900">{vin}</span>
          <span className="truncate max-md:hidden">
            {roleLabel}: {customerEmail.trim() || "nav e-pasta"}
          </span>
          {/* Vecā forma - 2 nedēļas (līdz AUDIT_SEND_OLD_FORM_UNTIL). */}
          <button type="button" className="underline underline-offset-2 hover:text-slate-900" disabled={off} onClick={onOpenOldForm}>
            Vecā forma
          </button>
        </p>
      }
      onClose={onClose}
      closeDisabled={off}
      backdropProps={busyClose}
      scrollRef={scrollRef}
      footer={footer}
    >
      {sentView ?? (
        <div className="flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_360px] md:items-start md:gap-5">
          <div className="contents md:flex md:flex-col md:gap-3">
            <div className="max-md:order-1">{segRow}</div>
            <div className="max-md:order-2">{situationRow}</div>
            {issues > 0 ? (
              <div className="max-md:order-3">
                <CriticalSourceIssuesAlert issues={criticalIssues} />
              </div>
            ) : null}
            <div className="max-md:order-4">{fields}</div>
            <div className="max-md:order-6">{attachmentsCard}</div>
          </div>
          <div className="contents md:flex md:flex-col md:gap-3">
            <div className="max-md:order-5">{pdfCard}</div>
            <div className="max-md:order-8">{checklist}</div>
            <div className="max-md:order-7">{optionsCard}</div>
            {err ? <p className="amx-tx--red text-[11.5px] text-rose-700 max-md:order-9 max-md:text-[14px]">{err}</p> : null}
          </div>
        </div>
      )}
    </AdminClientSendShell>
  );

  if (typeof document === "undefined") return dialog;
  return createPortal(dialog, document.body);
}
