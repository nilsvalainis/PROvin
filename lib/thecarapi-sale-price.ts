/**
 * Izsoles noslēguma cena no TheCarApi ieraksta (viena patiesība visiem produktiem).
 *
 * Openlane piemērs (VXEVFAHKKM7805359, 01.10.2026): `current_price` solījumi 4 100 → 7 300, `final_price` = 7 300
 * (uzvarējušais solījums), bet `current_final` / `public_price_eur` = 11 168 un mainās NEATKARĪGI no solījumiem
 * (7 214 → 7 934 → 11 168) - tā ir portāla publiskā cena ar papildu izmaksām, nevis noslēguma cena.
 * Tāpēc: `final_price` > `public_price_eur` > `current_final` > `current_price` > `start_price`.
 * Ja `final_price` ir citā valūtā (`currency_code_id` nav EUR), EUR vērtība ir `public_price_eur`.
 * Atšķirīgu publisko cenu klienta PDF nerāda - to rāda tikai adminā kā pretrunu (`conflict`).
 */

export type ThecarapiSalePrice = {
  /** Noslēguma cena EUR (vai null). */
  eur: number | null;
  /** Avota lauks, no kura ņemta `eur`. */
  source: string;
  /** Publiskā cena EUR, ja tā atšķiras no `eur` (tikai adminam). */
  publicEur: number | null;
  /** Admin teksts par pretrunu vai "". */
  conflict: string;
};

function toNum(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.replace(/[\s  ]/g, "").replace(/EUR|€/gi, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function groupInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** `get(key)` - lauka vērtība (raw rinda vai admin lauku saraksts). */
export function thecarapiSalePrice(get: (key: string) => unknown): ThecarapiSalePrice {
  const currency = String(get("currency_code_id") ?? "").trim().toUpperCase();
  const nativeOk = !currency || currency === "EUR";
  const finalP = nativeOk ? toNum(get("final_price")) : null;
  const publicP = toNum(get("public_price_eur"));
  const currentFinal = nativeOk ? toNum(get("current_final")) : null;
  const order: [string, number | null][] = [
    ["final_price", finalP],
    ["public_price_eur", publicP],
    ["current_final", currentFinal],
    ["current_price", nativeOk ? toNum(get("current_price")) : null],
    ["start_price", nativeOk ? toNum(get("start_price")) : null],
  ];
  const hit = order.find(([, n]) => n != null);
  const eur = hit?.[1] ?? null;
  const source = hit?.[0] ?? "";
  const pub = publicP ?? currentFinal;
  const differs = eur != null && pub != null && source === "final_price" && Math.round(pub) !== Math.round(eur);
  return {
    eur,
    source,
    publicEur: differs ? pub : null,
    conflict: differs
      ? `Publiskā cena ${groupInt(pub!)} € (public_price_eur/current_final) atšķiras no noslēguma cenas ${groupInt(eur!)} € (final_price, pēdējais solījums). Klienta PDF rāda tikai noslēguma cenu.`
      : "",
  };
}

/** Admin lauku sarakstam (`ThecarapiAdminRecord.fields`). */
export function thecarapiSalePriceFromFields(fields: readonly { key: string; value: string }[]): ThecarapiSalePrice {
  const map = new Map<string, string>();
  for (const f of fields) if (!map.has(f.key) && f.value.trim()) map.set(f.key, f.value);
  return thecarapiSalePrice((k) => map.get(k));
}

type SaleRowLike = { venue: string; price: string; status: string };
type RecordLike = { site: string; id: string; venue: string; fields: readonly { key: string; value: string }[] };

/**
 * Agrāk importētās izsoļu pārdošanas rindas glabā publisko cenu (piem. 11 168 EUR) noslēguma cenas vietā.
 * PDF renderī (bez prod datu maiņas) rindas cenu ņem no atbilstošā izsoles ieraksta (`status` = «Venue · id»).
 */
export function salesWithAuctionFinalPrice<T extends SaleRowLike>(sales: readonly T[], records: readonly RecordLike[] | null | undefined): T[] {
  if (!records?.length) return [...sales];
  return sales.map((row) => {
    const rec = records.find((r) => r.id && row.status.split(" · ").map((x) => x.trim()).includes(r.id));
    if (!rec) return row;
    const eur = thecarapiSalePriceFromFields(rec.fields).eur;
    return eur != null ? { ...row, price: `${groupInt(eur)} EUR` } : row;
  });
}
