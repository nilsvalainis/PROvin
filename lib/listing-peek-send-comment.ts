import "server-only";

import { isSmtpConfigured, sendListingPeekCustomerCommentEmail } from "@/lib/email/send-transactional";
import { parseListingPeekSendCommentInput } from "@/lib/listing-peek-send-comment-input";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { getListingPeekById, markListingPeekCommentSent } from "@/lib/listing-peek-store";

export type ListingPeekSendCommentReason = "invalid" | "smtp" | "missing" | "error";

export type ListingPeekSendCommentResult =
  | { ok: true }
  | { ok: false; reason: ListingPeekSendCommentReason };

/** SMTP + Blob atzīme. Bez Stripe / konversijas statistikas. */
export async function sendListingPeekCustomerComment(input: {
  id: string;
  comment: string;
}): Promise<ListingPeekSendCommentResult> {
  const parsed = parseListingPeekSendCommentInput(input);
  if (!parsed.ok) return parsed;
  if (!isSmtpConfigured()) return { ok: false, reason: "smtp" };

  const entry = await getListingPeekById(parsed.id);
  if (!entry?.email || !isValidOrderEmail(entry.email)) {
    return { ok: false, reason: "missing" };
  }

  try {
    await sendListingPeekCustomerCommentEmail({
      to: entry.email,
      comment: parsed.comment,
      listingUrl: entry.listingUrl,
    });
    await markListingPeekCommentSent(parsed.id, parsed.comment);
    return { ok: true };
  } catch (e) {
    console.error("[listing-peek] send comment failed:", e);
    return { ok: false, reason: "error" };
  }
}
