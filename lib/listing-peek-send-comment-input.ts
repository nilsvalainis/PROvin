export const LISTING_PEEK_COMMENT_MIN_LEN = 8;

export function parseListingPeekSendCommentInput(raw: {
  id?: unknown;
  comment?: unknown;
}): { ok: true; id: string; comment: string } | { ok: false; reason: "invalid" } {
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const comment = typeof raw.comment === "string" ? raw.comment.trim() : "";
  if (!id || comment.length < LISTING_PEEK_COMMENT_MIN_LEN) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, id, comment };
}
