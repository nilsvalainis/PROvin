import type { VinDecodeResult } from "@/lib/vin-decode";

/**
 * Bezmaksas VIN pārbaudes papildu dati (sākumlapa, /vin-dekoders).
 *
 * Rādām tikai to, par ko esam droši. NHTSA vPIC ir bez maksas un bez atslēgas, bet tajā ir ražotāju
 * pašu iesniegtie VIN dekodēšanas dati tikai ASV tirgus auto (49 CFR 565). Eiropas auto VIN vPIC
 * mēdz atkodēt nepareizi (VW -> 1984, rūpnīca Westmoreland), tāpēc to vaicājam tikai Ziemeļamerikas VIN.
 * ASV atsaukšanas akcijas nerādām: tās ir modeļa līmenī, nevis konkrētam auto.
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

export type FreeVinSignal = {
  id: "north_america" | "check_digit_bad" | "check_digit_ok";
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

const COUNTRY_CODE_LV: Record<string, string> = { US: "ASV", CA: "Kanādā", MX: "Meksikā" };

/** Brīdinājumi klientam tikai no pārbaudāmiem faktiem (VIN struktūra, NHTSA). */
export function buildFreeVinSignals(input: {
  local: Extract<VinDecodeResult, { ok: true }>;
  vpic: VpicDetails | null;
}): FreeVinSignal[] {
  const { local, vpic } = input;
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

/** Tikai ražotāja dati: ja vPIC ražotājs nesakrīt ar VIN WMI ražotāju, neko no vPIC nerādām. */
export function vpicMatchesLocal(local: Extract<VinDecodeResult, { ok: true }>, vpic: VpicDetails): boolean {
  if (!local.make) return true;
  const a = local.make.toLowerCase().replace(/[^a-z]/g, "");
  const b = vpic.make.toLowerCase().replace(/[^a-z]/g, "");
  return a.includes(b) || b.includes(a);
}

/** vPIC tikai Ziemeļamerikas VIN. Kļūdas vai neatbilstības gadījumā `vpic` ir `null`, lapa rāda lokālo dekodu. */
export async function fetchFreeVinDetails(
  local: Extract<VinDecodeResult, { ok: true }>,
  fetchImpl: FetchLike = fetch,
): Promise<{ vpic: VpicDetails | null; signals: FreeVinSignal[] }> {
  let vpic: VpicDetails | null = null;
  if (local.region === "northAmerica") {
    const dec = await getText(fetchImpl, `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(local.vin)}?format=json`);
    const parsed = dec ? parseVpicDetails(dec.status, dec.text) : null;
    vpic = parsed && vpicMatchesLocal(local, parsed) ? parsed : null;
  }
  return { vpic, signals: buildFreeVinSignals({ local, vpic }) };
}
