/**
 * PDF teksta slāņa tīrīšana pirms Plan A regex / rindu parsētājiem.
 */
import { normalizePdfExtractedText } from "@/lib/pdf-text-normalize";

/** Atdalītāji → atstarpes/rindas; atdalīt km no pielīdušiem vārdiem (ServiceVisit u.c.). */
export function sanitizePdfTextForParsing(raw: string): string {
  let t = raw.replace(/\u00a0/g, " ");
  t = t.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  t = t.replace(/\|/g, " ");
  t = t.replace(/\t+/g, " ");
  t = t.replace(/[•·▪◦]/g, " ");
  t = t.replace(/km([A-Za-z])/gi, "km $1");
  t = t.replace(/([A-Za-z])(\d{1,3}(?:[,.]\d{3})*\s*km\b)/gi, "$1 $2");
  t = t.replace(/(\d)(ServiceVisit)/gi, "$1 $2");
  t = t.replace(/(ServiceVisit)(\d)/gi, "$1 $2");
  t = t.replace(/(\d{1,3}(?:[,.]\d{3})*)(ServiceVisit)/gi, "$1 $2");
  t = t.replace(/ {2,}/g, " ");
  t = t.replace(/\n{3,}/g, "\n\n");
  return normalizePdfExtractedText(t);
}
