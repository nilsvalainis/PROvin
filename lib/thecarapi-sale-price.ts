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
  /** Klientam rādāmā cena EUR (vai null). */
  eur: number | null;
  /** Etiķete pēc lauka nozīmes: «Pēdējais solījums», «Noslēguma cena» vai «Portāla publiskā cena». */
  label: string;
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
  const s = raw.replace(/[\s\u00a0\u202f]/g, "").replace(/EUR|€/gi, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function groupInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export const THECARAPI_LAST_BID_LABEL = "Pēdējais solījums";

/**
 * `get(key)` - lauka vērtība (raw rinda vai admin lauku saraksts).
 * Kārtība: `final_price` (ja = `current_price` → «Pēdējais solījums», citādi «Noslēguma cena») > `current_price`
 * («Pēdējais solījums») > publiskā cena (tikai, ja nekā cita nav). Publisko cenu, kas atšķiras no solījuma, klientam
 * nerāda: tās nozīmi (maksas/PVN/transports) avots nedokumentē - 2 Openlane loti arhīvā 23.11 dod dažādu attiecību
 * (7 300 → 11 168, 8 700 → 13 070), tāpēc tā paliek tikai adminā kā pretruna.
 */
export function thecarapiSalePrice(get: (key: string) => unknown): ThecarapiSalePrice {
  const currency = String(get("currency_code_id") ?? "").trim().toUpperCase();
  const nativeOk = !currency || currency === "EUR";
  const finalP = nativeOk ? toNum(get("final_price")) : null;
  const current = nativeOk ? toNum(get("current_price")) : null;
  const pub = toNum(get("public_price_eur")) ?? (nativeOk ? toNum(get("current_final")) : null);
  let eur: number | null = null;
  let source = "";
  let label = "";
  if (finalP != null) {
    eur = finalP;
    source = "final_price";
    label = current != null && Math.round(current) === Math.round(finalP) ? THECARAPI_LAST_BID_LABEL : "Noslēguma cena";
  } else if (current != null) {
    eur = current;
    source = "current_price";
    label = THECARAPI_LAST_BID_LABEL;
  } else if (pub != null) {
    eur = pub;
    source = "public_price_eur";
    label = "Portāla publiskā cena";
  }
  const differs = eur != null && pub != null && source !== "public_price_eur" && Math.round(pub) !== Math.round(eur);
  return {
    eur,
    label,
    source,
    publicEur: differs ? pub : null,
    conflict: differs
      ? `Publiskā cena ${groupInt(pub!)} € (public_price_eur/current_final) atšķiras no ${label.toLowerCase()} ${groupInt(eur!)} € (${source}). Nozīme nav dokumentēta - klienta PDF to nerāda.`
      : "",
  };
}

/** Admin lauku sarakstam (`ThecarapiAdminRecord.fields`). */
export function thecarapiSalePriceFromFields(fields: readonly { key: string; value: string }[]): ThecarapiSalePrice {
  const map = new Map<string, string>();
  for (const f of fields) if (!map.has(f.key) && f.value.trim()) map.set(f.key, f.value);
  return thecarapiSalePrice((k) => map.get(k));
}

type SaleRowLike = { venue: string; price: string; status: string; priceLabel?: string };
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
    const sp = thecarapiSalePriceFromFields(rec.fields);
    // «Statuss» - īsts rezultāts, nevis «Openlane · ID» (audits 23.11, p. 31).
    const status = thecarapiSaleStatus(rec.fields);
    return sp.eur != null ? { ...row, price: `${groupInt(sp.eur)} EUR`, priceLabel: sp.label, status } : { ...row, status };
  });
}

/**
 * Izsoles rezultāts tikai no skaidra avota lauka: «Pārdots» / «Nav pārdots»; citādi «Izsole noslēgusies»
 * (neaktīva) vai «Izsole». Pēdējais solījums pats par sevi nepierāda pārdošanu.
 */
export function thecarapiSaleStatus(fields: readonly { key: string; value: string }[]): string {
  const tail = (k: string) => k.split(".").pop()!.replace(/\[\d+\]$/, "").toLowerCase().replace(/[^a-z]/g, "");
  let active: boolean | null = null;
  for (const f of fields) {
    if (/price_history\[/.test(f.key)) continue;
    const t = tail(f.key);
    const v = f.value.trim().toLowerCase();
    if (!v) continue;
    if (t === "issold" || t === "sold") {
      if (/^(jā|yes|true|1)$/.test(v)) return "Pārdots";
      if (/^(nē|no|false|0)$/.test(v)) return "Nav pārdots";
    }
    if (t === "salestatus" || t === "salestatusname" || t === "lotstatus" || t === "auctionstatus") {
      if (/not\s*sold|unsold|no\s*sale|nav\s+pārdots/.test(v)) return "Nav pārdots";
      if (/(^|[^a-z])(sold|pārdots|verkauft|vendu)([^a-z]|$)/.test(v)) return "Pārdots";
    }
    if ((t === "isactive" || t === "active") && active == null) active = /^(jā|yes|true|1)$/.test(v) ? true : /^(nē|no|false|0)$/.test(v) ? false : null;
  }
  return active === false ? "Izsole noslēgusies" : "Izsole";
}
