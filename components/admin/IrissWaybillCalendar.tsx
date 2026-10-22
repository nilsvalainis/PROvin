"use client";

import { useMemo } from "react";
import { buildWaybillCalendar } from "@/lib/iriss-waybill-calendar";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";

const DAY_FMT = new Intl.DateTimeFormat("lv-LV", { weekday: "short", day: "2-digit", month: "2-digit" });

/** Termiņu kalendārs: katram tranzīta numuram sava josla, pavadzīme = josla laikā (7 dienas). */
export function IrissWaybillCalendar({
  rows,
  nowMs,
  onOpen,
}: {
  rows: readonly IrissPavadzimeListRow[];
  nowMs: number;
  onOpen: (row: IrissPavadzimeListRow) => void;
}) {
  const cal = useMemo(() => buildWaybillCalendar(rows, nowMs, 7), [rows, nowMs]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  if (cal.lanes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#E5E7EB] bg-white px-6 py-10 text-center text-[13px] text-[#6b7280] max-md:mx-4">
        Nākamajās 7 dienās nav pavadzīmju.
      </div>
    );
  }
  return (
    <section className="iriss-wb-cal max-md:mx-4" aria-label="Pavadzīmju termiņu kalendārs">
      <div className="iriss-wb-cal-head">
        <span className="iriss-wb-cal-plate" />
        <div className="iriss-wb-cal-days">
          {cal.days.map((d, i) => (
            <span key={d} className={i === 0 ? "today" : ""}>
              {i === 0 ? "Šodien" : DAY_FMT.format(new Date(d))}
            </span>
          ))}
        </div>
      </div>
      {cal.lanes.map((lane) => (
        <div key={lane.plate} className="iriss-wb-cal-lane">
          <span className="iriss-wb-cal-plate">{lane.plate}</span>
          <div className="iriss-wb-cal-track">
            {cal.days.map((d, i) => (
              <span key={d} className="iriss-wb-cal-grid" style={{ left: `${(i / cal.days.length) * 100}%` }} aria-hidden />
            ))}
            <span className="iriss-wb-cal-now" style={{ left: `${cal.nowPct}%` }} aria-hidden />
            {lane.segments.map((seg) => (
              <button
                key={seg.id}
                type="button"
                className={`iriss-wb-cal-seg ${seg.tone}`}
                style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
                title={`${seg.number} · ${seg.brandModel}`}
                onClick={() => {
                  const r = byId.get(seg.id);
                  if (r) onOpen(r);
                }}
              >
                <span>{seg.brandModel || seg.number}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      <p className="iriss-wb-cal-legend">
        <span className="dot active" /> derīga <span className="dot soon" /> beidzas 24 h laikā <span className="dot expired" /> beigusies
      </p>
    </section>
  );
}
