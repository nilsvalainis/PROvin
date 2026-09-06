import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";

export const LISTING_PHOTO_NO_DEFECTS_LABEL = "Nav vizuālo defektu";

export const LISTING_PHOTO_NO_DEFECTS_TEXT =
  "Sludinājuma fotogrāfijās automašīnai netika fiksēti būtiski vizuālie defekti, pārkrāsotas detaļas vai mākslīgi slēpts nolietojums. Stāvoklis kopumā atbilst vecumam un norādītajam nobraukumam. Tomēr apgaismojuma un atspīdumu dēļ krāsas toņu atšķirības un sīkus defektus attālināti nav iespējams objektīvi novērtēt, tāpēc automašīnu nepieciešams rūpīgi pārbaudīt klātienē.";

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
