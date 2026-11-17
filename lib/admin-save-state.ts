/**
 * Vienots saglabāšanas stāvoklis visam admin: viena poga rāda visu (nav saglabāts → saglabā → saglabāts / kļūda).
 */
export type AdminSaveState = "idle" | "saving" | "saved" | "error";

/** Cik ilgi rāda "Saglabāts", pirms poga atgriežas mierīgā stāvoklī. */
export const ADMIN_SAVED_FLASH_MS = 1800;

export function adminSaveLabel(state: AdminSaveState, dirty: boolean, idleLabel = "Saglabāt"): string {
  if (state === "saving") return "Saglabā…";
  if (state === "saved") return "Saglabāts";
  if (state === "error") return "Mēģināt vēlreiz";
  return dirty ? idleLabel : idleLabel;
}

/** ⌘S / Ctrl+S (bez Shift/Alt), arī ievades laukā. */
export function isAdminSaveShortcut(e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s";
}
