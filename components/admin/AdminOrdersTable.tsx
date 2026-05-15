"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, FileText, Loader2, Send } from "lucide-react";
import { formatMoneyEur } from "@/lib/format-money";
import type { SerializedAdminOrderTableRow } from "@/lib/serialize-admin-order-table";
import { idbGetPortfolio, type StoredPortfolioBlob } from "@/lib/admin-portfolio-idb";
import {
  isNotifyBlobUploadEnabled,
  postNotifyReportReadyMultipart,
  postNotifyReportReadyViaBlob,
  type NotifyPortfolioUploadItem,
} from "@/lib/admin-notify-report-ready-client";

export type AdminOrdersTableRow = SerializedAdminOrderTableRow;

const NOTIFY_ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function inferPortfolioMime(p: StoredPortfolioBlob): string | null {
  const m = (p.mime ?? "").trim().toLowerCase();
  if (NOTIFY_ALLOWED_MIME.has(m)) return m;
  const n = (p.name ?? "").toLowerCase();
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".gif")) return "image/gif";
  return null;
}

function PaymentStatusPill({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "paid") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
        Apmaksāts
      </span>
    );
  }
  if (s === "unpaid") {
    return (
      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/90">
        Pirms apmaksas
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
      {status}
    </span>
  );
}

function invoicePdfHref(row: AdminOrdersTableRow): string | null {
  if (row.paymentStatus !== "paid" || row.amountTotal == null) return null;
  return row.invoicePdfUrl ?? `/api/admin/invoice/${encodeURIComponent(row.id)}/pdf`;
}

const CONSULTATION_EDITS_PREFIX = "provin-admin-consultation-edits-v1-";

function rowDetailHrefBase(row: AdminOrdersTableRow, defaultBase: string): string {
  if (row.checkoutLine === "provin_select") return "/admin/konsultacijas";
  return defaultBase;
}

function rowEditsLocalStoragePrefix(row: AdminOrdersTableRow, tableDefaultPrefix: string): string {
  if (row.checkoutLine === "provin_select") return CONSULTATION_EDITS_PREFIX;
  return tableDefaultPrefix;
}

function NotifyReportReadyCell({
  sessionId,
  paymentStatus,
  customerEmail,
}: {
  sessionId: string;
  paymentStatus: string;
  customerEmail: string | null;
}) {
  const paid = paymentStatus.toLowerCase() === "paid";
  const email = customerEmail?.trim() ?? "";
  const [phase, setPhase] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [lastSentTo, setLastSentTo] = useState<string | null>(null);
  const [skippedCount, setSkippedCount] = useState(0);

  const sendWithAttachments = useCallback(async () => {
    setErrMsg(null);
    setPhase("loading");
    setSkippedCount(0);
    try {
      const stored = (await idbGetPortfolio(sessionId)) ?? [];
      let skipped = 0;
      const uploads: NotifyPortfolioUploadItem[] = [];
      for (const p of stored) {
        const mime = inferPortfolioMime(p);
        if (!mime) {
          skipped += 1;
          continue;
        }
        uploads.push({
          buffer: p.buffer,
          name: p.name || "pielikums",
          mime,
          lastModified: Number.isFinite(Date.parse(p.addedAt)) ? Date.parse(p.addedAt) : Date.now(),
        });
      }
      setSkippedCount(skipped);

      const blobOn = await isNotifyBlobUploadEnabled();
      const { res, data } =
        blobOn && uploads.length > 0
          ? await postNotifyReportReadyViaBlob({
              sessionId,
              customerEmail: email || undefined,
              uploads,
            })
          : await (async () => {
              const fd = new FormData();
              fd.append("sessionId", sessionId);
              if (email) fd.append("customerEmail", email);
              for (const u of uploads) {
                const blob = new Blob([u.buffer], { type: u.mime });
                const file = new File([blob], u.name, {
                  type: u.mime,
                  lastModified: u.lastModified ?? Date.now(),
                });
                fd.append("attachment", file);
              }
              return postNotifyReportReadyMultipart(fd);
            })();
      const message = typeof data.message === "string" ? data.message : null;
      const detail = typeof data.detail === "string" ? data.detail : null;
      const composed = [message, detail].filter(Boolean).join(" — ") || null;
      if (!res.ok) {
        const fallback =
          typeof data.error === "string"
            ? data.error
            : "Neizdevās nosūtīt";
        setErrMsg(composed ?? fallback);
        setPhase("error");
        console.error("[admin] notify-report-ready", res.status, data);
        return;
      }
      const sentTo = typeof data.sentTo === "string" ? data.sentTo.trim() : null;
      setLastSentTo(sentTo);
      setPhase("sent");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tīkla kļūda";
      setErrMsg(msg);
      setPhase("error");
      console.error("[admin] notify-report-ready fetch", e);
    }
  }, [email, sessionId]);

  if (!paid) {
    return <span className="text-[11px] text-[var(--color-provin-muted)]">—</span>;
  }
  if (!email) {
    return <span className="text-[11px] font-medium text-amber-800">Nav e-pasta</span>;
  }
  if (phase === "sent") {
    return (
      <span className="inline-flex max-w-[220px] flex-col items-end gap-0.5 text-[11px] font-semibold text-emerald-800">
        <span className="inline-flex items-center gap-1">
          <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          Nosūtīts
        </span>
        {lastSentTo ? (
          <span className="break-all text-right text-[10px] font-normal text-emerald-900/90" title="Faktiskais saņēmējs">
            → {lastSentTo}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => {
          setErrMsg(null);
          setPhase("idle");
          setLastSentTo(null);
          setSkippedCount(0);
          void sendWithAttachments();
        }}
        disabled={phase === "loading"}
        className="inline-flex max-w-[200px] items-center justify-center gap-1.5 rounded-full border border-slate-200/90 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-provin-accent)] shadow-sm transition hover:border-[var(--color-provin-accent)]/35 hover:bg-[var(--color-provin-accent-soft)]/40 disabled:cursor-not-allowed disabled:opacity-60"
        title="Nosūtīt klientam e-pastu ar klienta portfeļa failiem un rēķinu"
      >
        {phase === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Send className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        )}
        Nosūtīt atskaiti
      </button>
      {phase === "error" && errMsg ? (
        <p className="max-w-[220px] text-right text-[10px] leading-snug text-red-600">{errMsg}</p>
      ) : null}
      {phase === "idle" && skippedCount > 0 ? (
        <p className="max-w-[220px] text-right text-[10px] leading-snug text-amber-700">
          {skippedCount} portfeļa faili netika pievienoti (neatbalstīts formāts).
        </p>
      ) : null}
    </div>
  );
}

export function AdminOrdersTable({
  orders,
  orderDetailHrefBase = "/admin/orders",
  orderEditsLocalStorageKeyPrefix = "provin-admin-order-edits-v1-",
  consultationList = false,
}: {
  orders: AdminOrdersTableRow[];
  /** Piem. `/admin/konsultacijas` — saite „Atvērt”. */
  orderDetailHrefBase?: string;
  /** Lokālā pārdefinēšana klienta laukiem tabulā (atšķirīgs prefikss konsultācijām). */
  orderEditsLocalStorageKeyPrefix?: string;
  /** Saglabāts API savietojamībai (konsultāciju saraksta wrapperiem). */
  consultationList?: boolean;
}) {
  void consultationList;
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "short", timeStyle: "short" });
  const [clientOverrides, setClientOverrides] = useState<
    Record<string, { customerName?: string; customerEmail?: string; customerPhone?: string }>
  >({});

  useEffect(() => {
    const next: Record<string, { customerName?: string; customerEmail?: string; customerPhone?: string }> = {};
    for (const o of orders) {
      try {
        const prefix = rowEditsLocalStoragePrefix(o, orderEditsLocalStorageKeyPrefix);
        const raw = localStorage.getItem(`${prefix}${o.id}`);
        if (!raw) continue;
        const p = JSON.parse(raw) as Record<string, unknown>;
        const customerName = typeof p.customerName === "string" ? p.customerName.trim() : "";
        const customerEmail = typeof p.customerEmail === "string" ? p.customerEmail.trim() : "";
        const customerPhone = typeof p.customerPhone === "string" ? p.customerPhone.trim() : "";
        if (!customerName && !customerEmail && !customerPhone) continue;
        next[o.id] = {
          ...(customerName ? { customerName } : {}),
          ...(customerEmail ? { customerEmail } : {}),
          ...(customerPhone ? { customerPhone } : {}),
        };
      } catch {
        /* ignore localStorage parsing issues */
      }
    }
    setClientOverrides(next);
  }, [orders, orderEditsLocalStorageKeyPrefix]);

  const detailBaseNormalized = orderDetailHrefBase.replace(/\/$/, "");

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
              <th className="px-4 py-3.5">Datums</th>
              <th className="px-4 py-3.5">VIN</th>
              <th className="px-4 py-3.5">Klients</th>
              <th className="px-4 py-3.5">Statuss</th>
              <th className="px-4 py-3.5 text-right">Summa</th>
              <th className="px-4 py-3.5 text-center">Rēķins</th>
              <th className="px-4 py-3.5 text-right">Atskaite</th>
              <th className="px-4 py-3.5 text-right">Darbība</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => {
              const pdfHref = invoicePdfHref(o);
              const detailBase = rowDetailHrefBase(o, detailBaseNormalized);
              const ov = clientOverrides[o.id];
              const name = ov?.customerName ?? (o.customerName?.trim() ?? "");
              const email = ov?.customerEmail ?? (o.customerEmail?.trim() ?? "");
              const phone = ov?.customerPhone ?? (o.customerPhone?.trim() ?? "");
              const primaryClient = name || email || phone || "—";
              const secondaryClient = [name ? email : "", phone].filter(Boolean).join(" · ");
              return (
                <tr
                  key={o.id}
                  className={
                    o.isDemo
                      ? "bg-[var(--color-provin-accent-soft)]/25 transition-colors hover:bg-[var(--color-provin-accent-soft)]/45"
                      : "transition-colors hover:bg-slate-50/90"
                  }
                >
                  <td className="whitespace-nowrap px-4 py-3.5 text-[var(--color-apple-text)]">
                    <span className="flex flex-wrap items-center gap-2">
                      {dateFmt.format(new Date(o.created * 1000))}
                      {o.isDemo ? (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/20">
                          Paraugs
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3.5 font-mono text-xs text-[var(--color-apple-text)]">
                    {o.vin ?? "—"}
                  </td>
                  <td className="max-w-[260px] px-4 py-3.5 text-[var(--color-apple-text)]">
                    <div className="min-w-0">
                      <p className="truncate">{primaryClient}</p>
                      {secondaryClient ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--color-provin-muted)]">{secondaryClient}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <PaymentStatusPill status={o.paymentStatus} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right tabular-nums font-medium text-[var(--color-apple-text)]">
                    {formatMoneyEur(o.amountTotal, o.currency)}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {pdfHref ? (
                      <a
                        href={pdfHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 text-[var(--color-provin-accent)] shadow-sm transition hover:border-[var(--color-provin-accent)]/40 hover:bg-[var(--color-provin-accent-soft)]/50"
                        aria-label="Atvērt rēķinu PDF"
                        title="Rēķins (PDF)"
                      >
                        <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
                      </a>
                    ) : (
                      <span className="text-[var(--color-provin-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right align-middle">
                    <NotifyReportReadyCell
                      sessionId={o.id}
                      paymentStatus={o.paymentStatus}
                      customerEmail={email || null}
                    />
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`${detailBase}/${encodeURIComponent(o.id)}`}
                      className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] hover:shadow-md"
                    >
                      Atvērt
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
