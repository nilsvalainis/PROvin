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
    const substantial = notes.length >= 400;
    parts.push(
      [
        "=== OPERATORA KOMANDAS (AUGSTĀKĀ PRIORITĀTE — PRECĪZI IZPILDĪT) ===",
        "Šīs ir admin eksperta tiešās instrukcijas / materiāls šim ģenerējumam.",
        "Tās OVERWRITE / pārspēj noklusējuma stilu, GARUMU un satura uzsvaru, ja ir konflikts.",
        "",
        "KĀ RĪKOTIES AR OPERATORA TEKSTU:",
        "- Drīksti PĀRKĀRTOT un noformēt PROVIN stilā (rindkopas, **bold** ievadi).",
        "- Drīksti PAPILDINĀT ar īsu kontekstu no pasūtījuma portfeļa, ja tas palīdz.",
        "- NEDRĪKSTI APGRAIZĪT, saspiest „formulā” vai izmest detalizāciju, ko operators iedeva.",
        "- Saglabā konkrētus faktus: datumus, km, servisa nosaukumus, eļļas tipus, intervālu aprēķinus, secinājumus, skaitļus.",
        substantial
          ? "- Šis ir PLAŠS operators materiāls — izejas tekstam jābūt TIKPAT BAGĀTAM (vai bagātākam). Noklusējuma īsais 600–1100 rakstzīmju limits ŠEIT NEATTIECAS."
          : "- Iekļauj pieprasītos faktus un formulējumus; neaizstāj ar vispārīgu tekstu.",
        "Ja komanda liek rakstīt par tehniskajiem riskiem, intervāliem vai konkrētu frāzi — TAS JĀBŪT izejas tekstā.",
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

/** Kad operators iedod garu tekstu — izejas maxLen nedrīkst to nogriezt. */
export function geminiMaxLenForOperatorNotes(
  operatorNotes: string | null | undefined,
  baseMaxLen = 2400,
): number {
  const n = operatorNotes?.trim().length ?? 0;
  if (n < 400) return baseMaxLen;
  return Math.min(14_000, Math.max(baseMaxLen, Math.ceil(n * 1.4) + 1200));
}

export function strFromBody(v: unknown): string {
  return typeof v === "string" ? v : "";
}
