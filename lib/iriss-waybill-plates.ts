/**
 * IRISS CSDD tirdzniecības nr. allowlist un aizņemtība.
 * Aizņemts = indeksā ir aktīva (vēl nederīga) pavadzīme šim nr., kas nav Arhīvā un ko CSDD nav atsaucis.
 */

import { selectActiveIrissPavadzimes } from "@/lib/iriss-pavadzimes-active";
import type { CsddPlatesDoc } from "@/lib/iriss-waybill-csdd-plates";

export const IRISS_DEALER_PLATES = ["B193-7", "B762-7", "B192-7"] as const;
export type IrissDealerPlate = (typeof IRISS_DEALER_PLATES)[number];

export type IrissDealerPlateMeta = {
  owner: string;
  bottomText: string;
};

export const IRISS_DEALER_PLATE_META: Record<IrissDealerPlate, IrissDealerPlateMeta> = {
  "B193-7": { owner: "SIA ĪRISS", bottomText: "SIA ĪRISS" },
  "B762-7": { owner: "SIA ĪRISS", bottomText: "SIA ĪRISS" },
  "B192-7": { owner: "SIA Dzintarzeme Auto", bottomText: "Dzintarzeme auto" },
};

export function dealerPlateMeta(plate: string): IrissDealerPlateMeta {
  const display = displayDealerPlate(plate);
  if (display) return IRISS_DEALER_PLATE_META[display];
  return { owner: "", bottomText: "" };
}

export type WaybillPlateCurrent = {
  number: string;
  brandModel: string;
  validUntil: string;
};

export type WaybillPlateState = {
  plate: IrissDealerPlate;
  busy: boolean;
  current?: WaybillPlateCurrent;
  /** Pieprasījums šim numuram ir rindā vai darbā (CSDD vēl izdod). Aizņemtību nemaina. */
  issuing?: {
    brandModel: string;
    /** j47: izraksta Aivars ar roku (nodots no automātikas, nestandarta, B192, atkārtots vai Aivars jau darbā). */
    manual?: boolean;
  };
};

export type WaybillWithdrawnRow = {
  plate: string;
  number: string;
  issuedAt?: string;
  archived?: boolean;
};

export type OccupancyRow = WaybillWithdrawnRow & {
  validUntil: string;
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

/**
 * j66: CSDD apstiprina, ka pavadzīme vairs nav aktīva (piem. pēc «Pārtraukt»): izdevies nolasījums šim numuram,
 * veikts pēc pavadzīmes izdošanas, un šī numura nav CSDD aktīvo sarakstā. Ja izdošanas laiks nav zināms vai
 * nolasījums ir vecāks par izdošanu - nevar zināt, tāpēc false.
 */
export function csddRefutesWaybill(
  doc: CsddPlatesDoc | null | undefined,
  row: { plate: string; number: string; issuedAt?: string },
): boolean {
  if (!doc) return false;
  const want = compactDealerPlate(row.plate);
  if (!want) return false;
  const entry = doc.plates.find((e) => compactDealerPlate(e.plate) === want);
  if (!entry?.ok) return false;
  const issued = Date.parse(row.issuedAt ?? "");
  const checked = Date.parse(entry.checkedAt);
  if (!Number.isFinite(issued) || !Number.isFinite(checked) || checked <= issued) return false;
  const number = row.number.trim().toUpperCase();
  return Boolean(number) && !entry.active.some((w) => w.waybillNo === number);
}

/** Pavadzīme vairs neaizņem numuru: PDF Arhīvā vai CSDD to vairs nerāda kā aktīvu. */
export function waybillWithdrawn(
  row: WaybillWithdrawnRow,
  csdd?: CsddPlatesDoc | null,
): boolean {
  return row.archived === true || csddRefutesWaybill(csdd, row);
}

/**
 * Indeksa pavadzīmju numuri, kas vairs neaizņem numurzīmi (Arhīvs vai CSDD atsaucis ar jaunāku ok nolasījumu).
 * Overlay slāņi (CSDD momentuzņēmums, izdotais pieprasījums) tos nedrīkst atkal padarīt aizņemtus.
 */
export function withdrawnWaybillNos(
  rows: readonly WaybillWithdrawnRow[],
  csdd?: CsddPlatesDoc | null,
): ReadonlySet<string> {
  const out = new Set<string>();
  for (const row of rows) {
    const no = row.number.trim().toUpperCase();
    if (no && waybillWithdrawn(row, csdd)) out.add(no);
  }
  return out;
}

export function waybillPlateOccupancy(rows: OccupancyRow[], now = new Date(), csdd?: CsddPlatesDoc | null): WaybillPlateState[] {
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
    const busy = Boolean(row && Number.isFinite(until) && until >= nowMs && !waybillWithdrawn(row, csdd));
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
