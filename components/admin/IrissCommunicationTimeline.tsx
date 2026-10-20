"use client";

import {
  IRISS_COMM_CHANNEL_LV,
  IRISS_COMM_CHANNELS,
  filterIrissCommunicationTimeline,
  type IrissCommFilter,
  type IrissCommTimelineItem,
} from "@/lib/iriss-communication-timeline";
import {
  IRISS_COMM_TYPE_FILTERS,
  formatIrissCommDateLeft,
  irissCommBubbleSide,
  irissCommTypeMatches,
  type IrissCommTypeFilter,
} from "@/lib/iriss-order-comm-view";

export function IrissCommunicationTimeline({
  items,
  filter,
  onFilter,
  typeFilter = "all",
  onTypeFilter,
}: {
  items: readonly IrissCommTimelineItem[];
  filter: IrissCommFilter;
  onFilter: (next: IrissCommFilter) => void;
  typeFilter?: IrissCommTypeFilter;
  onTypeFilter?: (next: IrissCommTypeFilter) => void;
}) {
  const channelShown = filterIrissCommunicationTimeline(items, filter);
  const shown = channelShown.filter((row) => irissCommTypeMatches(row, typeFilter));
  const counts = Object.fromEntries(
    IRISS_COMM_CHANNELS.map((id) => [id, filterIrissCommunicationTimeline(items, id).length]),
  ) as Record<IrissCommFilter, number>;

  return (
    <div className="space-y-2">
      <div className="flex max-w-full flex-wrap gap-1.5" role="tablist" aria-label="Komunikācijas filtri">
        {IRISS_COMM_CHANNELS.map((id) => {
          const active = filter === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                active
                  ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]"
                  : "bg-[var(--s1)] text-[var(--ink2)] shadow-[var(--sh)]"
              }`}
              onClick={() => onFilter(id)}
            >
              {id === "all" ? "Visi" : IRISS_COMM_CHANNEL_LV[id]}
              <em className="ml-1.5 rounded-full bg-[color-mix(in_srgb,currentColor_14%,transparent)] px-1.5 py-px text-[11px] font-semibold not-italic">
                {counts[id]}
              </em>
            </button>
          );
        })}
      </div>
      {onTypeFilter ? (
        <div className="flex max-w-full flex-wrap gap-1.5" role="tablist" aria-label="Tipa filtrs">
          {IRISS_COMM_TYPE_FILTERS.map((item) => {
            const active = typeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  active
                    ? "bg-[var(--chip-active-bg)] text-[var(--chip-active-fg)]"
                    : "bg-[var(--s1)] text-[var(--ink2)] shadow-[var(--sh)]"
                }`}
                onClick={() => onTypeFilter(item.id)}
              >
                {item.id === "all"
                  ? "Viss"
                  : item.id === "sent"
                    ? "Nosūtīts"
                    : item.id === "answered"
                      ? "Klienta atbilde"
                      : "Neatzīmēts zvans"}
              </button>
            );
          })}
        </div>
      ) : null}
      {shown.length === 0 ? (
        <p className="text-[13px] leading-snug text-[var(--ink2)]">
          Šajā filtrā ierakstu nav. Zvans, WhatsApp un e-pasts atveras ar pogām. Piezīmes paliek pasūtījumā.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((row) => {
            const when = formatIrissCommDateLeft(row.stamp);
            const side = irissCommBubbleSide(row);
            return (
              <li key={row.id} className="flex items-start gap-3 py-1.5">
                <div className="w-[52px] shrink-0 text-[11px] leading-tight text-[var(--ink3)]">
                  <p>{when.date}</p>
                  {when.time ? <p>{when.time}</p> : null}
                </div>
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--ink3)]" aria-hidden />
                <div className={`min-w-0 flex-1 ${side === "client" ? "flex justify-end" : ""}`}>
                  <div
                    className={`max-w-[92%] rounded-[16px] px-3 py-2 ${
                      side === "client" ? "bg-[var(--fill)]" : "bg-[var(--s2)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold text-[var(--ink)]">{row.title}</p>
                      {row.statusLabel ? (
                        <span className="rounded-full bg-[var(--fill)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink2)]">
                          {row.statusLabel}
                        </span>
                      ) : null}
                    </div>
                    {row.body || row.durationMin ? (
                      <p className="mt-0.5 text-[12px] text-[var(--ink2)]">
                        {row.durationMin ? `${row.durationMin} min` : ""}
                        {row.durationMin && row.body ? " · " : ""}
                        {row.body ?? ""}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
