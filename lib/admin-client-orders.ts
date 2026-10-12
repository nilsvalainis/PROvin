/**
 * Klienta kartīte: iepriekšējie pasūtījumi pēc tā paša e-pasta (bez sevis), jaunākie augšā.
 * Tīra funkcija sarakstam; darba zonā tos pašus datus dod `buildCustomerHistory`.
 */
export type ClientPrevOrder = { id: string; created: number; vin: string | null; amountTotal: number | null; currency: string | null };

export function normalizeClientEmail(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function previousOrdersByEmail<
  T extends { id: string; created: number; customerEmail?: string | null; vin?: string | null; amountTotal?: number | null; currency?: string | null },
>(targets: T[], pool: T[], max = 10): Map<string, ClientPrevOrder[]> {
  const byEmail = new Map<string, T[]>();
  for (const p of pool) {
    const e = normalizeClientEmail(p.customerEmail);
    if (!e.includes("@")) continue;
    const list = byEmail.get(e) ?? [];
    list.push(p);
    byEmail.set(e, list);
  }
  const out = new Map<string, ClientPrevOrder[]>();
  for (const t of targets) {
    const e = normalizeClientEmail(t.customerEmail);
    const others = (byEmail.get(e) ?? []).filter((p) => p.id !== t.id).sort((a, b) => b.created - a.created);
    if (others.length === 0) continue;
    out.set(
      t.id,
      others.slice(0, max).map((p) => ({
        id: p.id,
        created: p.created,
        vin: p.vin ?? null,
        amountTotal: typeof p.amountTotal === "number" ? p.amountTotal : null,
        currency: p.currency ?? null,
      })),
    );
  }
  return out;
}
