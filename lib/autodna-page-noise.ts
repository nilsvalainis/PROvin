/**
 * AutoDNA PDF lapu galvenes / kājenes troksnis (LV, EN, LT): „Pārbaudiet ziņojuma oriģinalitāti … QR kodu”,
 * „Auto Vēstures Atskaite autoDNA VIN”, „Lapa N [datums]”, garš heksadecimāls hešs ar laika zīmogu.
 * Ja bojājuma bloks pāriet uz nākamo lapu, šīs rindas ielīp „Detaļu grupa” / „Bojājumu zona” sarakstā.
 */

const ISO_STAMP = String.raw`\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?`;

/** Hešs: >= 24 heksadecimālās zīmes (drīkst ar defisēm), vismaz viens burts a-f. */
const HEX_HASH = String.raw`(?=[0-9a-f-]*[a-f])(?:[0-9a-f]-?){24,}`;

const HEX_HASH_LINE_RE = new RegExp(
  String.raw`^(?:${ISO_STAMP}\s+)?${HEX_HASH}(?:\s+${ISO_STAMP})?$`,
  "i",
);

const PAGE_LINE_RE = new RegExp(
  String.raw`^(?:${ISO_STAMP}\s+)?(?:Lapa|Page|Puslapis)\s*\d+(?:\s*(?:\/|no|of|iš)\s*\d+)?(?:\s+${ISO_STAMP})?$`,
  "i",
);

const REPORT_TITLE_RE =
  /^(?:Auto\s+V[ēe]stures\s+Atskaite|Vehicle\s+History\s+Report|Transporto\s+priemon[ėe]s\s+istorijos\s+ataskaita)\b/i;

const AUTHENTICITY_RE =
  /^(?:P[āa]rbaudiet\s+zi[ņn]ojuma|ori[ģg]inalit[āa]ti\b|Check\s+the\s+authenticity|Patikrinkite\s+ataskaitos)|noskenē|nuskenuok|QR[\s-]*(?:kod|code)/i;

const VIN_LINE_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Viena rinda ir AutoDNA lapas galvene / kājene (nav bojājuma saturs). */
export function isAutodnaPageNoiseLine(line: string): boolean {
  const t = line.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (REPORT_TITLE_RE.test(t)) return true;
  if (/\bautoDNA\b/i.test(t) && /Atskaite|Report|Ataskaita/i.test(t)) return true;
  if (AUTHENTICITY_RE.test(t)) return true;
  if (PAGE_LINE_RE.test(t)) return true;
  if (HEX_HASH_LINE_RE.test(t)) return true;
  if (VIN_LINE_RE.test(t)) return true;
  return false;
}

/** Tas pats troksnis, ja PDF to salīmējis vienā rindā ar bojājuma tekstu. */
const INLINE_NOISE_RES: RegExp[] = [
  /P[āa]rbaudiet\s+zi[ņn]ojuma\s+ori[ģg]inalit[āa]ti[^\n]{0,160}?QR[\s-]*kod\p{L}*\.?/giu,
  /Check\s+the\s+authenticity[^\n]{0,160}?QR[\s-]*code(?:\s+(?:visible\s+)?in\s+the\s+header)?\.?/gi,
  /Patikrinkite\s+ataskaitos[^\n]{0,160}?QR[\s-]*kod\p{L}*\.?/giu,
  /(?:Auto\s+V[ēe]stures\s+Atskaite|Vehicle\s+History\s+Report|Transporto\s+priemon[ėe]s\s+istorijos\s+ataskaita)\s+autoDNA(?:\s+[A-HJ-NPR-Z0-9]{17})?/gi,
  new RegExp(String.raw`(?<![0-9a-z])${HEX_HASH}(?:\s+${ISO_STAMP})?(?![0-9a-z])`, "gi"),
  new RegExp(String.raw`(?<![\p{L}\p{N}])(?:Lapa|Page|Puslapis)\s*\d+(?:\s+${ISO_STAMP})?\s*$`, "giu"),
];

/**
 * Izņem AutoDNA lapu galvenes / kājenes, lai bojājuma bloks turpinās pāri lapas robežai.
 * Pārējās rindas un to secība paliek nemainīgas (salīmētā trokšņa vietā paliek atstarpe).
 */
export function stripAutodnaPageNoise(text: string): string {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    let cleaned = line;
    for (const re of INLINE_NOISE_RES) {
      re.lastIndex = 0;
      cleaned = cleaned.replace(re, " ");
    }
    if (cleaned !== line) {
      cleaned = cleaned.replace(/ {2,}/g, " ").trimEnd();
      if (!cleaned.trim()) continue;
    }
    if (isAutodnaPageNoiseLine(cleaned)) continue;
    out.push(cleaned);
  }
  return out.join("\n");
}
