/**
 * Serviss telefona skata (F6, dizains A «Centra +») tīrā loģika: dokumentu secība,
 * nākamais trūkstošais, progresa 0/3 un problēmu foto teksts.
 */
import type { V2ServissInvoiceView, V2ServissView } from "@/lib/iriss-autoparks-v2-serviss";

export type ServissDocKey = "number_check" | "diag" | "invoice";

export const SERVISS_DOC_ORDER: readonly ServissDocKey[] = ["number_check", "diag", "invoice"];

export const SERVISS_DOC_TITLE: Record<ServissDocKey, string> = {
  number_check: "Numuru salīdzināšanas akts",
  diag: "CSDD diagnostika",
  invoice: "Rēķins",
};

export function servissDocReady(
  view: Pick<V2ServissView, "numberCheck" | "diag" | "invoices">,
  key: ServissDocKey,
): boolean {
  if (key === "number_check") return view.numberCheck.files.length > 0;
  if (key === "diag") return view.diag.files.length > 0;
  return view.invoices.length > 0;
}

export function nextMissingServissDoc(
  view: Pick<V2ServissView, "numberCheck" | "diag" | "invoices">,
): ServissDocKey | null {
  return SERVISS_DOC_ORDER.find((key) => !servissDocReady(view, key)) ?? null;
}

export function servissDocProgress(
  view: Pick<V2ServissView, "numberCheck" | "diag" | "invoices">,
): { done: number; total: number } {
  return {
    done: SERVISS_DOC_ORDER.filter((key) => servissDocReady(view, key)).length,
    total: SERVISS_DOC_ORDER.length,
  };
}

export function problemPhotoHint(count: number): string {
  if (count <= 0) return "Bez foto";
  return count === 1 ? "1 foto" : `${count} foto`;
}

export const SERVISS_EMPTY_PROBLEMS_HINT = "Problēmu vēl nav. Foto - pēc izvēles.";

/** Jaunākā rēķina datums un summa kartītes galvenei. */
export function invoiceCardMeta(invoices: readonly V2ServissInvoiceView[]): {
  date: string;
  amountEur: number | null;
  aiAmountEur: number | null;
} {
  const first = invoices[0];
  if (!first) return { date: "", amountEur: null, aiAmountEur: null };
  return {
    date: first.date,
    amountEur: first.amountEur,
    aiAmountEur: first.amountEur == null ? (first.ai?.amountEur ?? null) : null,
  };
}
