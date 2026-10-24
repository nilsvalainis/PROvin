/**
 * Formas melnraksta glabāšana (localStorage): drošības tīkls, lai ievadītie dati nepazūd, ja
 * logs aizveras nejauši, pārlādējas lapa vai aizveras cilne, pirms lietotājs spiedis "Saglabāt".
 * Krātuve ir injicējama (nevis tieši `window.localStorage`), lai šo loģiku var testēt bez DOM.
 */
export type FormDraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type FormDraftEnvelope<T> = {
  savedAt: string;
  data: T;
};

export function saveFormDraft<T>(storage: FormDraftStorage, key: string, data: T, nowIso = new Date().toISOString()): void {
  try {
    storage.setItem(key, JSON.stringify({ savedAt: nowIso, data } satisfies FormDraftEnvelope<T>));
  } catch {
    // Krātuve pilna vai nepieejama (privātais režīms) - melnraksts vienkārši nesaglabājas.
  }
}

export function loadFormDraft<T>(storage: FormDraftStorage, key: string): FormDraftEnvelope<T> | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("data" in parsed) || !("savedAt" in parsed)) return null;
    return parsed as FormDraftEnvelope<T>;
  } catch {
    return null;
  }
}

export function clearFormDraft(storage: FormDraftStorage, key: string): void {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}
