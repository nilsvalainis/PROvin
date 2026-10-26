/**
 * Izsoļu raw vērtību karte uz kopīgām IRISS grupām.
 * Skaitliskie kodi nāk tikai no jau apstiprinātajām konstantēm
 * (`OPENLANE_FUEL_ID_TO_NAME`, Autobid e17/e70/virsbūve, ET degviela).
 * Nezināms kods paliek bez grupas ar `todo`. To neuzmin.
 */

import { parseEnginePowerKwFromText } from "@/lib/engine-power-kw";
import { extractPowerKwFromBrand } from "@/lib/iriss-listings-ecarstrade-catalog";
import {
  AUTOBID_BODY_ID_TO_NAME,
  AUTOBID_FUEL_ID_TO_NAME,
  AUTOBID_GEARBOX_ID_TO_NAME,
  OPENLANE_FUEL_ID_TO_NAME,
  isWildcardCriterion,
  mapAutobidBodyId,
  mapAutobidFuelToken,
  mapAutobidGearboxId,
  mapEcarstradeDrive,
  mapEmissionClass,
  mapOpenlaneFuelToken,
} from "@/lib/iriss-listings-ecarstrade-criteria";
import { ECARSTRADE_BODY, ECARSTRADE_FUEL } from "@/lib/iriss-listings-ecarstrade-search";

export const IRISS_AUCTION_PLATFORMS = [
  "auto1",
  "openlane",
  "autobid",
  "ecarstrade",
  "caronsale",
  "bca",
  "copart",
  "mobile_de",
] as const;

export type AuctionPlatform = (typeof IRISS_AUCTION_PLATFORMS)[number];

export const FUEL_GROUPS = ["petrol", "diesel", "hybrid", "electric", "gas", "hydrogen", "other"] as const;
export type FuelGroup = (typeof FUEL_GROUPS)[number];

export const HYBRID_SUBS = ["full_hev", "phev", "mhev", "diesel_hybrid"] as const;
export type HybridSub = (typeof HYBRID_SUBS)[number];

export const ELECTRIC_SUBS = ["bev", "erev"] as const;
export type ElectricSub = (typeof ELECTRIC_SUBS)[number];

export const GAS_SUBS = ["lpg", "cng", "bifuel"] as const;
export type GasSub = (typeof GAS_SUBS)[number];

export type FuelSub = HybridSub | ElectricSub | GasSub;

export const GEARBOX_GROUPS = ["manual", "automatic"] as const;
export type GearboxGroup = (typeof GEARBOX_GROUPS)[number];

export const AUTOMATIC_SUBS = ["torque_converter", "dsg_dct", "cvt", "amt", "single_speed_ev"] as const;
export type AutomaticSub = (typeof AUTOMATIC_SUBS)[number];

export const BODY_GROUPS = ["sedan", "wagon", "hatchback", "suv", "coupe", "cabrio", "mpv", "van_bus", "pickup"] as const;
export type BodyGroup = (typeof BODY_GROUPS)[number];

export const DRIVE_GROUPS = ["fwd", "rwd", "awd"] as const;
export type DriveGroup = (typeof DRIVE_GROUPS)[number];

export type CriteriaConfidence = "high" | "medium" | "low" | "unknown";

export type NormalizedFuel = {
  group: FuelGroup | null;
  sub?: FuelSub;
  raw: string;
  confidence: CriteriaConfidence;
  /** Paskaidrojums, ja grupa ir zināma, bet apakštips kodā nav. */
  note?: string;
  /** Tikai ja grupa nav noteikta. Sākas ar `TODO`. */
  todo?: string;
};

export type NormalizedGearbox = {
  group: GearboxGroup | null;
  sub?: AutomaticSub;
  raw: string;
  confidence: CriteriaConfidence;
  note?: string;
  todo?: string;
};

export type NormalizedBody = {
  group: BodyGroup | null;
  raw: string;
  confidence: CriteriaConfidence;
  note?: string;
  todo?: string;
};

export type NormalizedDrive = {
  group: DriveGroup | null;
  raw: string;
  confidence: CriteriaConfidence;
  note?: string;
  todo?: string;
};

export type NormalizedEmission = {
  group: string | null;
  raw: string;
  confidence: CriteriaConfidence;
  note?: string;
  todo?: string;
};

export type ConfirmedAuctionCode = {
  platform: AuctionPlatform;
  field: "fuel" | "gearbox" | "body" | "drive";
  code: string;
  group: string;
  sub?: string;
  note: string;
};

const ET_BODY_TO_GROUP: Record<string, BodyGroup> = {
  [ECARSTRADE_BODY.saloon]: "sedan",
  [ECARSTRADE_BODY.estate]: "wagon",
  [ECARSTRADE_BODY.small]: "hatchback",
  [ECARSTRADE_BODY.suv]: "suv",
  [ECARSTRADE_BODY.coupe]: "coupe",
  [ECARSTRADE_BODY.convertible]: "cabrio",
  [ECARSTRADE_BODY.van]: "van_bus",
};

const HYBRID_NO_SUB = "Hibrīda kods nav sadalīts pa HEV, PHEV, MHEV vai dīzeļa hibrīdu.";
const AUTO_NO_SUB = "Automāts bez apakštipa. Griezes momenta pārveidotājs, DSG un CVT šajā kodā nav atdalīti.";

export function isFuelGroup(value: unknown): value is FuelGroup {
  return typeof value === "string" && (FUEL_GROUPS as readonly string[]).includes(value);
}

export function isHybridSub(value: unknown): value is HybridSub {
  return typeof value === "string" && (HYBRID_SUBS as readonly string[]).includes(value);
}

export function isElectricSub(value: unknown): value is ElectricSub {
  return typeof value === "string" && (ELECTRIC_SUBS as readonly string[]).includes(value);
}

export function isGasSub(value: unknown): value is GasSub {
  return typeof value === "string" && (GAS_SUBS as readonly string[]).includes(value);
}

export function isGearboxGroup(value: unknown): value is GearboxGroup {
  return typeof value === "string" && (GEARBOX_GROUPS as readonly string[]).includes(value);
}

export function isAutomaticSub(value: unknown): value is AutomaticSub {
  return typeof value === "string" && (AUTOMATIC_SUBS as readonly string[]).includes(value);
}

export function isBodyGroup(value: unknown): value is BodyGroup {
  return typeof value === "string" && (BODY_GROUPS as readonly string[]).includes(value);
}

export function isDriveGroup(value: unknown): value is DriveGroup {
  return typeof value === "string" && (DRIVE_GROUPS as readonly string[]).includes(value);
}

export function isAuctionPlatform(value: unknown): value is AuctionPlatform {
  return typeof value === "string" && (IRISS_AUCTION_PLATFORMS as readonly string[]).includes(value);
}

/** `openline` ir esošais IRISS lauka nosaukums. `mobile` ir mobile.de. */
export function resolveAuctionPlatform(raw: string | undefined | null): AuctionPlatform | undefined {
  const s = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (!s) return undefined;
  if (s === "openlane" || s === "openline") return "openlane";
  if (s === "auto1") return "auto1";
  if (s === "autobid") return "autobid";
  if (s === "ecarstrade" || s === "et") return "ecarstrade";
  if (s === "caronsale" || s === "cos") return "caronsale";
  if (s === "bca") return "bca";
  if (s === "copart") return "copart";
  if (s === "mobilede" || s === "mobile") return "mobile_de";
  return undefined;
}

export function foldCriterion(raw: string): string {
  return raw
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_.,+()[\]{}]+/g, " ")
    .replace(/[/-]+/g, " ")
    .replace(/&/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Komats, semikols, jauna rinda, `vai` / `or` / `oder` / `en`, slīpsvītra ar atstarpēm. */
export function splitCriterionTokens(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  return t
    .split(/\s*(?:,|;|\n|\s\/\s|\bvai\b|\bor\b|\boder\b|\ben\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function legacyFuel(name: string): { group: FuelGroup; note?: string } | null {
  if (name === "petrol") return { group: "petrol" };
  if (name === "diesel") return { group: "diesel" };
  if (name === "hybrid") return { group: "hybrid", note: HYBRID_NO_SUB };
  return null;
}

function fuelHit(
  raw: string,
  group: FuelGroup,
  confidence: CriteriaConfidence,
  extra?: { sub?: FuelSub; note?: string },
): NormalizedFuel {
  return {
    group,
    ...(extra?.sub ? { sub: extra.sub } : {}),
    raw,
    confidence,
    ...(extra?.note ? { note: extra.note } : {}),
  };
}

function fuelTodo(raw: string, todo: string): NormalizedFuel {
  return { group: null, raw, confidence: "unknown", todo };
}

function emptyFuel(raw: string): NormalizedFuel {
  return { group: null, raw, confidence: "unknown" };
}

function digitsOnly(raw: string): boolean {
  return /^\d+$/.test(raw.trim());
}

function looksLikeCodePair(raw: string): boolean {
  return /^\d+\s*;\s*\d+$/.test(raw.trim());
}

export function confirmedNumericCodes(): ConfirmedAuctionCode[] {
  const rows: ConfirmedAuctionCode[] = [];
  for (const [code, name] of Object.entries(OPENLANE_FUEL_ID_TO_NAME)) {
    const mapped = legacyFuel(name);
    if (!mapped) continue;
    rows.push({
      platform: "openlane",
      field: "fuel",
      code,
      group: mapped.group,
      note: mapped.note ?? "OPENLANE_FUEL_ID_TO_NAME",
    });
  }
  for (const [code, name] of Object.entries(AUTOBID_FUEL_ID_TO_NAME)) {
    const mapped = legacyFuel(name);
    if (!mapped) continue;
    rows.push({
      platform: "autobid",
      field: "fuel",
      code,
      group: mapped.group,
      note: mapped.note ?? "AUTOBID_FUEL_ID_TO_NAME e17",
    });
  }
  for (const [code, name] of Object.entries(AUTOBID_GEARBOX_ID_TO_NAME)) {
    rows.push({
      platform: "autobid",
      field: "gearbox",
      code,
      group: name === "Manual" ? "manual" : "automatic",
      note: name === "Manual" ? "AUTOBID_GEARBOX_ID_TO_NAME e70" : AUTO_NO_SUB,
    });
  }
  for (const [code, name] of Object.entries(AUTOBID_BODY_ID_TO_NAME)) {
    const group = ET_BODY_TO_GROUP[name];
    if (!group) continue;
    rows.push({
      platform: "autobid",
      field: "body",
      code,
      group,
      note: `AUTOBID_BODY_ID_TO_NAME ${name}`,
    });
  }
  return rows;
}

function confirmedFuelCode(raw: string, platform: AuctionPlatform | undefined): NormalizedFuel | null {
  const code = raw.trim();
  if (platform === "openlane") {
    const name = mapOpenlaneFuelToken(code);
    const mapped = name ? legacyFuel(name) : null;
    if (mapped) return fuelHit(raw, mapped.group, "high", { note: mapped.note });
    if (digitsOnly(code)) return fuelTodo(raw, `TODO: Openlane fuelTypes ${code} nav kartēts`);
    return null;
  }
  if (platform === "autobid") {
    const name = mapAutobidFuelToken(code);
    const mapped = name ? legacyFuel(name) : null;
    if (mapped) return fuelHit(raw, mapped.group, "high", { note: mapped.note });
    if (digitsOnly(code)) return fuelTodo(raw, `TODO: Autobid e17 ${code} nav kartēts`);
    return null;
  }
  if (!platform && digitsOnly(code) && code.length >= 6) {
    const name = OPENLANE_FUEL_ID_TO_NAME[code];
    const mapped = name ? legacyFuel(name) : null;
    if (mapped) return fuelHit(raw, mapped.group, "high", { note: mapped.note ?? "Openlane fuelTypes bez platformas parametra" });
    return fuelTodo(raw, `TODO: skaitlisks degvielas kods ${code} nav Openlane 100001, 100003 vai 100013`);
  }
  return null;
}

function hasDieselWord(s: string): boolean {
  return /\bdiesel\b|\bdiisel\b|\bdizel|\bgazole\b|\bgasoil\b|\bgasolio\b|\bgasoleo\b|\btdi\b|\bcdi\b|\bdci\b|\bhdi\b|\bcrdi\b|\btdci\b/.test(s);
}

function hasPetrolWord(s: string): boolean {
  return /\bpetrol\b|\bgasoline\b|\bbenzin|\bbensiin\b|\bessence\b|\bsans plomb\b|\bunleaded\b|\botto\b|\btfsi\b|\btsi\b|\bfsi\b|\bgdi\b|\bpb95\b|\bsp95\b|\bsuperbenzin\b/.test(s);
}

function hasElectricWord(s: string): boolean {
  return /\belectric\b|\belektro\b|\belektrisch\b|\belectrique\b|\belektrisk\b|\bbatter/.test(s);
}

export function normalizeFuel(raw: string, platform?: AuctionPlatform | string): NormalizedFuel {
  const trimmed = raw.trim();
  const resolved = typeof platform === "string" ? resolveAuctionPlatform(platform) ?? (isAuctionPlatform(platform) ? platform : undefined) : platform;
  if (!trimmed || isWildcardCriterion(trimmed)) return emptyFuel(raw);
  const coded = confirmedFuelCode(trimmed, resolved);
  if (coded) return coded;

  const s = foldCriterion(trimmed);
  if (!s || isWildcardCriterion(s)) return emptyFuel(raw);

  if (/\bhydrogen\b|\bwasserstoff\b|\bhydrogene\b|\bfcev\b|\bfuel cell\b|\bbrandstofcel\b|\budensrad/.test(s) || s === "h2") {
    return fuelHit(raw, "hydrogen", "high");
  }

  if (/\bplugin\b|\bplug in\b|\bphev\b|\bstekker\b|\bauflad\b|\brechargeable\b/.test(s)) {
    return fuelHit(raw, "hybrid", "high", { sub: "phev" });
  }
  if (/\bmild hybrid\b|\bmildhybrid\b|\bmhev\b|\b48\s*v\b|\b48v\b/.test(s)) {
    return fuelHit(raw, "hybrid", "high", { sub: "mhev" });
  }
  if (/\be hybrid\b|\behybrid\b/.test(s)) {
    return fuelHit(raw, "hybrid", "medium", {
      sub: "phev",
      note: "e-Hybrid bieži ir VW spraudņa hibrīds. Apakštips ir vidēja ticamība, ne izsoles kods.",
    });
  }
  if (/\bfull hybrid\b|\bfullhybrid\b|\bvollhybrid\b|\bhev\b/.test(s)) {
    return fuelHit(raw, "hybrid", "high", { sub: "full_hev" });
  }
  if (/hybrid|hibrid|hybride/.test(s) && hasDieselWord(s)) {
    return fuelHit(raw, "hybrid", "high", { sub: "diesel_hybrid" });
  }
  if (/hybrid|hibrid|hybride/.test(s)) {
    return fuelHit(raw, "hybrid", "high", { note: "Hibrīds bez HEV, PHEV vai MHEV precizējuma." });
  }
  if (hasElectricWord(s) && hasDieselWord(s)) {
    return fuelHit(raw, "hybrid", "medium", { sub: "diesel_hybrid", note: "Dīzelis un elektro vienā vērtībā, bez vārda hybrid." });
  }
  if (hasElectricWord(s) && hasPetrolWord(s)) {
    return fuelHit(raw, "hybrid", "medium", { note: "Benzīns un elektro vienā vērtībā, bez vārda hybrid." });
  }

  if (/\bbifuel\b|\bbi fuel\b|\bbivalent\b|\bbivalentni/.test(s) || (hasPetrolWord(s) && /\blpg\b|\bautogas\b|\bgpl\b/.test(s))) {
    return fuelHit(raw, "gas", "high", { sub: "bifuel" });
  }
  if (/\blpg\b|\bautogas\b|\bautogaze\b|\bflussiggas\b|\bgpl\b|\bvloibaargas\b|\bliquefied\b/.test(s)) {
    return fuelHit(raw, "gas", "high", { sub: "lpg" });
  }
  if (/\bcng\b|\berdgas\b|\baardgas\b|\bnatural gas\b|\bgaz naturel\b|\bgnv\b|\bdabasgaz|\bmethan\b|\bcompressed natural\b/.test(s)) {
    return fuelHit(raw, "gas", "high", { sub: "cng" });
  }
  if (s === "gas") {
    if (resolved === "copart") return fuelHit(raw, "petrol", "high", { note: "Copart fuel Gas ir benzīns, ne LPG." });
    return fuelTodo(raw, "TODO: gas bez platformas ir divdomīgs (Copart benzīns vai LPG/CNG)");
  }

  if (/\berev\b|\brange extender\b|\brex\b/.test(s)) {
    return fuelHit(raw, "electric", "high", { sub: "erev" });
  }
  if (hasElectricWord(s) || /\bbev\b/.test(s)) {
    return fuelHit(raw, "electric", "high", { sub: "bev" });
  }
  if (/\bev\b/.test(s)) {
    return fuelHit(raw, "electric", "medium", { sub: "bev", note: "ev kā atsevišķs vārds. Vidēja ticamība." });
  }

  const petrol = hasPetrolWord(s);
  const diesel = hasDieselWord(s);
  if (petrol && diesel) return fuelTodo(raw, "TODO: vienā vērtībā ir gan benzīns, gan dīzelis");
  if (diesel) {
    const badge = /\btdi\b|\bcdi\b|\bdci\b|\bhdi\b|\bcrdi\b|\btdci\b/.test(s) && !/\bdiesel\b|\bdizel\b|\bgazole\b/.test(s);
    return fuelHit(raw, "diesel", badge ? "medium" : "high", badge ? { note: "Dīzeļa dzinēja apzīmējums (TDI, CDI, dCi, HDi)." } : undefined);
  }
  if (petrol) {
    const badge = /\botto\b|\btfsi\b|\btsi\b|\bfsi\b|\bgdi\b/.test(s) && !/\bpetrol\b|\bgasoline\b|\bbenzin\b|\bessence\b/.test(s);
    return fuelHit(raw, "petrol", badge ? "medium" : "high", badge ? { note: "Benzīna dzinēja apzīmējums (TFSI, TSI, FSI, GDI, Otto)." } : undefined);
  }

  if (/\bethanol\b|\be85\b|\bflexfuel\b|\bflex fuel\b/.test(s)) {
    return fuelHit(raw, "other", "medium", { note: "Etanols vai flex fuel nav atsevišķa grupa." });
  }
  if (/\bother\b|\bsonstige\b|\boverig\b|\bautre\b|\bcits\b|\bunknown\b/.test(s)) {
    return fuelHit(raw, "other", "high");
  }

  if (digitsOnly(trimmed)) return fuelTodo(raw, `TODO: īss skaitlisks degvielas kods ${trimmed} bez apstiprinātas kartes`);
  return emptyFuel(raw);
}

function gearHit(
  raw: string,
  group: GearboxGroup,
  confidence: CriteriaConfidence,
  extra?: { sub?: AutomaticSub; note?: string },
): NormalizedGearbox {
  return {
    group,
    ...(extra?.sub ? { sub: extra.sub } : {}),
    raw,
    confidence,
    ...(extra?.note ? { note: extra.note } : {}),
  };
}

function gearTodo(raw: string, todo: string): NormalizedGearbox {
  return { group: null, raw, confidence: "unknown", todo };
}

export function normalizeGearbox(raw: string, platform?: AuctionPlatform | string): NormalizedGearbox {
  const trimmed = raw.trim();
  const resolved = typeof platform === "string" ? resolveAuctionPlatform(platform) : platform;
  if (!trimmed || isWildcardCriterion(trimmed)) return { group: null, raw, confidence: "unknown" };

  if (resolved === "autobid") {
    const fromId = mapAutobidGearboxId(trimmed);
    if (fromId === "Manual") return gearHit(raw, "manual", "high");
    if (fromId === "Automatic") return gearHit(raw, "automatic", "high", { note: AUTO_NO_SUB });
    if (digitsOnly(trimmed)) return gearTodo(raw, `TODO: Autobid e70 ${trimmed} nav kartēts`);
  }
  if (resolved === "mobile_de") {
    const key = foldCriterion(trimmed).replace(/\s+/g, "_");
    if (key === "automatic_gear" || key === "automatic") return gearHit(raw, "automatic", "high", { note: AUTO_NO_SUB });
    if (key === "manual_gear" || key === "manual") return gearHit(raw, "manual", "high");
    if (key === "semiautomatic_gear" || key === "semiautomatic") {
      return gearHit(raw, "automatic", "medium", {
        note: "mobile.de SEMIAUTOMATIC_GEAR iet kopā ar AUTOMATIC_GEAR kā Automatik. Apakštips nav atdalīts.",
      });
    }
  }

  const s = foldCriterion(trimmed);
  if (!s || isWildcardCriterion(s)) return { group: null, raw, confidence: "unknown" };

  if (/\bsingle speed\b|\b1 speed\b|\b1 gang\b|\bdirect drive\b|\bfeste ubersetzung\b|\beingang\b/.test(s)) {
    return gearHit(raw, "automatic", "high", { sub: "single_speed_ev" });
  }
  if (/\be cvt\b|\becvt\b|\bmultitronic\b|\bxtronic\b|\blineartronic\b|\bcvt\b|\bivt\b/.test(s)) {
    return gearHit(raw, "automatic", "high", { sub: "cvt" });
  }
  if (/\bdsg\b|\bdct\b|\bpdk\b|\bs tronic\b|\bstronic\b|\bedc\b|\bpowershift\b|\bdoppelkupplung\b|\bdual clutch\b|\bdkg\b|\b7g dct\b/.test(s)) {
    return gearHit(raw, "automatic", "high", { sub: "dsg_dct" });
  }
  if (/\bsteptronic\b|\btiptronic\b|\bgeartronic\b|\d\s*g\s*tronic\b|\btorque converter\b|\bwandler\b/.test(s)) {
    return gearHit(raw, "automatic", "high", { sub: "torque_converter" });
  }
  if (/\bamt\b|\brobotis|\brobotiz|\basg\b|\bsemi automatic\b|\bsemiautomatic\b|\bhalbauto|\beasytronic\b|\bdurashift\b|\bsensodrive\b|\bselespeed\b|\bdualogic\b|\bautomatisierte\b|\bautomated manual\b/.test(s)) {
    return gearHit(raw, "automatic", "high", { sub: "amt" });
  }

  const manual = /\bschalt|\bmanual\b|\bmanuell\b|\bmanuala\b|\bmanuaal\b|\bmehan|\bstick\b|\bhandgeschakeld\b|\bhandbak\b|\bboite manuelle\b|\bhandmatig\b|\bschaltgetriebe\b/.test(s);
  const automatic = /\bautomat|\bautomaat\b|\bautomats\b|\bauto\b/.test(s);
  if (manual && automatic) return gearTodo(raw, "TODO: vienā vērtībā ir gan manuālā, gan automātiskā kārba");
  if (manual) return gearHit(raw, "manual", "high");
  if (/\bautomat|\bautomaat\b/.test(s)) return gearHit(raw, "automatic", "high", { note: AUTO_NO_SUB });
  if (s === "auto") return gearHit(raw, "automatic", "medium", { note: "auto kā saīsinājums. Apakštips nav zināms." });
  // Pasūtījumu formā raksta saīsinājumus (audits 27.10: «AT» pret izsoles «Automaat» Sludinājumos rādīja ✕).
  if (s === "at" || s === "akpp" || s === "a t") return gearHit(raw, "automatic", "medium", { note: "AT kā saīsinājums. Apakštips nav zināms." });
  if (s === "mt" || s === "m t") return gearHit(raw, "manual", "medium");

  if (digitsOnly(trimmed) || looksLikeCodePair(trimmed)) {
    return gearTodo(raw, `TODO: kārbas kods ${trimmed} nav kartēts`);
  }
  return { group: null, raw, confidence: "unknown" };
}

function bodyFromEtName(raw: string, name: string): NormalizedBody | null {
  if (name === ECARSTRADE_BODY.suv) {
    return {
      group: "suv",
      raw,
      confidence: "medium",
      note: "eCarsTrade SUV kods apvieno arī pickup. Atsevišķs pickup no šī koda nav atdalāms.",
    };
  }
  const group = ET_BODY_TO_GROUP[name];
  if (!group) return null;
  return { group, raw, confidence: "high" };
}

function bodyTodo(raw: string, todo: string): NormalizedBody {
  return { group: null, raw, confidence: "unknown", todo };
}

export function normalizeBody(raw: string, platform?: AuctionPlatform | string): NormalizedBody {
  const trimmed = raw.trim();
  const resolved = typeof platform === "string" ? resolveAuctionPlatform(platform) : platform;
  if (!trimmed || isWildcardCriterion(trimmed)) return { group: null, raw, confidence: "unknown" };

  if (resolved === "autobid") {
    const name = mapAutobidBodyId(trimmed);
    if (name) {
      const hit = bodyFromEtName(raw, name);
      if (hit) return { ...hit, confidence: "high", note: hit.note ?? `Autobid virsbūve ${name}` };
    }
    if (digitsOnly(trimmed) || looksLikeCodePair(trimmed)) {
      if (trimmed === "1") return bodyTodo(raw, "TODO: Autobid category 1 ir PKW tips, ne virsbūve");
      return bodyTodo(raw, `TODO: Autobid virsbūves kods ${trimmed} nav kartēts`);
    }
  }

  const s = foldCriterion(trimmed);
  if (!s || isWildcardCriterion(s)) return { group: null, raw, confidence: "unknown" };
  if (s === foldCriterion(ECARSTRADE_BODY.suv)) {
    return bodyFromEtName(raw, ECARSTRADE_BODY.suv)!;
  }

  if (/\bpickup\b|\bpick up\b|\bpikaps\b|\bpritsche\b|\bdouble cab\b/.test(s)) return { group: "pickup", raw, confidence: "high" };
  if (/\bcabrio|\bconvertible\b|\bkabriolet|\broadster\b|\bspider\b|\bspyder\b/.test(s)) return { group: "cabrio", raw, confidence: "high" };
  if (/\bsuv\b|\bcrossover\b|\bapvidus\b|\boff road\b|\boffroad\b|\bgelandewagen\b|\bsav\b/.test(s)) return { group: "suv", raw, confidence: "high" };
  if (/\bestate\b|\bwagon\b|\bkombi\b|\bcombi\b|\bavant\b|\bbreak\b|\bstation\b|\btouring\b|\bvariant\b|\buniversal|\buniversalis\b/.test(s)) {
    const medium = /\btouring\b|\bvariant\b|\bavant\b/.test(s);
    return {
      group: "wagon",
      raw,
      confidence: medium ? "medium" : "high",
      ...(medium ? { note: "Avant, Variant vai Touring ir virsbūves vārds ar vidēju ticamību." } : {}),
    };
  }
  if (/\bmpv\b|\bminivan\b|\bminiven|\bmonospace\b|\bpeople carrier\b|\bgran tourer\b/.test(s)) return { group: "mpv", raw, confidence: "high" };
  if (/\bminibus\b|\btransporter\b|\bkasten\b|\bfourgon\b|\bfurgon|\bmikroautobuss\b|\bpanel van\b|\bvan bus\b|\bbus\b|\bvan\b/.test(s)) {
    return { group: "van_bus", raw, confidence: "high" };
  }
  if (/\bhatch|\bhecbek|\bschragheck\b|\bcitadine\b|\bsmall car\b/.test(s)) return { group: "hatchback", raw, confidence: "high" };
  if (s === "compact") return { group: "hatchback", raw, confidence: "medium", note: "compact bez hatchback vārda." };
  if (/\bcoupe\b|\bkupeja\b|\bsports car\b|\bsport car\b|\bsportscar\b/.test(s)) return { group: "coupe", raw, confidence: "high" };
  if (/\bsedan\b|\bsedans\b|\bsaloon\b|\blimousine\b|\blimuzin|\blimo\b|\bberline\b|\bstufenheck\b/.test(s)) return { group: "sedan", raw, confidence: "high" };

  const et = bodyFromEtName(raw, trimmed);
  if (et && et.group) return et;

  if (digitsOnly(trimmed) || looksLikeCodePair(trimmed)) return bodyTodo(raw, `TODO: virsbūves kods ${trimmed} nav kartēts`);
  return { group: null, raw, confidence: "unknown" };
}

export function normalizeDrive(raw: string, platform?: AuctionPlatform | string): NormalizedDrive {
  const trimmed = raw.trim();
  const resolved = typeof platform === "string" ? resolveAuctionPlatform(platform) : platform;
  if (!trimmed || isWildcardCriterion(trimmed)) return { group: null, raw, confidence: "unknown" };
  const s = foldCriterion(trimmed);
  const fwd = /\bfwd\b|\bfront wheel\b|\bfront drive\b|\bfront\b|\bprieksej|\bvoorwiel\b|\bfrontantrieb\b|\bvorderrad\b/.test(s);
  const rwd = /\brwd\b|\brear wheel\b|\brear drive\b|\brear\b|\baizmugur|\bheckantrieb\b|\bachterwiel\b|\bhinterrad\b/.test(s);
  const awd =
    /\bawd\b|\b4x4\b|\b4wd\b|\bfour wheel\b|\ball wheel\b|\ballrad\b|\ballradantrieb\b|\bquattro\b|\bxdrive\b|\b4matic\b|\b4motion\b|\ball4\b|\ball 4\b|\bsyncro\b|\bhaldex\b|\bpilnpiedzin/.test(
      s,
    ) || s === "all wheel" || s === "integral";
  const hits = [fwd ? "fwd" : "", rwd ? "rwd" : "", awd ? "awd" : ""].filter(Boolean);
  if (hits.length > 1) {
    return { group: null, raw, confidence: "unknown", todo: "TODO: vienā vērtībā ir vairākas piedziņas" };
  }
  if (hits.length === 1) return { group: hits[0] as DriveGroup, raw, confidence: "high" };

  const mapped = mapEcarstradeDrive(trimmed);
  if (mapped) return { group: mapped, raw, confidence: "high", note: "ET iriss_drive / mapEcarstradeDrive" };

  if (digitsOnly(trimmed)) {
    const where = resolved ? `${resolved} ` : "";
    return { group: null, raw, confidence: "unknown", todo: `TODO: ${where}piedziņas kods ${trimmed} nav kartēts` };
  }
  return { group: null, raw, confidence: "unknown" };
}

export function normalizeEmission(raw: string): NormalizedEmission {
  const trimmed = raw.trim();
  if (!trimmed || isWildcardCriterion(trimmed)) return { group: null, raw, confidence: "unknown" };
  const group = mapEmissionClass(trimmed);
  if (group) return { group, raw, confidence: "high", note: "mapEmissionClass" };
  if (/euro|eiro/i.test(trimmed)) return { group: null, raw, confidence: "unknown", todo: `TODO: emisijas klase ${trimmed} nav mapEmissionClass kartē` };
  return { group: null, raw, confidence: "unknown" };
}

export type PowerKwRange = { from: number | null; to: number | null };

/** kW diapazons. Vispirms teksta `kW` robežas, tad hp/PS/ZS caur `parseEnginePowerKwFromText`. */
export function normalizePowerKw(raw: string): PowerKwRange {
  const branded = extractPowerKwFromBrand(raw);
  if (branded) return { from: branded.from, to: branded.to };
  const one = parseEnginePowerKwFromText(raw);
  if (one == null) return { from: null, to: null };
  return { from: one, to: one };
}

export function acceptedNormalization(confidence: CriteriaConfidence, group: string | null): boolean {
  return group != null && (confidence === "high" || confidence === "medium");
}

export const ECARSTRADE_FUEL_TO_GROUP: Record<string, { group: FuelGroup; sub?: FuelSub; note?: string }> = {
  [ECARSTRADE_FUEL.petrol]: { group: "petrol" },
  [ECARSTRADE_FUEL.diesel]: { group: "diesel" },
  [ECARSTRADE_FUEL.electric]: { group: "electric", sub: "bev" },
  [ECARSTRADE_FUEL.lpg]: { group: "gas", sub: "lpg" },
  [ECARSTRADE_FUEL.gas]: { group: "gas", sub: "cng" },
  [ECARSTRADE_FUEL.hybridPetrol]: { group: "hybrid", note: "ET Hybrid (petrol/electric) bez HEV/PHEV/MHEV." },
  [ECARSTRADE_FUEL.hybridDiesel]: { group: "hybrid", sub: "diesel_hybrid" },
};
