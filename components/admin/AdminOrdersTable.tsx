"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { formatMoneyEur } from "@/lib/format-money";

export type AdminOrdersTableRow = {
  id: string;
  created: number;
  amountTotal: number | null;
  currency: string | null;
  paymentStatus: string;
  customerEmail: string | null;
  vin: string | null;
  isDemo?: boolean;
  /** No pasūtījuma JSON pēc PDF saglabāšanas; ja nav — izmanto noklusējuma API ceļu. */
  invoicePdfUrl: string | null;
};

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

export function AdminOrdersTable({
  orders,
  dateFmt,
}: {
  orders: AdminOrdersTableRow[];
  dateFmt: Intl.DateTimeFormat;
}) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
              <th className="px-4 py-3.5">Datums</th>
              <th className="px-4 py-3.5">VIN</th>
              <th className="px-4 py-3.5">Klients</th>
              <th className="px-4 py-3.5">Statuss</th>
              <th className="px-4 py-3.5 text-right">Summa</th>
              <th className="px-4 py-3.5 text-center">Rēķins</th>
              <th className="px-4 py-3.5 text-right">Darbība</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((o) => {
              const pdfHref = invoicePdfHref(o);
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
                  <td className="max-w-[200px] truncate px-4 py-3.5 text-[var(--color-apple-text)]">
                    {o.customerEmail ?? "—"}
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
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/admin/orders/${encodeURIComponent(o.id)}`}
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
