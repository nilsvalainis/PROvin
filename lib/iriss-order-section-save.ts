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

/**
 * Pēc saglabāšanas: lauki, ko operators kopš sūtīšanas nav mainījis, ņem no servera atbildes.
 * Serveris pie revīzijas nesakritības apvieno ar citu izmaiņām (klients apstiprina → «Rezervēts»,
 * cita cilne) un atdod jaunu revīziju. Ja cilne paturētu savus vecos laukus ar jauno revīziju,
 * nākamā saglabāšana bez konflikta pārrakstītu apvienoto ierakstu (FABLE F3: statuss + vēsture
 * pazuda). Lauki, kas mainīti sūtīšanas laikā, paliek vietējie. `keepLocalKeys` (piem. offers ar
 * vietējiem bilžu priekšskatījumiem) netiek pārņemti.
 */
export function adoptServerMergedFields<T extends object>(
  current: T,
  savedPayload: T,
  serverRecord: T | null | undefined,
  keepLocalKeys: ReadonlyArray<keyof T> = [],
): T {
  if (!serverRecord) return current;
  const out = { ...current } as Record<string, unknown>;
  const cur = current as Record<string, unknown>;
  const sent = savedPayload as Record<string, unknown>;
  const srv = serverRecord as Record<string, unknown>;
  const keep = new Set<string>(keepLocalKeys.map(String));
  const keys = new Set([...Object.keys(srv), ...Object.keys(sent)]);
  for (const key of keys) {
    if (keep.has(key)) continue;
    if (JSON.stringify(cur[key]) !== JSON.stringify(sent[key])) continue;
    if (key in srv) out[key] = srv[key];
    else delete out[key];
  }
  return out as T;
}
