/**
 * Veiktie darbi (OFICIĀLĀ DĪLERA DATI, OneAuto un Auto Records):
 * katrs darbs savā rindā, bez ikonām, pirmais burts liels, secība pēc konteksta.
 */

import { isVendorServiceCategoryLine } from "@/lib/vendor-service-history";

const ICON_OR_EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}]/gu;

const LINE_BULLET_RE = /^[\s*•·▪▸►▶●○◆◇■□–—-]+/gm;

const OEM_QUALIFIER_RE =
  /^(exterior|interior|door|cap|cover|top|bottom|upper|lower|ventilated|front|rear|left|right|vorn(e)?|hinten|links|rechts|oben|unten|innen|aussen|au[ßs]en|mit\s+sensor|with\s+sensor|front\s+(left|right)|rear\s+(left|right)|vorne\s+(links|rechts)|hinten\s+(links|rechts))$/i;

const STANDALONE_WORK_RE =
  /maiņ|apkope|remont|filtr|eļļ|ellj|bremž|balans|utiliz|šķidrum|komplekt|diagnost|programmatūr|atjaunin|service|change|filter|oil|brake|inspection|check|update|software|fluid|disposal|entsorgung|gewichte|scheibenklar|motoroel|motor[öo]l|ventil|valve|reifen|tyre|tire|washer|wiper|battery|akumul|funktion|fitting|uitgevoerd|warranty/i;

const PART_NO_RE = /\(\s*[A-Z]{0,6}\d{5,}|\(\s*\d{8,}/;

const PLACEHOLDER_RE = /detaliz[ēe]ts\s+darbu\s+saraksts/i;

function capitalizeFirstLetter(text: string): string {
  const i = text.search(/\p{L}/u);
  if (i < 0) return text;
  return text.slice(0, i) + text.charAt(i).toLocaleUpperCase("lv") + text.slice(i + 1);
}

/** Pirmais burts liels (LV). Kategorija: arī darba daļa pēc kolona. */
export function capitalizeServiceField(text: string): string {
  const t = text.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^([^:]{2,48}):\s*(.+)$/);
  if (m && isVendorServiceCategoryLine(m[1]!.trim())) {
    return `${capitalizeFirstLetter(m[1]!.trim())}: ${capitalizeFirstLetter(m[2]!.trim())}`;
  }
  return capitalizeFirstLetter(t);
}

function stripWorkDecorations(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(ICON_OR_EMOJI_RE, "")
    .replace(LINE_BULLET_RE, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanItem(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[;,]+$/g, "")
    .replace(/\)\.$/, ")")
    .trim();
}

function hasPartNumber(text: string): boolean {
  return PART_NO_RE.test(text);
}

function looksLikeOemQualifier(part: string): boolean {
  const t = part.trim();
  if (!t) return false;
  if (OEM_QUALIFIER_RE.test(t)) return true;
  return t.length <= 4 && !STANDALONE_WORK_RE.test(t) && !hasPartNumber(t);
}

function looksLikeStandaloneWork(part: string): boolean {
  return STANDALONE_WORK_RE.test(part) || hasPartNumber(part);
}

/** „ITEM (CODE).,” / „ITEM.;” starp OEM pozīcijām. */
function splitOemTerminated(text: string): string[] {
  const chunks = text
    .split(/\s*[.]\s*,\s*|\s*;\s*/)
    .map(cleanItem)
    .filter(Boolean);
  return chunks.length > 0 ? chunks : [text];
}

function splitCommaAware(text: string): string[] {
  const parts = text.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return parts.length === 1 ? [parts[0]!] : [];

  const out: string[] = [];
  let cur = parts[0]!;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]!;
    const partIsWork = looksLikeStandaloneWork(part);
    const partIsQual = looksLikeOemQualifier(part) && !partIsWork;
    if (partIsQual) {
      cur = `${cur}, ${part}`;
      continue;
    }
    if (partIsWork) {
      out.push(cur);
      cur = part;
      continue;
    }
    cur = `${cur}, ${part}`;
  }
  out.push(cur);
  return out;
}

function splitCategoryPrefix(text: string): { category: string; rest: string } | null {
  const m = text.match(/^([^:]{2,48}):\s*(.+)$/);
  if (!m) return null;
  const category = m[1]!.trim();
  if (!isVendorServiceCategoryLine(category)) return null;
  return { category, rest: m[2]!.trim() };
}

function explodeSegment(segment: string): string[] {
  const cleaned = cleanItem(segment);
  if (!cleaned) return [];
  const cat = splitCategoryPrefix(cleaned);
  if (cat) {
    const items = splitCommaAware(cat.rest).flatMap((item) => splitOemTerminated(item));
    const unique = items.map(cleanItem).filter(Boolean);
    if (unique.length <= 1) {
      const only = unique[0] ?? "";
      return only ? [`${cleanItem(cat.category)}: ${only}`] : [cleanItem(cat.category)];
    }
    return [cleanItem(cat.category), ...unique];
  }
  return splitCommaAware(cleaned).flatMap((item) => splitOemTerminated(item)).map(cleanItem).filter(Boolean);
}

function workSortRank(line: string): number {
  if (isVendorServiceCategoryLine(line.replace(/:$/, ""))) return 0;
  if (PLACEHOLDER_RE.test(line)) return 90;
  if (/filtr/i.test(line)) return 2;
  if (/eļļ|ellj|motoroel|motor[öo]l|\boil\b/i.test(line)) return 1;
  if (/šķidrum|coolant|dzesē|scheibenklar|stiklu\s+mazg|washer|bremsfl|[öo]lwechsel/i.test(line)) {
    return 3;
  }
  if (/bremž|brake|brems/i.test(line)) return 4;
  if (/riep|tyre|tire|reifen|balans|ventil|valve|gewichte|entsorgung|wheel/i.test(line)) return 5;
  if (/akumul|batter/i.test(line)) return 6;
  if (/sveč|siksn|spark|plug|belt|zahnriemen/i.test(line)) return 7;
  if (/pārbaude|inspection|check|warranty|software|update|atjaunin/i.test(line)) return 8;
  return 9;
}

function sortWorkLines(lines: string[]): string[] {
  return lines
    .map((line, index) => ({ line, index, rank: workSortRank(line) }))
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index))
    .map((x) => x.line);
}

const WORK_FAMILY_RULES: { family: string; re: RegExp }[] = [
  { family: "particle_filter", re: /daļiņ|particle|dpf|ru[sš]u\s*filtr|diesel\s*particulate|ru[sß]filter/i },
  { family: "fuel_filter", re: /degvielas\s*filtr|fuel\s*filter|kraftstofffilter/i },
  { family: "cabin_filter", re: /salona|pollen|cabin\s*filter|innenraumfilter|mikrofiltr/i },
  { family: "air_filter", re: /gaisa\s*filtr|air\s*filter|luftfilter/i },
  { family: "oil_filter", re: /e[ļl]{1,2}as\s*filtr|oil\s*filter|[öo]lfilter/i },
  { family: "transmission_oil", re: /ātrumkārb|p[aā]rnesumkārb|transmission|gearbox|getriebe/i },
  { family: "spark_plugs", re: /sve[cč]|spark\s*plug|z[üu]ndkerze/i },
  { family: "brake_fluid", re: /brem[žz].{0,12}šķidrum|brake\s*fluid|bremsfl/i },
  { family: "coolant", re: /dzesēšan|coolant|k[üu]hlmittel/i },
  {
    family: "oil_service",
    re: /e[ļl]{1,2}as\s*maiņ|motore[ļl]{1,2}|oil\s*(change|service)|[öo]lwechsel|[öo]lservice|apkope.{0,24}e[ļl]|regul[āa]r[āa]\s*apkope/i,
  },
];

const WORK_STOP_TOKENS = new Set(["ar", "un", "the", "for", "mit", "und", "vai", "no", "and"]);

function serviceWorkFamily(line: string): string | null {
  const t = line.trim();
  if (!t) return null;
  if (isVendorServiceCategoryLine(t.replace(/[:/].*$/, "").trim())) return "oil_service";
  for (const rule of WORK_FAMILY_RULES) {
    if (rule.re.test(t)) return rule.family;
  }
  return null;
}

function workTokens(line: string): Set<string> {
  return new Set(
    line
      .toLocaleLowerCase("lv")
      .replace(/[^a-zāčēģīķļņšūž0-9]+/gi, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !WORK_STOP_TOKENS.has(t)),
  );
}

function workKeepScore(line: string, family: string | null): number {
  const head = line.replace(/[:/].*$/, "").trim();
  if (isVendorServiceCategoryLine(head)) return 0;
  if (family === "oil_service" && /regul[āa]r|apkope/i.test(line) && !/filtr|sve[cč]|brem|ātrum|p[aā]rnesum/i.test(line)) {
    return 1;
  }
  return 2 + Math.min(line.length, 80) / 80;
}

function tokenSetsOverlap(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  if (inter === 0) return false;
  const subset = inter === a.size || inter === b.size;
  const jaccard = inter / (a.size + b.size - inter);
  return subset || jaccard >= 0.6;
}

/**
 * Apvienojot vizītes: pārklājošos darbus (pēc nozīmes) atstāj vienu reizi.
 * Identisks teksts nav vajadzīgs: „Apkope ar eļļas maiņu” un „Regulārā apkope / Eļļas maiņa” ir viens darbs.
 */
export function mergeOverlappingServiceWorkLines(lines: readonly string[]): string[] {
  const cleaned = lines.map((l) => cleanItem(l)).filter(Boolean);
  const kept: string[] = [];
  for (const line of cleaned) {
    const family = serviceWorkFamily(line);
    const tokens = workTokens(line);
    const hit = kept.findIndex((prev) => {
      const prevFamily = serviceWorkFamily(prev);
      if (family && prevFamily) return family === prevFamily;
      if (family || prevFamily) return false;
      return tokenSetsOverlap(tokens, workTokens(prev));
    });
    if (hit < 0) {
      kept.push(line);
      continue;
    }
    const prev = kept[hit]!;
    if (workKeepScore(line, family) > workKeepScore(prev, serviceWorkFamily(prev))) {
      kept[hit] = line;
    }
  }
  return sortWorkLines(kept);
}

/** Ielasīts darbu teksts → rindas (idempotents). */
export function formatServiceWorksLines(raw: string): string {
  const text = stripWorkDecorations(raw);
  if (!text) return "";

  const seeds: string[] = [];
  for (const block of text.split(/\r?\n+/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    for (const piece of splitOemTerminated(trimmed)) {
      seeds.push(...explodeSegment(piece));
    }
  }

  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of seeds) {
    const line = cleanItem(item);
    if (!line) continue;
    const key = line.toLocaleLowerCase("lv");
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(line);
  }

  return sortWorkLines(items).map(capitalizeServiceField).join("\n");
}
