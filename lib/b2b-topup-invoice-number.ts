import "server-only";

import {
  isOrderDraftStorageDurable,
  readOrderDraft,
  upsertOrderDraftInvoiceFields,
} from "@/lib/admin-order-draft-store";
import { fallbackB2bTopupInvoiceNumber, formatIrsInvoiceNumber } from "@/lib/b2b-topup-invoice";
import { nextInvoiceSequenceForYear } from "@/lib/invoice-counter";

export const B2B_TOPUP_INVOICE_COUNTER_FILENAME = "b2b-topup-invoice-year-sequence.json";

/**
 * Vienreiz piešķir IRS-YYYY-XXXX (vai patur jau saglabāto numuru).
 */
export async function getOrCreateB2bTopupInvoiceNumber(sessionId: string, created: number): Promise<string> {
  const draft = await readOrderDraft(sessionId);
  if (draft?.invoiceNumber) return draft.invoiceNumber;

  if (!isOrderDraftStorageDurable()) {
    return fallbackB2bTopupInvoiceNumber(sessionId, created);
  }

  const year = new Date(created * 1000).getFullYear();
  let seq: number;
  try {
    seq = await nextInvoiceSequenceForYear(year, B2B_TOPUP_INVOICE_COUNTER_FILENAME);
  } catch {
    return fallbackB2bTopupInvoiceNumber(sessionId, created);
  }

  const num = formatIrsInvoiceNumber(year, seq);
  const res = await upsertOrderDraftInvoiceFields(sessionId, { invoiceNumber: num });
  if (!res.ok) return fallbackB2bTopupInvoiceNumber(sessionId, created);
  return num;
}
