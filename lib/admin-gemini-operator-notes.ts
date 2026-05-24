import "server-only";

/** Papildina Gemini lietotāja promptu ar eksperta piezīmēm un esošo melnrakstu. */
export function appendGeminiOperatorNotesSection(
  userPrompt: string,
  options?: {
    operatorNotes?: string | null;
    existingDraftPlain?: string | null;
  },
): string {
  const parts = [userPrompt.trim()];
  const draft = options?.existingDraftPlain?.trim();
  if (draft) {
    parts.push(
      `=== Esošais melnraksts (jāapvieno ar jauno tekstu — nevis jāatkārto vārds vārdā) ===\n${draft}`,
    );
  }
  const notes = options?.operatorNotes?.trim();
  if (notes) {
    parts.push(
      `=== Eksperta piezīmes pirms ģenerēšanas (obligāti iekļauj, koriģē un apvieno ar ģenerējamo saturu) ===\n${notes}`,
    );
  }
  return parts.filter(Boolean).join("\n\n");
}

export function strFromBody(v: unknown): string {
  return typeof v === "string" ? v : "";
}
