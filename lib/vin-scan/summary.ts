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

/**
 * Nobraukuma teksts -> km. Tūkstošu atdalītāji: "120,000", "145.230", "198 000" (arī NBSP / šaurā NBSP).
 * Decimāldaļa: "12,5" vai "12.5". Mazs skaitlis (< 50) nozīmē tūkstošus ("12,5 tūkst. km" -> 12 500).
 */
export function odometerKm(raw: string): number | null {
  const spaced = String(raw).replace(/[\s\u00a0\u202f\u2009\u2007']/g, " ").replace(/[^\d., ]/g, " ");
  // Pirmais skaitlis ar iekšējiem atdalītājiem; "12,5 tūkst. km" -> "12,5" (bez beigu punkta).
  const cleaned = /\d+(?:[., ]\d+)*/.exec(spaced)?.[0] ?? "";
  if (!cleaned) return null;
  let normalized: string;
  if (/^\d{1,3}(?:([., ])\d{3})(?:\1\d{3})*$/.test(cleaned)) {
    // Viens un tas pats atdalītājs pirms katras 3 ciparu grupas = tūkstošu atdalītājs.
    normalized = cleaned.replace(/[., ]/g, "");
  } else {
    const compact = cleaned.replace(/ /g, "");
    const lastDot = compact.lastIndexOf(".");
    const lastComma = compact.lastIndexOf(",");
    if (lastDot >= 0 && lastComma >= 0) {
      // Abi: pēdējais ir decimālzīme, otrs - tūkstošu atdalītājs ("1,234.5" / "1.234,5").
      const dec = lastDot > lastComma ? "." : ",";
      const grp = dec === "." ? "," : ".";
      normalized = compact.split(grp).join("").replace(dec, ".");
    } else {
      normalized = compact.replace(",", ".");
    }
  }
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n < 50) return n * 1000;
  return n;
}

/** Datums -> ms (UTC). Pieņem ISO, `YYYYMMDD`, `DD.MM.YYYY` un `YYYY`. */
export function mileageDateMs(raw: string): number | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return utcDay(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (m) return utcDay(+m[3]!, +m[2]!, +m[1]!);
  m = /^(\d{4})$/.exec(t);
  if (m) return utcDay(+m[1]!, 1, 1);
  if (!/^\d{4}-\d{2}(-\d{2})?/.test(t)) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

function utcDay(y: number, mo: number, d: number): number | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return ms;
}

export function detectVinScanMileageRollback(rows: readonly VinScanMileage[]): boolean {
  const dated = rows
    .map((row) => ({ t: mileageDateMs(row.date), km: odometerKm(row.odometer) }))
    .filter((row): row is { t: number; km: number } => row.t != null && row.km != null)
    .sort((a, b) => a.t - b.t);
  let prev = 0;
  for (const row of dated) {
    const km = row.km;
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
    if (country && ["LV", "LT", "EE", "DK", "SE", "FI", "NO", "NL", "UK", "BE", "CZ"].includes(country)) {
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
