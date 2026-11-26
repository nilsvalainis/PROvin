/**
 * Īss apstiprinājums pasūtījumu sarakstā pēc pārejas no pasūtījuma (Nils 26.11: pēc dīlera datu
 * nosūtīšanas lapa pati atgriežas sarakstā). Glabājas tikai šīs cilnes sessionStorage, nolasās vienreiz.
 */

/** Pasūtījumu saraksts (tas pats, kur ved pasūtījuma «Atpakaļ»). */
export const ADMIN_ORDERS_LIST_HREF = "/admin/dashboard";

const KEY = "provin-admin-orders-flash";
const MAX_AGE_MS = 60_000;

export function dealerSentFlashText(vin: string | null | undefined): string {
  const v = (vin ?? "").trim();
  return v ? `Nosūtīts klientam · VIN …${v.slice(-4)}` : "Nosūtīts klientam";
}

export function writeOrdersListFlash(text: string, storage: Pick<Storage, "setItem"> | null = safeSession()): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ text, at: Date.now() }));
  } catch {
    /* privātais režīms - apstiprinājums nav obligāts */
  }
}

export function takeOrdersListFlash(
  storage: Pick<Storage, "getItem" | "removeItem"> | null = safeSession(),
  now = Date.now(),
): string | null {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return null;
    storage?.removeItem(KEY);
    const o = JSON.parse(raw) as { text?: unknown; at?: unknown };
    if (typeof o.text !== "string" || typeof o.at !== "number") return null;
    if (now - o.at > MAX_AGE_MS) return null;
    return o.text;
  } catch {
    return null;
  }
}

function safeSession(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}
