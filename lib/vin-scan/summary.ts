import type { VinScanIndicator, VinScanMileage, VinScanStatus, VinScanVehicle } from "@/lib/vin-scan/types";
import { isVinScanWantedSource } from "@/lib/vin-scan/wanted";

export type VinScanOverviewRow = {
  id: string;
  status: VinScanStatus;
  label?: string;
  vehicle?: VinScanVehicle;
  mileage?: VinScanMileage[];
};

const RIGA = "Europe/Riga";

export function formatVinScanScannedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("lv-LV", {
    timeZone: RIGA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function pickVinScanVehicle(rows: readonly VinScanOverviewRow[]): VinScanVehicle | null {
  const ranked = ["csdd", "nhtsa", "tjekbil", "esyn", "carinfo", "plc_auction"] as const;
  for (const id of ranked) {
    const row = rows.find((item) => item.id === id && item.status === "found" && item.vehicle);
    if (row?.vehicle && (row.vehicle.make || row.vehicle.model || row.vehicle.year)) return row.vehicle;
  }
  const any = rows.find((item) => item.status === "found" && item.vehicle);
  return any?.vehicle ?? null;
}

export function collectVinScanMileage(rows: readonly VinScanOverviewRow[]): VinScanMileage[] {
  const seen = new Set<string>();
  const out: VinScanMileage[] = [];
  for (const row of rows) {
    for (const item of row.mileage ?? []) {
      const key = `${item.date}|${item.odometer}|${item.source}`;
      if (!item.date && !item.odometer) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export function formatVinScanVehicleLine(vehicle: VinScanVehicle | null): string {
  if (!vehicle) return "";
  return [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ");
}

export function formatVinScanMileageLine(rows: readonly VinScanMileage[]): string {
  if (rows.length === 0) return "Nobraukuma rādījumu nav";
  return rows
    .map((row) => [row.date, row.odometer, row.source].filter(Boolean).join(" · "))
    .join("; ");
}

export function buildVinScanOverview(rows: readonly VinScanOverviewRow[]): { vehicleLine: string; mileageLine: string } {
  return {
    vehicleLine: formatVinScanVehicleLine(pickVinScanVehicle(rows)),
    mileageLine: formatVinScanMileageLine(collectVinScanMileage(rows)),
  };
}

export function formatVinScanExportText(opts: {
  vin: string;
  scannedAt: string;
  rows: readonly (VinScanOverviewRow & Partial<VinScanIndicator>)[];
}): string {
  const overview = buildVinScanOverview(opts.rows);
  const when = formatVinScanScannedAt(opts.scannedAt);
  const lines = [
    `VIN: ${opts.vin}`,
    when ? `Skenēts: ${when}` : "",
    overview.vehicleLine,
    `Nobraukums: ${overview.mileageLine}`,
    "",
    "Avoti:",
    ...opts.rows.map((row) => {
      const wanted =
        isVinScanWantedSource(row.id) && (row.status === "found" || row.status === "none")
          ? row.status === "found"
            ? "meklēšanā"
            : "nav meklēšanā"
          : row.status;
      return `- ${row.label} (${row.country}): ${wanted} · ${row.summary}`;
    }),
  ];
  return lines.filter((line, i) => line !== "" || i === 4).join("\n").trim();
}

export function formatVinScanExportJson(opts: {
  vin: string;
  scannedAt: string;
  rows: readonly (VinScanOverviewRow & Partial<VinScanIndicator>)[];
}): string {
  return JSON.stringify(
    {
      vin: opts.vin,
      scannedAt: opts.scannedAt,
      vehicle: pickVinScanVehicle(opts.rows),
      mileage: collectVinScanMileage(opts.rows),
      indicators: opts.rows,
    },
    null,
    2,
  );
}
