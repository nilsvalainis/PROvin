"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminCollapsedMenuButton } from "@/components/admin/AdminCollapsedMenuButton";
import { IrissOverflowItem, IrissOverflowMenu } from "@/components/admin/IrissOverflowMenu";
import { AdminMobileTopBar } from "@/components/admin/mobile/AdminMobileChrome";
import { useModalBackdropClose } from "@/hooks/useModalBackdropClose";
import { formatYearMonthKey, shiftYearMonth } from "@/lib/admin-riga-calendar";
import { formatIrissMonthlyReportCsv, type IrissMonthlyReport } from "@/lib/iriss-monthly-report";
import {
  formatIrissMonthlyDelta,
  formatIrissReportMonthLocative,
  formatIrissReportNavLabel,
  IRISS_REPORT_ABOUT,
  IRISS_REPORT_ABOUT_TITLE,
  IRISS_REPORT_PDF_HINT,
  IRISS_REPORT_PDF_VALUE,
  irissMonthlyMetricDeltas,
  irissMonthlyMetricSnapshot,
} from "@/lib/iriss-monthly-report-view";
import { IRISS_PASUTIJUMS_LIST_STATUS_LV } from "@/lib/iriss-pasutijumi-types";

const STATUS_LV = IRISS_PASUTIJUMS_LIST_STATUS_LV;

function hrefForMonth(year: number, month: number): string {
  return `/admin/iriss/atskaite?month=${formatYearMonthKey(year, month)}`;
}

export function IrissMonthlyReportView({
  report,
  previous,
}: {
  report: IrissMonthlyReport;
  previous: IrissMonthlyReport;
}) {
  const csv = useMemo(() => formatIrissMonthlyReportCsv(report), [report]);
  const prev = shiftYearMonth(report.year, report.month, -1);
  const next = shiftYearMonth(report.year, report.month, 1);
  const [aboutOpen, setAboutOpen] = useState(false);
  const mobileAboutTriggerRef = useRef<HTMLButtonElement>(null);
  const desktopAboutTriggerRef = useRef<HTMLButtonElement>(null);
  const lastAboutFrom = useRef<"mobile" | "desktop">("desktop");
  const deltas = irissMonthlyMetricDeltas(irissMonthlyMetricSnapshot(report), irissMonthlyMetricSnapshot(previous));
  const prevLoc = formatIrissReportMonthLocative(previous.month);

  function openAbout(from: "mobile" | "desktop") {
    lastAboutFrom.current = from;
    setAboutOpen(true);
  }

  function closeAbout() {
    setAboutOpen(false);
    window.requestAnimationFrame(() => {
      (lastAboutFrom.current === "mobile" ? mobileAboutTriggerRef : desktopAboutTriggerRef).current?.focus();
    });
  }

  const aboutBackdropClose = useModalBackdropClose(closeAbout);

  useEffect(() => {
    if (!aboutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeAbout();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aboutOpen]);

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

  const monthNav = (
    <div className="flex items-center justify-center gap-2">
      <Link
        href={hrefForMonth(prev.year, prev.month)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--s1)] text-[16px] font-semibold text-[var(--ink)] shadow-[var(--sh)]"
        aria-label="Iepriekšējais mēnesis"
      >
        ‹
      </Link>
      <p className="min-w-[10.5rem] text-center text-[15px] font-semibold text-[var(--ink)]">
        {formatIrissReportNavLabel(report.year, report.month)}
      </p>
      <Link
        href={hrefForMonth(next.year, next.month)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--s1)] text-[16px] font-semibold text-[var(--ink)] shadow-[var(--sh)]"
        aria-label="Nākamais mēnesis"
      >
        ›
      </Link>
    </div>
  );

  function overflowFor(from: "mobile" | "desktop") {
    return (
      <IrissOverflowMenu label="Vairāk" triggerRef={from === "mobile" ? mobileAboutTriggerRef : desktopAboutTriggerRef}>
        <IrissOverflowItem onClick={downloadCsv}>Lejupielādēt CSV</IrissOverflowItem>
        <IrissOverflowItem onClick={() => openAbout(from)}>{IRISS_REPORT_ABOUT_TITLE}</IrissOverflowItem>
      </IrissOverflowMenu>
    );
  }

  return (
    <div className="iriss-atskaite-view">
      <div className="md:hidden">
        <AdminMobileTopBar title="Mēneša atskaite" trailing={overflowFor("mobile")}>
          {monthNav}
        </AdminMobileTopBar>
      </div>

      <header className="mb-4 hidden md:block">
        <div className="flex items-center gap-2">
          <AdminCollapsedMenuButton className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-tight text-[var(--ink)]">Mēneša atskaite</h1>
            <p className="mt-1 text-[13px] text-[var(--ink2)]">
              IRISS pasūtījumi un piedāvājumi. Bez PROVIN auditu metriku.
            </p>
          </div>
          {monthNav}
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex h-10 items-center rounded-full bg-[var(--s1)] px-3 text-[13px] font-semibold text-[var(--ink)] shadow-[var(--sh)]"
          >
            Lejupielādēt CSV
          </button>
          {overflowFor("desktop")}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Pasūtījumi" value={report.ordersCreated} hint={formatIrissMonthlyDelta(deltas.ordersCreated, prevLoc)} />
        <Stat label="Aktīvi" value={report.ordersByStatus.active} hint={formatIrissMonthlyDelta(deltas.active, prevLoc)} />
        <Stat label="Izpildīti" value={report.ordersByStatus.completed} hint={formatIrissMonthlyDelta(deltas.completed, prevLoc)} />
        <Stat label="Neaktīvi" value={report.ordersByStatus.inactive} hint={formatIrissMonthlyDelta(deltas.inactive, prevLoc)} />
        <Stat label="Piedāvājumi" value={report.offersCreated} hint={formatIrissMonthlyDelta(deltas.offersCreated, prevLoc)} />
        <Stat label="Ar piedāvājumu" value={report.ordersWithOffers} hint={formatIrissMonthlyDelta(deltas.ordersWithOffers, prevLoc)} />
        <Stat label="Laboti piedāvājumi" value={report.offersUpdated} hint={formatIrissMonthlyDelta(deltas.offersUpdated, prevLoc)} />
        <Stat label="PDF ģenerēšana" value={IRISS_REPORT_PDF_VALUE} hint={IRISS_REPORT_PDF_HINT} muted />
      </div>

      {report.rows.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-[var(--s1)] px-5 py-10 text-center text-[15px] text-[var(--ink3)] shadow-[var(--sh)]">
          Šajā mēnesī nav jaunu IRISS pasūtījumu.
        </p>
      ) : (
        <>
          <p className="mt-6 mb-2 text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--ink2)]">
            {formatIrissReportNavLabel(report.year, report.month).split(" ")[0]} pasūtījumi · {report.rows.length}
          </p>
          <div className="hidden overflow-hidden rounded-3xl bg-[var(--s1)] shadow-[var(--sh)] md:block">
            <table className="w-full text-left text-[14px]">
              <thead>
                <tr className="text-[12px] font-semibold uppercase tracking-[0.04em] text-[var(--ink3)]">
                  <th className="px-4 py-3 font-semibold">Klients</th>
                  <th className="px-4 py-3 font-semibold">Auto</th>
                  <th className="px-4 py-3 font-semibold">Statuss</th>
                  <th className="px-4 py-3 text-right font-semibold">Piedāvājumi</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id} className="border-t border-[var(--hair)]">
                    <td className="px-4 py-3">
                      <Link href={`/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`} className="font-semibold text-[var(--ink)]">
                        {row.clientName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[var(--ink2)]">{row.brandModel}</td>
                    <td className="px-4 py-3 text-[var(--ink2)]">{STATUS_LV[row.status]}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-[var(--ink2)]">
                      {row.offersCreatedInMonth}/{row.offerCount} piedāv.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {report.rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/admin/iriss/pasutijumi/${encodeURIComponent(row.id)}`}
                  className="flex min-h-[4.25rem] items-center gap-3 rounded-2xl bg-[var(--s1)] px-4 py-3 shadow-[var(--sh)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-[var(--ink)]">{row.clientName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-[var(--ink2)]">{row.brandModel}</p>
                  </div>
                  <p className="shrink-0 text-[12px] font-semibold text-[var(--ink2)]">{STATUS_LV[row.status]}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {aboutOpen ? (
        <div
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/40 p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:p-6"
          {...aboutBackdropClose}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="iriss-report-about-title"
            className="w-full max-w-md rounded-3xl bg-[var(--s1)] p-5 shadow-[var(--gsh)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="iriss-report-about-title" className="text-[16px] font-semibold text-[var(--ink)]">
              Par atskaiti
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink2)]">{IRISS_REPORT_ABOUT}</p>
            <button
              type="button"
              onClick={closeAbout}
              className="mt-4 inline-flex h-10 items-center rounded-full bg-[var(--s2)] px-4 text-[13px] font-semibold text-[var(--ink)]"
            >
              Aizvērt
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: number | string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-[var(--s1)] px-3 py-3 shadow-[var(--sh)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--ink3)]">{label}</p>
      <p className={`mt-1 font-bold leading-tight text-[var(--ink)] ${muted ? "text-[17px]" : "text-[1.65rem] tabular-nums"}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-[var(--ink3)]">{hint}</p> : null}
    </div>
  );
}
