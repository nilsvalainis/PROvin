/** Žetona skaitlis. Objekts, NaN vai tukšs lauks paliek 0, nevis React bērns. */
export function finiteBadgeCount(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
}
