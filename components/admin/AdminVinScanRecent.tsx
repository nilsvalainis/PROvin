"use client";

import { useState } from "react";
import { vinScanHistoryInfo, type VinScanHistoryEntry } from "@/lib/vin-scan/camera-vin";

function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("lv-LV", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Pēdējie skenējumi, pēc noklusējuma aizvērti. Pieskāriens ieliek VIN laukā. */
export function AdminVinScanRecent({
  entries,
  onPick,
}: {
  entries: VinScanHistoryEntry[];
  onPick: (vin: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#e5e5ea] bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3.5 text-left text-[13px] font-semibold text-[#1d1d1f]"
      >
        <span>Pēdējie skenējumi · {entries.length}</span>
        <span aria-hidden className={`text-[#86868b] transition-transform ${open ? "rotate-90" : ""}`}>›</span>
      </button>
      {open ? (
        <ul className="divide-y divide-[#f0f0f2] border-t border-[#f0f0f2]">
          {entries.map((e) => (
            <li key={e.vin}>
              <button
                type="button"
                onClick={() => onPick(e.vin)}
                className="flex w-full items-baseline gap-2 px-3.5 py-2 text-left"
              >
                <span className="shrink-0 font-mono text-[12.5px] text-[#1d1d1f]">{e.vin}</span>
                <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#86868b]">{vinScanHistoryInfo(e.vin)}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[#aeaeb2]">{shortTime(e.at)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
