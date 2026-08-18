import "server-only";

import { AI_OPERATOR_NOTES_EXECUTION_RULES } from "@/lib/source-summary-comment-format";

/**
 * Papildina AI lietotāja promptu ar eksperta piezīmēm un esošo melnrakstu.
 * Operatora komandas iet **pirms** konteksta — citādi milzīgs portfelis tās pārspēj.
 */
export function appendAiOperatorNotesSection(
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
        "=== OPERATORA KOMANDAS (SAISTOŠS DARBA UZDEVUMS — NAV IETEIKUMS) ===",
        "Šis teksts ir no admin lauka „Papildu piezīmes AI”. Tu NEDRĪKSTI izvēlēties, ko apstrādāt un ko nē.",
        "",
        AI_OPERATOR_NOTES_EXECUTION_RULES,
        "",
        "PIRMS rakstīšanas saskaiti KATRU atsevišķo tēmu / norādi / jautājumu / nosaukto mezglu no teksta zemāk. Katrai jābūt izejā. Izlaist kaut vienu = kļūda.",
        "JA operators saka „tikai par…”, „raksti tikai…”, „neraksti par…”, „nepapildi”, „bez …” — raksti TIKAI to. Bez liekām rindām un bez noklusējuma lauka esejas.",
        "Drīksti pārkārtot PROVIN stilā (**bold** ievadi). NEDRĪKSTI izmest faktus, datumus, km, nosaukumus, secinājumus.",
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

/** Kad operators iedod garu tekstu vai jau ir garš melnraksts — izejas maxLen nedrīkst to nogriezt. */
export function aiMaxLenForOperatorNotes(
  operatorNotes: string | null | undefined,
  baseMaxLen = 2400,
  extraText?: string | null,
): number {
  const n = Math.max(operatorNotes?.trim().length ?? 0, extraText?.trim().length ?? 0);
  if (n < 400) return baseMaxLen;
  return Math.min(16_000, Math.max(baseMaxLen, Math.ceil(n * 1.4) + 1200));
}

export function strFromBody(v: unknown): string {
  return typeof v === "string" ? v : "";
}
