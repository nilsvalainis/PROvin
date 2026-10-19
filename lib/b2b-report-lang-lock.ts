import { parseB2bWalletOrderMarks, type B2bWalletReportLang } from "@/lib/b2b-wallet";

export type B2bPdfGenerateLang = B2bWalletReportLang;

/** Partnera izvēlētā atskaites valoda no saglabātajām piezīmēm. Veciem pasūtījumiem: null. */
export function b2bChosenReportLang(notes?: string | null): B2bWalletReportLang | null {
  return parseB2bWalletOrderMarks(notes)?.reportLang ?? null;
}

export function b2bChosenReportLangLabel(notes?: string | null): string | null {
  const lang = b2bChosenReportLang(notes);
  return lang ? lang.toUpperCase() : null;
}

export function confirmUnlockB2bReportLang(preferredLang: B2bWalletReportLang): boolean {
  if (typeof window === "undefined") return false;
  return window.confirm(
    `Partneris pirkumā izvēlējās valodu ${preferredLang.toUpperCase()}. Mainīt valodu šim ģenerējumam?`,
  );
}

/** true = šī valodas poga paliek pelēka, kamēr operators nav atbloķējis. */
export function isB2bPdfLangLocked(args: {
  preferredLang: B2bWalletReportLang | null;
  unlocked: boolean;
  lang: B2bPdfGenerateLang;
}): boolean {
  if (!args.preferredLang || args.unlocked) return false;
  return args.preferredLang !== args.lang;
}
