/** Bezmaksas stāvvietas termiņa taimeris (līdz dienas beigām UTC+ lokāli). */

export function logisticsParkingDeadlineTimer(
  untilIso: string,
  now = new Date(),
): { label: string; overdue: boolean; remainingMs: number } {
  const d = untilIso.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { label: "", overdue: false, remainingMs: 0 };
  const end = new Date(`${d}T23:59:59`);
  const remainingMs = end.getTime() - now.getTime();
  if (!Number.isFinite(remainingMs)) return { label: "", overdue: false, remainingMs: 0 };
  if (remainingMs <= 0) return { label: "stāvvietas termiņš beidzies", overdue: true, remainingMs };
  const days = Math.floor(remainingMs / 86_400_000);
  const hours = Math.floor((remainingMs % 86_400_000) / 3_600_000);
  const mins = Math.floor((remainingMs % 3_600_000) / 60_000);
  if (days >= 1) return { label: `vēl ${days} d. ${hours} h`, overdue: false, remainingMs };
  if (hours >= 1) return { label: `vēl ${hours} h ${mins} min`, overdue: false, remainingMs };
  return { label: `vēl ${mins} min`, overdue: false, remainingMs };
}
