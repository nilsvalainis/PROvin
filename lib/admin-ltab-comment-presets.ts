import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";
import { SHARED_SOURCE_COMMENT_TEMPLATES } from "@/lib/admin-source-comment-presets";

/** LTAB komentārs, kad nav reģistrētu OCTA atlīdzības pieteikumu LV. */
export const LTAB_COMMENT_NO_OCTA_CLAIM =
  "Automašīnai Latvijā nav reģistrēts neviens OCTA atlīdzības pieteikums.";

export type LtabCommentTemplate = {
  id: string;
  label: string;
  text: string;
};

export const LTAB_COMMENT_TEMPLATES: LtabCommentTemplate[] = [
  {
    id: "no_octa_claim",
    label: "Nav OCTA atlīdzības",
    text: LTAB_COMMENT_NO_OCTA_CLAIM,
  },
  ...SHARED_SOURCE_COMMENT_TEMPLATES,
];

/** Ievieto šablonu komentāra laukā (rich HTML) - neaizstāj esošo, ja šablons jau ir. */
export function applyLtabCommentTemplate(existingHtml: string, templateText: string): string {
  const plain = adminRichHtmlToPlainText(existingHtml).trim();
  const snippet = templateText.trim();
  if (!snippet) return existingHtml;
  if (!plain) return plainTextToMinimalRichHtml(snippet);
  if (plain.includes(snippet)) return existingHtml;
  const add = plainTextToMinimalRichHtml(snippet);
  const base = existingHtml.trim();
  return base ? `${base}<br /><br />${add}` : add;
}
