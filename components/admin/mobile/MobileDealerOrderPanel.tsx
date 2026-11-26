"use client";

/**
 * Dīlera pasūtījums telefonā - B1 «Darbību režģis» (Nila «jā» 22.11, makets v3).
 * Lapas augšā zem galvenes: statusa kartīte (ielase + nosūtīšana), 2×2 pogas, servisa ieraksti, 2 AI lauki.
 * Pogas izsauc esošās funkcijas (tā pati loģika kā dīlera blokā, sk. `useDealerDataJobControls`).
 * Rāda tikai telefonā (OrderDetailWorkspace montē tikai `phoneStack`).
 */

import { useMemo, useState, type ReactNode } from "react";
import { AdminClientReportLinkControl } from "@/components/admin/AdminClientReportLinkControl";
import type { AutoRecordsServiceWorkRow } from "@/lib/auto-records-service-works";
import {
  adminIngestFromDealerJob,
  adminIngestSentLabel,
  type AdminOrderIngest,
} from "@/lib/admin-mobile-ingest";
import { dealerDataJobReadyAt, dealerDataRetryButtonLabel, type DealerDataJob } from "@/lib/dealer-data-job-types";
import { formatRigaDayTime } from "@/lib/order-client-marks";
import { openWindowSyncThen, PDF_PREPARING_HTML } from "@/lib/admin-open-window";
import { requestOpenAdminBlock } from "@/lib/admin-mobile-ds";
import { AdminDealerSendDialog, type DealerSendBridge } from "@/components/admin/AdminDealerSendDialog";
import { AdminAuctionArchivePanel } from "@/components/admin/AdminAuctionArchive";
import { AdminDealerShadowGateRow } from "@/components/admin/AdminDealerShadowGate";
import type { DealerShadowGate } from "@/lib/dealer-shadow-types";
import type { AutoRecordsBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { collectSourceBlockTexts, type DealerReviewScore } from "@/lib/dealer-review-score";
import { AdminDealerReviewGlassCard, useDealerReviewScore } from "@/components/admin/AdminDealerReviewCard";
import {
  dealerRefundCentsOf,
  resolveDealerPdfLang,
  useDealerDataJobControls,
} from "@/components/admin/useDealerDataJobControls";
import { AdminDealerRefundDialog } from "@/components/admin/AdminDealerRefundDialog";
import {
  AmxButton,
  AmxCard,
  AmxIcon,
  AmxLabel,
  AmxStatusDot,
  type AmxDotTone,
} from "@/components/admin/mobile/AdminMobileGlass";

export type MobileDealerRecord = { date: string; works: string; km: string };
export type MobileDealerAiField = { key: "service" | "comment"; title: string; text: string };

const SHOWN_RECORDS = 3;

/** «12.03.2024» -> «03.2024»; citādi kā ir. */
function shortDate(d: string): string {
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(d.trim());
  return m ? `${m[2].padStart(2, "0")}.${m[3]}` : d.trim();
}

function formatKm(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return `${Number(digits).toLocaleString("lv-LV").replace(/ |,/g, " ")} km`;
}

/** Servisa ieraksti telefona kopsavilkumam (tukšās rindas izlaiž). */
export function mobileDealerRecordsFromWorks(rows: readonly AutoRecordsServiceWorkRow[] | null | undefined): MobileDealerRecord[] {
  return (rows ?? [])
    .filter((r) => (r.works ?? "").trim() || (r.date ?? "").trim() || (r.odometer ?? "").trim())
    .map((r) => ({ date: shortDate(r.date ?? ""), works: (r.works ?? "").trim(), km: formatKm(r.odometer ?? "") }));
}

function ingestTone(i: AdminOrderIngest): AmxDotTone {
  if (i.state === "done") return "ok";
  if (i.state === "error" || i.state === "no_data") return "err";
  return "muted";
}

/** Statusa kartītes teksts: «Ielasīts · 14 ieraksti». */
export function mobileDealerStatusText(i: AdminOrderIngest): string {
  if (i.state === "done") return `Ielasīts · ${i.count ?? 0} ieraksti`;
  return i.label;
}

export type MobileDealerOrderPanelViewProps = {
  ingest: AdminOrderIngest;
  /** «šodien 09:12 · OneAuto». */
  statusSub: string;
  sentLabel: string;
  records: MobileDealerRecord[];
  aiFields: MobileDealerAiField[];
  busy: null | "run" | "refund" | "pdf";
  pdfDisabled: boolean;
  sendDisabled: boolean;
  /** Atmaksa redzama vienmēr (vieta režģī); pieejama tikai, kad esošais noteikums to atļauj. */
  refundEnabled: boolean;
  refundLabel: string;
  rerunEnabled: boolean;
  rerunLabel: string;
  notice: string | null;
  onPdf: () => void;
  onSend: () => void;
  onRefund: () => void;
  onRerun: () => void;
  onShowAllRecords: () => void;
  onEditAi: (key: MobileDealerAiField["key"]) => void;
  /** Ēnu režīma spriedums (nav - rinda netiek rādīta, ja nav darba). */
  shadowGate?: DealerShadowGate | null;
  shadowBusy?: boolean;
  onShadowRecheck?: () => void;
  /** «Atsauksmes iespēja» (tikai ieteikums). */
  review?: DealerReviewScore | null;
  /** Zem 2×2 pogām (piem. «Klienta saite»). */
  afterActions?: ReactNode;
};

/** Prezentācija (bez stāvokļa) - testējama ar SSR. */
export function MobileDealerOrderPanelView(p: MobileDealerOrderPanelViewProps) {
  const shown = p.records.slice(0, SHOWN_RECORDS);
  const noRecords = p.records.length === 0;
  return (
    <section className="amx mb-4" data-mobile-dealer-panel aria-label="Dīlera dati">
      <AmxCard className="flex items-center justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <AmxStatusDot tone={ingestTone(p.ingest)}>{mobileDealerStatusText(p.ingest)}</AmxStatusDot>
          {p.statusSub ? <div className="amx-mut ml-[14px] mt-0.5 truncate text-[12px]">{p.statusSub}</div> : null}
        </div>
        <AmxStatusDot tone={p.sentLabel === "Nosūtīts" ? "outline" : "neutral"}>{p.sentLabel}</AmxStatusDot>
      </AmxCard>
      {p.onShadowRecheck ? (
        <AdminDealerShadowGateRow glass gate={p.shadowGate} busy={p.shadowBusy} onRecheck={p.onShadowRecheck} />
      ) : null}

      <div className="amx-grid2 mt-2.5">
        <AmxButton icon="doc" disabled={p.pdfDisabled || p.busy !== null} onClick={p.onPdf}>
          {p.busy === "pdf" ? "Gatavo PDF…" : "Pārbaudīt PDF"}
        </AmxButton>
        <AmxButton variant="primary" icon="send" disabled={p.sendDisabled || p.busy !== null} onClick={p.onSend}>
          Sūtīt klientam
        </AmxButton>
        <AmxButton variant="danger" icon="undo" disabled={!p.refundEnabled || p.busy !== null} onClick={p.onRefund}>
          {p.busy === "refund" ? "Atmaksā…" : p.refundLabel}
        </AmxButton>
        <AmxButton icon="re" disabled={!p.rerunEnabled || p.busy !== null} onClick={p.onRerun}>
          {p.busy === "run" ? "Ielasa…" : p.rerunLabel}
        </AmxButton>
      </div>

      {p.afterActions ?? null}

      {p.notice ? <p className="amx-mut mt-2 px-1 text-[13px] [overflow-wrap:anywhere]">{p.notice}</p> : null}

      {p.review ? <AdminDealerReviewGlassCard review={p.review} /> : null}

      <AmxLabel>Pārbaude</AmxLabel>
      {noRecords ? (
        <AmxCard className="px-3.5 py-4">
          <span className="amx-tx--red text-[15px] font-semibold">Servisa ierakstu nav</span>
        </AmxCard>
      ) : (
        <AmxCard>
          {shown.map((r, i) => (
            <div key={i} className="amx-sv">
              <span className="amx-mut tabular-nums">{r.date}</span>
              <span className="min-w-0 truncate">{r.works || "-"}</span>
              <span className="tabular-nums">{r.km}</span>
            </div>
          ))}
          <button type="button" className="amx-row w-full text-left text-[14px]" onClick={p.onShowAllRecords}>
            <span className="w-[66px] shrink-0" />
            <span className="min-w-0 flex-1 font-semibold">Visi {p.records.length} ieraksti</span>
            <AmxIcon name="chev" className="h-5 w-5 shrink-0 text-[var(--amx-soft)]" />
          </button>
        </AmxCard>
      )}

      {p.aiFields.map((f) => (
        <AmxCard key={f.key} className="mt-2.5 px-3.5 py-3 text-[14.5px] leading-normal">
          <div className="mb-1.5 flex min-h-[30px] items-center justify-between gap-2">
            <b className="amx-mut text-[12px] font-semibold uppercase tracking-[0.06em]">{f.title}</b>
            <button
              type="button"
              className="amx-pill"
              onClick={() => p.onEditAi(f.key)}
            >
              <AmxIcon name="pen" className="h-[15px] w-[15px]" />
              Labot
            </button>
          </div>
          {f.text.trim() ? (
            <p className="line-clamp-6 whitespace-pre-line [overflow-wrap:anywhere]">{f.text.trim()}</p>
          ) : (
            <p className="amx-tx--red">Nav teksta</p>
          )}
        </AmxCard>
      ))}
    </section>
  );
}

const AI_ARIA: Record<MobileDealerAiField["key"], string> = {
  service: "Oficiālā dīlera dati - Servisa vēsture",
  comment: "Oficiālā dīlera dati - komentāri",
};

/** Atver dīlera bloku (telefonā sakļauts) un ritina līdz vajadzīgajam laukam. */
function focusInAutoRecords(selector: string | null): void {
  requestOpenAdminBlock("auto-records");
  window.setTimeout(() => {
    const root = document.getElementById("admin-order-block-auto-records");
    const target = (selector ? root?.querySelector<HTMLElement>(selector) : null) ?? root;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target && target !== root) {
      const input = target.matches("textarea, [contenteditable]")
        ? target
        : target.querySelector<HTMLElement>("textarea, [contenteditable]");
      input?.focus({ preventScroll: true });
    }
  }, 380);
}

export function mobileDealerStatusSub(job: DealerDataJob | null, nowMs: number = Date.now()): string {
  if (!job) return "";
  const at = dealerDataJobReadyAt(job) || job.finishedAt || job.updatedAt || "";
  const t = Date.parse(at);
  if (!Number.isFinite(t)) return "OneAuto";
  const dayTime = formatRigaDayTime(at);
  const today = formatRigaDayTime(new Date(nowMs).toISOString()).split(" ")[0];
  const [day, time] = dayTime.split(" ");
  return `${day === today ? `šodien ${time}` : dayTime} · OneAuto`;
}

type ContainerProps = {
  sessionId: string;
  orderVin: string;
  customerEmail?: string | null;
  canRefund: boolean;
  walletRefund: boolean;
  b2bClient: boolean;
  reportLang?: string | null;
  dealerSend: DealerSendBridge | null;
  serviceWorks: readonly AutoRecordsServiceWorkRow[] | null | undefined;
  serviceHistoryNotes: string;
  comments: string;
  /** «Atsauksmes iespēja»: dīlera bloks + visu avotu teksti (taxi pazīmes reģistros). */
  autoRecords?: AutoRecordsBlockState | null;
  sourceBlocks?: WorkspaceSourceBlocks | null;
};

export function MobileDealerOrderPanel({
  sessionId,
  orderVin,
  customerEmail = "",
  canRefund,
  walletRefund,
  b2bClient,
  reportLang = null,
  dealerSend,
  serviceWorks,
  serviceHistoryNotes,
  comments,
  autoRecords = null,
  sourceBlocks = null,
}: ContainerProps) {
  const c = useDealerDataJobControls({ sessionId, orderVin, editable: true, canRefund, walletRefund });
  const [pdfBusy, setPdfBusy] = useState(false);
  const [archKey, setArchKey] = useState(0);
  const records = useMemo(() => mobileDealerRecordsFromWorks(serviceWorks), [serviceWorks]);
  const reviewTexts = useMemo(() => (sourceBlocks ? collectSourceBlockTexts(sourceBlocks) : []), [sourceBlocks]);
  const review = useDealerReviewScore({ sessionId, job: c.job, autoRecords, vin: c.vin, extraTexts: reviewTexts });
  const pdfLang = resolveDealerPdfLang(reportLang);
  const sent = c.marks ? (c.marks.dealerSends ?? []).length > 0 : null;
  const ingest = adminIngestFromDealerJob(c.job, sent);
  const sentLabel = adminIngestSentLabel({ ...ingest, sent: sent ?? false }) ?? "Nav nosūtīts";

  /** Servera PDF jaunā cilnē (iOS rāda lapas pilnā platumā). Logs jāatver sinhroni pieskāriena brīdī. */
  const openPdf = async () => {
    if (!dealerSend || pdfBusy) return;
    const pre = openWindowSyncThen();
    pre.writeHtml(PDF_PREPARING_HTML);
    setPdfBusy(true);
    c.setNotice(null);
    try {
      const prepared = await dealerSend.prepareDealerPdf(pdfLang);
      pre.navigate(prepared.downloadUrl);
      void c.recheckShadow("pdf", { pathname: prepared.pdfPathname });
    } catch (e) {
      pre.close();
      c.setNotice(e instanceof Error ? e.message : "PDF netika izveidots.");
    } finally {
      setPdfBusy(false);
    }
  };

  if (!c.loaded) return null;

  const job = c.job;
  const refundLabel = c.refunded ? "Atmaksāts" : c.b2bRefund ? (walletRefund ? "Atmaksa uz atlikumu" : "Atgriezt kredītu") : "Atgriezt maksājumu";

  return (
    <>
      <MobileDealerOrderPanelView
        ingest={ingest}
        statusSub={mobileDealerStatusSub(job)}
        sentLabel={sentLabel}
        records={records}
        aiFields={[
          { key: "service", title: "Servisa vēsture", text: serviceHistoryNotes },
          { key: "comment", title: "Komentāri", text: comments },
        ]}
        busy={pdfBusy ? "pdf" : c.busy}
        pdfDisabled={!dealerSend || (ingest.state !== "done" && records.length === 0)}
        sendDisabled={false}
        refundEnabled={c.showRefund}
        refundLabel={refundLabel}
        rerunEnabled={Boolean(job)}
        rerunLabel={dealerDataRetryButtonLabel(job)}
        notice={c.notice}
        onPdf={() => void openPdf()}
        onSend={() => c.setDialog(c.defaultSituation)}
        onRefund={() => void c.refund()}
        onRerun={() => {
          if (job) void c.rerun(job.status === "done" || job.status === "no_data");
        }}
        onShowAllRecords={() => focusInAutoRecords(null)}
        onEditAi={(key) => focusInAutoRecords(`[aria-label="${AI_ARIA[key]}"]`)}
        shadowGate={job?.shadowGate ?? null}
        shadowBusy={c.shadowBusy}
        onShadowRecheck={job ? () => void c.recheckShadow("manual") : undefined}
        review={review}
        afterActions={
          <>
            <AdminClientReportLinkControl sessionId={sessionId} variant="glass" />
            <AdminAuctionArchivePanel sessionId={sessionId} refreshKey={archKey} onOpenSend={() => c.setDialog("archive")} />
          </>
        }
      />
      <AdminDealerRefundDialog
        open={c.refundDialog}
        onClose={() => c.setRefundDialog(false)}
        sessionId={sessionId}
        vin={c.vin}
        customerEmail={(customerEmail ?? "").trim()}
        customerPhoneDigits={dealerSend?.customerPhoneDigits ?? null}
        onRefunded={c.onStripeRefunded}
      />
      <AdminDealerSendDialog
        open={c.dialog !== null}
        onClose={() => c.setDialog(null)}
        sessionId={sessionId}
        vin={c.vin}
        b2b={b2bClient}
        customerEmail={(customerEmail ?? "").trim()}
        defaultSituation={c.dialog ?? c.defaultSituation}
        refundCents={dealerRefundCentsOf(job)}
        pdfLang={pdfLang}
        bridge={dealerSend}
        review={review}
        onSent={(next, msg) => {
          if (next) c.setMarks(next);
          c.setNotice(msg);
          setArchKey((k) => k + 1);
        }}
        shadow={
          job
            ? {
                gate: job.shadowGate,
                feedback: job.shadowFeedback,
                busy: c.shadowBusy,
                recheck: (trigger, pdf) => void c.recheckShadow(trigger, pdf),
                submitFeedback: (correct, note) => void c.submitShadowFeedback(correct, note),
              }
            : null
        }
      />
    </>
  );
}

