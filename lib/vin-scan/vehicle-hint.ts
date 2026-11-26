/**
 * Viena skenējuma ietvaros: kad reģistru avoti (CSDD, tjekbil, RDW u.c.) atbildējuši, ES Safety Gate
 * meklē pēc to modeļa, nevis pēc NHTSA vPIC (vPIC ne-ASV auto modeli bieži sajauc: Volvo V60 -> «740 Series»).
 */
import { VIN_SCAN_VEHICLE_RANK, pickVinScanVehicle, type VinScanOverviewRow } from "@/lib/vin-scan/summary";
import type { VinScanVehicle } from "@/lib/vin-scan/types";

/** Ilgāk negaida: Safety Gate meklēšana iet paralēli, avota kopējais limits ir 14 s. */
export const VIN_SCAN_VEHICLE_HINT_WAIT_MS = 8_000;

export type VinScanVehicleHint = {
  report: (row: VinScanOverviewRow) => void;
  wait: () => Promise<VinScanVehicle | null>;
};

const HINT_IDS = new Set<string>(VIN_SCAN_VEHICLE_RANK);

export function createVinScanVehicleHint(
  ids: readonly string[],
  opts: { waitMs?: number } = {},
): VinScanVehicleHint {
  const pending = new Set(ids.filter((id) => HINT_IDS.has(id)));
  const rows: VinScanOverviewRow[] = [];
  let release: () => void = () => {};
  const allDone = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (pending.size === 0) release();

  function best(): VinScanVehicle | null {
    const v = pickVinScanVehicle(rows);
    return v && (v.make || v.model) ? v : null;
  }

  return {
    report(row) {
      if (!HINT_IDS.has(row.id)) return;
      rows.push(row);
      pending.delete(row.id);
      // Labākais (pirmais rangā) jau ir ar modeli - nav jāgaida pārējie.
      const top = VIN_SCAN_VEHICLE_RANK.find((id) => ids.includes(id));
      const v = best();
      if (pending.size === 0 || (top && row.id === top && v?.model)) release();
    },
    async wait() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, opts.waitMs ?? VIN_SCAN_VEHICLE_HINT_WAIT_MS);
      });
      await Promise.race([allDone, timeout]);
      if (timer) clearTimeout(timer);
      return best();
    },
  };
}

/** Ilgāk par CSDD avota limitu negaida (kfz_at kopējais limits to ietver). */
export const VIN_SCAN_FIRST_REG_HINT_WAIT_MS = 15_000;

/**
 * kfzgutachten.at datums no tā paša skenējuma CSDD rindas: pirmais `report` atbrīvo gaidītājus
 * (tukšs - datuma nav). Bez CSDD skenējumā - uzreiz "".
 */
export function createVinScanFirstRegHint(
  hasCsdd: boolean,
  opts: { waitMs?: number } = {},
): { report: (date: string) => void; wait: () => Promise<string> } {
  let value = "";
  let settled = !hasCsdd;
  let release: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    release = resolve;
  });
  if (settled) release();
  return {
    report(date) {
      if (settled) return;
      settled = true;
      value = String(date ?? "").trim();
      release();
    },
    async wait() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, opts.waitMs ?? VIN_SCAN_FIRST_REG_HINT_WAIT_MS);
      });
      await Promise.race([done, timeout]);
      if (timer) clearTimeout(timer);
      return value;
    },
  };
}
