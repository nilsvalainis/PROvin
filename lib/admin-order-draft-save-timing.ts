/**
 * Admin pasūtījuma servera saglabāšanas debounce (ms).
 * Klients: `NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS` (noklus. 2500, min 800, max 30000).
 */
export function orderDraftServerSaveDebounceMs(): number {
  const raw =
    typeof process !== "undefined"
      ? (process.env.NEXT_PUBLIC_ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS ??
          process.env.ADMIN_ORDER_DRAFT_SAVE_DEBOUNCE_MS ??
          "2500")
      : "2500";
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 2500;
  return Math.min(30_000, Math.max(800, n));
}

/** Post-write read-back verifikācija — izlaižama tikai skaidram `autosave`. */
export function orderDraftPersistRequiresVerify(persistContext: string | undefined): boolean {
  return persistContext !== "autosave";
}
