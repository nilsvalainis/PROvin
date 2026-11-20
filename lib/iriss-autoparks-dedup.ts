/**
 * Autoparka dublikātu aizsardzība (bugfix 20.11): pirms jauna Autoparka ieraksta izveides meklē, vai auto jau nav.
 *
 * 17.11 arhivējot Loģistikas pasūtījumus («Uz Autoparku») tika izveidoti jauni ieraksti auto, kas jau bija Autoparkā:
 * pasūtījumam VIN bija tikai piezīmēs vai saīsināts, bet esošajam auto VIN bija tikai v2 (Pamatdati) laukā -
 * vecā pārbaude salīdzināja tikai `orderId` un precīzu v1 VIN.
 *
 * Meklēšanas secība (katrā līmenī vispirms nearhivētie auto):
 * 1. saite uz Loģistikas pasūtījumu (`orderId`);
 * 2. precīzs VIN (efektīvais v2 || v1, kā arī v1);
 * 3. saīsināts VIN - īsākais ir garākā prefikss (≥ 13 zīmes), tikai ja atbilst viens auto;
 * 4. VIN6 / VIN beigas - nepilns VIN (6-16 zīmes) ir otra VIN beigas, tikai ja atbilst viens auto;
 * 5. izsoles stock nr. (v2 `purchase.auctionNo`), tikai ja VIN nav pretrunā.
 * Tīra loģika bez krātuves.
 */

import type { AutoparksV2State } from "@/lib/iriss-autoparks-v2";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

export const DEDUP_VIN_PREFIX_MIN = 13;
export const DEDUP_VIN_SUFFIX_MIN = 6;
const FULL_VIN = 17;

export type AutoparksDedupBy = "order" | "vin" | "vin_prefix" | "vin_suffix" | "stock";

export type AutoparksDedupCar = { id: string; orderId: string; vin: string; archivedAt?: string };

export type AutoparksDedupQuery = {
  orderId?: string;
  /** Visi zināmie VIN varianti (pilns, saīsināts, VIN6); tukšos ignorē. */
  vins?: ReadonlyArray<string | null | undefined>;
  stockNo?: string;
};

export function normalizeDedupVin(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32);
}

function normalizeStock(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Vai teksta gabals izskatās pēc VIN (burti + cipari, bez I/O/Q nav obligāti - piekabēm mēdz būt citādi). */
function looksLikeVin(token: string): boolean {
  return /[A-Z]/.test(token) && /\d/.test(token) && (token.match(/\d/g)?.length ?? 0) >= 3;
}

/**
 * VIN no brīva teksta (Loģistikas piezīmes, nosaukums): «VIN: ...», «VIN6: 123456» un atsevišķi 17 zīmju VIN.
 * Atgriež normalizētus, unikālus VIN (garākie vispirms).
 */
export function extractVinsFromText(text: unknown): string[] {
  if (typeof text !== "string" || !text.trim()) return [];
  const up = text.toUpperCase();
  const out = new Set<string>();
  for (const m of up.matchAll(/\bVIN\s*6\s*[:#.\-]?\s*([A-Z0-9]{6})\b/g)) out.add(m[1]!);
  for (const m of up.matchAll(/\bVIN(?!\s*6\b)\s*(?:NR\.?|KODS)?\s*[:#.\-]?\s*([A-Z0-9]{6,20})\b/g)) {
    if (/\d/.test(m[1]!)) out.add(m[1]!);
  }
  for (const m of up.matchAll(/\b([A-HJ-NPR-Z0-9]{17})\b/g)) if (looksLikeVin(m[1]!)) out.add(m[1]!);
  return [...out].sort((a, b) => b.length - a.length);
}

/** Visi Loģistikas pasūtījuma VIN varianti: lauks, sludinājuma VIN, piezīmes, nosaukums (garākie vispirms, unikāli). */
export function orderVinCandidates(
  order: Partial<Pick<LogisticsOrder, "vin" | "notes" | "title">> & { listingParsed?: { vin?: string | null } | null },
): string[] {
  const out: string[] = [];
  const push = (v: string) => {
    if (v.length >= DEDUP_VIN_SUFFIX_MIN && !out.includes(v)) out.push(v);
  };
  push(normalizeDedupVin(order.vin));
  push(normalizeDedupVin(order.listingParsed?.vin ?? ""));
  for (const v of extractVinsFromText(order.notes)) push(v);
  for (const v of extractVinsFromText(order.title)) push(v);
  return out;
}

/** Labākais VIN jaunam ierakstam: pasūtījuma lauks, citādi garākais atrastais (≥ 11 zīmes). */
export function bestOrderVin(order: Parameters<typeof orderVinCandidates>[0]): string {
  const direct = normalizeDedupVin(order.vin);
  if (direct.length >= 11) return direct;
  const all = orderVinCandidates(order).filter((v) => v.length >= 11);
  all.sort((a, b) => b.length - a.length);
  return all[0] ?? direct;
}

/** Auto VIN varianti: efektīvais (v2 || v1) un v1. */
export function carDedupVins(car: Pick<AutoparksDedupCar, "id" | "vin">, v2?: Pick<AutoparksV2State, "cars"> | null): string[] {
  const out: string[] = [];
  for (const v of [normalizeDedupVin(v2?.cars[car.id]?.fields?.vin), normalizeDedupVin(car.vin)]) if (v && !out.includes(v)) out.push(v);
  return out;
}

function vinRelation(a: string, b: string): "exact" | "prefix" | "suffix" | null {
  if (!a || !b) return null;
  if (a === b) return "exact";
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length === long.length) return null;
  if (short.length >= DEDUP_VIN_PREFIX_MIN && long.startsWith(short)) return "prefix";
  if (short.length >= DEDUP_VIN_SUFFIX_MIN && short.length < FULL_VIN && long.endsWith(short)) return "suffix";
  return null;
}

export type AutoparksDedupMatch<C> = { car: C; by: AutoparksDedupBy };

/** Atrod esošu Autoparka auto, kam atbilst vaicājums; null - auto nav (drīkst veidot jaunu). */
export function findAutoparksDuplicate<C extends AutoparksDedupCar>(
  cars: readonly C[],
  v2: Pick<AutoparksV2State, "cars"> | null | undefined,
  q: AutoparksDedupQuery,
): AutoparksDedupMatch<C> | null {
  const live = (list: C[]) => list.find((c) => !c.archivedAt) ?? list[0];
  const orderId = q.orderId?.trim() ?? "";
  if (orderId) {
    const hit = live(cars.filter((c) => c.orderId === orderId));
    if (hit) return { car: hit, by: "order" };
  }
  const qVins = [...new Set((q.vins ?? []).map(normalizeDedupVin).filter((v) => v.length >= DEDUP_VIN_SUFFIX_MIN))];
  const carVins = new Map(cars.map((c) => [c.id, carDedupVins(c, v2)]));
  const rel = (c: C, kind: "exact" | "prefix" | "suffix") => qVins.some((qv) => carVins.get(c.id)!.some((cv) => vinRelation(qv, cv) === kind));
  if (qVins.length) {
    const exact = live(cars.filter((c) => rel(c, "exact")));
    if (exact) return { car: exact, by: "vin" };
    for (const kind of ["prefix", "suffix"] as const) {
      const hits = cars.filter((c) => rel(c, kind));
      const liveHits = hits.filter((c) => !c.archivedAt);
      const pool = liveHits.length ? liveHits : hits;
      // Nepilns VIN, kas atbilst vairākiem auto, nav drošs - labāk nesasaistīt.
      if (pool.length === 1) return { car: pool[0]!, by: kind === "prefix" ? "vin_prefix" : "vin_suffix" };
    }
  }
  const stock = normalizeStock(q.stockNo);
  if (stock.length >= 4 && v2?.cars) {
    const hasFullQVin = qVins.some((v) => v.length >= FULL_VIN);
    const hits = cars.filter((c) => {
      if (normalizeStock(v2.cars[c.id]?.purchase?.auctionNo) !== stock) return false;
      // Stock nr. sakritība nav pietiekama, ja abiem ir pilns, atšķirīgs VIN.
      const cv = carVins.get(c.id)!;
      return !hasFullQVin || cv.length === 0 || cv.every((v) => v.length < FULL_VIN);
    });
    const liveHits = hits.filter((c) => !c.archivedAt);
    const pool = liveHits.length ? liveHits : hits;
    if (pool.length === 1) return { car: pool[0]!, by: "stock" };
  }
  return null;
}

/* ---------------- Viena loģika: Loģistikas pasūtījums <-> Autoparka auto (bugfix 20.11) ---------------- */

/** Loģistikas pasūtījuma lauki, ko izmanto saskaņošanā (pārējie neobligāti - VIN var būt piezīmēs / nosaukumā). */
export type LogisticsOrderMatchInput = Pick<LogisticsOrder, "id"> &
  Partial<Pick<LogisticsOrder, "vin" | "notes" | "title" | "stockNo">> & { listingParsed?: { vin?: string | null } | null };

/**
 * Autoparka auto Loģistikas pasūtījumam - tā pati secība kā `findAutoparksDuplicate`
 * (sasaiste `orderId` -> efektīvais VIN v2 || v1, arī no piezīmēm -> saīsināts VIN ≥ 13 -> VIN6 -> stock nr.;
 * nepilns VIN tikai, ja viennozīmīgi). `liveOnly` - arhīva auto neskata.
 * Lieto visur: «Ceļā» pārbaude, Loģistikas sinhronizācija, viens avots, sasaiste, koplietošanas saites.
 */
export function findCarForLogisticsOrder<C extends AutoparksDedupCar>(
  cars: readonly C[],
  v2: Pick<AutoparksV2State, "cars"> | null | undefined,
  order: LogisticsOrderMatchInput,
  opts: { liveOnly?: boolean } = {},
): AutoparksDedupMatch<C> | null {
  const pool = opts.liveOnly ? cars.filter((c) => !c.archivedAt) : cars;
  return findAutoparksDuplicate(pool, v2, { orderId: order.id, vins: orderVinCandidates(order), stockNo: order.stockNo });
}

/**
 * Pretējais virziens: aktīvs Loģistikas pasūtījums auto VIN (piem. ar roku pievienots auto «Ceļā»).
 * Pasūtījuma VIN no lauka / piezīmēm; precīzs VIN, tad saīsināts / VIN6 - tikai, ja atbilst viens pasūtījums.
 */
export function findOrderForCarVin<O extends LogisticsOrderMatchInput>(orders: readonly O[], vin: unknown): O | undefined {
  const v = normalizeDedupVin(vin);
  if (v.length < DEDUP_VIN_SUFFIX_MIN) return undefined;
  const rel = (o: O, kind: "exact" | "prefix" | "suffix") => orderVinCandidates(o).some((ov) => vinRelation(v, ov) === kind);
  const exact = orders.find((o) => rel(o, "exact"));
  if (exact) return exact;
  for (const kind of ["prefix", "suffix"] as const) {
    const hits = orders.filter((o) => rel(o, kind));
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}

export const AUTOPARKS_DEDUP_BY_LV: Record<AutoparksDedupBy, string> = {
  order: "Loģistikas ieraksts",
  vin: "VIN",
  vin_prefix: "saīsināts VIN",
  vin_suffix: "VIN beigas",
  stock: "stock nr.",
};
