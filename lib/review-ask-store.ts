import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  emptyReviewAskDoc,
  enqueueReviewAsk,
  parseReviewAskDoc,
  type ReviewAskDoc,
  type ReviewAskEnqueueInput,
  type ReviewAskEntry,
} from "@/lib/review-ask";

/** Viens dokuments (rinda ir maza: tikai pēdējo ~60 dienu atskaites), atomāri ar `ifMatch`. */
const DOC_KEY = "index";

const store = createJsonDocStore<ReviewAskDoc>({
  blobPrefix: "review-ask/",
  dirName: "review-ask",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseReviewAskDoc,
  empty: emptyReviewAskDoc,
});

export async function readReviewAskDoc(): Promise<ReviewAskDoc> {
  return store.read(DOC_KEY);
}

/** Atomāra dokumenta mutācija. `next` nav = nekas netiek rakstīts. */
export function updateReviewAskDoc<R>(
  mutate: (doc: ReviewAskDoc) => { value: R; next?: ReviewAskDoc },
): Promise<R> {
  return store.update(DOC_KEY, (doc) => mutate(doc));
}

export async function readReviewAskEntry(sessionId: string): Promise<ReviewAskEntry | null> {
  try {
    return (await readReviewAskDoc()).entries[sessionId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Pēc veiksmīgas atskaites sūtīšanas klientam: ieliek pasūtījumu rindā (lūgums nākamajā darba dienā).
 * Kļūda atskaites sūtīšanu neaptur. Atkārtota sūtīšana (labota atskaite) datumu nemaina.
 */
export async function enqueueReviewAskAfterReport(input: ReviewAskEnqueueInput): Promise<boolean> {
  try {
    return await updateReviewAskDoc((doc) => {
      const next = enqueueReviewAsk(doc, input);
      return next ? { value: true, next } : { value: false };
    });
  } catch (e) {
    console.error("[review-ask] enqueue failed", e instanceof Error ? e.message.slice(0, 160) : e);
    return false;
  }
}
