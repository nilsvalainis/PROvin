/**
 * Piedāvājumu saraksta rādījums un izveides dublikātu aizsardzība (Nils 20.11 ekrānšāviņi):
 * - VIN kolonnā tikai ticams VIN (izsoles iekšējs 17 zīmju hash, piem. Auto1 «23631FD56A3D73DC7», netiek rādīts);
 * - avots pēc izsoles saites, ja saglabātā etiķete tai neatbilst;
 * - cena: gala cena klientam, ja tukša - cenu bloka summa (kā detaļā «Klientam kopā»);
 * - «Izveidot piedāvājumu» atkārtots klikšķis / POST atver jau izveidoto melnrakstu.
 * Ierakstus nemaina - tikai attēlošana un jaunu ierakstu izveides lēmums.
 */

import { isPlausibleListingVin } from "@/lib/iriss-listings-extract";
import { parsePriceLike } from "@/lib/iriss-price-format";
import { normalizeVin } from "@/lib/order-field-validation";
import type { IrissPdListRow, IrissPdSource } from "@/lib/iriss-piedavajumi-types";

/** VIN rādīšanai: 17 zīmes bez I/O/Q un ne izsoles hash. Citādi tukšs (sarakstā «-»). */
export function irissPdDisplayVin(raw: string | null | undefined): string {
  const s = String(raw ?? "");
  if (!s.trim()) return "";
  return isPlausibleListingVin(s) ? normalizeVin(s) : "";
}

/** Izsoles/portāla saites hosts -> avots. Tukšs, ja saite nav atpazīta. */
export function irissPdSourceFromUrl(raw: string | null | undefined): IrissPdSource | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  let host = "";
  try {
    host = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (/(^|\.)auto1\.(com|eu)$/.test(host)) return "auto1";
  if (/(^|\.)(openlane|openline)\.(eu|com)$/.test(host)) return "openlane";
  if (/(^|\.)autobid\.(de|eu)$/.test(host)) return "autobid";
  if (/(^|\.)ecarstrade\.com$/.test(host)) return "ecarstrade";
  if (/(^|\.)mobile\.de$/.test(host)) return "mobilede";
  if (/(^|\.)autoscout24\.[a-z.]+$/.test(host)) return "autoscout24";
  return null;
}

/**
 * Etiķete atbilst izsoles platformai: ja saglabātais avots ir cita izsole (vai «Ar roku»),
 * bet saite ir no zināmas platformas, rāda saites platformu. Autoparks / Loģistika paliek.
 */
export function irissPdEffectiveSource(source: IrissPdSource, sourceUrl: string | null | undefined): IrissPdSource {
  if (source === "autoparks" || source === "logistics") return source;
  return irissPdSourceFromUrl(sourceUrl) ?? source;
}

type PriceParts = { price: string; purchasePrice?: string; logisticsCost?: string; prepCost?: string; commission?: string };

/** Cena klientam sarakstam: `price`, ja tukšs - iepirkums + loģistika + sagatavošana + komisija. */
export function irissPdListPrice(rec: PriceParts): string {
  if (rec.price.trim()) return rec.price;
  // Tā pati summa kā `irissPdTotalFromParts` (bez cikliska importa no iriss-piedavajumi).
  const total = [rec.purchasePrice, rec.logisticsCost, rec.prepCost, rec.commission].reduce((sum, x) => {
    const n = x && /\d/.test(x) ? parsePriceLike(x) : 0;
    return sum + (Number.isFinite(n) && n > 0 ? n : 0);
  }, 0);
  return total > 0 ? String(Math.round(total)) : "";
}

/** Dublikātu logs: tas pats sludinājums/saite + tas pats pasūtījums šajās minūtēs -> atver esošo. */
export const IRISS_PD_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

export type IrissPdCreateIdentity = {
  /** `listing:<id>` (no Sludinājumiem) vai "". */
  sourceRef: string;
  source: IrissPdSource | "";
  sourceKey: string;
  orderId: string;
};

export function irissPdCreateIdentityKey(id: IrissPdCreateIdentity): string {
  const src = id.sourceRef ? id.sourceRef : `${id.source}:${id.sourceKey.trim().toUpperCase()}`;
  return `${src}|${id.orderId}`;
}

/**
 * Jau izveidots melnraksts / nosūtīts piedāvājums tam pašam sludinājumam (vai izsoles atslēgai) un pasūtījumam
 * pēdējās `windowMs` minūtēs. null - drīkst veidot jaunu.
 */
export function findRecentDuplicateIrissPd(
  rows: readonly Pick<IrissPdListRow, "id" | "status" | "sourceRef" | "source" | "sourceKey" | "clientOrderId" | "updatedAt">[],
  id: IrissPdCreateIdentity,
  nowMs: number,
  windowMs = IRISS_PD_DUPLICATE_WINDOW_MS,
): string | null {
  const key = id.sourceKey.trim().toUpperCase();
  if (!id.sourceRef && !(id.source && key)) return null;
  let best: { id: string; at: number } | null = null;
  for (const r of rows) {
    if (r.status !== "draft" && r.status !== "sent") continue;
    if ((r.clientOrderId || "") !== (id.orderId || "")) continue;
    const same = id.sourceRef ? r.sourceRef === id.sourceRef : r.source === id.source && r.sourceKey.trim().toUpperCase() === key;
    if (!same) continue;
    const at = Date.parse(r.updatedAt);
    if (!Number.isFinite(at) || nowMs - at > windowMs || at - nowMs > windowMs) continue;
    if (!best || at > best.at) best = { id: r.id, at };
  }
  return best?.id ?? null;
}
