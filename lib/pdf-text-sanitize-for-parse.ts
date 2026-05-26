/**
 * PDF teksta slāņa tīrīšana pirms Plan A regex / rindu parsētājiem.
 * NEizmanto normalizePdfExtractedText digit-space collapse — tas bojā "2024-03-25 281,218".
 */
export function sanitizePdfTextForParsing(raw: string): string {
  let t = raw.replace(/\u00a0/g, " ");
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/\|/g, " ");
  t = t.replace(/\t+/g, " ");
  t = t.replace(/[•·▪◦]/g, " ");
  t = t.replace(/km([A-Za-z])/gi, "km $1");
  t = t.replace(/([A-Za-z])(\d{1,3}(?:[,.]\d{3})*\s*km\b)/gi, "$1 $2");
  t = t.replace(/(\d)(Service\s*Visit)/gi, "$1 $2");
  t = t.replace(/(Service\s*Visit)(\d)/gi, "$1 $2");
  t = t.replace(/(\d{1,3}(?:[,.]\d{3})*)(Service\s*Visit)/gi, "$1 $2");
  t = t.replace(/ {2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return t;
}
