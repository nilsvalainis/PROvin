import { adminRichHtmlToPlainText, aiExpertSourceCommentToRichHtml } from "@/lib/admin-rich-comment-html";
import {
  ccVinBlockHasOperatorData,
  type CcVinBlockState,
} from "@/lib/cc-vin-report";

export const CC_VIN_AUCTION_CHECK_HEADING = "Datu pārbaude izsoļu reģistros";

export const CC_VIN_AUCTION_CHECK_BODY =
  "Šis avots veic specifisku pārbaudi Eiropas un Amerikas izsoļu datubāzēs, lai identificētu iespējamos ierakstus par automašīnas pārdošanu, t.s. pēc smagiem negadījumiem vai pilnīgas bojāejas. Konkrētajai automašīnai mūsu reģistros ieraksti netika atrasti.";

export const CC_VIN_AUCTION_CHECK_PLAIN = `${CC_VIN_AUCTION_CHECK_HEADING}\n${CC_VIN_AUCTION_CHECK_BODY}`;

export function ccVinAuctionCheckCommentHtml(): string {
  return aiExpertSourceCommentToRichHtml(CC_VIN_AUCTION_CHECK_PLAIN);
}

function squishPlain(htmlOrPlain: string): string {
  return adminRichHtmlToPlainText(htmlOrPlain).replace(/\s+/g, " ").trim();
}

export function isCcVinAuctionCheckComment(html: string): boolean {
  const plain = squishPlain(html);
  return Boolean(plain) && plain === squishPlain(CC_VIN_AUCTION_CHECK_PLAIN);
}

export function seedCcVinDefaultComment(block: CcVinBlockState): CcVinBlockState {
  if (ccVinBlockHasOperatorData(block) || block.comments.trim()) return block;
  return { ...block, comments: ccVinAuctionCheckCommentHtml() };
}

export function applyCcVinAuctionCheckTemplate(existingHtml: string): string {
  const html = ccVinAuctionCheckCommentHtml();
  if (isCcVinAuctionCheckComment(existingHtml)) return existingHtml.trim() ? existingHtml : html;
  const plain = adminRichHtmlToPlainText(existingHtml).trim();
  if (!plain) return html;
  return `${existingHtml.trim()}<br /><br />${html}`;
}

/** Jaunā pasūtījumā rāda sagatavi; pirmo datu lauku aizpildot, noklusējuma komentāru noņem. */
export function applyCcVinDefaultCommentPolicy(
  next: CcVinBlockState,
  previous?: CcVinBlockState,
): CcVinBlockState {
  const nextHasData = ccVinBlockHasOperatorData(next);
  const prevHasData = previous ? ccVinBlockHasOperatorData(previous) : false;
  if (nextHasData && isCcVinAuctionCheckComment(next.comments) && !prevHasData) {
    return { ...next, comments: "" };
  }
  return seedCcVinDefaultComment(next);
}
