/**
 * Ģenerēts komentārs, kas nav pabeigts (timeout / max_tokens), bet teksts jau
 * ir apmaksāts. Nedrīkst pazust, un nedrīkst izskatīties pēc veiksmes.
 */
export class AiIncompleteCommentError extends Error {
  readonly partialText: string;
  readonly reason: "timeout" | "max_tokens";
  readonly extra?: Record<string, unknown>;

  constructor(
    partialText: string,
    reason: "timeout" | "max_tokens",
    extra?: Record<string, unknown>,
  ) {
    super("ai_incomplete_comment");
    this.name = "AiIncompleteCommentError";
    this.partialText = partialText.trim();
    this.reason = reason;
    this.extra = extra;
  }
}

export function isAiIncompleteCommentError(e: unknown): e is AiIncompleteCommentError {
  return e instanceof AiIncompleteCommentError;
}

export function throwIfBlankGeneratedComment(text: string): string {
  const t = text.trim();
  if (!t) throw new Error("ai_empty_content");
  return t;
}

export function rethrowNormalizedIncompleteComment(
  e: unknown,
  normalize: (text: string) => string,
): never {
  if (isAiIncompleteCommentError(e)) {
    throw new AiIncompleteCommentError(
      throwIfBlankGeneratedComment(normalize(e.partialText)),
      e.reason,
      e.extra,
    );
  }
  throw e;
}

/** Ja ir kaut daļa teksta — kļūda ar to līdzi; ja nav — tukša atbilde (nauda jau noņemta). */
export function throwIncompleteOrEmptyComment(
  partial: string,
  reason: "timeout" | "max_tokens",
): never {
  const t = partial.trim();
  if (!t) {
    throw new Error(reason === "max_tokens" ? "ai_empty_content_max_tokens" : "ai_empty_content");
  }
  throw new AiIncompleteCommentError(t, reason);
}
