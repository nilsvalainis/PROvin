"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Check, FileText, Loader2, Pencil, Trash2, X } from "lucide-react";
import { formatMoneyEur } from "@/lib/format-money";
import type { SerializedAdminOrderTableRow } from "@/lib/serialize-admin-order-table";
import { isDealerHighlightAdminOrder, isMiniHighlightAdminOrder } from "@/lib/admin-customer-identity";
import {
  b2bPackInfoLabelLv,
  isB2bPackAdminOrder,
  isPartnerHighlightAdminOrder,
  isPartnerVinAdminOrder,
  PARTNER_VIN_AMOUNT_LABEL_LV,
  partnerAuditPurposeLabelLv,
} from "@/lib/b2b-partner-orders";
import { AdminPartnerArchivePdfButton } from "@/components/admin/AdminPartnerArchivePdfButton";
import { sortAdminOrdersIncompleteFirst } from "@/lib/admin-audit-deadline-complete";
import { AdminAuditDeadlineCell } from "@/components/admin/AdminAuditDeadlineCell";
import {
  AdminAuditResultColorControl,
} from "@/components/admin/AdminAuditResultColorControl";
import { AdminVinCopyButton } from "@/components/admin/AdminVinClipboardAndLinks";
import { shouldOpenAdminOrderFromRowClick } from "@/lib/admin-vin-urls";
import {
  AUDIT_RESULT_COLORS,
  AUDIT_RESULT_COLOR_DOT_CLASS,
  AUDIT_RESULT_COLOR_LABEL_LV,
  type AuditResultColor,
} from "@/lib/admin-audit-result-color";

export type AdminOrdersTableRow = SerializedAdminOrderTableRow;

/** Avota ikona pie klienta (agrāk atsevišķa kolonna „Avots”). Nosaukums — tooltip. */
const SOURCE_ICON: Record<string, { bg: string; ch: string }> = {
  tiktok: { bg: "#000000", ch: "♪" },
  youtube: { bg: "#ff0000", ch: "▶" },
  instagram: { bg: "linear-gradient(45deg,#f58529,#dd2a7b,#8134af)", ch: "◎" },
  facebook: { bg: "#1877f2", ch: "f" },
  google: { bg: "#4285f4", ch: "G" },
};
function SourceIcon({ source }: { source: string | null | undefined }) {
  const label = source?.trim();
  if (!label) return null;
  const hit = SOURCE_ICON[label.toLowerCase()] ?? { bg: "#8e8e93", ch: label.charAt(0).toUpperCase() };
  return (
    <span
      title={`Kur uzzināja: ${label}`}
      aria-label={`Kur uzzināja: ${label}`}
      role="img"
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold leading-none text-white"
      style={{ background: hit.bg }}
    >
      {hit.ch}
    </span>
  );
}

/** Statuss tikai izņēmumiem — „Apmaksāts” nerādām. */
function PaymentStatusException({ status }: { status: string }) {
  if (status.toLowerCase() === "paid") return null;
  return <PaymentStatusPill status={status} />;
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

type OrderRowView = {
  pdfHref: string | null;
  detailBase: string;
  orderHref: string;
  vin: string;
  hasVin: boolean;
  primaryClient: string;
  secondaryClient: string;
  dealerHighlight: boolean;
  miniHighlight: boolean;
  partnerHighlight: boolean;
  partnerCompanyName: string;
  partnerPurposeLabel: string;
  isPack: boolean;
  packLabel: string;
  isPartnerVin: boolean;
};

type ClientOverride = {
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  vin?: string;
};

/** Viena rinda gan tabulai, gan telefona kartēm, lai abi skati nekad neatšķiras. */
function orderRowView(
  o: AdminOrdersTableRow,
  ov: ClientOverride | undefined,
  detailBaseNormalized: string,
): OrderRowView {
  const detailBase = rowDetailHrefBase(o, detailBaseNormalized);
  const name = ov?.customerName ?? (o.customerName?.trim() ?? "");
  const email = ov?.customerEmail ?? (o.customerEmail?.trim() ?? "");
  const phone = ov?.customerPhone ?? (o.customerPhone?.trim() ?? "");
  const vin = ov?.vin ?? (o.vin?.trim() ?? "");
  const partnerCompanyName = o.partnerCompanyName?.trim() ?? "";
  const isPack = isB2bPackAdminOrder(o);
  const partnerHighlight =
    !isPack &&
    isPartnerHighlightAdminOrder({
      partnerCompanyName,
      partnerId: o.partnerId,
      notes: o.notes,
    });
  const isPartnerVin = isPartnerVinAdminOrder({
    isB2bPack: o.isB2bPack,
    isManual: o.isManual,
    isDemo: o.isDemo,
    checkoutLine: o.checkoutLine,
    vin: o.vin,
    partnerCompanyName,
    partnerId: o.partnerId,
    notes: o.notes,
  });
  return {
    pdfHref: invoicePdfHref(o),
    detailBase,
    orderHref: `${detailBase}/${encodeURIComponent(o.id)}`,
    vin,
    hasVin: vin.length > 0,
    primaryClient: partnerCompanyName || name || email || phone || "—",
    secondaryClient: [partnerCompanyName && name ? name : "", name && !partnerCompanyName ? email : "", phone]
      .filter(Boolean)
      .join(" · "),
    dealerHighlight:
      !isPack &&
      !partnerHighlight &&
      isDealerHighlightAdminOrder({
        checkoutLine: o.checkoutLine,
        amountTotalCents: o.amountTotal,
      }),
    miniHighlight:
      !isPack &&
      !partnerHighlight &&
      isMiniHighlightAdminOrder({
        checkoutLine: o.checkoutLine,
        amountTotalCents: o.amountTotal,
      }),
    partnerHighlight,
    partnerCompanyName,
    partnerPurposeLabel: isPack ? "" : partnerAuditPurposeLabelLv(o.partnerAuditPurpose),
    isPack,
    packLabel: isPack ? b2bPackInfoLabelLv({ checkoutLine: o.checkoutLine, packQty: o.packQty }) : "",
    isPartnerVin,
  };
}

export function AdminOrdersTable({
  orders,
  orderDetailHrefBase = "/admin/orders",
  orderEditsLocalStorageKeyPrefix = "provin-admin-order-edits-v1-",
  consultationList = false,
  toolbarEnd,
}: {
  /** Papildu vadīklas tās pašas rīkjoslas labajā pusē (PRO saraksts: summas slēdzis, „＋ Jauns”). */
  toolbarEnd?: ReactNode;
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
  const [completeOverride, setCompleteOverride] = useState<Record<string, boolean>>({});
  const [colorOverride, setColorOverride] = useState<Record<string, AuditResultColor | null>>({});
  const [colorFilter, setColorFilter] = useState<AuditResultColor | "all" | "none">("all");
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

  const displayedOrders = useMemo(() => {
    const withMeta = orders.map((o) => ({
      ...o,
      auditComplete: o.id in completeOverride ? completeOverride[o.id] : Boolean(o.auditComplete),
      auditResultColor:
        o.id in colorOverride ? colorOverride[o.id] : (o.auditResultColor ?? null),
    }));
    const filtered =
      colorFilter === "all"
        ? withMeta
        : colorFilter === "none"
          ? withMeta.filter((o) => !o.auditResultColor)
          : withMeta.filter((o) => o.auditResultColor === colorFilter);
    return sortAdminOrdersIncompleteFirst(filtered);
  }, [orders, completeOverride, colorOverride, colorFilter]);

  const markComplete = useCallback((id: string, complete: boolean) => {
    setCompleteOverride((prev) => ({ ...prev, [id]: complete }));
  }, []);

  const markColor = useCallback((id: string, color: AuditResultColor | null) => {
    setColorOverride((prev) => ({ ...prev, [id]: color }));
  }, []);

  const detailBaseNormalized = orderDetailHrefBase.replace(/\/$/, "");
  const hug = "w-[1%] whitespace-nowrap";


  return (
    <>
      {/* V1: viena slaida rinda — rezultāta segmenti kreisi, papildu vadīklas labi. */}
      <div className="mt-2 flex items-center gap-2">
        <div role="tablist" aria-label="Rezultāts" className="flex min-w-0 overflow-x-auto rounded-[9px] bg-[#e9e9ee] p-[2px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(["all", ...AUDIT_RESULT_COLORS, "none"] as const).map((c) => {
            const on = colorFilter === c;
            const label = c === "all" ? "Visi" : c === "none" ? "Bez" : AUDIT_RESULT_COLOR_LABEL_LV[c];
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={c === "none" ? "Bez krāsas" : label}
                title={c === "none" ? "Bez krāsas" : label}
                onClick={() => setColorFilter(c)}
                className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] transition sm:px-3 ${on ? "bg-white font-semibold text-[var(--color-apple-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"}`}
              >
                {c === "all" ? null : c === "none" ? (
                  <span className="h-2 w-2 rounded-full bg-slate-200 ring-1 ring-slate-300/80" aria-hidden />
                ) : (
                  <span className={`h-2 w-2 rounded-full ${AUDIT_RESULT_COLOR_DOT_CLASS[c]}`} aria-hidden />
                )}
                <span className={c === "all" ? "" : "hidden sm:inline"}>{label}</span>
              </button>
            );
          })}
        </div>
        {toolbarEnd ? <div className="ml-auto flex shrink-0 items-center gap-1.5">{toolbarEnd}</div> : null}
      </div>

      {/* Telefonā deviņu kolonnu tabula nav lasāma, tāpēc tā pati rinda ir karte.
          No 768 px uz augšu rāda tieši to pašu tabulu, kas bija līdz šim. */}
      <ul className="mt-4 space-y-2 md:hidden">
        {displayedOrders.map((o) => {
          const v = orderRowView(o, clientOverrides[o.id], detailBaseNormalized);
          const accent = o.isDemo
            ? "border-l-[var(--color-provin-accent)]"
            : v.isPack
              ? "border-l-violet-400"
              : v.partnerHighlight
                ? "border-l-violet-500"
                : v.dealerHighlight
                  ? "border-l-sky-400"
                  : v.miniHighlight
                    ? "border-l-amber-400"
                    : "border-l-slate-200";
          const openOrderFromCard = (e: MouseEvent) => {
            if (v.isPack) return;
            if (!shouldOpenAdminOrderFromRowClick(e.target)) return;
            if (e.metaKey || e.ctrlKey || e.button === 1) {
              window.open(v.orderHref, "_blank", "noopener,noreferrer");
              return;
            }
            router.push(v.orderHref);
          };
          return (
            <li
              key={o.id}
              role={v.isPack ? undefined : "link"}
              tabIndex={v.isPack ? undefined : 0}
              className={`rounded-xl border border-slate-200/70 border-l-4 p-3 shadow-[0_1px_10px_rgba(15,23,42,0.04)] ${accent} ${
                v.isPack
                  ? "cursor-default bg-violet-50/70"
                  : v.partnerHighlight
                    ? "cursor-pointer bg-violet-50/80 active:bg-slate-50"
                    : "cursor-pointer bg-white active:bg-slate-50"
              }`}
              onClick={v.isPack ? undefined : openOrderFromCard}
              onAuxClick={
                v.isPack
                  ? undefined
                  : (e) => {
                      if (e.button !== 1) return;
                      openOrderFromCard(e);
                    }
              }
              onKeyDown={
                v.isPack
                  ? undefined
                  : (e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      router.push(v.orderHref);
                    }
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-[var(--color-apple-text)]">
                    {v.isPack ? null : (
                      <AdminAuditResultColorControl
                        sessionId={o.id}
                        initialColor={o.auditResultColor ?? null}
                        compact
                        onColorChange={(c) => markColor(o.id, c)}
                      />
                    )}
                    {v.isPack ? v.packLabel : o.makeModel?.trim() || v.primaryClient}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-[var(--color-provin-muted)]">
                    {v.isPack
                      ? v.primaryClient
                      : v.hasVin
                        ? v.vin
                        : "VIN nav"}
                  </p>
                </div>
                {v.isPack ? null : (
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                    <AdminAuditDeadlineCell
                      sessionId={o.id}
                      createdUnixSec={o.deadlineFromUnix ?? o.created}
                      initialComplete={Boolean(o.auditComplete)}
                      onCompleteChange={(complete) => markComplete(o.id, complete)}
                    />
                  </div>
                )}
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {v.isPartnerVin ? (
                  <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200/80">
                    {PARTNER_VIN_AMOUNT_LABEL_LV}
                  </span>
                ) : (
                  <PaymentStatusException status={o.paymentStatus} />
                )}
                {o.isDemo ? (
                  <span className="rounded-full bg-[var(--color-provin-accent-soft)]/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-provin-accent)]">
                    Paraugs
                  </span>
                ) : null}
                {v.isPack ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
                    Paka
                  </span>
                ) : v.partnerHighlight ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900">
                    Partneris{v.partnerCompanyName ? ` · ${v.partnerCompanyName}` : ""}
                  </span>
                ) : o.isManual ? (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                    Manuāls
                  </span>
                ) : null}
                {v.partnerPurposeLabel ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-200/80">
                    {v.partnerPurposeLabel}
                  </span>
                ) : null}
                {v.miniHighlight ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950">
                    MINI
                  </span>
                ) : null}
                {o.upsellBadge ? (
                  <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-950">
                    {o.upsellBadge}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 text-[12px] text-[var(--color-apple-text)]"><span className="truncate">{v.primaryClient}</span><SourceIcon source={o.heardAbout} /></p>
                  <p className="mt-0.5 truncate text-[11px] tabular-nums text-[var(--color-provin-muted)]">
                    {dateFmt.format(new Date(o.created * 1000))} ·{" "}
                    {v.isPartnerVin ? PARTNER_VIN_AMOUNT_LABEL_LV : formatMoneyEur(o.amountTotal, o.currency)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {v.isPartnerVin ? (
                    <span
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <AdminPartnerArchivePdfButton sessionId={o.id} compact />
                    </span>
                  ) : null}
                  {v.pdfHref ? (
                    <a
                      href={v.pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 text-[var(--color-provin-accent)]"
                      aria-label="Atvērt rēķinu PDF"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </a>
                  ) : null}
                  {v.isPack ? (
                    <span className="text-[11px] font-medium text-[var(--color-provin-muted)]">Tikai info</span>
                  ) : (
                    <span className="inline-flex rounded-full bg-[var(--color-provin-accent)] px-3.5 py-2 text-xs font-semibold text-white shadow-sm">
                      Atvērt
                    </span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_2px_24px_rgba(15,23,42,0.05)] md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/90 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-provin-muted)]">
              <th className={`${hug} py-3 pl-4 pr-2`}>Rez.</th>
              <th className={`${hug} py-3 pl-2 pr-4`}>Datums · termiņš</th>
              <th className="px-4 py-3">VIN · marka</th>
              <th className="px-4 py-3">Klients</th>
              <th className={`${hug} px-4 py-3 text-right`}>Summa</th>
              <th className={`${hug} py-3 pl-2 pr-4 text-right`}>Rēķins</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {displayedOrders.map((o) => {
              const {
                pdfHref,
                orderHref,
                vin,
                hasVin,
                primaryClient,
                secondaryClient,
                dealerHighlight,
                miniHighlight,
                partnerHighlight,
                partnerCompanyName,
                partnerPurposeLabel,
                isPack,
                packLabel,
                isPartnerVin,
              } = orderRowView(o, clientOverrides[o.id], detailBaseNormalized);
              const openOrderFromRow = (e: MouseEvent) => {
                if (isPack) return;
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
                    isPack
                      ? "bg-violet-50/70"
                      : o.isDemo
                        ? "cursor-pointer bg-[var(--color-provin-accent-soft)]/25 transition-colors hover:bg-[var(--color-provin-accent-soft)]/45"
                        : partnerHighlight
                          ? "cursor-pointer bg-violet-50/90 transition-colors hover:bg-violet-100/80"
                          : dealerHighlight
                            ? "cursor-pointer bg-sky-50/80 transition-colors hover:bg-sky-100/80"
                            : miniHighlight
                              ? "cursor-pointer bg-amber-50/90 transition-colors hover:bg-amber-100/80"
                              : "cursor-pointer transition-colors hover:bg-slate-50/90"
                  }
                  onClick={isPack ? undefined : openOrderFromRow}
                  onAuxClick={
                    isPack
                      ? undefined
                      : (e) => {
                          if (e.button !== 1) return;
                          openOrderFromRow(e);
                        }
                  }
                >
                  <td className={`${hug} py-2 pl-4 pr-2`}>
                    {isPack ? (
                      <span className="text-[var(--color-provin-muted)]">—</span>
                    ) : (
                      <AdminAuditResultColorControl
                        sessionId={o.id}
                        initialColor={o.auditResultColor ?? null}
                        compact
                        onColorChange={(c) => markColor(o.id, c)}
                      />
                    )}
                  </td>
                  <td className={`${hug} py-2 pl-2 pr-4 text-[13px] text-[var(--color-apple-text)]`}>
                    <span className="flex flex-wrap items-center gap-1.5">
                      {o.isManual && !isPartnerVin ? (
                        <ManualOrderDateCell id={o.id} created={o.created} />
                      ) : (
                        dateFmt.format(new Date(o.created * 1000))
                      )}
                      {o.isDemo ? (
                        <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--color-provin-accent)] ring-1 ring-[var(--color-provin-accent)]/20">
                          Paraugs
                        </span>
                      ) : null}
                      {isPack ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200/80">
                          Paka
                        </span>
                      ) : partnerHighlight ? (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 ring-1 ring-violet-200/80">
                          Partneris{partnerCompanyName ? ` · ${partnerCompanyName}` : ""}
                        </span>
                      ) : o.isManual ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800 ring-1 ring-sky-200/80">
                          Manuāls
                        </span>
                      ) : null}
                      {partnerPurposeLabel ? (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-800 ring-1 ring-violet-200/80">
                          {partnerPurposeLabel}
                        </span>
                      ) : null}
                      {miniHighlight ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-950 ring-1 ring-amber-300/80">
                          MINI
                        </span>
                      ) : null}
                      {o.upsellBadge ? (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-sky-950 ring-1 ring-sky-200/80">
                          {o.upsellBadge}
                        </span>
                      ) : null}
                    </span>
                    {isPack ? null : (
                      <div className="mt-1">
                        <AdminAuditDeadlineCell
                          sessionId={o.id}
                          createdUnixSec={o.deadlineFromUnix ?? o.created}
                          initialComplete={Boolean(o.auditComplete)}
                          onCompleteChange={(complete) => markComplete(o.id, complete)}
                        />
                      </div>
                    )}
                  </td>
                  <td className="max-w-[300px] px-4 py-2 text-[var(--color-apple-text)]">
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
                    <p className="mt-0.5 truncate text-[11.5px] text-[var(--color-provin-muted)]" title={isPack ? packLabel : o.makeModel?.trim() || undefined}>
                      {isPack ? packLabel : o.makeModel?.trim() || "—"}
                    </p>
                  </td>
                  <td className="max-w-[320px] px-4 py-2 text-[var(--color-apple-text)]">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5">
                        {isPack ? (
                          <span className="truncate">{primaryClient}</span>
                        ) : (
                          <Link href={orderHref} className="admin-nav-link truncate text-[var(--color-apple-text)] hover:underline" aria-label={`Atvērt pasūtījumu: ${primaryClient}`}>
                            {primaryClient}
                          </Link>
                        )}
                        <SourceIcon source={o.heardAbout} />
                      </p>
                      {secondaryClient ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--color-provin-muted)]">{secondaryClient}</p>
                      ) : null}
                    </div>
                  </td>
                  <td className={`${hug} px-4 py-2 text-right tabular-nums font-medium text-[var(--color-apple-text)]`}>
                    {isPartnerVin ? (
                      PARTNER_VIN_AMOUNT_LABEL_LV
                    ) : o.isManual ? (
                      <ManualOrderAmountCell id={o.id} amountTotal={o.amountTotal} currency={o.currency} />
                    ) : (
                      formatMoneyEur(o.amountTotal, o.currency)
                    )}
                    {isPartnerVin ? null : o.paymentStatus.toLowerCase() === "paid" ? null : (
                      <div className="mt-1">
                        <PaymentStatusException status={o.paymentStatus} />
                      </div>
                    )}
                  </td>
                  <td className={`${hug} py-2 pl-2 pr-4 text-right`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      {isPartnerVin ? (
                        <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                          <AdminPartnerArchivePdfButton sessionId={o.id} compact />
                        </span>
                      ) : null}
                      {o.isManual && !isPack && !isPartnerVin ? <ManualOrderDeleteButton id={o.id} /> : null}
                      {isPack ? (
                        <span className="text-[11px] font-medium text-[var(--color-provin-muted)]">Tikai info</span>
                      ) : pdfHref ? (
                        <a
                          href={pdfHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-provin-accent)] transition hover:bg-[var(--color-provin-accent-soft)]/50"
                          aria-label="Atvērt rēķinu PDF"
                          title="Rēķins (PDF)"
                        >
                          <FileText className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </a>
                      ) : (
                        <span className="inline-flex h-8 w-8 items-center justify-center text-[var(--color-provin-muted)]">—</span>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
