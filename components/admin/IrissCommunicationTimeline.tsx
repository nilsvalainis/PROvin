"use client";

import {
  IRISS_COMM_CHANNEL_LV,
  IRISS_COMM_CHANNELS,
  filterIrissCommunicationTimeline,
  type IrissCommFilter,
  type IrissCommTimelineItem,
} from "@/lib/iriss-communication-timeline";

const filterBtn =
  "rounded-full border px-3 py-1.5 text-[12px] font-semibold";

function kindDot(kind: IrissCommTimelineItem["kind"]): string {
  if (kind === "whatsapp") return "bg-[#16a34a]";
  if (kind === "call") return "bg-[#111827]";
  if (kind === "email") return "bg-[#2563eb]";
  if (kind === "advance") return "bg-[#ca8a04]";
  if (kind === "offer") return "bg-[#0f766e]";
  if (kind === "status") return "bg-[#7c3aed]";
  return "bg-[#6b7280]";
}

export function IrissCommunicationTimeline({
  items,
  filter,
  onFilter,
}: {
  items: readonly IrissCommTimelineItem[];
  filter: IrissCommFilter;
  onFilter: (next: IrissCommFilter) => void;
}) {
  const shown = filterIrissCommunicationTimeline(items, filter);
  const counts = Object.fromEntries(
    IRISS_COMM_CHANNELS.map((id) => [id, filterIrissCommunicationTimeline(items, id).length]),
  ) as Record<IrissCommFilter, number>;

  return (
    <div className="space-y-2">
      <div className="flex max-w-full flex-wrap gap-1.5" role="tablist" aria-label="Komunikācijas filtri">
        {IRISS_COMM_CHANNELS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`${filterBtn} ${
              filter === id
                ? "border-[#111827] bg-[#111827] text-white"
                : "border-[#e5e7eb] bg-[#f3f4f6] text-[#374151]"
            }`}
            onClick={() => onFilter(id)}
          >
            {IRISS_COMM_CHANNEL_LV[id]} {counts[id]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-[13px] leading-snug text-[#6b7280]">
          Šajā filtrā ierakstu nav. Zvans, WhatsApp un e-pasts atveras ar pogām. Piezīmes paliek pasūtījumā.
        </p>
      ) : (
        <ul className="space-y-2">
          {shown.map((row) => (
            <li key={row.id} className="flex items-start gap-3 border-b border-dashed border-[#eee] py-2 last:border-0">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${kindDot(row.kind)}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-[#111827]">{row.title}</p>
                  {row.statusLabel ? (
                    <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[11px] font-semibold text-[#374151]">
                      {row.statusLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[12px] text-[#6b7280]">
                  {row.stamp}
                  {row.durationMin ? ` · ${row.durationMin} min` : ""}
                  {row.body ? ` · ${row.body}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
