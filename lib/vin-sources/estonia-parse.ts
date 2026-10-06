/**
 * Igaunijas mnt.ee / lkf.ee lapas teksta → VinSourceFetchResult (bez tīkla).
 */
import { formatRegistryDateLv } from "@/lib/vin-registry-client-text";
import type { ExtractedPage } from "@/lib/vin-sources/html-extract";
import { detectSpecialUseLabels, translateTermLv, translateTextLv } from "@/lib/vin-sources/translate-lv";
import {
  emptyVinSourceResult,
  type VinSourceFetchResult,
  type VinSourceIncidentRow,
  type VinSourceMileageRow,
} from "@/lib/vin-sources/types";

export const MNT_NOT_FOUND = /Sisestatud andmetega sõidukit registris ei ole/i;
export const MNT_CAPTCHA_ERROR = /reCAPTCHA valideerimise viga/i;
/** Admin UI ziņa, kad mnt.ee serveris noraida reCAPTCHA v3 žetonu. estonia.ts to meklē pārlūka rezervei. */
export const MNT_CAPTCHA_REJECTED_MESSAGE = "reCAPTCHA neizdevās";

/** Piem. `reCAPTCHA neizdevās (mnt.ee noraidīja ReCaptchaV3TaskProxyLess, ReCaptchaV3M1TaskProxyLess žetonu)`. */
export function mntCaptchaRejectedMessage(taskTypes: string[]): string {
  const list = taskTypes.map((t) => t.trim()).filter(Boolean).join(", ");
  return list ? `${MNT_CAPTCHA_REJECTED_MESSAGE} (mnt.ee noraidīja ${list} žetonu)` : MNT_CAPTCHA_REJECTED_MESSAGE;
}
export const LKF_NOT_IN_REGISTRY =
  /andmeid ei ole liikluskindlustuse registris|registris (puuduvad|ei ole) andm|ei leitud.{0,40}registrist/i;
export const LKF_CAPTCHA_ERROR = /captcha|reCAPTCHA|kinnitusväljakutse aegus/i;
export const LKF_NO_CLAIMS =
  /(kahju|juhtum)\w*\s+(ei ole|puuduvad)|ei ole osalenud|puuduvad andmed|kindlustusjuhtumeid ei ole|kahjujuhtumeid ei ole|juhtumeid ei leitud|ei ole liikluskindlustuse juhtum|sõidukiga ei ole toimunud/i;
const LKF_SEARCH_FORM = /Sõiduki registrimärk või VIN-kood|history_traffic_accidents_form|edit-vehicle/i;
const COUNTRY_LV = "Igaunija";

type PageTable = ExtractedPage["tables"][number];

function normalizeDate(cell: string): string {
  const dot = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(cell);
  if (dot) return `${dot[3]}-${dot[2]!.padStart(2, "0")}-${dot[1]!.padStart(2, "0")}`;
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(cell);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return "";
}

function parseKm(cell: string): string {
  if (normalizeDate(cell)) return "";
  const m = /(\d[\d\s.,]{2,})\s*(?:km|KM)?/.exec(cell.replace(/\u00a0/g, " "));
  if (!m) return "";
  const digits = m[1]!.replace(/[^\d]/g, "");
  if (digits.length < 3) return "";
  return String(Number(digits));
}

function parseAmount(cell: string): string {
  const m = /(\d[\d\s.,]*)\s*(?:€|EUR|eur)/.exec(cell.replace(/\u00a0/g, " "));
  if (!m) return "";
  const normalized = m[1]!.replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return "";
  return `${value.toFixed(2)} €`;
}

function mileageRowsFromTables(tables: PageTable[]): VinSourceMileageRow[] {
  const rows: VinSourceMileageRow[] = [];
  for (const table of tables) {
    const contextLv = translateTextLv(table.headers.join(" "), "et");
    for (const cells of table.rows) {
      const date = cells.map(normalizeDate).find(Boolean) ?? "";
      const km = cells.map(parseKm).find(Boolean) ?? "";
      if (!date || !km) continue;
      rows.push({ date, odometer: km, country: COUNTRY_LV, origin: contextLv || "Transpordiamet" });
    }
  }
  return rows
    .filter((row, i, all) => all.findIndex((r) => r.date === row.date && r.odometer === row.odometer) === i)
    .sort((a, b) => b.date.localeCompare(a.date));
}

function mileageNotes(mileage: VinSourceMileageRow[]): string[] {
  const notes: string[] = [];
  const asc = [...mileage].sort((a, b) => a.date.localeCompare(b.date));
  let peak: VinSourceMileageRow | null = null;
  for (const row of asc) {
    const km = Number(row.odometer);
    const peakKm = peak ? Number(peak.odometer) : -1;
    if (peak && km < peakKm - 1000) {
      notes.push(
        `Odometra pretruna: ${peakKm.toLocaleString("lv-LV")} km (${formatRegistryDateLv(peak.date)}), pēc tam ${km.toLocaleString("lv-LV")} km (${formatRegistryDateLv(row.date)}).`,
      );
    }
    if (!peak || km > peakKm) peak = row;
  }
  return notes;
}

export function parseMntExtract(vin: string, data: ExtractedPage): VinSourceFetchResult {
  if (MNT_CAPTCHA_ERROR.test(data.text)) {
    return emptyVinSourceResult("mnt_ee", vin, MNT_CAPTCHA_REJECTED_MESSAGE);
  }
  const afterForm = data.text.split("VIN-kood").pop() ?? data.text;
  if (MNT_NOT_FOUND.test(afterForm)) {
    return emptyVinSourceResult("mnt_ee", vin, "VIN nav Igaunijas transportlīdzekļu reģistrā");
  }

  const pairs = data.pairs.filter((p) => p.value && p.label.length < 60);
  if (pairs.length === 0 && data.tables.length === 0) {
    return emptyVinSourceResult("mnt_ee", vin, "Rezultātu lapā dati netika atrasti");
  }

  const mileage = mileageRowsFromTables(data.tables);
  const notes = mileageNotes(mileage);

  const ownerLines: string[] = [];
  const statusLines: string[] = [];
  for (const { label, value } of pairs) {
    const labelLv = translateTermLv(label.replace(/:$/, ""), "et");
    const valueLv = translateTextLv(value, "et");
    const line = `${labelLv}: ${valueLv}`;
    if (/omanik|kasutaja|registreerimi|īpašnieks|lietotājs|reģistrāc/i.test(label + labelLv)) ownerLines.push(line);
    if (/kasutusotstarve|piirang|arest|pant|takso|õppe|staatus|ierobežo|statuss/i.test(label + labelLv)) {
      statusLines.push(line);
    }
  }

  const historyTable = data.tables.find((t) =>
    /kasutus|omanik|registreeri/i.test([...t.headers, ...(t.rows[0] ?? [])].join(" ")),
  );
  if (historyTable) {
    ownerLines.push(
      `Reģistrācijas ieraksti: ${historyTable.rows.length}`,
      ...historyTable.rows.slice(0, 25).map((cells) => translateTextLv(cells.filter(Boolean).join(", "), "et")),
    );
  }

  const specialUse = detectSpecialUseLabels(data.text);
  if (specialUse.length > 0) {
    statusLines.push(`Īpašie statusi: ${specialUse.join(", ")}`);
    for (const label of specialUse) notes.push(`Īpašais statuss: ${label}.`);
  }
  if (/arestitud|pant\b/i.test(data.text)) notes.push("Reģistrā norādīts arests vai ķīla.");
  if (/registrist kustutatud/i.test(data.text)) notes.push("Izslēgts no Igaunijas reģistra.");

  const found = mileage.length > 0 || ownerLines.length > 0 || statusLines.length > 0 || pairs.length > 0;
  if (!found) {
    return emptyVinSourceResult("mnt_ee", vin, "VIN nav Igaunijas transportlīdzekļu reģistrā");
  }

  return {
    source: "mnt_ee",
    vin,
    found: true,
    message: `Atrasts Igaunijas reģistrā (${mileage.length} nobraukuma ieraksti)`,
    mileage,
    incidents: [],
    timeline: [],
    ownersSummary: ownerLines.join("\n"),
    statusRecords: statusLines.join("\n"),
    notes,
    raw: data.text,
    fetchedAt: new Date().toISOString(),
  };
}

export function parseLkfExtract(vin: string, data: ExtractedPage): VinSourceFetchResult {
  if (LKF_CAPTCHA_ERROR.test(data.text) && /vale|incorrect|failed|neõige|viga|aegus|not correct|nav pareiz/i.test(data.text)) {
    return {
      ...emptyVinSourceResult("lkf_ee", vin, "reCAPTCHA neizdevās"),
      raw: data.text,
    };
  }
  if (LKF_NOT_IN_REGISTRY.test(data.text)) {
    return {
      ...emptyVinSourceResult("lkf_ee", vin, "VIN nav Igaunijas OCTA reģistrā - visticamāk nav bijis reģistrēts Igaunijā"),
      raw: data.text,
    };
  }

  const claimTables = data.tables.filter((t) => t.rows.some((row) => row.some((cell) => normalizeDate(cell))));
  const incidents: VinSourceIncidentRow[] = [];
  for (const table of claimTables) {
    for (const cells of table.rows) {
      const date = cells.map(normalizeDate).find(Boolean);
      if (!date) continue;
      const amount = cells.map(parseAmount).find(Boolean) ?? "";
      const note = translateTextLv(
        cells.filter((c) => c && !normalizeDate(c) && !parseAmount(c)).join(" · "),
        "et",
      );
      incidents.push({ date, amount, country: COUNTRY_LV, note });
    }
  }

  const notes: string[] = [];
  if (incidents.length > 0) notes.push(`Igaunijas OCTA reģistrā ${incidents.length} atlīdzības gadījumi.`);
  if (/hävinud|total|hukkunud/i.test(data.text)) {
    notes.push("Norāde uz pilnīgu bojāeju.");
  }
  const withoutAmount = incidents.filter((i) => !i.amount).length;
  if (incidents.length > 0 && withoutAmount === incidents.length) {
    notes.push("Atlīdzības summas publiski netiek rādītas.");
  }

  const noClaims = incidents.length === 0 && LKF_NO_CLAIMS.test(data.text);
  const stillSearchForm = incidents.length === 0 && !noClaims && LKF_SEARCH_FORM.test(data.text);

  return {
    source: "lkf_ee",
    vin,
    found: incidents.length > 0,
    message:
      incidents.length > 0
        ? `Atrasti ${incidents.length} OCTA atlīdzības gadījumi`
        : noClaims
          ? "OCTA atlīdzības gadījumi nav atrasti"
          : stillSearchForm
            ? "lkf.ee atbilde palika meklēšanas forma - pārbaudi RAW tekstu"
            : "Atbilde nav automātiski klasificēta - pārbaudi RAW tekstu",
    mileage: [],
    incidents,
    timeline: [],
    ownersSummary: "",
    statusRecords: "",
    notes,
    raw: data.text,
    fetchedAt: new Date().toISOString(),
  };
}
