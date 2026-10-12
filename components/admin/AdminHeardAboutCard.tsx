"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { computeHeardAboutStats, HEARD_ABOUT_PERIODS, type HeardAboutOrder, type HeardAboutPeriod } from "@/lib/admin-heard-about-stats";

const fmtEur = (cents: number | null) => (cents == null ? "—" : `${(cents / 100).toLocaleString("lv-LV", { maximumFractionDigits: 2 })} €`);
const fmtDate = (sec: number) => new Date(sec * 1000).toLocaleDateString("lv-LV", { day: "2-digit", month: "2-digit", year: "numeric" });

export function AdminHeardAboutCard({ orders, nowSec }: { orders: HeardAboutOrder[]; nowSec: number }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<HeardAboutPeriod>("30");
  const [picked, setPicked] = useState<string | null>(null);
  const stats = useMemo(() => computeHeardAboutStats(orders, period, nowSec), [orders, period, nowSec]);
  const top = stats.rows.slice(0, 3).map((r) => `${r.label} ${r.count}`).join(" · ");
  const max = stats.rows[0]?.count ?? 0;

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-5 text-left sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-provin-muted)]">Pasūtījumi</p>
          <h2 className="mt-1 text-base font-semibold text-[var(--color-apple-text)]">Kur uzzināja</h2>
          <p className="mt-0.5 truncate text-[12.5px] text-[var(--color-provin-muted)]">{stats.total > 0 ? top : "Nav datu šajā periodā"}</p>
        </div>
        <p className="text-[2rem] font-semibold leading-none tabular-nums text-[var(--color-apple-text)]">{stats.total}</p>
        <ChevronDown className={`h-5 w-5 shrink-0 text-[#8e8e93] transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-5 pb-5 pt-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-[9px] bg-[#e9e9ee] p-[2px]" role="tablist" aria-label="Periods">
              {HEARD_ABOUT_PERIODS.map((p) => (
                <button key={p.id} type="button" role="tab" aria-selected={period === p.id} onClick={() => { setPeriod(p.id); setPicked(null); }} className={`h-7 rounded-[7px] px-3 text-[12.5px] ${period === p.id ? "bg-white font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "font-medium text-[#3a3a3c]"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            <span className="text-[11.5px] text-[#8e8e93]">{stats.total} ar avotu{stats.withoutSource > 0 ? ` · ${stats.withoutSource} bez avota` : ""}</span>
          </div>

          {stats.rows.length === 0 ? (
            <p className="mt-4 text-[13px] text-[var(--color-provin-muted)]">Šajā periodā nav pasūtījumu ar norādītu avotu.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {stats.rows.map((r) => {
                const on = picked === r.label;
                return (
                  <li key={r.label}>
                    <button type="button" onClick={() => setPicked(on ? null : r.label)} aria-expanded={on} className="flex w-full items-center gap-3 py-2.5 text-left">
                      <ChevronRight className={`h-4 w-4 shrink-0 text-[#c7c7cc] transition ${on ? "rotate-90" : ""}`} aria-hidden />
                      <span className="w-28 shrink-0 truncate text-[13.5px] font-medium text-[var(--color-apple-text)] sm:w-36">{r.label}</span>
                      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f2f2f7]">
                        <span className="block h-full rounded-full bg-[var(--color-provin-accent)]" style={{ width: `${max > 0 ? (r.count / max) * 100 : 0}%` }} />
                      </span>
                      <span className="w-8 shrink-0 text-right text-[13.5px] font-semibold tabular-nums">{r.count}</span>
                      <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-[#8e8e93]">{Math.round(r.share * 100)}%</span>
                    </button>
                    {on ? (
                      <ul className="mb-2 ml-7 overflow-hidden rounded-xl bg-[#f8f8f9]">
                        {r.orders.map((o) => (
                          <li key={o.id} className="border-b border-slate-100 last:border-b-0">
                            <Link href={`/admin/orders/${encodeURIComponent(o.id)}`} className="flex items-center gap-3 px-3 py-2 text-[12.5px] hover:bg-black/[0.03]">
                              <span className="w-20 shrink-0 tabular-nums text-[#8e8e93]">{fmtDate(o.created)}</span>
                              <span className="min-w-0 flex-1 truncate text-[var(--color-apple-text)]">{o.label}</span>
                              <span className="shrink-0 tabular-nums text-[#8e8e93]">{fmtEur(o.amountTotal)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
