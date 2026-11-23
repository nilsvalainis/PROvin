/**
 * «Ātrā pārbaude» - VIN pārbaude + dīlera dati vienā lapā (/admin/vin-scan).
 * Tīra loģika: avotu grupas, maksas kopsumma pirms palaišanas, ievades atpazīšana,
 * pāradresācija no /admin/dilera-dati un apvienotā «Pēdējās pārbaudes» vēsture.
 */
import { VIN_SCAN_CATALOG, vinScanSourceDisabled, type VinScanCatalogItem, type VinScanSourceId } from "@/lib/vin-scan/catalog";
import { freeVinScanSourceIds } from "@/lib/vin-scan/free-sources";
import { isValidScanPlate, normalizeScanPlate } from "@/lib/vin-scan/plates";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import {
  DEALER_CHECK_SOURCES,
  DEALER_CHECK_TEMPLATE_LABEL,
  formatDealerCheckEur,
  isSafeDealerCheckId,
  type DealerCheckTemplateId,
} from "@/lib/dealer-check";
import { csvCell, type DealerCheckHistoryEntry } from "@/lib/dealer-check-history";
import type { OneautoProductId } from "@/lib/oneauto-catalog";
import type { VinScanHistoryEntry } from "@/lib/vin-scan/camera-vin";
import { formatRigaIsoShort } from "@/lib/riga-datetime";

export const ATRA_PAGE_PATH = "/admin/vin-scan" as const;
export const ATRA_TITLE = "Ātrā pārbaude";

/* ---------------- Bezmaksas avoti ---------------- */

export type AtraFreeGroupId = "registri" | "izsoles" | "citi";

const GROUPS: ReadonlyArray<{ id: AtraFreeGroupId; label: string; ids: readonly VinScanSourceId[] }> = [
  {
    id: "registri",
    label: "Reģistri",
    ids: [
      "csdd",
      "mnt_ee",
      "lkf_ee",
      "tjekbil",
      "esyn",
      "dsb",
      "nummerplade",
      "carinfo",
      "biluppgifter",
      "rdw",
      "traficom",
      "regitra",
      "lt_itpr",
      "cz_rsv",
      "dvsa_mot",
      "vegvesen",
    ],
  },
  {
    id: "izsoles",
    label: "Izsoles un foto",
    ids: ["thecarapi_eu", "auchistory", "bid_cars", "bidfax", "poctra", "plc_auction", "stat_vin", "checkcar_vin", "carfax_eu", "autodna_precheck"],
  },
  { id: "citi", label: "Atsaukumi, drošība, citi", ids: [] },
];

/** Bezmaksas avoti (un TheCarApi, ja paketē ieslēgts). Noklusējumā visi ieslēgti. */
export function atraFreeSourceIds(thecarapiEnabled: boolean): VinScanSourceId[] {
  const ids = freeVinScanSourceIds();
  if (thecarapiEnabled && !vinScanSourceDisabled("thecarapi_eu") && !ids.includes("thecarapi_eu")) ids.push("thecarapi_eu");
  return ids;
}

export type AtraFreeGroup = { id: AtraFreeGroupId; label: string; items: VinScanCatalogItem[] };

export function atraFreeGroups(thecarapiEnabled: boolean): AtraFreeGroup[] {
  const allowed = new Set<string>(atraFreeSourceIds(thecarapiEnabled));
  const used = new Set<string>();
  const out: AtraFreeGroup[] = GROUPS.map((g) => {
    const items = VIN_SCAN_CATALOG.filter((item) => g.ids.includes(item.id) && allowed.has(item.id));
    items.sort((a, b) => g.ids.indexOf(a.id) - g.ids.indexOf(b.id));
    for (const item of items) used.add(item.id);
    return { id: g.id, label: g.label, items };
  });
  const rest = VIN_SCAN_CATALOG.filter((item) => allowed.has(item.id) && !used.has(item.id));
  const citi = out.find((g) => g.id === "citi");
  if (citi) citi.items.push(...rest);
  return out.filter((g) => g.items.length > 0);
}

/* ---------------- Maksas avoti ---------------- */

export const ATRA_JOJ_ID = "joj_copart_iaai" as const;
export const ATRA_SPECKR_ID = "speckr" as const;
/** JoJ Copart/IAAI ~0,50 $ par meklējumu (rēķins dolāros, tāpēc «~»). */
export const ATRA_JOJ_APPROX_CENTS = 46;

export type AtraPaidId = OneautoProductId | typeof ATRA_JOJ_ID | typeof ATRA_SPECKR_ID;

export type AtraPaidSource = {
  id: AtraPaidId;
  label: string;
  hint: string;
  /** null - nav eiro cenas (Speckr kredīts). */
  priceCents: number | null;
  approx?: boolean;
  /** Mazs teksts zem cenas. */
  note?: string;
  kind: "oneauto" | "joj" | "speckr";
};

const ONEAUTO_ORDER: readonly OneautoProductId[] = ["oe_service_history", "oe_build_sheet", "oe_vin_lookup", "vin_decoder"];
const ONEAUTO_HINT: Record<OneautoProductId, string> = {
  oe_service_history: "Dīlera apkopes un nobraukums",
  oe_build_sheet: "Rūpnīcas komplektācija, PR kodi",
  oe_vin_lookup: "Dzinējs, versija, krāsa",
  vin_decoder: "Pamatdati",
};
const ONEAUTO_SHORT: Record<OneautoProductId, string> = {
  oe_service_history: "OE Service History",
  oe_build_sheet: "OE Build Sheet",
  oe_vin_lookup: "OE VIN Lookup",
  vin_decoder: "VIN Decoder",
};

export const ATRA_PAID_SOURCES: readonly AtraPaidSource[] = [
  ...ONEAUTO_ORDER.map((id): AtraPaidSource => {
    const src = DEALER_CHECK_SOURCES.find((s) => s.id === id);
    return {
      id,
      label: ONEAUTO_SHORT[id],
      hint: ONEAUTO_HINT[id],
      priceCents: src?.priceCents ?? 0,
      ...(id === "oe_service_history" ? { note: "tikai, ja ir dati" } : {}),
      kind: "oneauto",
    };
  }),
  { id: ATRA_JOJ_ID, label: "Copart / IAAI (JoJ)", hint: "ASV izsoles ar foto", priceCents: ATRA_JOJ_APPROX_CENTS, approx: true, kind: "joj" },
  { id: ATRA_SPECKR_ID, label: "Speckr", hint: "Tehniskā specifikācija", priceCents: null, kind: "speckr" },
];

export function isAtraOneautoId(id: string): id is OneautoProductId {
  return (ONEAUTO_ORDER as readonly string[]).includes(id);
}

export function atraOneautoSelected(selected: readonly string[]): OneautoProductId[] {
  return ONEAUTO_ORDER.filter((id) => selected.includes(id));
}

export type AtraCost = { cents: number; approx: boolean; speckrCredits: number; count: number };

/** Ko maksās šī pārbaude: summa no ieķeksētajiem maksas avotiem. */
export function atraPaidCost(selected: readonly string[]): AtraCost {
  let cents = 0;
  let approx = false;
  let speckrCredits = 0;
  let count = 0;
  for (const src of ATRA_PAID_SOURCES) {
    if (!selected.includes(src.id)) continue;
    count += 1;
    if (src.priceCents == null) speckrCredits += 1;
    else cents += src.priceCents;
    if (src.approx) approx = true;
  }
  return { cents, approx, speckrCredits, count };
}

export function formatAtraCost(cost: AtraCost): string {
  const eur = `${cost.approx ? "~" : ""}${formatDealerCheckEur(cost.cents)}`;
  if (!cost.speckrCredits) return eur;
  return `${eur} + ${cost.speckrCredits} Speckr kredīts`;
}

export function atraRunLabel(cost: AtraCost): string {
  return cost.count ? `Pārbaudīt · ${formatAtraCost(cost)}` : "Pārbaudīt";
}

/* ---------------- Ievade ---------------- */

export type AtraQuery = { kind: "vin"; vin: string } | { kind: "plate"; plate: string } | { kind: "none" };

/** Viens lauks: 17 zīmju VIN vai LV numurzīme. */
export function parseAtraQuery(raw: string): AtraQuery {
  const vin = normalizeVin(raw);
  if (isValidVin(vin)) return { kind: "vin", vin };
  const plate = normalizeScanPlate(raw);
  if (plate && isValidScanPlate("lv", plate)) return { kind: "plate", plate };
  return { kind: "none" };
}

/* ---------------- Pāradresācija ---------------- */

export type AtraSearchParams = { vin?: string; no?: string; vn?: string; id?: string; skats?: string };

/** /admin/dilera-dati?… → /admin/vin-scan?… ar tiem pašiem parametriem. */
export function atraHrefFromDealerParams(sp: AtraSearchParams | undefined): string {
  const q = new URLSearchParams();
  const id = (sp?.id ?? "").trim();
  if (id && isSafeDealerCheckId(id)) q.set("id", id);
  const vin = normalizeVin(sp?.vin ?? "");
  if (vin) q.set("vin", vin);
  const vn = (sp?.vn ?? "").trim();
  if (vn) q.set("vn", vn.slice(0, 20));
  if ((sp?.no ?? "").trim() === "autoparks") q.set("no", "autoparks");
  // Telefonā atver «Dīlera dati» segmentu (datorā viss vienā lapā).
  q.set("skats", "dilera");
  const qs = q.toString();
  return qs ? `${ATRA_PAGE_PATH}?${qs}` : ATRA_PAGE_PATH;
}

/* ---------------- Vēsture ---------------- */

export type AtraPotential = "augsts" | "videjs" | "zems";

export const ATRA_POTENTIAL_LABEL: Record<AtraPotential, string> = {
  augsts: "Augsts",
  videjs: "Vidējs",
  zems: "Zems",
};

/** Papildu lauki VIN SCAN vēstures ierakstā (jaunās pārbaudes raksta tikai šeit). */
export type AtraHistoryMeta = {
  plate?: string;
  title?: string;
  potential?: AtraPotential;
  costCents?: number;
  orderId?: string;
  dealerCheckId?: string;
};

export type AtraHistoryEntry = VinScanHistoryEntry & AtraHistoryMeta;

function clip(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function parseAtraHistoryMeta(raw: unknown): AtraHistoryMeta {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: AtraHistoryMeta = {};
  const plate = clip(o.plate, 20);
  if (plate) out.plate = plate.toUpperCase();
  const title = clip(o.title, 80);
  if (title) out.title = title;
  if (o.potential === "augsts" || o.potential === "videjs" || o.potential === "zems") out.potential = o.potential;
  if (typeof o.costCents === "number" && Number.isFinite(o.costCents) && o.costCents >= 0) {
    out.costCents = Math.min(Math.round(o.costCents), 100_000);
  }
  const orderId = clip(o.orderId, 80);
  if (orderId && /^[A-Za-z0-9_-]+$/.test(orderId)) out.orderId = orderId;
  const dealerCheckId = clip(o.dealerCheckId, 90);
  if (dealerCheckId && isSafeDealerCheckId(dealerCheckId)) out.dealerCheckId = dealerCheckId;
  return out;
}

/** Ieraksts ar jauniem laukiem; ja meta nav dota, paliek iepriekšējā ieraksta lauki. */
export function pushAtraHistory(
  list: readonly AtraHistoryEntry[],
  vin: string,
  at: string,
  meta: AtraHistoryMeta | null,
  max = 15,
): AtraHistoryEntry[] {
  const v = normalizeVin(vin);
  if (!isValidVin(v)) return [...list];
  const prev = list.find((e) => e.vin === v);
  const prevMeta: AtraHistoryMeta = prev ? parseAtraHistoryMeta(prev) : {};
  const next: AtraHistoryEntry = { ...(meta ? { ...prevMeta, ...meta } : prevMeta), vin: v, at };
  return [next, ...list.filter((e) => e.vin !== v)].slice(0, max);
}

export type AtraHistoryRow = {
  key: string;
  at: string;
  vin: string;
  plate: string;
  title: string;
  potential: AtraPotential | "";
  costCents: number;
  orderId: string;
  dealerCheckId: string;
  template: DealerCheckTemplateId | "";
  href: string;
};

/**
 * Apvieno abas krātuves: VIN SCAN vēsturi (arī jaunie «Ātrā pārbaude» ieraksti) un
 * dīlera pārbaužu sarakstu. Piesaistītais dīlera ieraksts (`dealerCheckId`) nedublējas.
 */
export function mergeAtraHistory(
  vinEntries: readonly AtraHistoryEntry[],
  dealerEntries: readonly DealerCheckHistoryEntry[],
  limit = 40,
): AtraHistoryRow[] {
  const dealerById = new Map(dealerEntries.map((d) => [d.id, d]));
  const linked = new Set<string>();
  const rows: AtraHistoryRow[] = [];
  for (const e of vinEntries) {
    const meta = parseAtraHistoryMeta(e);
    const dealer = meta.dealerCheckId ? dealerById.get(meta.dealerCheckId) : undefined;
    if (dealer) linked.add(dealer.id);
    rows.push({
      key: `v:${e.vin}:${e.at}`,
      at: e.at,
      vin: e.vin,
      plate: meta.plate || dealer?.plate || "",
      title: meta.title || "",
      potential: meta.potential ?? "",
      // meta.costCents - JoJ u.c. ārpus OneAuto; OneAuto faktiski iekasētais nāk no dīlera ieraksta.
      costCents: (dealer?.chargedCents ?? 0) + (meta.costCents ?? 0),
      orderId: meta.orderId || dealer?.orderId || "",
      dealerCheckId: dealer?.id ?? "",
      template: dealer?.template ?? "",
      href: dealer ? `${ATRA_PAGE_PATH}?id=${encodeURIComponent(dealer.id)}` : `${ATRA_PAGE_PATH}?vin=${encodeURIComponent(e.vin)}`,
    });
  }
  for (const d of dealerEntries) {
    if (linked.has(d.id)) continue;
    rows.push({
      key: `d:${d.id}`,
      at: d.createdAt || d.fetchedAt,
      vin: d.vin,
      plate: d.plate,
      title: d.autoparksTitle || "",
      potential: "",
      costCents: d.chargedCents,
      orderId: d.orderId,
      dealerCheckId: d.id,
      template: d.template,
      href: `${ATRA_PAGE_PATH}?id=${encodeURIComponent(d.id)}`,
    });
  }
  rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return rows.slice(0, limit);
}

/** Saīsināts VIN tabulai: WAUZZZ4G…2604. */
export function atraShortVin(vin: string): string {
  const v = vin.trim();
  return v.length === 17 ? `${v.slice(0, 8)}…${v.slice(-4)}` : v;
}

export function atraHistoryToCsv(rows: readonly AtraHistoryRow[]): string {
  const header = ["datums", "vin", "numurzime", "auto", "potencials", "maksa", "sablons", "pasutijuma_id", "dilera_parbaude"];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        formatRigaIsoShort(r.at),
        r.vin,
        r.plate,
        r.title,
        r.potential ? ATRA_POTENTIAL_LABEL[r.potential] : "",
        formatDealerCheckEur(r.costCents),
        r.template ? DEALER_CHECK_TEMPLATE_LABEL[r.template] : "",
        r.orderId,
        r.dealerCheckId,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

/** «23.11 10:14» (Rīgas laiks) tabulai. */
export function atraHistoryDate(iso: string): string {
  const s = formatRigaIsoShort(iso);
  return /^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(s) ? `${s.slice(0, 5)} ${s.slice(11)}` : s;
}
