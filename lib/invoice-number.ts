import "server-only";

import {
  getOrderDraftStorageDir,
  readOrderDraft,
  upsertOrderDraftInvoiceFields,
} from "@/lib/admin-order-draft-store";
import { nextInvoiceSequenceForYear } from "@/lib/invoice-counter";

/** Deterministisks numurs, ja nav JSON glabātuves (Vercel u.c.). */
export function fallbackInvoiceNumber(sessionId: string, created: number): string {
  const year = new Date(created * 1000).getFullYear();
  let h = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = ((h >>> 0) % 10000).toString().padStart(4, "0");
  return `PRV-${year}-${n}`;
}

/**
 * Vienreiz piešķir PRV-YYYY-XXXX un saglabā pasūtījuma JSON, ja glabātuve pieejama.
 * Ja glabātuves nav — atgriež deterministisku numuru (tas pats sesijai).
 */
export async function getOrCreateInvoiceNumber(sessionId: string, created: number): Promise<string> {
  const draft = await readOrderDraft(sessionId);
  if (draft?.invoiceNumber) return draft.invoiceNumber;

  if (!getOrderDraftStorageDir()) {
    return fallbackInvoiceNumber(sessionId, created);
  }

  const year = new Date(created * 1000).getFullYear();
  let seq: number;
  try {
    seq = await nextInvoiceSequenceForYear(year);
  } catch {
    return fallbackInvoiceNumber(sessionId, created);
  }

  const num = `PRV-${year}-${String(seq).padStart(4, "0")}`;
  const res = await upsertOrderDraftInvoiceFields(sessionId, { invoiceNumber: num });
  if (!res.ok) {
    return fallbackInvoiceNumber(sessionId, created);
  }
  return num;
}
