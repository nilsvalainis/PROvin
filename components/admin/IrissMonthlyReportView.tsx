"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatIrissMonthlyReportCsv, type IrissMonthlyReport } from "@/lib/iriss-monthly-report";
import { formatYearMonthKey, shiftYearMonth } from "@/lib/admin-riga-calendar";

const STATUS_LV: Record<IrissMonthlyReport["rows"][number]["status"], string> = {
  active: "Aktīvs",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

function hrefForMonth(year: number, month: number): string {
  return `/admin/iriss/atskaite?month=${formatYearMonthKey(year, month)}`;
}

export function IrissMonthlyReportView({ report }: { report: IrissMonthlyReport }) {
  const csv = useMemo(() => formatIrissMonthlyReportCsv(report), [report]);
  const prev = shiftYearMonth(report.year, report.month, -1);
  const next = shiftYearMonth(report.year, report.month, 1);

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iriss-menesas-atskaite-${report.monthKey}.csv`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto w-full max-w-3xl pb-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={hrefForMonth(prev.year, prev.month)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#f2f2f7] text-[15px] font-semibold text-[var(--color-apple-text)]"
        >
          ‹
        </Link>
        <p className="text-center text-[17px] font-semibold capitalize text-[var(--color-apple-text)]">
          {report.monthLabel}
        </p>
        <Link
          href={hrefForMonth(next.year, next.month)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#f2f2f7] text-[15px] font-semibold text-[var(--color-apple-text)]"
        >
          ›
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Pasūtījumi" value={report.ordersCreated} />
        <Stat label="Aktīvi" value={report.ordersByStatus.active} />
        <Stat label="Izpildīti" value={report.ordersByStatus.completed} />
        <Stat label="Neaktīvi" value={report.ordersByStatus.inactive} />
        <Stat label="Piedāvājumi" value={report.offersCreated} />
        <Stat label="Ar piedāvājumu" value={report.ordersWithOffers} />
        <Stat label="Laboti piedāvājumi" value={report.offersUpdated} />
        <Stat label="PDF ģenerēšana" value="nav datos" muted />
      </div>

      <p className="mt-3 text-[12px] text-[#8e8e93]">
        Single-tenant IRISS ops (ĪRISS). Nav Stripe un nav PROVIN VIN/auditu metriku. Multi-tenant
        dīleru panelis vēl nav.
      </p>

      <button
        type="button"
        onClick={downloadCsv}
        className="mt-4 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[var(--color-apple-text)] text-[15px] font-semibold text-white"
      >
        Lejupielādēt CSV
      </button>

      {report.rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[#e5e5ea] bg-white px-5 py-10 text-center text-[15px] text-[#8e8e93]">
          Šajā mēnesī nav jaunu IRISS pasūtījumu.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-[#f0f0f2] overflow-hidden rounded-2xl border border-[#e5e5ea] bg-white">
          {report.rows.map((row) => (
            <li key={row.id}>
              <Link
                href={`/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`}
                className="flex min-h-[4.25rem] items-center gap-3 px-4 py-3 active:bg-[#f2f2f7]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[var(--color-apple-text)]">{row.clientName}</p>
                  <p className="mt-0.5 truncate text-[12px] text-[#8e8e93]">{row.brandModel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] font-semibold text-[#3a3a3c]">{STATUS_LV[row.status]}</p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-[#8e8e93]">
                    {row.offersCreatedInMonth}/{row.offerCount} piedāv.
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, muted }: { label: string; value: number | string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#e5e5ea] bg-white px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#8e8e93]">{label}</p>
      <p
        className={`mt-1 font-bold leading-tight text-[var(--color-apple-text)] ${
          muted ? "text-[15px]" : "text-[1.65rem] tabular-nums"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
