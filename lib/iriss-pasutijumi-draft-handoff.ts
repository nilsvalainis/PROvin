/**
 * Jauns pasūtījums: pēc pirmās automātiskās saglabāšanas /new lapa pāriet uz /pasutijumi/{id}.
 * Tā ir cita lapa - redaktors tiek uzstādīts no jauna ar servera kopiju, un viss, kas ierakstīts
 * saglabāšanas laikā («Toyota» → «To»), pazustu. Pirms vecā redaktora noņemšanas tā pēdējais
 * stāvoklis un fokusētais lauks tiek nodoti jaunajam caur sessionStorage.
 */

export const IRISS_DRAFT_HANDOFF_PREFIX = "iriss-draft-handoff:";
export const IRISS_DRAFT_HANDOFF_TTL_MS = 60_000;

export type IrissDraftHandoffFocus = {
  /** Lauka etiķete (label teksts vai aria-label). */
  label: string;
  selectionStart: number | null;
  selectionEnd: number | null;
};

export type IrissDraftHandoff<T> = {
  rec: T;
  focus: IrissDraftHandoffFocus | null;
};

type HandoffStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function writeIrissDraftHandoff<T>(
  storage: HandoffStorage,
  id: string,
  rec: T,
  focus: IrissDraftHandoffFocus | null,
  now: number,
): void {
  if (!id) return;
  try {
    storage.setItem(IRISS_DRAFT_HANDOFF_PREFIX + id, JSON.stringify({ at: now, rec, focus }));
  } catch {
    /* pilna krātuve / privātais režīms - nodošana nav obligāta */
  }
}

/** Nolasa un uzreiz izdzēš nodošanu; novecojusi (> TTL) vai bojāta tiek ignorēta. */
export function takeIrissDraftHandoff<T extends { id: string }>(
  storage: HandoffStorage,
  id: string,
  now: number,
): IrissDraftHandoff<T> | null {
  if (!id) return null;
  const key = IRISS_DRAFT_HANDOFF_PREFIX + id;
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
    if (raw !== null) storage.removeItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { at?: unknown; rec?: unknown; focus?: unknown };
    if (typeof parsed.at !== "number" || now - parsed.at > IRISS_DRAFT_HANDOFF_TTL_MS || now < parsed.at - 5_000) {
      return null;
    }
    const rec = parsed.rec as T | undefined;
    if (!rec || typeof rec !== "object" || rec.id !== id) return null;
    const f = parsed.focus as Partial<IrissDraftHandoffFocus> | null | undefined;
    const focus =
      f && typeof f === "object" && typeof f.label === "string" && f.label.trim()
        ? {
            label: f.label,
            selectionStart: typeof f.selectionStart === "number" ? f.selectionStart : null,
            selectionEnd: typeof f.selectionEnd === "number" ? f.selectionEnd : null,
          }
        : null;
    return { rec, focus };
  } catch {
    return null;
  }
}

type FocusableField = {
  getAttribute(name: string): string | null;
  closest(selector: string): { textContent: string | null } | null;
};

/** Lauka etiķete fokusa atjaunošanai: aria-label, citādi ietverošā label teksts. */
export function irissDraftFieldLabel(el: FocusableField | null | undefined): string {
  if (!el) return "";
  const aria = el.getAttribute("aria-label")?.trim();
  if (aria) return aria;
  return el.closest("label")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
