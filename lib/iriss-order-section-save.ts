export type IrissSectionSaveStatus = "idle" | "saving" | "saved" | "error";

export type IrissOrderSaveResult = { ok: true } | { ok: false; error: string };

export function irissSectionSaveButtonLabel(status: IrissSectionSaveStatus): string {
  return status === "saving" ? "Saglabā…" : "Saglabāt";
}

export function irissSectionSaveInlineText(
  status: IrissSectionSaveStatus,
  error?: string | null,
): string | null {
  if (status === "saving") return "Saglabā…";
  if (status === "saved") return "✓ Saglabāts";
  if (status === "error") {
    const msg = error?.trim();
    return msg && msg.length > 0 ? msg : "Kļūda saglabājot.";
  }
  return null;
}

/**
 * Manual save sends the whole order. If the operator edited another section
 * while PATCH was in flight, keep the newer local state instead of applying
 * the server record (which would drop those keystrokes).
 */
export function pickRecordAfterOrderSave<T>(current: T, savedPayload: T, serverRecord: T | null): T {
  if (JSON.stringify(current) !== JSON.stringify(savedPayload)) return current;
  return serverRecord ?? current;
}
