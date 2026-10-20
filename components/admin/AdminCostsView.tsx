"use client";

import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminCollapsedMenuButton } from "@/components/admin/AdminCollapsedMenuButton";
import {
  adminCostsChrome,
  adminCostsHref,
  costAlertBannerText,
  costBarRatio,
  costGroupDotVar,
  costLimitCaption,
  costRemainingCaption,
  formatAdminCostPercent,
  formatAdminCostUsd,
  formatCostUpdatedBadge,
  type AdminCostsWorkspace,
  type CostDashboard,
  type CostGroupView,
  type CostSourceId,
  type CostSourceView,
} from "@/lib/admin-costs";

function MonthTabs({ dashboard, hrefBase }: { dashboard: CostDashboard; hrefBase: string }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={href} className="admin-costs-tab" data-on={on ? "true" : "false"}>
      {label}
    </Link>
  );
  return (
    <div className="flex shrink-0 gap-1.5" role="tablist" aria-label="Mēnesis">
      {tab(`${hrefBase}?m=${dashboard.prevMonth}`, dashboard.prevMonthTitle, false)}
      {tab(`${hrefBase}?m=${dashboard.month}`, dashboard.monthTitle, true)}
    </div>
  );
}

function LiveBadge({ row, nowMs }: { row: CostSourceView; nowMs: number }) {
  if (row.badge === "live") {
    return <span className="admin-costs-live">live</span>;
  }
  const label = formatCostUpdatedBadge(row.updatedAt, nowMs);
  if (!label) return null;
  return <span className="admin-costs-muted text-[11px]">{label}</span>;
}

function LimitBar({ row }: { row: CostSourceView }) {
  const has = row.limitUsd != null || row.limitUnits != null;
  if (!has && !row.googleQuota) {
    return <p className="admin-costs-muted text-[11px]">bez limita</p>;
  }
  const ratio = costBarRatio(row);
  return (
    <div className="min-w-0">
      <p className="admin-costs-muted text-[11px] leading-4">{costLimitCaption(row)}</p>
      <div className="admin-costs-track mt-1 h-1.5 overflow-hidden rounded-full">
        <div className="admin-costs-bar h-full rounded-full" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      {costRemainingCaption(row) ? (
        <p className="admin-costs-muted mt-0.5 text-[11px] leading-4">{costRemainingCaption(row)}</p>
      ) : null}
    </div>
  );
}

function SourceRow({
  row,
  month,
  nowMs,
  onSaved,
}: {
  row: CostSourceView;
  month: string;
  nowMs: number;
  onSaved: () => void;
}) {
  const [edit, setEdit] = useState(false);
  return (
    <div className="admin-costs-hair border-t px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="admin-costs-ink text-[14px] font-medium">{row.label}</p>
            <LiveBadge row={row} nowMs={nowMs} />
          </div>
          {row.subtitle ? <p className="admin-costs-muted mt-0.5 text-[12px]">{row.subtitle}</p> : null}
          <div className="mt-2 max-w-[16rem] sm:hidden">
            <LimitBar row={row} />
          </div>
        </div>
        <p className="admin-costs-ink shrink-0 text-[14px] font-semibold tabular-nums">{formatAdminCostUsd(row.usd)}</p>
        <p className="admin-costs-muted w-10 shrink-0 text-right text-[13px] tabular-nums">{formatAdminCostPercent(row.percent)}</p>
        <div className="hidden w-[13.5rem] shrink-0 sm:block">
          <LimitBar row={row} />
        </div>
      </div>
      {row.editable ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setEdit((v) => !v)}
            className="admin-costs-muted text-[12px] font-medium underline-offset-2 hover:underline"
          >
            {edit ? "Aizvērt" : "Labot"}
          </button>
          {edit ? <CostEditForm row={row} month={month} onSaved={onSaved} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function CostEditForm({ row, month, onSaved }: { row: CostSourceView; month: string; onSaved: () => void }) {
  const [usd, setUsd] = useState(String(row.usd.toFixed(2)));
  const [units, setUnits] = useState(String(row.units));
  const [limitUsd, setLimitUsd] = useState(row.limitUsd == null ? "" : String(row.limitUsd));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <form
      className="admin-costs-edit mt-2 flex flex-wrap items-end gap-2 rounded-xl p-3"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setErr("");
        void fetch("/api/admin/izmaksas", {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            source: row.id,
            month,
            usd: Number(usd.replace(",", ".")),
            units: Number(units.replace(",", ".")),
            limitUsd: limitUsd.trim() === "" ? null : Number(limitUsd.replace(",", ".")),
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const body = (await res.json().catch(() => null)) as { error?: string } | null;
              throw new Error(body?.error || "save_failed");
            }
            onSaved();
          })
          .catch((e: unknown) => setErr(e instanceof Error ? e.message : "save_failed"))
          .finally(() => setBusy(false));
      }}
    >
      <label className="admin-costs-soft text-[12px]">
        Summa $
        <input
          className="mt-1 block h-8 w-24 rounded-lg border bg-white px-2 text-[13px] tabular-nums"
          value={usd}
          onChange={(e) => setUsd(e.target.value)}
          inputMode="decimal"
        />
      </label>
      <label className="admin-costs-soft text-[12px]">
        Apjoms
        <input
          className="mt-1 block h-8 w-24 rounded-lg border bg-white px-2 text-[13px] tabular-nums"
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          inputMode="numeric"
        />
      </label>
      <label className="admin-costs-soft text-[12px]">
        Limits $
        <input
          className="mt-1 block h-8 w-24 rounded-lg border bg-white px-2 text-[13px] tabular-nums"
          value={limitUsd}
          onChange={(e) => setLimitUsd(e.target.value)}
          inputMode="decimal"
          placeholder="bez"
        />
      </label>
      <button type="submit" disabled={busy} className="admin-costs-save h-8 rounded-lg px-3 text-[12px] font-semibold disabled:opacity-50">
        {busy ? "…" : "Saglabāt"}
      </button>
      {err ? <p className="w-full text-[12px] text-red-700">{err}</p> : null}
    </form>
  );
}

function GroupCard({
  group,
  month,
  nowMs,
  onSaved,
}: {
  group: CostGroupView;
  month: string;
  nowMs: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(group.defaultOpen);
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <section className="admin-costs-card overflow-hidden rounded-2xl">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left sm:px-5"
        aria-expanded={open}
      >
        <Chevron className="admin-costs-muted h-4 w-4 shrink-0" aria-hidden />
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: costGroupDotVar(group.id) }} aria-hidden />
        <span className="admin-costs-ink min-w-0 flex-1 truncate text-[15px] font-semibold">
          {group.label}{" "}
          <span className="admin-costs-muted font-normal">
            {group.sourceCount} {group.sourceCount === 1 ? "avots" : "avoti"}
          </span>
        </span>
        <span className="admin-costs-ink shrink-0 text-[15px] font-semibold tabular-nums">{formatAdminCostUsd(group.usd)}</span>
        <span className="admin-costs-pct">{formatAdminCostPercent(group.percent)}</span>
      </button>
      {open ? (
        <div>
          {group.sources.map((row) => (
            <SourceRow key={row.id} row={row} month={month} nowMs={nowMs} onSaved={onSaved} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function AdminCostsView({
  dashboard,
  workspace,
}: {
  dashboard: CostDashboard;
  workspace: AdminCostsWorkspace;
}) {
  const router = useRouter();
  const nowMs = Date.now();
  const banner = costAlertBannerText(dashboard.alerts);
  const worst = dashboard.alerts[0]?.level ?? 0;
  const hrefBase = adminCostsHref(workspace);
  const chrome = adminCostsChrome(workspace);
  return (
    <div className="admin-costs-view w-full max-w-none px-4 pb-8 pt-3 md:px-0 md:pt-0" data-costs-theme={workspace}>
      <header className="md:hidden">
        <p className="admin-costs-muted text-[13px]">{chrome.crumb}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="admin-costs-ink text-[34px] font-bold leading-none tracking-tight">Izmaksas</h1>
            <p className="admin-costs-muted mt-1 text-[13px]">{chrome.subtitle}</p>
          </div>
        </div>
        <div className="mt-3">
          <MonthTabs dashboard={dashboard} hrefBase={hrefBase} />
        </div>
      </header>

      <section className="admin-costs-card mt-4 rounded-2xl p-4 sm:p-5 md:mt-0">
        <div className="hidden items-start justify-between gap-4 md:flex">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AdminCollapsedMenuButton />
              <h1 className="admin-costs-ink text-[1.5rem] font-semibold tracking-tight">Izmaksas</h1>
              {workspace === "iriss" ? (
                <span className="admin-costs-chip">{chrome.subtitle}</span>
              ) : (
                <span className="admin-costs-muted text-[13px]">· {chrome.subtitle}</span>
              )}
            </div>
            <p className="admin-costs-muted mt-3 text-[13px]">{dashboard.rangeLabel}</p>
            <p className="admin-costs-ink mt-1 text-[2.35rem] font-semibold leading-none tracking-tight tabular-nums">
              {formatAdminCostUsd(dashboard.totalUsd)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <MonthTabs dashboard={dashboard} hrefBase={hrefBase} />
            <p className="admin-costs-muted max-w-[16rem] text-right text-[11px] leading-4">{dashboard.footnote}</p>
          </div>
        </div>

        <div className="md:hidden">
          <p className="admin-costs-muted text-[13px]">{dashboard.rangeLabel}</p>
          <p className="admin-costs-ink mt-1 text-[2.1rem] font-semibold leading-none tracking-tight tabular-nums">
            {formatAdminCostUsd(dashboard.totalUsd)}
          </p>
          <p className="admin-costs-muted mt-2 text-[11px] leading-4">{dashboard.footnote}</p>
        </div>

        <div className="admin-costs-track mt-4 flex h-2 overflow-hidden rounded-full" aria-hidden>
          {dashboard.groups
            .filter((g) => g.usd > 0)
            .map((g) => (
              <div key={g.id} className="h-full" style={{ width: `${Math.max(g.percent, 0)}%`, background: costGroupDotVar(g.id) }} />
            ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {dashboard.groups.map((g) => (
            <li key={g.id} className="admin-costs-soft flex items-center gap-1.5 text-[12px]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: costGroupDotVar(g.id) }} />
              {g.label} {formatAdminCostPercent(g.percent)}
            </li>
          ))}
        </ul>
      </section>

      {banner ? (
        <p className="admin-costs-banner mt-3" data-level={worst >= 100 ? "100" : "80"}>
          <AlertTriangle className="mr-2 inline h-4 w-4 -translate-y-px" aria-hidden />
          {banner}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-3">
        {dashboard.groups.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            month={dashboard.month}
            nowMs={nowMs}
            onSaved={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}

export type { CostSourceId, AdminCostsWorkspace };
