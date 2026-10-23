"use client";

import { useMemo } from "react";
import { buildWaybillCalendar, waybillExpiredByDay, waybillPlateCards } from "@/lib/iriss-waybill-calendar";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import { IRISS_DEALER_PLATES, displayDealerPlate } from "@/lib/iriss-waybill-plates";

const DAY_FMT = new Intl.DateTimeFormat("lv-LV", { weekday: "short", day: "2-digit", month: "2-digit" });

function SmallPlate({ plate }: { plate: string }) {
  const shown = (displayDealerPlate(plate) || plate).replace(/^([A-Z])/, "$1 ");
  return (
    <span className="shrink-0 whitespace-nowrap rounded-[4px] border-[1.5px] border-[#c8102e] bg-white px-[5px] text-[12px] font-bold leading-[18px] !text-[#c8102e]">
      {shown}
    </span>
  );
}

/**
 * Kalendārs telefonā v2 (makets ~/pz-mob-v2/3-kalendars.png): katrs numurs sava kartīte - auto, VIN,
 * "Beidzas rīt, 06:42", josla un "Atlikušas 8 h"; zem tā beigušās pa dienām (7 dienas).
 */
export function IrissWaybillCalendarCards({
  rows,
  nowMs,
  onOpen,
}: {
  rows: readonly IrissPavadzimeListRow[];
  nowMs: number;
  onOpen: (row: IrissPavadzimeListRow) => void;
}) {
  const cards = useMemo(() => waybillPlateCards(rows, IRISS_DEALER_PLATES, nowMs), [rows, nowMs]);
  const ended = useMemo(() => waybillExpiredByDay(rows, nowMs, 7), [rows, nowMs]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  return (
    <div className="px-4">
      <p className="pb-2.5 text-[14px] leading-snug text-[var(--ink2,#5e636e)]">Kuram numuram pavadzīme ir derīga un līdz kuram brīdim.</p>
      {cards.map((card) => {
        const a = card.active;
        const row = a ? byId.get(a.id) : undefined;
        const soon = a?.tone === "soon";
        return (
          <div
            key={card.plate}
            role={row ? "button" : undefined}
            tabIndex={row ? 0 : undefined}
            onClick={row ? () => onOpen(row) : undefined}
            onKeyDown={row ? (e) => (e.key === "Enter" ? onOpen(row) : undefined) : undefined}
            className="mb-2.5 rounded-[14px] bg-[var(--s1,#fff)] p-3.5"
          >
            <div className="flex items-center gap-2.5">
              <SmallPlate plate={card.plate} />
              <span
                className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                  !a ? "bg-[var(--fill,rgba(116,120,138,0.11))] !text-[var(--ink2,#5e636e)]" : soon ? "bg-[#fff4e5] !text-[#b45309]" : "bg-[#ecfdf3] !text-[#067647]"
                }`}
              >
                {!a ? "Brīvs" : soon ? "Beidzas drīz" : "Derīga"}
              </span>
            </div>
            {a ? (
              <>
                <p className="mt-2.5 text-[16px] font-bold text-[var(--ink,#0b0c10)]">{a.brandModel || "Auto"}</p>
                {a.vin ? <p className="mt-0.5 font-mono text-[12px] text-[var(--ink2,#5e636e)]">{a.vin}</p> : null}
                <div className="mt-2.5 flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-[var(--ink2,#5e636e)]">Beidzas</span>
                  <span className="text-[20px] font-bold tracking-[-0.01em] text-[var(--ink,#0b0c10)]">{a.endsLabel}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--fill,rgba(116,120,138,0.11))]">
                  <div className={`h-full rounded-full ${soon ? "bg-[#ff9500]" : "bg-[#34c759]"}`} style={{ width: `${Math.round(a.share * 100)}%` }} />
                </div>
                <p className={`mt-1.5 text-[13px] font-semibold ${soon ? "!text-[#c2410c]" : "!text-[#1f8a3b]"}`}>Atlikušas {a.hoursLeft} h</p>
              </>
            ) : (
              <>
                <p className="mt-2.5 text-[16px] font-bold text-[var(--ink3,#9a9faa)]">Nav aktīvas pavadzīmes</p>
                {card.last ? (
                  <p className="mt-0.5 text-[12px] text-[var(--ink2,#5e636e)]">
                    Pēdējā: {card.last.brandModel || "auto"}, beidzās {card.last.endedLabel}
                  </p>
                ) : null}
              </>
            )}
          </div>
        );
      })}
      {ended.length ? (
        <>
          <p className="px-1 pb-1.5 pt-4 text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--ink2,#6b7080)]">Beigušās (7 dienas)</p>
          <div className="overflow-hidden rounded-[14px] bg-[var(--s1,#fff)]">
            {ended.map((group) => (
              <div key={group.day}>
                <p className="bg-[var(--fill,#f7f8fa)] px-3.5 pb-1 pt-2.5 text-[12px] font-bold text-[var(--ink2,#5e636e)]">{group.day}</p>
                {group.items.map((item) => {
                  const row = byId.get(item.id);
                  return (
                    <div key={item.id} className="border-t-[0.5px] border-[var(--hair,rgba(17,24,39,0.08))] first:border-t-0">
                      <button
                        type="button"
                        onClick={() => row && onOpen(row)}
                        className="flex min-h-14 w-full items-center gap-2.5 !rounded-none px-3.5 py-2.5 text-left"
                      >
                        <SmallPlate plate={item.plate} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-[var(--ink,#0b0c10)]">{item.brandModel || "Auto"}</span>
                          <span className="block text-[13px] text-[var(--ink2,#5e636e)]">beidzās {item.time}</span>
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Termiņu kalendārs: katram tranzīta numuram sava josla, pavadzīme = josla laikā (7 dienas). Telefonā - kartītes (v2). */
export function IrissWaybillCalendar(props: {
  rows: readonly IrissPavadzimeListRow[];
  nowMs: number;
  onOpen: (row: IrissPavadzimeListRow) => void;
}) {
  return (
    <>
      <div className="md:hidden">
        <IrissWaybillCalendarCards {...props} />
      </div>
      <div className="max-md:hidden">
        <IrissWaybillCalendarLanes {...props} />
      </div>
    </>
  );
}

function IrissWaybillCalendarLanes({
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
