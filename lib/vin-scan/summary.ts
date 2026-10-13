import type { VinScanIndicator, VinScanMileage, VinScanStatus, VinScanVehicle } from "@/lib/vin-scan/types";
import { isVinScanWantedSource } from "@/lib/vin-scan/wanted";

export type VinScanOverviewRow = {
  id: string;
  status: VinScanStatus | "idle";
  label?: string;
  vehicle?: VinScanVehicle;
  mileage?: VinScanMileage[];
  country?: string;
  summary?: string;
  flags?: VinScanIndicator["flags"];
  media?: VinScanIndicator["media"];
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
  const ranked = ["csdd", "tjekbil", "rdw", "vegvesen", "esyn", "biluppgifter", "plc_auction", "vin_decode"] as const;
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

function odometerKm(raw: string): number | null {
  const n = Number(String(raw).replace(/[^\d.,]/g, "").replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 50) return n * 1000;
  return n;
}

export function detectVinScanMileageRollback(rows: readonly VinScanMileage[]): boolean {
  const dated = rows
    .map((row) => ({ t: Date.parse(row.date), km: odometerKm(row.odometer) }))
    .filter((row) => Number.isFinite(row.t) && row.km != null)
    .sort((a, b) => a.t - b.t);
  let prev = 0;
  for (const row of dated) {
    const km = row.km ?? 0;
    if (prev > 0 && km + 1000 < prev) return true;
    if (km > prev) prev = km;
  }
  return false;
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

export type VinScanFacts = {
  vehicleLine: string;
  mileageLine: string;
  mileageRollback: boolean;
  wanted: string[];
  recalls: string[];
  auctionPhotos: string[];
  registrations: string[];
};

export function buildVinScanFacts(rows: readonly VinScanOverviewRow[]): VinScanFacts {
  const mileage = collectVinScanMileage(rows);
  const wanted: string[] = [];
  const recalls: string[] = [];
  const auctionPhotos: string[] = [];
  const countries = new Set<string>();
  for (const row of rows) {
    if (row.status !== "found") continue;
    if (isVinScanWantedSource(row.id) || row.flags?.wanted || row.flags?.stolen) {
      wanted.push(row.label || row.id);
    }
    const recallN = row.flags?.recallCount ?? 0;
    if (recallN > 0) recalls.push(`${row.label || row.id}: ${recallN}`);
    const photos = row.flags?.photoCount ?? row.media?.photoCount ?? 0;
    if (photos > 0) auctionPhotos.push(`${row.label || row.id}: ${photos} foto`);
    const country = row.flags?.registrationCountry || row.country;
    if (country && ["LV", "LT", "EE", "DK", "SE", "FI", "NO", "NL", "UK", "BE"].includes(country)) {
      countries.add(country);
    }
  }
  return {
    vehicleLine: formatVinScanVehicleLine(pickVinScanVehicle(rows)),
    mileageLine: formatVinScanMileageLine(mileage),
    mileageRollback: detectVinScanMileageRollback(mileage),
    wanted,
    recalls,
    auctionPhotos,
    registrations: [...countries].sort(),
  };
}

export function buildVinScanOverview(rows: readonly VinScanOverviewRow[]): { vehicleLine: string; mileageLine: string } {
  const facts = buildVinScanFacts(rows);
  return { vehicleLine: facts.vehicleLine, mileageLine: facts.mileageLine };
}

export function formatVinScanExportText(opts: {
  vin: string;
  scannedAt: string;
  rows: readonly (VinScanOverviewRow & Partial<Omit<VinScanIndicator, "id">>)[];
}): string {
  const facts = buildVinScanFacts(opts.rows);
  const when = formatVinScanScannedAt(opts.scannedAt);
  const lines = [
    `VIN: ${opts.vin}`,
    when ? `Skenēts: ${when}` : "",
    facts.vehicleLine,
    `Nobraukums: ${facts.mileageLine}`,
    facts.mileageRollback ? "Nobraukuma nesakritība: vēlāks datums ar mazāku km." : "",
    facts.wanted.length ? `Meklēšanā / zagts: ${facts.wanted.join(", ")}` : "",
    facts.recalls.length ? `Atsaukumi: ${facts.recalls.join("; ")}` : "",
    facts.auctionPhotos.length ? `Izsoles foto: ${facts.auctionPhotos.join("; ")}` : "",
    facts.registrations.length ? `Reģistrācijas: ${facts.registrations.join(", ")}` : "",
    "",
    "Avoti:",
    ...opts.rows.map((row) => {
      const wanted =
        isVinScanWantedSource(row.id) && (row.status === "found" || row.status === "none")
          ? row.status === "found"
            ? "meklēšanā"
            : "nav meklēšanā"
          : row.status === "needs_input"
            ? "vajag ievadi"
            : row.status;
      return `- ${row.label} (${row.country}): ${wanted} · ${row.summary}`;
    }),
  ];
  return lines.filter((line, i) => line !== "" || i === 9).join("\n").trim();
}

export function formatVinScanExportJson(opts: {
  vin: string;
  scannedAt: string;
  rows: readonly (VinScanOverviewRow & Partial<Omit<VinScanIndicator, "id">>)[];
}): string {
  return JSON.stringify(
    {
      vin: opts.vin,
      scannedAt: opts.scannedAt,
      vehicle: pickVinScanVehicle(opts.rows),
      mileage: collectVinScanMileage(opts.rows),
      facts: buildVinScanFacts(opts.rows),
      indicators: opts.rows,
    },
    null,
    2,
  );
}
