/** Lietotāju darbību žurnāls pa dienām: bez datuma vakardienas 21:45 sajaucās ar šodienas (audits 27.10). */

export type AuditDayGroup<T> = { key: string; label: string; rows: T[] };

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function auditDayLabel(d: Date, now: Date): string {
  const today = dayKey(now);
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const k = dayKey(d);
  if (k === today) return "Šodien";
  if (k === dayKey(y)) return "Vakar";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Saglabā ierakstu secību; nederīgs datums - grupā "Bez datuma". */
export function groupAuditByDay<T extends { createdAt: string | null }>(rows: T[], now = new Date()): AuditDayGroup<T>[] {
  const groups: AuditDayGroup<T>[] = [];
  for (const row of rows) {
    const d = row.createdAt ? new Date(row.createdAt) : null;
    const valid = d && !Number.isNaN(d.getTime());
    const key = valid ? dayKey(d) : "none";
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.rows.push(row);
    else groups.push({ key, label: valid ? auditDayLabel(d, now) : "Bez datuma", rows: [row] });
  }
  return groups;
}

export function auditTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
