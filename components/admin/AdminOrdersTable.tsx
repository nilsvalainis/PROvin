"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AdminClientOrdersChip } from "@/components/admin/AdminClientOrdersChip";
import { AdminClientLinkButton } from "@/components/admin/AdminClientLinkButton";
import { AdminCreateManualOrderButton } from "@/components/admin/AdminCreateManualOrderButton";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition, type MouseEvent, type ReactNode } from "react";
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
import {
  partitionAdminOrdersActiveFirst,
  sortAdminOrdersIncompleteFirst,
} from "@/lib/admin-audit-deadline-complete";
import { AdminAuditDeadlineCell } from "@/components/admin/AdminAuditDeadlineCell";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import {
  AdminMobileChips,
  AdminMobileSearchField,
  AdminMobileSheet,
  AdminMobileStatusTag,
  AdminMobileTopBar,
} from "@/components/admin/mobile/AdminMobileChrome";
import {
  adminMobileAuditFilterLabel,
  formatAdminMobileDeadlineHours,
} from "@/lib/admin-mobile-ds";
import { AdminAuditSlaListBanner } from "@/components/admin/AdminAuditSlaWarningBanner";
import { formatAuditDeadlineRemaining } from "@/lib/admin-audit-deadline";
import { useAdminAuditDeadlineTick } from "@/components/admin/AdminAuditDeadlineTickProvider";
import {
  AdminAuditResultColorControl,
} from "@/components/admin/AdminAuditResultColorControl";
import { AdminVinCopyButton } from "@/components/admin/AdminVinClipboardAndLinks";
import { AdminVinNotSeventeenFlag } from "@/components/admin/AdminVinNotSeventeenFlag";
import { shouldOpenAdminOrderFromRowClick } from "@/lib/admin-vin-urls";
import {
  AUDIT_RESULT_COLORS,
  AUDIT_RESULT_COLOR_DOT_CLASS,
  AUDIT_RESULT_COLOR_LABEL_LV,
  type AuditResultColor,
} from "@/lib/admin-audit-result-color";

export type AdminOrdersTableRow = SerializedAdminOrderTableRow;

/** Avots: neitrāls pelēks čips ar vienkrāsainu ikonu (H2). Nosaukums arī tooltipā. */
function SourceGlyph({ k }: { k: string }) {
  const c = "#6e6e73";
  if (k === "tiktok")
    return <svg width="10" height="10" viewBox="0 0 24 24" fill={c} aria-hidden><path d="M16.5 3c.3 2.2 1.7 3.8 4 4v3.2c-1.5 0-2.8-.4-4-1.1v6.4A5.6 5.6 0 1 1 11 9.9v3.3a2.4 2.4 0 1 0 2.2 2.4V3h3.3z" /></svg>;
  if (k === "youtube")
    return <svg width="11" height="10" viewBox="0 0 24 24" aria-hidden><rect x="2" y="5" width="20" height="14" rx="4" fill={c} /><path d="M10 9v6l5-3z" fill="#f2f2f7" /></svg>;
  if (k === "instagram")
    return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.6" aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /></svg>;
  if (k === "facebook")
    return <svg width="9" height="10" viewBox="0 0 24 24" fill={c} aria-hidden><path d="M14 8h3V4h-3c-2.8 0-4 1.8-4 4.3V10H7v4h3v8h4v-8h3l1-4h-4V8.6c0-.4.3-.6.6-.6z" /></svg>;
  if (k === "google")
    return <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" aria-hidden><path d="M20 12a8 8 0 1 1-2.3-5.6M20 12h-8" /></svg>;
  return <svg width="8" height="8" viewBox="0 0 24 24" fill={c} aria-hidden><circle cx="12" cy="12" r="6" /></svg>;
}
function SourceIcon({ source }: { source: string | null | undefined }) {
  const label = source?.trim();
  if (!label) return null;
  return (
    <span
      title={`Kur uzzināja: ${label}`}
      className="inline-flex h-[19px] shrink-0 items-center gap-1 rounded-[5px] bg-[#f2f2f7] pl-1.5 pr-[7px] text-[11px] font-medium leading-none text-[#6e6e73]"
    >
      <SourceGlyph k={label.toLowerCase()} />
      {label}
    </span>
  );
}

/** H2: kluss žetons (pelēks rāmis). MINI — vienīgais krāsainais (kluss dzeltenbrūns teksts). */
const CALM_TAG = "inline-flex items-center rounded-[5px] border border-[#e5e5ea] px-1.5 py-px text-[11px] font-medium text-[#8e8e93] whitespace-nowrap";

const RIGA_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Riga", year: "numeric", month: "2-digit", day: "2-digit" });
const RIGA_DATETIME = new Intl.DateTimeFormat("lv-LV", {
  timeZone: "Europe/Riga",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
/** J3: MINI — dzeltena pill (vienīgā krāsa līdzās termiņa žetoniem). */
const MINI_PILL = "inline-flex shrink-0 rounded-full bg-[#ffe58f] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#7a5a00]";
const LV_MONTHS = ["janvāris", "februāris", "marts", "aprīlis", "maijs", "jūnijs", "jūlijs", "augusts", "septembris", "oktobris", "novembris", "decembris"];
const LV_MON_SHORT = ["janv.", "febr.", "marts", "apr.", "maijs", "jūn.", "jūl.", "aug.", "sept.", "okt.", "nov.", "dec."];

/** Dienas virsraksts Rīgas laikā: „Šodien · 12. okt.”, „Vakar · 11. okt.”, „10. oktobris”, citā gadā ar gadu. */
export function adminOrderDayLabel(dayKey: string, nowMs: number): string {
  const [y, m, d] = dayKey.split("-").map(Number) as [number, number, number];
  const today = RIGA_DAY.format(new Date(nowMs));
  const yesterday = RIGA_DAY.format(new Date(nowMs - 86_400_000));
  const short = `${d}. ${LV_MON_SHORT[m - 1]}`;
  if (dayKey === today) return `Šodien · ${short}`;
  if (dayKey === yesterday) return `Vakar · ${short}`;
  const thisYear = today.slice(0, 4) === String(y);
  return `${d}. ${LV_MONTHS[m - 1]}${thisYear ? "" : ` ${y}`}`;
}

function PaymentStatusCalm({ status }: { status: string }) {
  const s = status.toLowerCase();
  const label = s === "unpaid" ? "Pirms apmaksas" : s === "no_payment_required" ? "Bez maksas" : status;
  return <span className={CALM_TAG}>{label}</span>;
}

/** Statuss tikai izņēmumiem - „Apmaksāts” nerādām. */
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

/** Manuālā pasūtījuma “Laiks” - skats + labošana (datetime-local). */
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

/** Manuālā pasūtījuma “Summa” - skats + labošana (EUR). */
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

function AdminOrdersMobileChrome({
  colorFilter,
  onColorFilter,
  filterCounts,
  belowTitle,
}: {
  colorFilter: AuditResultColor | "all" | "none";
  onColorFilter: (c: AuditResultColor | "all" | "none") => void;
  filterCounts: { all: number; green: number; orange: number; red: number; none: number };
  belowTitle?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname() || "/admin/dashboard";
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [pending, startTransition] = useTransition();
  const sort = sp.get("sort") === "oldest" ? "oldest" : "newest";
  const first = useRef(true);

  const push = (next: { q?: string; sort?: string }) => {
    const p = new URLSearchParams(sp.toString());
    const nq = next.q ?? q;
    if (nq.trim()) p.set("q", nq.trim());
    else p.delete("q");
    const ns = next.sort ?? sort;
    if (ns === "oldest") p.set("sort", "oldest");
    else p.delete("sort");
    p.delete("limit");
    const qs = p.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => push({ q }), 300);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <AdminMobileTopBar
      title="Pasūtījumi"
      trailing={
        <>
          <span className="max-md:[&>button]:h-9 max-md:[&>button]:w-9 max-md:[&>button]:rounded-full max-md:[&>button]:px-0 max-md:[&>button]:text-[0px] max-md:[&_svg]:h-[18px] max-md:[&_svg]:w-[18px]">
            <AdminClientLinkButton />
          </span>
          <span className="max-md:[&>button]:h-9 max-md:[&>button]:w-9 max-md:[&>button]:rounded-full max-md:[&>button]:px-0 max-md:[&>button]:text-[0px]">
            <AdminCreateManualOrderButton compact />
          </span>
        </>
      }
    >
      {belowTitle ? <div className="mb-3">{belowTitle}</div> : null}
      <div className={`flex items-center gap-2 ${pending ? "opacity-60" : ""}`}>
        <div className="min-w-0 flex-1">
          <AdminMobileSearchField value={q} onChange={setQ} placeholder="Meklēt VIN, klientu" />
        </div>
        <button
          type="button"
          onClick={() => push({ sort: sort === "oldest" ? "newest" : "oldest" })}
          className="am-press inline-flex h-9 shrink-0 items-center gap-1 rounded-full bg-[var(--am-fill)] px-3 text-[13px] font-medium text-[var(--am-ink)]"
        >
          <AdminMobileIcon name="kartot" className="h-4 w-4" />
          {sort === "oldest" ? "Vecākie" : "Jaunākie"}
        </button>
      </div>
      <div className="mt-3">
        <AdminMobileChips
          value={colorFilter}
          onChange={(id) => onColorFilter(id as AuditResultColor | "all" | "none")}
          items={[
            { id: "all", label: adminMobileAuditFilterLabel("all"), count: filterCounts.all },
            { id: "orange", label: adminMobileAuditFilterLabel("orange"), count: filterCounts.orange },
            { id: "green", label: adminMobileAuditFilterLabel("green"), count: filterCounts.green },
            { id: "red", label: adminMobileAuditFilterLabel("red"), count: filterCounts.red },
            { id: "none", label: adminMobileAuditFilterLabel("none"), count: filterCounts.none },
          ]}
        />
      </div>
    </AdminMobileTopBar>
  );
}

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
    primaryClient: partnerCompanyName || name || email || phone || "-",
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
    packLabel: isPack
      ? b2bPackInfoLabelLv({ checkoutLine: o.checkoutLine, packQty: o.packQty, fulfillment: o.isB2bTopup ? "b2b_wallet_topup" : null })
      : "",
    isPartnerVin,
  };
}

export function AdminOrdersTable({
  orders,
  orderDetailHrefBase = "/admin/orders",
  orderEditsLocalStorageKeyPrefix = "provin-admin-order-edits-v1-",
  consultationList = false,
  toolbarEnd,
  doneOrder = "desc",
  belowTopBar,
}: {
  /** Izpildīto dienu secība (servera kārtošana „Vecākie” → asc). */
  doneOrder?: "desc" | "asc";
  /** Papildu vadīklas tās pašas rīkjoslas labajā pusē (PRO saraksts: summas slēdzis, „＋ Jauns”). */
  toolbarEnd?: ReactNode;
  orders: AdminOrdersTableRow[];
  /** Piem. `/admin/konsultacijas` - saite „Atvērt”. */
  orderDetailHrefBase?: string;
  /** Lokālā pārdefinēšana klienta laukiem tabulā (atšķirīgs prefikss konsultācijām). */
  orderEditsLocalStorageKeyPrefix?: string;
  /** Saglabāts API savietojamībai (konsultāciju saraksta wrapperiem). */
  consultationList?: boolean;
  belowTopBar?: ReactNode;
}) {
  void consultationList;
  const router = useRouter();
  const dateFmt = new Intl.DateTimeFormat("lv-LV", { dateStyle: "short", timeStyle: "short" });
  const [completeOverride, setCompleteOverride] = useState<Record<string, boolean>>({});
  const [colorOverride, setColorOverride] = useState<Record<string, AuditResultColor | null>>({});
  const [colorFilter, setColorFilter] = useState<AuditResultColor | "all" | "none">("all");
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);
  const swipeRef = useRef<{ id: string; x: number; dx: number } | null>(null);
  const lastSwipeDx = useRef(0);
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

  /**
   * NOTEIKUMS: visi aktīvie (neizpildītie) vienmēr augšā grupā „Aktīvie” (jaunākie ienākušie pirmie,
   * kavētie netiek celti augšā - sk. partitionAdminOrdersActiveFirst); izpildītie zemāk pa dienām (Rīgas laikā).
   */
  const dayGroups = useMemo(() => {
    const { active, done } = partitionAdminOrdersActiveFirst(displayedOrders);
    const sumOf = (list: typeof displayedOrders) =>
      list.reduce((n, o) => n + (typeof o.amountTotal === "number" ? o.amountTotal : 0), 0);
    const map = new Map<string, typeof displayedOrders>();
    for (const o of done) {
      const key = RIGA_DAY.format(new Date(o.created * 1000));
      const list = map.get(key);
      if (list) list.push(o);
      else map.set(key, [o]);
    }
    const days = [...map.entries()]
      .sort((a, b) => (doneOrder === "asc" ? -1 : 1) * (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0))
      .map(([key, list]) => ({
        key,
        isActive: false,
        list: doneOrder === "asc" ? [...list].sort((x, y) => x.created - y.created) : list,
        sum: sumOf(list),
      }));
    return active.length > 0
      ? [{ key: "__active", isActive: true, list: active, sum: sumOf(active) }, ...days]
      : days;
  }, [displayedOrders, doneOrder]);
  const [nowMs, setNowMs] = useState<number | null>(null);
  useEffect(() => setNowMs(Date.now()), []);
  const slaTick = useAdminAuditDeadlineTick();
  void slaTick;
  const slaCounts = useMemo(() => {
    let urgentCount = 0;
    let overdueCount = 0;
    for (const o of displayedOrders) {
      if (o.auditComplete || o.isB2bPack) continue;
      const status = formatAuditDeadlineRemaining(o.deadlineFromUnix ?? o.created).status;
      if (status === "overdue") overdueCount++;
      else if (status === "urgent") urgentCount++;
    }
    return { urgentCount, overdueCount };
  }, [displayedOrders, slaTick]);

  const markComplete = useCallback((id: string, complete: boolean) => {
    setCompleteOverride((prev) => ({ ...prev, [id]: complete }));
  }, []);

  const markColor = useCallback((id: string, color: AuditResultColor | null) => {
    setColorOverride((prev) => ({ ...prev, [id]: color }));
  }, []);

  const detailBaseNormalized = orderDetailHrefBase.replace(/\/$/, "");
  const hug = "w-[1%] whitespace-nowrap";


  const filterCounts = useMemo(() => {
    const withColor = orders.map((o) => ({
      color: o.id in colorOverride ? colorOverride[o.id] : (o.auditResultColor ?? null),
    }));
    return {
      all: withColor.length,
      green: withColor.filter((o) => o.color === "green").length,
      orange: withColor.filter((o) => o.color === "orange").length,
      red: withColor.filter((o) => o.color === "red").length,
      none: withColor.filter((o) => !o.color).length,
    };
  }, [orders, colorOverride]);

  return (
    <>
      <div className="hidden md:block">
      <AdminAuditSlaListBanner urgentCount={slaCounts.urgentCount} overdueCount={slaCounts.overdueCount} />
      </div>
      {/* V1: viena slaida rinda - rezultāta segmenti kreisi, papildu vadīklas labi. */}
      <div className="mt-2 hidden items-center gap-2 md:flex">
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
                className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[13px] transition sm:h-7 sm:px-3 sm:text-[12.5px] ${on ? "bg-white font-semibold text-[var(--color-apple-text)] shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"}`}
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

      {/* Telefonā: stikla josla + kartītes. Desktop tabula zemāk paliek neskarta. */}
      <div className="md:hidden">
        <AdminOrdersMobileChrome
          colorFilter={colorFilter}
          onColorFilter={setColorFilter}
          filterCounts={filterCounts}
          belowTitle={belowTopBar}
        />
      <ul className="mt-3 space-y-2.5">
        {dayGroups.map((g) => (
        <Fragment key={g.key}>
          <li className="flex items-baseline justify-between px-1 pt-2 text-[12px] font-semibold uppercase tracking-[0.045em] text-[var(--am-ink3)]">
            <span>{g.isActive ? "Aktīvie" : nowMs != null ? adminOrderDayLabel(g.key, nowMs) : g.key}</span>
            <span className="font-medium normal-case tracking-normal tabular-nums">
              {g.isActive ? `${g.list.length}` : g.list.length} · {formatMoneyEur(g.sum, "eur")}
            </span>
          </li>
          {g.list.map((o) => {
          const v = orderRowView(o, clientOverrides[o.id], detailBaseNormalized);
          const accent = "";
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
              className={`am-row am-press relative rounded-[22px] bg-[var(--am-s1)] p-4 shadow-[var(--am-card-shadow)] ${accent} ${
                v.isPack ? "cursor-default" : "cursor-pointer"
              }`}
              onPointerDown={(e) => {
                if (!v.pdfHref) return;
                swipeRef.current = { id: o.id, x: e.clientX, dx: 0 };
              }}
              onPointerMove={(e) => {
                const s = swipeRef.current;
                if (!s || s.id !== o.id) return;
                s.dx = Math.min(0, e.clientX - s.x);
                e.currentTarget.style.transform = `translateX(${s.dx}px)`;
                e.currentTarget.style.transition = "none";
              }}
              onPointerUp={(e) => {
                const s = swipeRef.current;
                e.currentTarget.style.transform = "";
                e.currentTarget.style.transition = "transform var(--d-std) var(--ease-out)";
                lastSwipeDx.current = s?.dx ?? 0;
                if (s && s.dx < -72 && v.pdfHref) {
                  window.open(v.pdfHref, "_blank", "noopener,noreferrer");
                }
                swipeRef.current = null;
              }}
              onPointerCancel={(e) => {
                e.currentTarget.style.transform = "";
                swipeRef.current = null;
              }}
              onClick={
                v.isPack
                  ? undefined
                  : (e) => {
                      if (Math.abs(lastSwipeDx.current) > 12) {
                        lastSwipeDx.current = 0;
                        return;
                      }
                      openOrderFromCard(e);
                    }
              }
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
              {o.auditResultColor === "red" ? (
                <span className="absolute left-3 top-3 rounded-[6px] bg-[var(--am-fill)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--am-ink2)]">
                  Riski
                </span>
              ) : null}
              {v.isPack ? null : (
                <div
                  className={`absolute right-3 top-3 flex items-center gap-1 ${o.auditResultColor === "red" ? "" : ""}`}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <AdminMobileStatusTag>
                    {formatAdminMobileDeadlineHours(o.deadlineFromUnix ?? o.created)}
                  </AdminMobileStatusTag>
                  <button
                    type="button"
                    aria-label="Termiņš"
                    className="am-press grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-[var(--am-fill)] text-[var(--am-ink2)]"
                    onClick={() => {
                      const el = document.querySelector<HTMLButtonElement>(`[data-admin-audit-color="${o.id}"] button, [data-admin-audit-color="${o.id}"]`);
                      el?.click();
                    }}
                  >
                    <AdminMobileIcon name="izverst" className="h-3 w-3" />
                  </button>
                  <div className="sr-only" data-admin-audit-color={o.id}>
                    <AdminAuditDeadlineCell
                      sessionId={o.id}
                      createdUnixSec={o.deadlineFromUnix ?? o.created}
                      initialComplete={Boolean(o.auditComplete)}
                      onCompleteChange={(complete) => markComplete(o.id, complete)}
                    />
                  </div>
                </div>
              )}
              <div className={`flex items-start justify-between gap-2 pr-16 ${o.auditResultColor === "red" ? "pt-5" : ""}`}>
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold tracking-tight text-[var(--am-ink)]">
                    {v.isPack ? v.packLabel : (o.makeModel?.trim() || v.primaryClient).toUpperCase()}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[12.5px] tracking-[0.01em] text-[var(--am-ink2)]">
                    {v.isPack ? v.primaryClient : v.hasVin ? v.vin : "VIN nav"}
                    {!v.isPack && v.hasVin ? <AdminVinNotSeventeenFlag vin={v.vin} compact /> : null}
                  </p>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {v.isPartnerVin ? (
                  <span className={CALM_TAG}>
                    {PARTNER_VIN_AMOUNT_LABEL_LV}
                  </span>
                ) : (
                  <PaymentStatusException status={o.paymentStatus} />
                )}
                {o.isDemo ? (
                  <span className={CALM_TAG}>
                    Paraugs
                  </span>
                ) : null}
                {v.isPack ? (
                  <span className={CALM_TAG}>
                    Paka
                  </span>
                ) : v.partnerHighlight ? (
                  <span className={CALM_TAG}>
                    Partneris{v.partnerCompanyName ? ` · ${v.partnerCompanyName}` : ""}
                  </span>
                ) : o.isManual ? (
                  <span className={CALM_TAG}>
                    Manuāls
                  </span>
                ) : null}
                {v.partnerPurposeLabel ? (
                  <span className={CALM_TAG}>
                    {v.partnerPurposeLabel}
                  </span>
                ) : null}
                {v.miniHighlight ? (
                  <span className={CALM_TAG}>MINI</span>
                ) : null}
                {o.repeatVin ? (
                  <span className={CALM_TAG} title={`Atkārtots VIN: šis VIN jau ir ${o.repeatVin} citā(-os) darbā(-os) - pirms pirkšanas pārbaudi, ko var izmantot atkārtoti`}>
                    ↻ Atkārtots VIN
                  </span>
                ) : null}
                {o.upsellBadge ? (
                  <span className={CALM_TAG}>
                    {o.upsellBadge}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 text-[14px] text-[var(--am-ink)]">
                    <span className="truncate">{v.primaryClient}</span>
                    {o.clientOrders?.length ? (
                      <span className="text-[var(--am-ink2)]">{o.clientOrders.length + 1}×</span>
                    ) : (
                      <span className="text-[var(--am-ink2)]">1×</span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] tabular-nums text-[var(--am-ink2)]">
                    {dateFmt.format(new Date(o.created * 1000))} ·{" "}
                    {v.isPartnerVin ? PARTNER_VIN_AMOUNT_LABEL_LV : formatMoneyEur(o.amountTotal, o.currency)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {v.pdfHref ? (
                    <button
                      type="button"
                      className="am-press grid h-9 w-9 place-items-center rounded-full text-[var(--am-ink2)]"
                      aria-label="Vairāk"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCardMenuId(o.id);
                      }}
                    >
                      <AdminMobileIcon name="vairak" className="h-4 w-4" />
                    </button>
                  ) : null}
                  {v.isPack ? null : <AdminMobileIcon name="uzPrieksu" className="h-4 w-4 text-[var(--am-ink3)]" />}
                </div>
              </div>
            </li>
          );
        })}
        </Fragment>
        ))}
      </ul>
      <AdminMobileSheet
        open={Boolean(cardMenuId)}
        title="Darbības"
        onClose={() => setCardMenuId(null)}
      >
        {(() => {
          const row = displayedOrders.find((x) => x.id === cardMenuId);
          const pdf = row ? invoicePdfHref(row) : null;
          if (!pdf) return <p className="text-[14px] text-[var(--am-ink2)]">Nav pieejamu darbību.</p>;
          return (
            <a
              href={pdf}
              target="_blank"
              rel="noopener noreferrer"
              className="am-press flex h-[50px] items-center gap-3 rounded-[18px] bg-[var(--am-fill)] px-4 text-[16px] text-[var(--am-ink)]"
              onClick={() => setCardMenuId(null)}
            >
              <AdminMobileIcon name="pdf" className="h-5 w-5" />
              Atvērt PDF
            </a>
          );
        })()}
      </AdminMobileSheet>
      </div>

      <div className="mt-3 hidden overflow-hidden rounded-xl bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.1)] md:block">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#6e6e73]">
              <th className={`${hug} py-2.5 pl-4 pr-4`}>Termiņš (48 h)</th>
              <th className="py-2.5 pr-4">Marka, modelis</th>
              <th className={`${hug} py-2.5 pr-4`}>VIN</th>
              <th className={`${hug} py-2.5 pr-4`}>Rez.</th>
              <th className="py-2.5 pr-4">Klients</th>
              <th className={`${hug} py-2.5 pr-4`}>Datums</th>
              <th className={`${hug} py-2.5 pr-4 text-right`}>Summa</th>
            </tr>
          </thead>
          {dayGroups.map((g) => (
          <tbody key={g.key}>
            <tr className="border-t border-[#ededed] bg-[#fafafa]">
              <td colSpan={7} className="px-4 py-1.5 text-[12px] font-semibold text-[#3a3a3c]">
                {g.isActive ? "Aktīvie" : nowMs != null ? adminOrderDayLabel(g.key, nowMs) : g.key}
                <span className="ml-2 font-normal text-[#aeaeb2]">
                  {g.list.length} pasūt. · {formatMoneyEur(g.sum, "eur")}
                </span>
              </td>
            </tr>
            {g.list.map((o) => {
              const {
                orderHref,
                vin,
                hasVin,
                primaryClient,
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
              const mm = isPack ? packLabel : o.makeModel?.trim() || "";
              return (
                <tr
                  key={o.id}
                  className={`h-[46px] whitespace-nowrap border-t border-[#f0f0f2] transition-colors ${
                    isPack
                      ? "bg-[#faf9fc]"
                      : o.isDemo || partnerHighlight || dealerHighlight
                        ? "cursor-pointer bg-[#f8fafc] hover:bg-[#f2f4f7]"
                        : miniHighlight
                          ? "cursor-pointer bg-[#fffbea] hover:bg-[#fdf5d8]"
                          : "cursor-pointer hover:bg-[#f7f7f8]"
                  }`}
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
                  <td className={`${hug} py-1 pl-4 pr-4`}>
                    {isPack ? (
                      <span className="text-[#c7c7cc]">-</span>
                    ) : (
                      <AdminAuditDeadlineCell
                        sessionId={o.id}
                        createdUnixSec={o.deadlineFromUnix ?? o.created}
                        initialComplete={Boolean(o.auditComplete)}
                        onCompleteChange={(complete) => markComplete(o.id, complete)}
                      />
                    )}
                  </td>
                  <td className="max-w-[300px] py-1 pr-4">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span
                        className={`truncate text-[14px] ${mm ? "font-bold text-[#1d1d1f]" : "text-[#aeaeb2]"}`}
                        title={mm || undefined}
                      >
                        {mm || "-"}
                      </span>
                      {miniHighlight ? <span className={MINI_PILL}>MINI</span> : null}
                    </span>
                  </td>
                  <td className={`${hug} py-1 pr-4`}>
                    {hasVin ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[12px] tracking-wide text-[#3a3a3c]" title={vin}>
                          {vin}
                        </span>
                        <AdminVinNotSeventeenFlag vin={vin} compact />
                        <AdminVinCopyButton value={vin} />
                      </span>
                    ) : (
                      <span className="text-[#c7c7cc]">-</span>
                    )}
                  </td>
                  <td className={`${hug} py-1 pr-4`}>
                    {isPack ? (
                      <span className="text-[#c7c7cc]">-</span>
                    ) : (
                      <AdminAuditResultColorControl
                        sessionId={o.id}
                        initialColor={o.auditResultColor ?? null}
                        compact
                        onColorChange={(c) => markColor(o.id, c)}
                      />
                    )}
                  </td>
                  <td className="max-w-[420px] py-1 pr-4">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {isPack ? (
                        <span className="truncate text-[13.5px] text-[#1d1d1f]">{primaryClient}</span>
                      ) : (
                        <Link href={orderHref} className="admin-nav-link truncate text-[13.5px] text-[#1d1d1f] hover:underline" aria-label={`Atvērt pasūtījumu: ${primaryClient}`}>
                          {primaryClient}
                        </Link>
                      )}
                      <SourceIcon source={o.heardAbout} />
                      {o.clientOrders?.length ? <AdminClientOrdersChip items={o.clientOrders.map((c) => ({ ...c, href: `${detailBaseNormalized}/${encodeURIComponent(c.id)}` }))} /> : null}
                      {o.repeatVin ? (
                        <span className={CALM_TAG} title={`Atkārtots VIN: šis VIN jau ir ${o.repeatVin} citā(-os) darbā(-os) - pirms pirkšanas pārbaudi, ko var izmantot atkārtoti`}>
                          ↻ Atkārtots VIN
                        </span>
                      ) : null}
                      {o.isDemo ? <span className={CALM_TAG}>Paraugs</span> : null}
                      {isPack ? (
                        <span className={CALM_TAG}>Paka</span>
                      ) : partnerHighlight ? (
                        <span className={CALM_TAG}>Partneris{partnerCompanyName ? ` · ${partnerCompanyName}` : ""}</span>
                      ) : o.isManual ? (
                        <span className={CALM_TAG}>Manuāls</span>
                      ) : null}
                      {partnerPurposeLabel ? <span className={CALM_TAG}>{partnerPurposeLabel}</span> : null}
                      {o.upsellBadge ? <span className={CALM_TAG}>{o.upsellBadge}</span> : null}
                    </span>
                  </td>
                  <td className={`${hug} py-1 pr-4 text-[13px] tabular-nums text-[#3a3a3c]`}>
                    {o.isManual && !isPartnerVin ? <ManualOrderDateCell id={o.id} created={o.created} /> : RIGA_DATETIME.format(new Date(o.created * 1000))}
                  </td>
                  <td className={`${hug} py-1 pr-4 text-right text-[14px] font-semibold tabular-nums text-[#1d1d1f]`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {!isPartnerVin && o.paymentStatus.toLowerCase() !== "paid" ? <PaymentStatusCalm status={o.paymentStatus} /> : null}
                      {isPartnerVin ? (
                        <>
                          <span className="text-[12px] font-medium text-[#8e8e93]">{PARTNER_VIN_AMOUNT_LABEL_LV}</span>
                          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                            <AdminPartnerArchivePdfButton sessionId={o.id} compact />
                          </span>
                        </>
                      ) : o.isManual ? (
                        <>
                          <ManualOrderAmountCell id={o.id} amountTotal={o.amountTotal} currency={o.currency} />
                          {!isPack ? <ManualOrderDeleteButton id={o.id} /> : null}
                        </>
                      ) : (
                        formatMoneyEur(o.amountTotal, o.currency)
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          ))}
        </table>
        </div>
      </div>
    </>
  );
}
