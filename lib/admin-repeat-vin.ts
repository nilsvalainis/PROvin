import { vehicleKeys } from "@/lib/quick-eval-match";

/**
 * „Atkārtots VIN” (obligāts): katram darbam — cik citos darbos (iepriekšējie pasūtījumi, ātrie vērtējumi)
 * ir tas pats VIN. Tīra funkcija sarakstam; detalizēto sarakstu ar datiem dod `findVinHistory`.
 */
export function countRepeatVins(
  targets: { id: string; vins: Array<string | null | undefined> }[],
  pool: { id: string; vins: Array<string | null | undefined> }[],
): Map<string, number> {
  const byKey = new Map<string, Set<string>>();
  for (const p of pool) {
    for (const k of vehicleKeys(...p.vins)) {
      const set = byKey.get(k) ?? new Set<string>();
      set.add(p.id);
      byKey.set(k, set);
    }
  }
  const out = new Map<string, number>();
  for (const t of targets) {
    const others = new Set<string>();
    for (const k of vehicleKeys(...t.vins)) for (const id of byKey.get(k) ?? []) if (id !== t.id) others.add(id);
    if (others.size > 0) out.set(t.id, others.size);
  }
  return out;
}
