/**
 * Viena statiska krāsas biezuma norma PDF / ieteikumiem.
 * AI šo lekciju neģenerē no jauna; injicē renderēšanas laikā.
 */
export const PAINT_GAUGE_STATIC_HEADING = "Virsbūves stāvoklis un krāsas biezums";

export const PAINT_GAUGE_STATIC_PARAGRAPH =
  "Digitālie dati var neuzrādīt krāsotus elementus, ja darbi veikti neatkarīgā servisā vai mēģinot noslēpt sīkus defektus. Virsbūve jāpārbauda klātienē ar krāsas biezuma mērītāju. Ārējiem paneļiem rūpnīcas rādījums parasti ir ap 100 līdz 150 µm. Visiem paneļiem jābūt ar līdzīgiem mērījumiem. Starpība no 50 līdz 150 µm starp blakus esošajiem elementiem var norādīt uz kosmētisku pārkrāsošanu. Iekšējās ailes un konstrukcijas elementi parasti uzrāda aptuveni uz pusi mazāku mikronu skaitu, kas ir normāli un liecina par rūpnīcas krāsojumu, nevis remonta pēdām.";

export const PAINT_GAUGE_STATIC_PLAIN = `${PAINT_GAUGE_STATIC_HEADING}\n${PAINT_GAUGE_STATIC_PARAGRAPH}`;

export const PAINT_GAUGE_STATIC_HTML = `<p><strong>${PAINT_GAUGE_STATIC_HEADING}</strong></p><p>${PAINT_GAUGE_STATIC_PARAGRAPH}</p>`;

const PAINT_HEADING_RE = /virsbūves\s+stāvoklis\s+un\s+krāsas\s+biezums/i;
const PAINT_LECTURE_RE =
  /krāsas\s+biezuma\s+mērītāj|100\s+līdz\s+150\s*(?:µm|μm|mikron)|50\s+līdz\s+150\s*(?:µm|μm|mikron)|iekšējās\s+ailes/i;

function isHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/** Noņem iepriekšējo krāsas lekciju (dažādi mikronu diapazoni) un ieliek vienu kanonu. */
export function applyPaintGaugeStaticBlock(text: string): string {
  const raw = text ?? "";
  if (isHtml(raw)) {
    let html = raw;
    html = html.replace(
      /<(?:p|h[1-6]|div)[^>]*>\s*(?:<strong>)?\s*Virsbūves\s+stāvoklis\s+un\s+krāsas\s+biezums\s*(?:<\/strong>)?\s*<\/(?:p|h[1-6]|div)>[\s\S]*?(?=<(?:p|h[1-6]|div)[^>]*>\s*(?:<strong>)?|$)/i,
      "",
    );
    html = html.replace(
      /<(?:p|div)[^>]*>[^<]*(?:krāsas\s+biezuma\s+mērītāj|100\s+līdz\s+\d{2,3}\s*(?:µm|μm|mikron))[\s\S]*?<\/(?:p|div)>/gi,
      "",
    );
    const trimmed = html.replace(/(<br\s*\/?>\s*)+$/i, "").trim();
    if (PAINT_HEADING_RE.test(trimmed) && PAINT_LECTURE_RE.test(trimmed) && /100 līdz 150/.test(trimmed) && /50 līdz 150/.test(trimmed)) {
      return trimmed;
    }
    return trimmed ? `${trimmed}${PAINT_GAUGE_STATIC_HTML}` : PAINT_GAUGE_STATIC_HTML;
  }

  const lines = raw.split(/\n/);
  const kept: string[] = [];
  let skip = false;
  for (const line of lines) {
    if (PAINT_HEADING_RE.test(line)) {
      skip = true;
      continue;
    }
    if (skip) {
      if (line.trim() === "") {
        skip = false;
        continue;
      }
      if (PAINT_LECTURE_RE.test(line) || /µm|μm|mikron/i.test(line)) continue;
      skip = false;
    }
    if (PAINT_LECTURE_RE.test(line) && /µm|μm|mikron/i.test(line)) continue;
    kept.push(line);
  }
  const body = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return body ? `${body}\n\n${PAINT_GAUGE_STATIC_PLAIN}` : PAINT_GAUGE_STATIC_PLAIN;
}
