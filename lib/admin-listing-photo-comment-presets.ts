import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";

export const LISTING_PHOTO_NO_DEFECTS_LABEL = "Nav vizuālo defektu";

/** Nila teksts (22.10): foto bez būtiskiem trūkumiem. ✨ to atgriež bez modeļa izsaukuma. */
export const LISTING_PHOTO_NO_DEFECTS_TEXT =
  "Virspusēji izvērtējot sludinājuma fotogrāfijas, būtiski vizuālie defekti netika novēroti. Redzamas tikai deklarētajam vecumam un nobraukumam pieļaujamas lietošanas pazīmes.";

/** Iepriekšējais pogas teksts - paliek vecajos pasūtījumos (šablonu atpazīšanai). */
export const LISTING_PHOTO_NO_DEFECTS_LEGACY_TEXT =
  "Sludinājuma fotogrāfijās automašīnai netika fiksēti būtiski vizuālie defekti, pārkrāsotas detaļas vai mākslīgi slēpts nolietojums. Stāvoklis kopumā atbilst vecumam un norādītajam nobraukumam. Tomēr apgaismojuma un atspīdumu dēļ krāsas toņu atšķirības un sīkus defektus attālināti nav iespējams objektīvi novērtēt, tāpēc automašīnu nepieciešams rūpīgi pārbaudīt klātienē.";

function squash(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Operators ir atzīmējis „Nav vizuālo defektu” (jaunais vai vecais teksts laukā). */
export function hasListingPhotoNoDefectsMark(plainOrHtml: string): boolean {
  const plain = squash(adminRichHtmlToPlainText(plainOrHtml ?? ""));
  if (!plain) return false;
  return (
    plain.includes(squash(LISTING_PHOTO_NO_DEFECTS_TEXT)) ||
    plain.includes(squash(LISTING_PHOTO_NO_DEFECTS_LEGACY_TEXT))
  );
}

export function applyListingPhotoNoDefectsTemplate(existingHtml: string): string {
  const snippet = LISTING_PHOTO_NO_DEFECTS_TEXT.trim();
  const plain = adminRichHtmlToPlainText(existingHtml).trim();
  if (!snippet) return existingHtml;
  if (!plain) return plainTextToMinimalRichHtml(snippet);
  if (plain.includes(snippet)) return existingHtml;
  const add = plainTextToMinimalRichHtml(snippet);
  const base = existingHtml.trim();
  return base ? `${base}<br /><br />${add}` : add;
}
