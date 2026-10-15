/**
 * Zviedrijas reģistra lapas, ko operators atver savā pārlūkā:
 * biluppgifter.se/fordon, Transportstyrelsen un car.info / carinfo.se transportlīdzekļa lapa.
 * Serveris parsē HTML. Datacentra zonde šiem ceļiem netiek pievienota.
 */

import type { VinScanInspection, VinScanMileage, VinScanParse } from "@/lib/vin-scan/types";

export const SWEDISH_BROWSER_SOURCE_IDS = ["biluppgifter", "carinfo", "transportstyrelsen"] as const;
export type SwedishBrowserSourceId = (typeof SWEDISH_BROWSER_SOURCE_IDS)[number];

const META: Record<SwedishBrowserSourceId, { label: string }> = {
  biluppgifter: { label: "biluppgifter.se" },
  carinfo: { label: "car.info" },
  transportstyrelsen: { label: "Transportstyrelsen" },
};

const NONE_RE = /hittades inte|ingen träff|inga uppgifter|inga fordon|finns inte|kunde inte hitta|not found|no vehicle|no record/i;
const CHALLENGE_RE = /just a moment|cf-browser-verification|checking your browser|cloudflare|\bbankid\b|logga in/i;
const VIN_RE = /[A-HJ-NPR-Z0-9]{17}/;
export function isSwedishBrowserSourceId(id: string): id is SwedishBrowserSourceId {
  return (SWEDISH_BROWSER_SOURCE_IDS as readonly string[]).includes(id);
}

export function swedishSourceFromUrl(pageUrl: string): SwedishBrowserSourceId | null {
  let host = "";
  let path = "";
  try {
    const url = new URL(pageUrl);
    host = url.hostname.replace(/^www\./, "").toLowerCase();
    path = url.pathname || "/";
  } catch {
    return null;
  }
  if (host === "biluppgifter.se" || host.endsWith(".biluppgifter.se")) {
    if (/^\/fordon\/[^/]+/i.test(path)) return "biluppgifter";
    if (/\/[A-HJ-NPR-Z0-9]{17}(?:\/|$)/i.test(path)) return "biluppgifter";
    return null;
  }
  if (host === "fu-regnr.transportstyrelsen.se") return "transportstyrelsen";
  if (host === "car.info" || host.endsWith(".car.info") || host === "carinfo.se" || host.endsWith(".carinfo.se")) {
    if (/\/vin\/[A-HJ-NPR-Z0-9]{11,17}/i.test(path)) return "carinfo";
    if (/\/(?:en-se|sv-se)\/[^/]+\/[^/]+/i.test(path)) return "carinfo";
    if (/\/(?:fordon|vehicle|bil)\/[^/]+/i.test(path)) return "carinfo";
    return null;
  }
  return null;
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&auml;|&#228;/gi, "ä")
    .replace(/&ouml;|&#246;/gi, "ö")
    .replace(/&aring;|&#229;/gi, "å")
    .replace(/&Auml;|&#196;/g, "Ä")
    .replace(/&Ouml;|&#214;/g, "Ö")
    .replace(/&Aring;|&#197;/g, "Å");
}

function textOf(raw: string): string {
  return decodeEntities(raw)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d|dt|dd)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function visibleText(html: string): string {
  return textOf(html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " "));
}

function norm(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function labelKind(label: string): string {
  const n = norm(label);
  if (/^(marke|fabrikat|make|brand)$/.test(n)) return "make";
  if (/^(modell|handelsbeteckning|model)$/.test(n)) return "model";
  if (/^(modellar|fordonsar|arsmodell|year|model year)$/.test(n)) return "year";
  if (/^(chassinummer|vin|chassis|chassis number)$/.test(n)) return "vin";
  if (/^(registreringsnummer|regnr|reg nr|registration number|license plate)$/.test(n)) return "plate";
  if (n === "fordonsstatus" || n === "status") return "status";
  if (/matarstallning|mileage|odometer/.test(n)) return "mileage";
  if (/besiktning|inspection/.test(n)) return "inspection";
  return "";
}

function pairsFromHtml(html: string): { label: string; value: string }[] {
  const cleaned = html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ");
  const out: { label: string; value: string }[] = [];
  const re = /<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>|<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi;
  for (const match of cleaned.matchAll(re)) {
    const label = textOf(match[1] || match[3] || "");
    const value = textOf(match[2] || match[4] || "");
    if (label && value) out.push({ label, value });
  }
  return out;
}

function tableRows(html: string): string[][] {
  const cleaned = html.replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, " ");
  const rows: string[][] = [];
  for (const tr of cleaned.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: string[] = [];
    for (const cell of (tr[1] ?? "").matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)) {
      const text = textOf(cell[1] ?? "");
      if (text) cells.push(text);
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function dateIso(raw: string): string {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dot = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(raw);
  if (!dot) return "";
  return `${dot[3]}-${dot[2]!.padStart(2, "0")}-${dot[1]!.padStart(2, "0")}`;
}

function dateLv(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function groupKm(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** Zviedrijas „mil” ir 10 km. Datuma ciparus un jau norādītus km reizināt nedrīkst. */
function odometerKm(raw: string, label = ""): string {
  const withoutDate = raw.replace(/\d{4}-\d{2}-\d{2}/g, " ").replace(/\d{1,2}\.\d{1,2}\.\d{4}/g, " ");
  const scoped = /([\d\s\u00a0]{1,14})\s*(km|mil)\b/i.exec(withoutDate);
  const labeledMileage = /matarstallning|mileage|odometer/.test(norm(label));
  let digits = "";
  let unit = "";
  if (scoped) {
    digits = scoped[1] ?? "";
    unit = (scoped[2] ?? "").toLowerCase();
  } else if (labeledMileage) {
    digits = withoutDate;
    unit = /\bmil\b/i.test(label) && !/\bkm\b/i.test(label) ? "mil" : "km";
  } else {
    return "";
  }
  const n = Number(digits.replace(/[^\d]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  const km = unit === "mil" ? n * 10 : n;
  if (km < 1 || km > 2_000_000) return "";
  return `${groupKm(km)} km`;
}

function inspectionResultLv(raw: string): string {
  const t = norm(raw);
  if (/underkand|ej godkand|\bfailed\b|not approved/.test(t)) return "nav izturēta";
  if (/anmarkning|with remark|advisory/.test(t)) return "izturēta ar piezīmēm";
  if (/godkand|\bapproved\b/.test(t)) return "izturēta";
  return "";
}

function statusLv(raw: string): string {
  const t = norm(raw);
  if (/avregistr/.test(t)) return "izslēgts no reģistra";
  if (/avstall/.test(t)) return "noņemts no uzskaites";
  if (/i trafik|in traffic/.test(t)) return "ekspluatācijā";
  return "";
}

function yearOf(raw: string): string {
  return /((?:19|20)\d{2})/.exec(raw)?.[1] ?? "";
}

function vinOf(raw: string): string {
  return raw.toUpperCase().match(VIN_RE)?.[0] ?? "";
}

function plateOf(raw: string): string {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length < 2 || compact.length > 8) return "";
  return compact;
}

function clip(raw: string, max: number): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

type MileageDraft = { date: string; odometer: string };
type HistoryDraft = { date: string; status: string };

function pushMileage(rows: MileageDraft[], date: string, odometer: string) {
  if (!odometer) return;
  if (rows.some((row) => row.date === date && row.odometer === odometer)) return;
  if (!date && rows.some((row) => row.odometer === odometer)) return;
  const undated = rows.findIndex((row) => !row.date && row.odometer === odometer);
  if (date && undated >= 0) rows.splice(undated, 1);
  rows.push({ date, odometer });
}

function pushInspection(rows: VinScanInspection[], row: VinScanInspection) {
  if (!row.date && !row.result) return;
  const key = `${row.date}|${row.result ?? ""}|${row.odometer ?? ""}`;
  if (rows.some((item) => `${item.date}|${item.result ?? ""}|${item.odometer ?? ""}` === key)) return;
  rows.push(row);
}

function fromLine(line: string, mileage: MileageDraft[], inspections: VinScanInspection[], history: HistoryDraft[]) {
  const date = dateIso(line);
  const result = inspectionResultLv(line);
  const km = odometerKm(line);
  const status = statusLv(line);
  if (date && result) {
    pushInspection(inspections, { date, result, ...(km ? { odometer: km } : {}) });
  }
  if (km && (date || /matarstallning|mileage|odometer/.test(norm(line)))) pushMileage(mileage, date, km);
  if (date && status && !result && !history.some((row) => row.date === date && row.status === status)) {
    history.push({ date, status });
  }
}

function sortByDateDesc<T extends { date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

function jsonString(html: string, key: string): string {
  const re = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]{1,80})"`, "i");
  return textOf(re.exec(html)?.[1] ?? "");
}

export function parseSwedishVehiclePage(
  html: string,
  pageUrl: string,
): { ok: true; id: SwedishBrowserSourceId; parsed: VinScanParse } | { ok: false; error: "unsupported" | "page_not_ready" } {
  const id = swedishSourceFromUrl(pageUrl);
  if (!id) return { ok: false, error: "unsupported" };
  const text = visibleText(html);
  if (!text || text.length < 20) return { ok: false, error: "page_not_ready" };

  const mileage: MileageDraft[] = [];
  const inspections: VinScanInspection[] = [];
  const history: HistoryDraft[] = [];
  let make = "";
  let model = "";
  let year = "";
  let vin = "";
  let plate = "";
  let status = "";

  for (const pair of pairsFromHtml(html)) {
    const kind = labelKind(pair.label);
    if (kind === "make" && !make) make = clip(pair.value, 40);
    if (kind === "model" && !model) model = clip(pair.value, 40);
    if (kind === "year" && !year) year = yearOf(pair.value);
    if (kind === "vin" && !vin) vin = vinOf(pair.value);
    if (kind === "plate" && !plate) plate = plateOf(pair.value);
    if (kind === "status" && !status) status = statusLv(pair.value);
    if (kind === "mileage") pushMileage(mileage, dateIso(pair.value), odometerKm(pair.value, pair.label));
    if (kind === "inspection") {
      const result = inspectionResultLv(pair.value);
      const date = dateIso(pair.value);
      const km = odometerKm(pair.value, pair.label);
      if (result || date) pushInspection(inspections, { date, ...(result ? { result } : {}), ...(km ? { odometer: km } : {}) });
    }
  }

  for (const row of tableRows(html)) fromLine(row.join(" "), mileage, inspections, history);
  for (const line of text.split("\n")) fromLine(line, mileage, inspections, history);

  if (!make) make = clip(jsonString(html, "brand") || jsonString(html, "manufacturer"), 40);
  if (!model) model = clip(jsonString(html, "model"), 40);
  if (!year) year = yearOf(jsonString(html, "vehicleModelDate") || jsonString(html, "modelYear"));
  if (!vin) vin = vinOf(jsonString(html, "vehicleIdentificationNumber"));

  const labeled = (re: RegExp) => textOf(re.exec(text)?.[1] ?? "");
  if (!make) make = clip(labeled(/(?:Märke|Fabrikat|Make)\s*:\s*([^\n]{2,40})/i), 40);
  if (!model) model = clip(labeled(/Modell(?!år)\s*:\s*([^\n]{1,40})/i), 40);
  if (!year) year = yearOf(labeled(/(?:Modellår|Fordonsår|Årsmodell|Year)\s*:\s*([^\n]{2,20})/i));
  if (!vin) vin = vinOf(labeled(/(?:Chassinummer|VIN)\s*:\s*([^\n]{11,40})/i));
  if (!plate) plate = plateOf(labeled(/(?:Registreringsnummer|Reg\.?\s*nr)\s*:\s*([^\n]{2,16})/i));
  if (!status) status = statusLv(labeled(/Fordonsstatus\s*:\s*([^\n]{2,40})/i));

  const mileageSorted = sortByDateDesc(mileage).slice(0, 20);
  const inspectionsSorted = sortByDateDesc(inspections).slice(0, 20);
  const historySorted = sortByDateDesc(history).slice(0, 12);
  const hasVehicle = Boolean(make || model || year || vin || plate || status || mileageSorted.length || inspectionsSorted.length);

  if (CHALLENGE_RE.test(text) && !hasVehicle) return { ok: false, error: "page_not_ready" };
  if (!hasVehicle && NONE_RE.test(text)) {
    return {
      ok: true,
      id,
      parsed: {
        status: "none",
        summary: "Zviedrijas reģistrā ieraksta nav",
        detail: "",
        flags: { registrationCountry: "SE" },
      },
    };
  }
  if (!hasVehicle) return { ok: false, error: "page_not_ready" };

  const name = [make, model].filter(Boolean).join(" ");
  const latestKm = mileageSorted[0]?.odometer || inspectionsSorted.find((row) => row.odometer)?.odometer || "";
  const head = [name, year, latestKm].filter(Boolean).join(", ");
  const latestInspection = inspectionsSorted.find((row) => row.result && row.date) || inspectionsSorted[0];
  const inspectionLine =
    latestInspection?.result && latestInspection.date
      ? `Besiktning ${dateLv(latestInspection.date)}: ${latestInspection.result}`
      : "";
  const statusLine = status ? `Statuss: ${status}` : "";
  const summary = [head, inspectionLine, statusLine].filter(Boolean).join(". ") || "Zviedrijas reģistrā ir ieraksts";

  const detailLines: string[] = [];
  if (plate) detailLines.push(`Reģ. nr. ${plate}`);
  if (vin) detailLines.push(`VIN: ${vin}`);
  if (status) detailLines.push(`Statuss: ${status}`);
  if (inspectionsSorted.length) {
    detailLines.push("Besiktning:");
    for (const row of inspectionsSorted) {
      const bits = [dateLv(row.date), row.result].filter(Boolean);
      const tail = row.odometer ? `${bits.join(": ")}${bits.length ? ", " : ""}${row.odometer}` : bits.join(": ");
      if (tail) detailLines.push(tail);
    }
  }
  if (mileageSorted.length) {
    detailLines.push("Nobraukums:");
    for (const row of mileageSorted) {
      detailLines.push([dateLv(row.date), row.odometer].filter(Boolean).join(": "));
    }
  }
  if (historySorted.length) {
    detailLines.push("Vēsture:");
    for (const row of historySorted) detailLines.push(`${dateLv(row.date)}: ${row.status}`);
  }

  const mileageOut: Omit<VinScanMileage, "source">[] = mileageSorted.map((row) => ({
    date: row.date,
    odometer: row.odometer,
  }));

  return {
    ok: true,
    id,
    parsed: {
      status: "found",
      summary: summary.slice(0, 300),
      detail: detailLines.join("\n").slice(0, 2000),
      vehicle: make || model || year ? { make, model, year } : undefined,
      mileage: mileageOut.length ? mileageOut : undefined,
      inspections: inspectionsSorted.length ? inspectionsSorted : undefined,
      flags: { registrationCountry: "SE" },
      openUrl: pageUrl,
    },
  };
}

export function swedishSourceLabel(id: SwedishBrowserSourceId): string {
  return META[id].label;
}
