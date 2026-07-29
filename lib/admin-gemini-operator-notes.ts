import "server-only";

/**
 * Papildina Gemini lietotāja promptu ar eksperta piezīmēm un esošo melnrakstu.
 * Operatora komandas iet **pirms** konteksta — citādi milzīgs portfelis tās pārspēj.
 */
export function appendGeminiOperatorNotesSection(
  userPrompt: string,
  options?: {
    operatorNotes?: string | null;
    existingDraftPlain?: string | null;
  },
): string {
  const parts: string[] = [];
  const notes = options?.operatorNotes?.trim();
  if (notes) {
    parts.push(
      [
        "=== OPERATORA KOMANDAS (AUGSTĀKĀ PRIORITĀTE — PRECĪZI IZPILDĪT) ===",
        "Šīs ir admin eksperta tiešās instrukcijas šim ģenerējumam.",
        "Tās OVERWRITE / pārspēj noklusējuma stilu, garumu un satura uzsvaru, ja ir konflikts.",
        "Obligāti: iekļauj pieprasītos faktus, formulējumus un secinājumus; neizlaid un neaizstāj ar vispārīgu tekstu.",
        "Ja komanda liek rakstīt par tehniskajiem riskiem, modeļa vājajām vietām vai konkrētu frāzi — TAS JĀBŪT izejas tekstā.",
        "",
        notes,
        "",
        "=== BEIGAS OPERATORA KOMANDĀM ===",
      ].join("\n"),
    );
  }

  const draft = options?.existingDraftPlain?.trim();
  if (draft) {
    parts.push(
      `=== Esošais melnraksts (jāapvieno ar jauno tekstu — nevis jāatkārto vārds vārdā; operatora komandas virs tā) ===\n${draft}`,
    );
  }

  parts.push(userPrompt.trim());
  return parts.filter(Boolean).join("\n\n");
}

export function strFromBody(v: unknown): string {
  return typeof v === "string" ? v : "";
}
