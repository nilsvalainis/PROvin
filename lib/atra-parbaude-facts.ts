/**
 * «Ātrā pārbaude» faktu kartītes, stāsta potenciāls un «Kopēt kopsavilkumu».
 * Tīra loģika (KODS, ne AI): tikai fakti no avotiem, nekādu minējumu.
 *
 * Liegumi: CSDD API (`csdd-tech-data`) atgriež tikai tehniskos datus, OCTA un TA termiņu -
 * liegumu/apgrūtinājumu tur nav, tāpēc kartīte rāda saiti uz e.csdd.lv (Smart-ID).
 */
import type { CsddTechData } from "@/lib/csdd-tech-data";
import type { DealerCheckRecord } from "@/lib/dealer-check";
import type { AtraPotential } from "@/lib/atra-parbaude";
import { atraPreviewPhotoSources, buildAtraPreviews, type AtraPreview } from "@/lib/atra-prieksskatijums";

export const ECSDD_URL = "https://e.csdd.lv/";

/** Rinda no VIN SCAN paneļa momentuzņēmuma (tikai lauki, ko lieto kartītes). */
export type AtraFactRow = {
  id: string;
  label: string;
  country: string;
  status: string;
  summary: string;
  detail?: string;
  openUrl?: string;
  vehicle?: { make?: string; model?: string; year?: string };
  mileage?: { date: string; odometer: string; source?: string }[];
  media?: { photoUrl?: string; photoCount?: number };
  flags?: { wanted?: boolean; stolen?: boolean; registrationCountry?: string; photoCount?: number };
  inspections?: { date: string; result?: string; odometer?: string }[];
  incidents?: { date?: string; summary: string }[];
  auctions?: { title?: string; date?: string; price?: string; venue?: string; photoUrl?: string; photoCount?: number }[];
  listings?: { date: string; price?: string; odometer?: string; photoUrl?: string }[];
};

export type AtraFactsInput = {
  vin: string;
  plate: string;
  title: string;
  year: string;
  rows: readonly AtraFactRow[];
  dealer: DealerCheckRecord | null;
  csdd: CsddTechData | null;
  /** Vai lietotājs ielika sludinājuma saiti. */
  hasListing: boolean;
};

export type AtraMileagePoint = { date: string; km: number; source: string; country: string };

export type AtraMileageFact = {
  points: AtraMileagePoint[];
  drop: { from: AtraMileagePoint; to: AtraMileagePoint; km: number } | null;
  last: AtraMileagePoint | null;
  maxKm: number;
  /** Pēdējais km + kritums (ja kritums bija pirms pēdējā ieraksta). */
  actualMinKm: number;
};

export type AtraAuctionFact = {
  count: number;
  years: string[];
  venues: string[];
  photos: string[];
  photoCount: number;
  sources: string[];
};

export type AtraDealerFact = {
  visits: number;
  firstYear: string;
  lastYear: string;
  longestGapMonths: number;
  lastDate: string;
  lastKm: string;
};

export type AtraFacts = {
  mileage: AtraMileageFact;
  wanted: string[];
  incidents: { count: number; items: string[]; sources: string[] };
  auctions: AtraAuctionFact;
  countries: string[];
  dealer: AtraDealerFact | null;
  listing: { has: boolean; price: string; km: number; kmDeviates: boolean; priceDeviates: boolean } ;
  inspection: { until: string; count: number; last: string };
  flags: { totalLoss: boolean; commercial: boolean };
  /** Maksas atskaišu bezmaksas priekšskatījums (AutoDNA, CheckCar.vin, CARFAX.eu). */
  previews: AtraPreview[];
};

export function formatKm(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function parseKm(raw: string | undefined): number {
  const digits = String(raw ?? "").replace(/[^\d]/g, "");
  if (!digits || digits.length > 7) return 0;
  return Number(digits);
}

/** «29.04.2015», «2015-04-29», «04.2015», «2015» → «2015-04-29» (salīdzināms). */
export function atraSortableDate(raw: string | undefined): string {
  const t = String(raw ?? "").trim();
  let m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3] ?? "01"}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(t);
  if (m) return `${m[3]}-${m[2]!.padStart(2, "0")}-${m[1]!.padStart(2, "0")}`;
  m = /^(\d{1,2})[./](\d{4})$/.exec(t);
  if (m) return `${m[2]}-${m[1]!.padStart(2, "0")}-01`;
  m = /^(\d{4})$/.exec(t);
  if (m) return `${m[1]}-01-01`;
  return "";
}

/** «2017-05-13» → «13.05.2017». */
export function atraLvDate(sortable: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sortable);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : sortable;
}

function monthsBetween(a: string, b: string): number {
  const pa = /^(\d{4})-(\d{2})/.exec(a);
  const pb = /^(\d{4})-(\d{2})/.exec(b);
  if (!pa || !pb) return 0;
  return (Number(pb[1]) - Number(pa[1])) * 12 + (Number(pb[2]) - Number(pa[2]));
}

const COUNTRY_OK = /^[A-Z]{2}$/;
const TOTAL_LOSS_RE = /total\s*loss|salvage|totalsk|glābšan|bojā gāj|flood|plūd|fire|deg(?:ts|šana)|burn/i;
const COMMERCIAL_RE = /taksometr|\btaxi\b|\btaksi\b|nomas auto|\brental\b|policij|\bpolice\b/i;

function rowText(row: AtraFactRow): string {
  return [
    row.summary,
    row.detail,
    ...(row.incidents ?? []).map((i) => i.summary),
    ...(row.auctions ?? []).map((a) => a.title ?? ""),
  ]
    .filter(Boolean)
    .join("\n");
}

function mileageFact(input: AtraFactsInput): AtraMileageFact {
  const points: AtraMileagePoint[] = [];
  const seen = new Set<string>();
  const push = (date: string, odo: string, source: string, country: string) => {
    const d = atraSortableDate(date);
    const km = parseKm(odo);
    if (!d || km <= 0) return;
    const key = `${d}|${km}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ date: d, km, source, country });
  };
  for (const row of input.rows) {
    if (row.status !== "found") continue;
    const c = row.flags?.registrationCountry || row.country;
    for (const m of row.mileage ?? []) push(m.date, m.odometer, m.source || row.label, COUNTRY_OK.test(c) ? c : "");
    for (const i of row.inspections ?? []) push(i.date, i.odometer ?? "", row.label, COUNTRY_OK.test(c) ? c : "");
  }
  for (const m of input.dealer?.mileageRows ?? []) push(m.date, m.odometer, m.source || "Dīleris", "");
  for (const s of input.dealer?.serviceRows ?? []) push(s.date, s.km, "Dīleris", "");
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.km - b.km));
  let maxPoint: AtraMileagePoint | null = null;
  let drop: AtraMileageFact["drop"] = null;
  for (const p of points) {
    if (maxPoint && maxPoint.km - p.km >= 10_000) {
      const km = maxPoint.km - p.km;
      if (!drop || km > drop.km) drop = { from: maxPoint, to: p, km };
    }
    if (!maxPoint || p.km > maxPoint.km) maxPoint = p;
  }
  const last = points.length ? points[points.length - 1]! : null;
  const maxKm = maxPoint?.km ?? 0;
  const actualMinKm = drop && last && last.date >= drop.to.date ? last.km + drop.km : maxKm;
  return { points, drop, last, maxKm, actualMinKm };
}

function auctionFact(rows: readonly AtraFactRow[]): AtraAuctionFact {
  const years = new Set<string>();
  const venues = new Set<string>();
  const photos: string[] = [];
  const sources = new Set<string>();
  let count = 0;
  let photoCount = 0;
  for (const row of rows) {
    if (row.status !== "found") continue;
    const list = row.auctions ?? [];
    for (const a of list) {
      count += 1;
      sources.add(row.label);
      const y = atraSortableDate(a.date).slice(0, 4);
      if (y) years.add(y);
      if (a.venue) venues.add(a.venue);
      if (a.photoUrl && !photos.includes(a.photoUrl)) photos.push(a.photoUrl);
      photoCount += a.photoCount ?? (a.photoUrl ? 1 : 0);
    }
    const mediaN = row.media?.photoCount ?? row.flags?.photoCount ?? 0;
    if (row.media?.photoUrl && !photos.includes(row.media.photoUrl)) photos.push(row.media.photoUrl);
    if (!list.length && (mediaN > 0 || row.media?.photoUrl)) {
      sources.add(row.label);
      photoCount += mediaN || 1;
    }
  }
  return { count, years: [...years].sort(), venues: [...venues], photos, photoCount, sources: [...sources] };
}

function dealerFact(record: DealerCheckRecord | null): AtraDealerFact | null {
  const rows = (record?.serviceRows ?? [])
    .map((r) => ({ ...r, d: atraSortableDate(r.date) }))
    .filter((r) => r.d)
    .sort((a, b) => (a.d < b.d ? -1 : 1));
  if (!rows.length) return null;
  let gap = 0;
  for (let i = 1; i < rows.length; i++) gap = Math.max(gap, monthsBetween(rows[i - 1]!.d, rows[i]!.d));
  const last = rows[rows.length - 1]!;
  return {
    visits: rows.length,
    firstYear: rows[0]!.d.slice(0, 4),
    lastYear: last.d.slice(0, 4),
    longestGapMonths: gap,
    lastDate: atraLvDate(last.d),
    lastKm: parseKm(last.km) ? formatKm(parseKm(last.km)) : "",
  };
}

export function buildAtraFacts(input: AtraFactsInput): AtraFacts {
  const found = input.rows.filter((r) => r.status === "found");
  const mileage = mileageFact(input);
  const wanted = found.filter((r) => r.flags?.wanted || r.flags?.stolen).map((r) => r.label);
  const incidentItems: string[] = [];
  const incidentSources = new Set<string>();
  for (const r of found) {
    for (const i of r.incidents ?? []) {
      incidentItems.push([atraLvDate(atraSortableDate(i.date)), i.summary].filter(Boolean).join(" "));
      incidentSources.add(r.label);
    }
  }
  const countries = new Set<string>();
  for (const r of found) {
    const c = r.flags?.registrationCountry || "";
    if (COUNTRY_OK.test(c)) countries.add(c);
  }
  for (const p of mileage.points) if (p.country) countries.add(p.country);
  if (input.csdd?.vin) countries.add("LV");
  const listingRow = found.find((r) => r.id === "listing_history");
  const listings = [...(listingRow?.listings ?? [])].sort((a, b) =>
    atraSortableDate(a.date) < atraSortableDate(b.date) ? 1 : -1,
  );
  const lastListing = listings[0];
  const listingKm = parseKm(lastListing?.odometer);
  const knownKm = mileage.actualMinKm || mileage.maxKm;
  const kmDeviates = listingKm > 0 && knownKm > 0 && listingKm < knownKm * 0.8;
  const prices = listings.map((l) => parseKm(l.price)).filter((n) => n > 0);
  const priceDeviates = prices.length >= 2 && Math.abs(prices[0]! - prices[prices.length - 1]!) / prices[prices.length - 1]! >= 0.2;
  const text = found.map(rowText).join("\n");
  const inspections = found.flatMap((r) => r.inspections ?? []);
  const lastInspection = [...inspections].sort((a, b) => (atraSortableDate(a.date) < atraSortableDate(b.date) ? 1 : -1))[0];
  return {
    mileage,
    wanted,
    incidents: { count: incidentItems.length, items: incidentItems, sources: [...incidentSources] },
    auctions: auctionFact(found),
    countries: [...countries].sort(),
    dealer: dealerFact(input.dealer),
    listing: {
      has: input.hasListing || Boolean(lastListing),
      price: lastListing?.price ?? "",
      km: listingKm,
      kmDeviates,
      priceDeviates,
    },
    inspection: {
      until: input.csdd?.inspectionValidUntilIso ? atraLvDate(input.csdd.inspectionValidUntilIso.slice(0, 10)) : "",
      count: inspections.length,
      last: lastInspection ? [atraLvDate(atraSortableDate(lastInspection.date)), lastInspection.result].filter(Boolean).join(" · ") : "",
    },
    flags: { totalLoss: TOTAL_LOSS_RE.test(text), commercial: COMMERCIAL_RE.test(text) },
    previews: buildAtraPreviews(input.vin, input.rows),
  };
}

/* ---------------- Stāsta potenciāls ---------------- */

export type AtraReason = { points: number; text: string };
export type AtraScore = { points: number; level: AtraPotential; reasons: AtraReason[] };

export const ATRA_SCORE_MAX = 10;

/** Punkti saskaitās, maksimums 10. Augsts 6+, vidējs 3-5, zems 0-2 (makets 23.11, 4. sadaļa). */
export function atraStoryScore(f: AtraFacts): AtraScore {
  const reasons: AtraReason[] = [];
  if (f.mileage.drop) reasons.push({ points: 3, text: `Notīts nobraukums ≥ ${formatKm(f.mileage.drop.km)} km` });
  if (f.flags.totalLoss) reasons.push({ points: 3, text: "Total loss, smagi bojājumi vai glābšanas izsole" });
  if (f.wanted.length) reasons.push({ points: 2, text: `Meklēšanā: ${f.wanted.join(", ")}` });
  if (f.auctions.photoCount > 0 || f.auctions.photos.length > 0) {
    reasons.push({ points: 2, text: `Izsoles bildes${f.auctions.years.length ? ` ${f.auctions.years.join(", ")}` : ""}` });
  } else {
    // AutoDNA arhīva foto vai CheckCar bildes skaitās kā izsoļu bildes, ja tās vēl nav ieskaitītas.
    const photoSources = atraPreviewPhotoSources(f.previews ?? []);
    if (photoSources.length) reasons.push({ points: 2, text: `Izsoļu bildes (${photoSources.join(", ")})` });
  }
  if (f.flags.commercial) reasons.push({ points: 2, text: "Taksometrs, noma vai policija" });
  if (f.listing.kmDeviates || f.listing.priceDeviates) {
    reasons.push({ points: 2, text: f.listing.kmDeviates ? "Sludinājuma km būtiski mazāks par datiem" : "Sludinājuma cena būtiski mainījusies" });
  }
  if (f.countries.length >= 3) reasons.push({ points: 1, text: `${f.countries.length} valstis` });
  if (Math.max(f.mileage.maxKm, f.mileage.actualMinKm) > 400_000) reasons.push({ points: 1, text: "Nobraukums virs 400 000 km" });
  if (f.dealer && f.dealer.longestGapMonths >= 36) reasons.push({ points: 1, text: `Dīlera robs ${f.dealer.longestGapMonths} mēn.` });
  if (f.incidents.count === 0) reasons.push({ points: 0, text: "Negadījumi nav" });
  if (!f.listing.has) reasons.push({ points: 0, text: "Nav sludinājuma" });
  const points = Math.min(ATRA_SCORE_MAX, reasons.reduce((n, r) => n + r.points, 0));
  const level: AtraPotential = points >= 6 ? "augsts" : points >= 3 ? "videjs" : "zems";
  return { points, level, reasons };
}

/* ---------------- Kopēt kopsavilkumu ---------------- */

const LEVEL_LOWER: Record<AtraPotential, string> = { augsts: "augsts", videjs: "vidējs", zems: "zems" };

/** Tikai fakti; rindas bez datiem izlaistas. */
export function atraSummaryText(input: Pick<AtraFactsInput, "vin" | "title" | "year">, f: AtraFacts, score: AtraScore): string {
  const lines: string[] = [[input.title, input.year, input.vin].filter(Boolean).join(" · ")];
  const m = f.mileage;
  if (m.drop) {
    const from = `${m.drop.from.country ? `${m.drop.from.country} ` : ""}${m.drop.from.date.slice(0, 4)} ${formatKm(m.drop.from.km)} km`;
    const to = `${m.drop.to.country ? `${m.drop.to.country} ` : ""}${m.drop.to.date.slice(0, 4)} ${formatKm(m.drop.to.km)} km`;
    lines.push(`Nobraukums: ${from} → ${to} (kritums ≥ ${formatKm(m.drop.km)} km), faktiski ≥ ${formatKm(m.actualMinKm)} km`);
  } else if (m.last) {
    lines.push(`Nobraukums: ${formatKm(m.last.km)} km (${atraLvDate(m.last.date)})`);
  }
  if (f.wanted.length) lines.push(`Meklēšanā: ${f.wanted.join(", ")}`);
  lines.push(f.incidents.count ? `Negadījumi: ${f.incidents.count}` : "Negadījumi: nav fiksēti");
  if (f.auctions.count || f.auctions.photoCount) {
    const parts = [f.auctions.years.join(", "), f.auctions.venues.join(", "), f.auctions.photoCount ? `${f.auctions.photoCount} bildes` : ""];
    lines.push(`Izsoles: ${parts.filter(Boolean).join(" ")}`.trim());
  }
  const extra = [f.countries.length ? `Valstis: ${f.countries.join(", ")}` : "", f.dealer ? `dīlera apkopes ${f.dealer.visits}` : ""].filter(Boolean);
  if (extra.length) lines.push(extra.join(" · "));
  if (f.inspection.until) lines.push(`TA līdz ${f.inspection.until}`);
  const previews = (f.previews ?? []).filter((p) => p.tone === "ok" || p.tone === "none");
  if (previews.length) {
    const parts = previews.map((p) => {
      const key = p.items.filter((i) => i.key && i.value !== "-").map((i) => `${i.label.toLowerCase()} ${i.value}`);
      return `${p.label} ${p.headline.charAt(0).toLowerCase()}${p.headline.slice(1)}${key.length ? ` (${key.join(", ")})` : ""}`;
    });
    lines.push(`Priekšskatījums: ${parts.join(" · ")}`);
  }
  lines.push(`Stāsta potenciāls: ${LEVEL_LOWER[score.level]} (${score.points}/${ATRA_SCORE_MAX})`);
  return lines.join("\n");
}
