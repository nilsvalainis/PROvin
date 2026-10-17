/** Klienta puse: saglabā AI izeju sidecar store (TRAINING_V2 API no-op, ja karogs izslēgts). */

import { aiDraftFieldFromAiUrl } from "@/lib/admin-ai-draft-fields";
import { PROVIN_AI_PROMPT_VERSION } from "@/lib/ai-prompt-version";

export function rememberGeneratedAiDraft(url: string, body: unknown, text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  if (!body || typeof body !== "object") return;
  const sessionId =
    typeof (body as { sessionId?: unknown }).sessionId === "string"
      ? (body as { sessionId: string }).sessionId.trim()
      : "";
  const field = aiDraftFieldFromAiUrl(url);
  if (!sessionId || !field) return;
  const modelRaw = (body as { modelTier?: unknown }).modelTier;
  const model = typeof modelRaw === "string" && modelRaw.trim() ? modelRaw.trim() : "unknown";
  void fetch("/api/admin/audit-knowledge", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "recordDraft",
      sessionId,
      field,
      text: trimmed,
      model,
      promptVersion: PROVIN_AI_PROMPT_VERSION,
    }),
  }).catch(() => undefined);
}
