/**
 * IRISS CSDD tirdzniecības nr. allowlist un aizņemtība.
 * Aizņemts = indeksā ir aktīva (vēl nederīga) pavadzīme šim nr.
 */

import { selectActiveIrissPavadzimes } from "@/lib/iriss-pavadzimes-active";

export const IRISS_DEALER_PLATES = ["B193-7", "B762-7", "B861-6"] as const;
export type IrissDealerPlate = (typeof IRISS_DEALER_PLATES)[number];

export type WaybillPlateCurrent = {
  number: string;
  brandModel: string;
  validUntil: string;
};

export type WaybillPlateState = {
  plate: IrissDealerPlate;
  busy: boolean;
  current?: WaybillPlateCurrent;
};

type OccupancyRow = {
  plate: string;
  validUntil: string;
  issuedAt?: string;
  number: string;
  brandModel?: string;
};

export function compactDealerPlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, "");
}

export function displayDealerPlate(raw: string): IrissDealerPlate | "" {
  const compact = compactDealerPlate(raw);
  if (!compact) return "";
  return IRISS_DEALER_PLATES.find((plate) => compactDealerPlate(plate) === compact) ?? "";
}

export function isAllowlistedWaybillPlate(raw: string): raw is IrissDealerPlate {
  return Boolean(displayDealerPlate(raw));
}

export function emptyWaybillPlateStates(): WaybillPlateState[] {
  return IRISS_DEALER_PLATES.map((plate) => ({ plate, busy: false }));
}

export function waybillPlateOccupancy(rows: OccupancyRow[], now = new Date()): WaybillPlateState[] {
  const normalized = rows.map((row) => ({
    ...row,
    plate: displayDealerPlate(row.plate) || row.plate.trim().toUpperCase(),
    issuedAt: row.issuedAt ?? "",
  }));
  const latest = selectActiveIrissPavadzimes(normalized, now);
  const byPlate = new Map<string, (typeof latest)[number]>();
  for (const row of latest) {
    const plate = displayDealerPlate(row.plate);
    if (plate) byPlate.set(plate, row);
  }
  const nowMs = now.getTime();
  return IRISS_DEALER_PLATES.map((plate) => {
    const row = byPlate.get(plate);
    const until = row ? Date.parse(row.validUntil) : Number.NaN;
    const busy = Boolean(row && Number.isFinite(until) && until >= nowMs);
    return {
      plate,
      busy,
      current:
        busy && row
          ? {
              number: row.number,
              brandModel: (row.brandModel ?? "").trim(),
              validUntil: row.validUntil,
            }
          : undefined,
    };
  });
}

/** `22.10.2026, 15:59` Europe/Riga. */
export function formatRigaDateTimeComma(iso: string): string {
  const d = new Date(iso);
  if (!iso.trim() || Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Riga",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")}, ${get("hour")}:${get("minute")}`;
}
