"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { Check, FileText, Loader2, Pencil, Trash2, X } from "lucide-react";
import { formatMoneyEur } from "@/lib/format-money";
import type { SerializedAdminOrderTableRow } from "@/lib/serialize-admin-order-table";
import { AdminAuditDeadlineCell } from "@/components/admin/AdminAuditDeadlineCell";
import { AdminVinCopyButton } from "@/components/admin/AdminVinClipboardAndLinks";
import { shouldOpenAdminOrderFromRowClick } from "@/lib/admin-vin-urls";

export type AdminOrdersTableRow = SerializedAdminOrderTableRow;

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

const manualCellEditBtn =
  "inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200/90 bg-white text-[var(--color-provin-muted)] shadow-sm transition hover:border-[var(--color-provin-accent)]/35 hover:text-[var(--color-provin-accent)] disabled:cursor-not-allowed disabled:opacity-50";

async function patchManualOrderRequest(
  id: string,
  patch: { created?: number; amountTotal?: number | null },
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch("/api/admin/manual-orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    if (!res.ok) {
      return { ok: false, error: typeof data.error === "string" ? data.error : "Neizdevās saglabāt" };
    }
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Tīkla kļūda" };
  }
}

function unixToDatetimeLocalValue(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "79,99" / "79.99" / "80" → centi; tukšs → null; nederīgs → undefined. */
function parseAmountInputToCents(raw: string): number | null | undefined {
  const t = raw.trim().replace(/\s+/g, "").replace(/€$/u, "").replace(",", ".");
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  const cents = Math.round(Number.parseFloat(t) * 100);
  return Number.isFinite(cents) ? cents : undefined;
}

/** Manuālā pasūtījuma “Laiks” — skats + labošana (datetime-local). */
function ManualOrderDateCell({ id, created }: { id: string; created: number }) {
  const router = useRouter();
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "short", timeStyle: "short" });
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => unixToDatetimeLocalValue(created));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) {
      setError("Nederīgs datums");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await patchManualOrderRequest(id, { created: Math.floor(ms / 1000) });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }, [id, value, router]);

  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span>{dateFmt.format(new Date(created * 1000))}</span>
        <button
          type="button"
          onClick={() => {
            setValue(unixToDatetimeLocalValue(created));
            setError(null);
            setEditing(true);
          }}
          className={manualCellEditBtn}
          aria-label="Labot laiku"
          title="Labot laiku"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving}
          className="rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-[11px] text-[var(--color-apple-text)] shadow-sm focus:border-[var(--color-provin-accent)]/50 focus:outline-none"
        />
        <button type="button" onClick={() => void save()} disabled={saving} className={manualCellEditBtn} aria-label="Saglabāt laiku" title="Saglabāt">
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          )}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className={manualCellEditBtn} aria-label="Atcelt" title="Atcelt">
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </span>
      {error ? <span className="text-[10px] leading-snug text-red-600">{error}</span> : null}
    </span>
  );
}

/** Manuālā pasūtījuma “Summa” — skats + labošana (EUR). */
function ManualOrderAmountCell({
  id,
  amountTotal,
  currency,
}: {
  id: string;
  amountTotal: number | null;
  currency: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(() => (amountTotal == null ? "" : (amountTotal / 100).toFixed(2)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    const cents = parseAmountInputToCents(value);
    if (cents === undefined) {
      setError("Nederīga summa (piem. 79,99)");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await patchManualOrderRequest(id, { amountTotal: cents });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }, [id, value, router]);

  if (!editing) {
    return (
      <span className="inline-flex items-center justify-end gap-1.5">
        <span>{formatMoneyEur(amountTotal, currency)}</span>
        <button
          type="button"
          onClick={() => {
            setValue(amountTotal == null ? "" : (amountTotal / 100).toFixed(2));
            setError(null);
            setEditing(true);
          }}
          className={manualCellEditBtn}
          aria-label="Labot summu"
          title="Labot summu"
        >
          <Pencil className="h-3 w-3" strokeWidth={2} aria-hidden />
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1.5">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          disabled={saving}
          placeholder="79,99"
          className="w-20 rounded-md border border-slate-200/90 bg-white px-1.5 py-1 text-right text-[11px] tabular-nums text-[var(--color-apple-text)] shadow-sm focus:border-[var(--color-provin-accent)]/50 focus:outline-none"
          autoFocus
        />
        <span className="text-[11px] text-[var(--color-provin-muted)]">€</span>
        <button type="button" onClick={() => void save()} disabled={saving} className={manualCellEditBtn} aria-label="Saglabāt summu" title="Saglabāt">
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
          )}
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className={manualCellEditBtn} aria-label="Atcelt" title="Atcelt">
          <X className="h-3 w-3" strokeWidth={2.5} aria-hidden />
        </button>
      </span>
      {error ? <span className="text-[10px] leading-snug text-red-600">{error}</span> : null}
    </span>
  );
}

/** Manuālā pasūtījuma dzēšana (ar apstiprinājumu). */
function ManualOrderDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const onDelete = useCallback(async () => {
    if (!window.confirm("Dzēst šo manuālo pasūtījumu? Darbība nav atgriezeniska.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/manual-orders?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      console.error("[admin] manual order delete", res.status);
    } catch (e) {
      console.error("[admin] manual order delete", e);
    } finally {
      setDeleting(false);
    }
  }, [id, router]);

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={deleting}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200/90 bg-white text-red-500 shadow-sm transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Dzēst manuālo pasūtījumu"
      title="Dzēst manuālo pasūtījumu"
    >
      {deleting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      )}
    </button>
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
  const router = useRouter();
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "short", timeStyle: "short" });
  const [clientOverrides, setClientOverrides] = useState<
    Record<string, { customerName?: string; customerEmail?: string; customerPhone?: string; vin?: string }>
  >({});

  useEffect(() => {
    const run = () => {
      const next: Record<string, { customerName?: string; customerEmail?: string; customerPhone?: string; vin?: string }> = {};
      for (const o of orders) {
        try {
          const prefix = rowEditsLocalStoragePrefix(o, orderEditsLocalStorageKeyPrefix);
          const raw = localStorage.getItem(`${prefix}${o.id}`);
          if (!raw) continue;
          const p = JSON.parse(raw) as Record<string, unknown>;
          const customerName = typeof p.customerName === "string" ? p.customerName.trim() : "";
          const customerEmail = typeof p.customerEmail === "string" ? p.customerEmail.trim() : "";
          const customerPhone = typeof p.customerPhone === "string" ? p.customerPhone.trim() : "";
          const vin = typeof p.vin === "string" ? p.vin.trim() : "";
          if (!customerName && !customerEmail && !customerPhone && !vin) continue;
          next[o.id] = {
            ...(customerName ? { customerName } : {}),
            ...(customerEmail ? { customerEmail } : {}),
            ...(customerPhone ? { customerPhone } : {}),
            ...(vin ? { vin } : {}),
          };
        } catch {
          /* ignore localStorage parsing issues */
        }
      }
      setClientOverrides(next);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 800 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 0);
    return () => window.clearTimeout(t);
  }, [orders, orderEditsLocalStorageKeyPrefix]);

  const detailBaseNormalized = orderDetailHrefBase.replace(/\/$/, "");
  const hug = "w-[1%] whitespace-nowrap";

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
              <th className={`${hug} py-3.5 pl-4 pr-1`}>Datums</th>
              <th className={`${hug} py-3.5 pl-1 pr-4`}>Termiņš (48 h)</th>
              <th className="px-4 py-3.5">VIN</th>
              <th className="px-4 py-3.5">Marka, modelis</th>
              <th className="px-4 py-3.5">Klients</th>
              <th className={`${hug} py-3.5 pl-4 pr-1`}>Statuss</th>
              <th className={`${hug} px-1 py-3.5 text-right`}>Summa</th>
              <th className={`${hug} py-3.5 pl-1 pr-4 text-center`}>Rēķins</th>
              <th className={`${hug} px-4 py-3.5 text-right`}>Darbība</th>
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
              const vin = ov?.vin ?? (o.vin?.trim() ?? "");
              const hasVin = vin.length > 0;
              const primaryClient = name || email || phone || "—";
              const secondaryClient = [name ? email : "", phone].filter(Boolean).join(" · ");
              const orderHref = `${detailBase}/${encodeURIComponent(o.id)}`;
              const openOrderFromRow = (e: MouseEvent) => {
                if (!shouldOpenAdminOrderFromRowClick(e.target)) return;
                if (e.metaKey || e.ctrlKey || e.button === 1) {
                  window.open(orderHref, "_blank", "noopener,noreferrer");
                  return;
                }
                router.push(orderHref);
              };
              return (
                <tr
                  key={o.id}
                  className={
                    o.isDemo
                      ? "cursor-pointer bg-[var(--color-provin-accent-soft)]/25 transition-colors hover:bg-[var(--color-provin-accent-soft)]/45"
                      : "cursor-pointer transition-colors hover:bg-slate-50/90"
                  }
                  onClick={openOrderFromRow}
                  onAuxClick={(e) => {
                    if (e.button !== 1) return;
                    openOrderFromRow(e);
                  }}
                >
                  <td className={`${hug} py-3.5 pl-4 pr-1 text-[var(--color-apple-text)]`}>
                    <span className="flex flex-wrap items-center gap-2">
                      {o.isManual ? (
                        <ManualOrderDateCell id={o.id} created={o.created} />
                      ) : (
                        dateFmt.format(new Date(o.created * 1000))
                      )}
                      {o.isDemo ? (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/20">
                          Paraugs
                        </span>
                      ) : null}
                      {o.isManual ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-200/80">
                          Manuāls
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className={`${hug} py-3.5 pl-1 pr-4`}>
                    {hasVin ? (
                      <AdminAuditDeadlineCell
                        sessionId={o.id}
                        createdUnixSec={o.created}
                        initialComplete={Boolean(o.auditComplete)}
                      />
                    ) : (
                      <span className="text-[var(--color-provin-muted)]">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-[var(--color-apple-text)]">
                    {hasVin ? (
                      <span className="inline-flex max-w-full items-center gap-1">
                        <span className="whitespace-nowrap font-mono text-xs tracking-wide" title={vin}>
                          {vin}
                        </span>
                        <AdminVinCopyButton value={vin} />
                      </span>
                    ) : (
                      <span className="text-[var(--color-provin-muted)]">—</span>
                    )}
                  </td>
                  <td
                    className="max-w-[180px] truncate px-4 py-3.5 text-[13px] text-[var(--color-apple-text)]"
                    title={o.makeModel?.trim() || undefined}
                  >
                    {o.makeModel?.trim() || (
                      <span className="text-[var(--color-provin-muted)]">—</span>
                    )}
                  </td>
                  <td className="max-w-[260px] px-4 py-3.5 text-[var(--color-apple-text)]">
                    <div className="min-w-0">
                      <p className="truncate">{primaryClient}</p>
                      {secondaryClient ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--color-provin-muted)]">{secondaryClient}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${hug} py-3.5 pl-4 pr-1`}>
                    <PaymentStatusPill status={o.paymentStatus} />
                  </td>
                  <td className={`${hug} px-1 py-3.5 text-right tabular-nums font-medium text-[var(--color-apple-text)]`}>
                    {o.isManual ? (
                      <ManualOrderAmountCell id={o.id} amountTotal={o.amountTotal} currency={o.currency} />
                    ) : (
                      formatMoneyEur(o.amountTotal, o.currency)
                    )}
                  </td>
                  <td className={`${hug} py-3.5 pl-1 pr-4 text-center`}>
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
                  <td className={`${hug} px-4 py-3.5 text-right`}>
                    <span className="inline-flex items-center gap-2">
                      {o.isManual ? <ManualOrderDeleteButton id={o.id} /> : null}
                      <Link
                        href={`${detailBase}/${encodeURIComponent(o.id)}`}
                        className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[var(--color-provin-accent-hover)] hover:shadow-md"
                      >
                        Atvērt
                      </Link>
                    </span>
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
