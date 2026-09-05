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
