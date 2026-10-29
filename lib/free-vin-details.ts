import type { VinDecodeResult } from "@/lib/vin-decode";

/**
 * Bezmaksas VIN pārbaudes papildu dati (sākumlapa, /vin-dekoders).
 *
 * Avoti ir bez maksas un bez atslēgas: NHTSA vPIC (VIN dekods ar rūpnīcu) un NHTSA atsaukumi.
 * NHTSA atsaukumi ir modeļa līmenī, tāpēc tos vaicājam tikai Ziemeļamerikas VIN (ES auto tas nav fakts).
 */

export type VpicDetails = {
  make: string;
  model: string;
  modelYear: string;
  bodyClass: string;
  engine: string;
  fuel: string;
  drive: string;
  transmission: string;
  plantCity: string;
  plantCountry: string;
  plantCompany: string;
};

export type UsRecalls = { count: number; items: { component: string; date: string }[] };

export type FreeVinSignal = {
  id: "north_america" | "check_digit_bad" | "check_digit_ok" | "us_recalls" | "us_recalls_none";
  tone: "warn" | "ok";
  title: string;
  body: string;
};

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

/** vPIC tukšumus raksta kā "Not Applicable" vai "0". */
function clean(v: unknown): string {
  const s = str(v);
  return /^(not applicable|n\/a|0|null)$/i.test(s) ? "" : s;
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, p: string, c: string) => p + c.toUpperCase());
}

const COUNTRY_LV: Record<string, string> = {
  "UNITED STATES (USA)": "ASV",
  "UNITED STATES": "ASV",
  CANADA: "Kanāda",
  MEXICO: "Meksika",
  GERMANY: "Vācija",
  "CZECH REPUBLIC": "Čehija",
  CZECHIA: "Čehija",
  SLOVAKIA: "Slovākija",
  HUNGARY: "Ungārija",
  AUSTRIA: "Austrija",
  FRANCE: "Francija",
  SPAIN: "Spānija",
  ITALY: "Itālija",
  BELGIUM: "Beļģija",
  "UNITED KINGDOM (UK)": "Lielbritānija",
  "UNITED KINGDOM": "Lielbritānija",
  SWEDEN: "Zviedrija",
  POLAND: "Polija",
  JAPAN: "Japāna",
  "SOUTH KOREA": "Dienvidkoreja",
  "KOREA (SOUTH)": "Dienvidkoreja",
  CHINA: "Ķīna",
  "SOUTH AFRICA": "Dienvidāfrika",
  TURKEY: "Turcija",
};

function countryLv(raw: string): string {
  const k = raw.trim().toUpperCase();
  return COUNTRY_LV[k] ?? (k ? titleCase(k) : "");
}

function fuelLv(raw: string): string {
  if (/diesel/i.test(raw)) return "Dīzelis";
  if (/electric/i.test(raw) && /gasoline|petrol/i.test(raw)) return "Hibrīds";
  if (/electric/i.test(raw)) return "Elektrība";
  if (/gasoline|petrol/i.test(raw)) return "Benzīns";
  if (/natural gas|cng/i.test(raw)) return "Gāze (CNG)";
  if (/lpg|propane/i.test(raw)) return "Gāze (LPG)";
  return raw;
}

function driveLv(raw: string): string {
  if (/awd|all.?wheel/i.test(raw)) return "Pilnpiedziņa";
  if (/4wd|4x4|4-wheel|four.?wheel/i.test(raw)) return "4x4";
  if (/fwd|front.?wheel/i.test(raw)) return "Priekšējā";
  if (/rwd|rear.?wheel/i.test(raw)) return "Aizmugurējā";
  return raw;
}

function transmissionLv(raw: string): string {
  if (/automatic|cvt|dct|dual.?clutch/i.test(raw)) return "Automātiskā";
  if (/manual|standard/i.test(raw)) return "Manuālā";
  return raw;
}

function bodyLv(raw: string): string {
  if (/sport utility|suv|crossover/i.test(raw)) return "Apvidus (SUV)";
  if (/wagon|estate/i.test(raw)) return "Universālis";
  if (/hatchback|liftback/i.test(raw)) return "Hečbeks";
  if (/sedan|saloon/i.test(raw)) return "Sedans";
  if (/convertible|cabriolet|roadster/i.test(raw)) return "Kabriolets";
  if (/coupe/i.test(raw)) return "Kupeja";
  if (/minivan|mpv/i.test(raw)) return "Minivens";
  if (/pickup/i.test(raw)) return "Pikaps";
  if (/van/i.test(raw)) return "Furgons";
  return raw;
}

/** "3.0 l, 6 cil., 250 kW" no vPIC dzinēja laukiem. */
function engineLv(row: Record<string, unknown>): string {
  const litres = Number(clean(row.DisplacementL));
  const cyl = clean(row.EngineCylinders);
  const kw = Number(clean(row.EngineKW));
  const hp = Number(clean(row.EngineHP));
  const power = kw > 0 ? Math.round(kw) : hp > 0 ? Math.round(hp * 0.7457) : 0;
  return [
    litres > 0 ? `${litres.toFixed(1).replace(".", ",")} l` : "",
    cyl ? `${cyl} cil.` : "",
    power > 0 ? `${power} kW` : "",
  ]
    .filter(Boolean)
    .join(", ");
}

/** Tīra funkcija: vPIC `DecodeVinValues` atbilde -> lauki latviski; `null`, ja ražotājs nav atkodēts. */
export function parseVpicDetails(status: number, text: string): VpicDetails | null {
  if (status !== 200) return null;
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const results = (data as { Results?: unknown })?.Results;
  const row = (Array.isArray(results) ? results[0] : null) as Record<string, unknown> | null;
  if (!row || typeof row !== "object") return null;
  const make = clean(row.Make);
  if (!make) return null;
  // Eiropas VIN vPIC bieži "atkodē" ar kļūdām (VW -> 1984, rūpnīca Westmoreland). Ņemam tikai
  // tīru dekodu: 0 = bez kļūdām, 1 = tikai kontrolcipars (to klientam rādām atsevišķi).
  const codes = str(row.ErrorCode).split(/[,\s]+/).filter(Boolean);
  if (!codes.length || codes.some((c) => c !== "0" && c !== "1")) return null;
  return {
    make: make.length <= 3 ? make.toUpperCase() : titleCase(make),
    model: clean(row.Model),
    modelYear: clean(row.ModelYear),
    bodyClass: bodyLv(clean(row.BodyClass)),
    engine: engineLv(row),
    fuel: fuelLv(clean(row.FuelTypePrimary)),
    drive: driveLv(clean(row.DriveType)),
    transmission: transmissionLv(clean(row.TransmissionStyle)),
    plantCity: titleCase(clean(row.PlantCity)),
    plantCountry: countryLv(clean(row.PlantCountry)),
    plantCompany: clean(row.PlantCompanyName),
  };
}

/** Tīra funkcija: NHTSA `recallsByVehicle` atbilde. 400 ar tukšu sarakstu nozīmē "nav". */
export function parseUsRecalls(status: number, text: string): UsRecalls | null {
  if (status === 404) return { count: 0, items: [] };
  if (status !== 200 && status !== 400) return null;
  let data: unknown;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  const o = (data ?? {}) as Record<string, unknown>;
  const rows = Array.isArray(o.results) ? o.results : Array.isArray(o.Results) ? o.Results : [];
  const items = rows.map((r) => {
    const row = (r ?? {}) as Record<string, unknown>;
    return { component: str(row.Component), date: str(row.ReportReceivedDate) };
  });
  return { count: items.length, items: items.slice(0, 5) };
}

/** Latviešu skaitļa forma: 1, 21, 31 - vienskaitlis (bet ne 11). */
function lvCount(n: number, one: string, many: string): string {
  return `${n} ${n % 10 === 1 && n % 100 !== 11 ? one : many}`;
}

const COUNTRY_CODE_LV: Record<string, string> = { US: "ASV", CA: "Kanādā", MX: "Meksikā" };

/** Brīdinājumi klientam tikai no pārbaudāmiem faktiem (VIN struktūra, NHTSA). */
export function buildFreeVinSignals(input: {
  local: Extract<VinDecodeResult, { ok: true }>;
  vpic: VpicDetails | null;
  recalls: UsRecalls | null;
}): FreeVinSignal[] {
  const { local, vpic, recalls } = input;
  const out: FreeVinSignal[] = [];
  if (local.region === "northAmerica") {
    const where = vpic?.plantCountry === "ASV" || local.country === "US" ? "ASV" : COUNTRY_CODE_LV[local.country ?? ""] ?? "Ziemeļamerikā";
    out.push({
      id: "north_america",
      tone: "warn",
      title: where === "ASV" ? "Auto ražots ASV" : `Auto ražots ${where}`,
      body: "Daļa šādu auto Eiropā nonāk no ASV un Kanādas izsolēm, arī pēc avārijām. Pirms pirkuma pārbaudi auto vēsturi.",
    });
  }
  if (local.checkDigitValid === false) {
    out.push({
      id: "check_digit_bad",
      tone: "warn",
      title: "VIN kontrolcipars nesakrīt",
      body: "Pārbaudi, vai VIN ievadīts pareizi. Ja jā, VIN var būt nepareizi ierakstīts vai mainīts.",
    });
  } else if (local.checkDigitValid === true) {
    out.push({ id: "check_digit_ok", tone: "ok", title: "VIN kontrolcipars derīgs", body: "VIN kods atbilst Ziemeļamerikas standartam." });
  }
  if (recalls && vpic?.model) {
    const name = [vpic.modelYear, vpic.make, vpic.model].filter(Boolean).join(" ");
    if (recalls.count > 0) {
      out.push({
        id: "us_recalls",
        tone: "warn",
        title: `${lvCount(recalls.count, "atsaukšanas akcija", "atsaukšanas akcijas")} ASV`,
        body: `NHTSA dati modelim ${name}. Pie dīlera pārbaudi, vai darbi veikti tieši šim auto.`,
      });
    } else {
      out.push({ id: "us_recalls_none", tone: "ok", title: "ASV atsaukšanas akciju nav", body: `NHTSA dati modelim ${name}.` });
    }
  }
  return out;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const TIMEOUT_MS = 8_000;

async function getText(fetchImpl: FetchLike, url: string): Promise<{ status: number; text: string } | null> {
  try {
    const res = await fetchImpl(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { status: res.status, text: await res.text() };
  } catch {
    return null;
  }
}

/** vPIC + (tikai Ziemeļamerikas VIN) ASV atsaukumi. Kļūdas gadījumā lauks ir `null`, lapa rāda lokālo dekodu. */
export async function fetchFreeVinDetails(
  local: Extract<VinDecodeResult, { ok: true }>,
  fetchImpl: FetchLike = fetch,
): Promise<{ vpic: VpicDetails | null; recalls: UsRecalls | null; signals: FreeVinSignal[] }> {
  const dec = await getText(fetchImpl, `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(local.vin)}?format=json`);
  const vpic = dec ? parseVpicDetails(dec.status, dec.text) : null;
  let recalls: UsRecalls | null = null;
  if (local.region === "northAmerica" && vpic?.model && vpic.modelYear) {
    const q = new URLSearchParams({ make: vpic.make, model: vpic.model, modelYear: vpic.modelYear });
    const rec = await getText(fetchImpl, `https://api.nhtsa.gov/recalls/recallsByVehicle?${q}`);
    recalls = rec ? parseUsRecalls(rec.status, rec.text) : null;
  }
  return { vpic, recalls, signals: buildFreeVinSignals({ local, vpic, recalls }) };
}
