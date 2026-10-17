import { adminRichHtmlToPlainText, plainTextToMinimalRichHtml } from "@/lib/admin-rich-comment-html";

export type SourceCommentTemplate = {
  id: string;
  label: string;
  text: string;
};

/** Kopīgie avotu šabloni. Tikai īsā ASCII defise. */
export const SHARED_SOURCE_COMMENT_TEMPLATES: SourceCommentTemplate[] = [
  {
    id: "not_applicable_lv",
    label: "Nav LV",
    text: "Nav piemērojams - auto nav reģistrēts LV.",
  },
  {
    id: "source_no_data",
    label: "Nav datu",
    text: "Avots nedeva datus.",
  },
];

/** Ievieto šablonu komentāra laukā (rich HTML) - neaizstāj esošo, ja šablons jau ir. */
export function applySourceCommentTemplate(existingHtml: string, templateText: string): string {
  const plain = adminRichHtmlToPlainText(existingHtml).trim();
  const snippet = templateText.trim();
  if (!snippet) return existingHtml;
  if (!plain) return plainTextToMinimalRichHtml(snippet);
  if (plain.includes(snippet)) return existingHtml;
  const add = plainTextToMinimalRichHtml(snippet);
  const base = existingHtml.trim();
  return base ? `${base}<br /><br />${add}` : add;
}
