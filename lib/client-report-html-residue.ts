/**
 * Pēc statiskās vārdnīcas HTML vēl satur pasūtījuma datus latviski
 * (CSDD defekti, laikposma kartītes, valstu nosaukumi, "18 ieraksti").
 * Šis modulis atrod teksta mezglus, kuros vēl ir latviešu valoda, un
 * ieliek tulkojumu atpakaļ tikai šajos mezglos. `<script>` un `<style>` netiek aiztikti.
 */

const LV_DIACRITIC = /[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/;

/** Vārdi bez garumzīmēm, kas PDF paliek latviski (skaitļa formas, "nav ierakstu"). */
const LV_PLAIN_WORD =
  /\b(ieraksts|ieraksti|ierakstu|ierakstiem|diena|dienas|dienu|dienā|nav|latvija|latvijā|vācija|vācijā|benzīns|dīzelis|uzskaitē|nobraukums|apskate|īpašnieks|īpašnieki|reģistrācija|vizīte|vizītes|pārbaudīts|pamatpārbaude|atkārtota|novērtējums|trūkumi|bojājumi|korozija|sludinājums|grafika|apdrošināts|transportlīdzeklis|numura|zīme|izlaiduma|laikā)\b/i;

const PROTECTED_REGION = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

export function htmlTextNeedsTranslation(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length < 2) return false;
  if (/^[\d\s.,:€$%+\-/()]+$/.test(t)) return false;
  if (/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(t.replace(/\s/g, ""))) return false;
  if (LV_DIACRITIC.test(t)) return true;
  return LV_PLAIN_WORD.test(t);
}

export function maskHtmlProtectedRegions(html: string): { html: string; blocks: string[] } {
  const blocks: string[] = [];
  const masked = html.replace(PROTECTED_REGION, (block) => {
    const token = `%%PROTECT_${blocks.length}%%`;
    blocks.push(block);
    return token;
  });
  return { html: masked, blocks };
}

export function unmaskHtmlProtectedRegions(html: string, blocks: string[]): string {
  return html.replace(/%%PROTECT_(\d+)%%/g, (_, index: string) => blocks[Number(index)] ?? "");
}

function decodeHtmlText(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function humanDashes(value: string): string {
  return value.replace(/\u2014/g, "-").replace(/\u2013/g, "-");
}

/** Unikālie teksta mezgli, kuros vēl ir latviešu valoda. Atslēga ir dekodētais teksts. */
export function collectHtmlTextsNeedingTranslation(html: string): string[] {
  const seen = new Set<string>();
  const re = />([^<]+)</g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const decoded = decodeHtmlText(match[1].trim());
    if (!decoded || !htmlTextNeedsTranslation(decoded)) continue;
    seen.add(decoded);
  }
  return [...seen];
}

/** Aizvieto tikai tos teksta mezglus, kuru pilnais (trim) saturs ir tulkojuma kartē. */
export function applyHtmlTextTranslations(html: string, translations: Record<string, string>): string {
  return html.replace(/>([^<]+)</g, (full, raw: string) => {
    const decoded = decodeHtmlText(raw.trim());
    const translated = translations[decoded];
    if (!translated || translated.trim() === decoded) return full;
    const lead = raw.match(/^\s*/)?.[0] ?? "";
    const trail = raw.match(/\s*$/)?.[0] ?? "";
    return `>${lead}${escapeHtmlText(humanDashes(translated.trim()))}${trail}<`;
  });
}
