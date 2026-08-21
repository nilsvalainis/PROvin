/**
 * Jumta lūka / panorāmas lūka — aprīkojuma pazīmes ✨ klātienes ieteikumiem.
 * Aizsērējušas drenāžas un mitrums zem grīdas paklājiem ir tipiska pārbaude,
 * VW grupā (īpaši Volkswagen) — izteikti tipiska problēma.
 */

const SUNROOF_EQUIPMENT_RE =
  /panor[aā]m\w{0,8}[\s/\-]*(?:l[uū]k|jumt|dach|roof|glass|stikl)|(?:jumta|stikla)[\s/\-]*l[uū]k|\bl[uū]k(?:a|as|u|ām|ai|ā)?\b|sun[\s/\-]?roof|moon[\s/\-]?roof|glass[\s/\-]?roof|sliding[\s/\-]?roof|tilt[\s/\-]?slide|schiebe(?:\s*\/\s*ausstell)?[\s/\-]?dach|panoramadach|glasdach|dachluke|toit[\s/\-]?ouvrant|techo[\s/\-]?solar|sky[\s/\-]?window|open[\s/\-]?sky|panoramic[\s/\-]?(?:roof|glass|sun)/iu;

const SUNROOF_FALSE_POSITIVE_RE =
  /reling|roof[\s/\-]?rail|dachreling|saulessarg|sun[\s/\-]?visor|sun[\s/\-]?blind|panoram\w{0,8}[\s/\-]*(?:kamer|camera|view)|360[\s/\-]*kamer/iu;

const VW_GROUP_BRANDS = ["VW", "VOLKSWAGEN", "AUDI", "SKODA", "SEAT", "CUPRA"] as const;
const VOLKSWAGEN_BRANDS = ["VW", "VOLKSWAGEN"] as const;

export function textIndicatesSunroof(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  if (SUNROOF_FALSE_POSITIVE_RE.test(t) && !SUNROOF_EQUIPMENT_RE.test(t)) return false;
  return SUNROOF_EQUIPMENT_RE.test(t);
}

export function isVwGroupBrand(makeModel: string, makeTokens: readonly string[] = []): boolean {
  const hay = [makeModel, ...makeTokens].join(" ").toUpperCase().replace(/Š/g, "S");
  return VW_GROUP_BRANDS.some((b) => hay.includes(b));
}

export function isVolkswagenBrand(makeModel: string, makeTokens: readonly string[] = []): boolean {
  const tokens = makeTokens.map((t) => t.toUpperCase());
  if (tokens.some((t) => (VOLKSWAGEN_BRANDS as readonly string[]).includes(t))) return true;
  const hay = makeModel.toUpperCase();
  return /\bVW\b/.test(hay) || hay.includes("VOLKSWAGEN");
}

export function sunroofInspectionFlagLine(opts: {
  evidence: string;
  makeModel?: string;
  makeTokens?: readonly string[];
}): string {
  const evidence = opts.evidence.trim() || "aprīkojums / sludinājums";
  const vw = isVwGroupBrand(opts.makeModel ?? "", opts.makeTokens ?? []);
  const volkswagen = isVolkswagenBrand(opts.makeModel ?? "", opts.makeTokens ?? []);
  const typical = volkswagen
    ? " VW grupā, īpaši Volkswagen, šī ir izteikti tipiska problēma."
    : vw
      ? " VW grupā (Audi, Škoda, SEAT, Cupra; visizteiktāk Volkswagen) šī ir tipiska problēma."
      : "";
  return `- LŪKA / PANORĀMAS LŪKA datos: ${evidence}. OBLIGĀTI „2. Ieteikumi klātienes apskatei” — atsevišķa rindkopa: jāpārbauda grīdas paklāji (paceļot), mitrums / smaka / pelējums kājvietās, vai jumta lūkas drenāžas nav ciet.${typical}`;
}
