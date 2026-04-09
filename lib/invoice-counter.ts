import "server-only";

import fs from "fs/promises";
import path from "path";
import { getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";

const COUNTER_FILENAME = "invoice-year-sequence.json";

/**
 * Atomiski palielina gada secības skaitītāju un atgriež nākamo numuru (1…).
 */
export async function nextInvoiceSequenceForYear(year: number): Promise<number> {
  const base = getOrderDraftStorageDir();
  if (!base) {
    throw new Error("invoice_counter_no_storage");
  }
  const fp = path.join(base, COUNTER_FILENAME);
  await fs.mkdir(base, { recursive: true });

  let data: Record<string, number> = {};
  try {
    const raw = await fs.readFile(fp, "utf8");
    const p = JSON.parse(raw) as unknown;
    if (p && typeof p === "object") {
      data = p as Record<string, number>;
    }
  } catch {
    /* jauna datne */
  }

  const key = String(year);
  const next = (data[key] ?? 0) + 1;
  data[key] = next;

  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data), "utf8");
  await fs.rename(tmp, fp);

  return next;
}
