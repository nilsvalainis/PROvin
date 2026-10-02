import { adminRichHtmlToPlainText, aiExpertSourceCommentToRichHtml } from "@/lib/admin-rich-comment-html";

export const CSDD_COMMENT_EUCARIS_HEADING_AVAILABILITY = "Datu pieejamība un EUCARIS sistēma";
export const CSDD_COMMENT_EUCARIS_HEADING_DOCS = "Dokumentu pārbaude";

export const CSDD_COMMENT_EUCARIS_BODY_AVAILABILITY =
  "Automašīna pašlaik nav reģistrēta Latvijā, tādēļ CSDD publiskajā datubāzē nav fiksēta vietējā tehnisko apskašu vēsture vai odometra rādījumi. Unikālie dati no EUCARIS (European Car and Driving Licence Information System) par pēdējām tehniskajām apskatēm Vācijā un tur fiksēto nobraukumu kļūs pieejami tikai pēc automašīnas agregātu numuru salīdzināšanas Latvijā.";

export const CSDD_COMMENT_EUCARIS_BODY_DOCS =
  "Tā kā dīlera datubāzē pēdējo gadu servisa ieraksti nav fiksēti, pircējam jālūdz pārdevējam uzrādīt fiziskus Vācijas tehnisko apskašu (HU/AU) protokolus un pēdējo gadu apkopes dokumentus. Šie dokumenti ir vienīgais veids, kā verificēt nobraukuma hronoloģiju un veiktos darbus periodā, kas nav atspoguļots digitālajos reģistros.";

export const CSDD_COMMENT_EUCARIS_PLAIN = [
  CSDD_COMMENT_EUCARIS_HEADING_AVAILABILITY,
  CSDD_COMMENT_EUCARIS_BODY_AVAILABILITY,
  "",
  CSDD_COMMENT_EUCARIS_HEADING_DOCS,
  CSDD_COMMENT_EUCARIS_BODY_DOCS,
].join("\n");

export type CsddCommentTemplate = {
  id: string;
  label: string;
  text: string;
};

export const CSDD_COMMENT_TEMPLATES: CsddCommentTemplate[] = [
  {
    id: "eucaris",
    label: "EUCARIS",
    text: CSDD_COMMENT_EUCARIS_PLAIN,
  },
];

export function csddEucarisCommentHtml(): string {
  return aiExpertSourceCommentToRichHtml(CSDD_COMMENT_EUCARIS_PLAIN);
}

/** Ievieto šablonu komentāra laukā (rich HTML) - neaizstāj esošo, ja šablons jau ir. */
export function applyCsddCommentTemplate(existingHtml: string, templateText: string): string {
  const plain = adminRichHtmlToPlainText(existingHtml).trim();
  const snippet = templateText.trim();
  if (!snippet) return existingHtml;
  const html = aiExpertSourceCommentToRichHtml(snippet);
  if (!plain) return html;
  if (plain.includes(adminRichHtmlToPlainText(html).trim()) || plain.includes(snippet)) {
    return existingHtml;
  }
  const base = existingHtml.trim();
  return base ? `${base}<br /><br />${html}` : html;
}
