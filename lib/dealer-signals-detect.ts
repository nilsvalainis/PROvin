/**
 * «Signāli ārpus dīlera datiem» - tīra noteikšana no pasūtījuma workspace datiem.
 * Atgriež tikai tipus (viens uz tipu neatkarīgi no avotu skaita); teksti - `lib/dealer-signals.ts`.
 * Avotu nosaukumi, skaitļi un datumi ārā netiek doti.
 */

import {
  mergeSourceBlocksWithDefaults,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { DEALER_SIGNAL_KINDS, type DealerSignalKind } from "@/lib/dealer-signals-persist";
import { vinScanAuctionsToCcVinParsed } from "@/lib/order-vin-scan";
import type { SourceIssue } from "@/lib/source-consistency";
import { detectTotalLossFromPdfInput, textIndicatesTotalLoss } from "@/lib/total-loss-detect";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import {
  AUTODNA_KEY_SECTIONS,
  autodnaSectionCount,
  parseAutodnaPrecheckDetail,
  type AutodnaPrecheck,
} from "@/lib/vin-scan/autodna-precheck";
import type { VinScanIndicator } from "@/lib/vin-scan/types";

export type DealerSignalsDetectInput = {
  sourceBlocks: WorkspaceSourceBlocks | null | undefined;
  /** `checkSourceConsistency` rezultāts (ar admina atzīmēm - noraidītie ir `info`). */
  sourceIssues?: readonly Pick<SourceIssue, "kind" | "severity">[] | null;
  /**
   * Pasūtījuma VIN SCAN rezultāts (Nils 27.11): izsoles, bojājumi, dokumenta statuss arī tad,
   * ja tie vēl nav importēti avotu blokos.
   */
  vinScan?: { indicators?: readonly VinScanIndicator[] | null } | null;
};

type Row = Record<string, unknown>;

/**
 * VIN SCAN avoti, kuru «found» ar izsoli nozīmē šī konkrētā auto ASV izsoļu vēsturi
 * (ne modeļa līmeņa datus kā NHTSA sūdzības / atsaukumi).
 */
const US_AUCTION_SCAN_IDS = new Set<string>(["bid_cars", "bidfax", "poctra", "stat_vin", "joj_copart_iaai"]);

/** ASV valsts nosaukums / kods avotu rindās (LV/EN/RU/DE). */
const US_COUNTRY_RE =
  /^(?:us|usa|u\.?s\.?a?\.?|asv|amerikas savienotās valstis|united states(?: of america)?|сша|соединённые штаты(?: америки)?|vereinigte staaten(?: von amerika)?)$/i;

/** ASV izsoļu platformas (cc_vin pārdošanas rindās). */
const US_AUCTION_VENUE_RE = /\b(?:iaai|insurance auto auctions)\b/i;

/** Bojājuma apraksts bez faktiska bojājuma (izsoļu «Normal wear», «None», «Unknown»). */
const NO_DAMAGE_PART_RE = /^(?:none|no damage|nav|nav bojājumu|normal wear(?:\s*(?:&|and)\s*tear)?|unknown|nezināms|n\/a|-)$/i;

/**
 * Īpašs dokumenta / titula statuss (salvage, rebuilt, flood u.c.). Tikai titula / zīmola / dokumenta laukos.
 */
const SPECIAL_STATUS_RE =
  /\b(?:salvage|rebuilt|rebuildable|reconstructed|flood|water damage|junk|total loss|totaled|non-repairable|irreparable|certificate of destruction|parts only|lemon|hail damage|fire damage|bojāej\p{L}*|totalschaden)(?![\p{L}\p{N}])/iu;
const STATUS_NEGATION_RE = /\b(?:no|not|none|nav|netika|clean|without|nein|kein\p{L}*|0)\b|ierakst\p{L}* nav|not found|no record/iu;

/** VIN SCAN detaļu rindas ar dokumenta / titula statusu (piem. «Dokuments: Salvage (Georgia)»). */
const SCAN_DOC_LINE_RE = /^\s*(?:dokuments|document|sale document|title(?: \(detalizēts\))?|title type|title brand)\s*:\s*(.+)$/gimu;

/** Ārvalstu reģistri (lkf.ee - apdrošināšana, tā nonāk negadījumos). */
const FOREIGN_REGISTRY_KEYS = ["tjekbil", "finnik", "mnt_ee", "carinfo", "traficom_fi"] as const;

function filled(v: unknown): boolean {
  return typeof v === "string" && v.trim() !== "" && v.trim() !== "-";
}

/** Rinda ar faktu (datums + km vai notikums); tikai valsts / izcelsme neskaitās. */
function registryRowHasFact(row: { date?: string; odometer?: string; event?: string }): boolean {
  return filled(row.date) && (filled(row.odometer) || filled(row.event));
}

/**
 * Nobraukums: dīlera pret reģistru (#1305, ne «info») vai kritisks kritums starp avotiem.
 * Parastie «warn» kritumi (pārrakstīšanās, sludinājums, zema ticamība) netiek skaitīti.
 */
export function hasMileageMismatchSignal(issues: DealerSignalsDetectInput["sourceIssues"]): boolean {
  return (issues ?? []).some(
    (i) =>
      (i.kind === "dealer_registry_mileage" && i.severity !== "info") ||
      (i.kind === "mileage_drop" && i.severity === "critical"),
  );
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function scanIndicators(input: Pick<DealerSignalsDetectInput, "vinScan">): VinScanIndicator[] {
  return [...(input.vinScan?.indicators ?? [])].filter((i) => i && typeof i === "object");
}

/** VIN SCAN izsoles / bojājumi / tituli / nobraukums cc_vin formā (tas pats, ko imports ieliktu blokā). */
function scanParsed(input: Pick<DealerSignalsDetectInput, "vinScan">) {
  const ind = scanIndicators(input);
  return ind.length > 0 ? vinScanAuctionsToCcVinParsed(ind) : null;
}

/** Bojājuma apraksts ar vismaz vienu faktisku daļu («Front end + Unknown» - jā, «Normal wear» - nē). */
export function isMeaningfulDamageText(text: string): boolean {
  const parts = text
    .split(/\s*(?:\+|,|;|\/|·)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.some((p) => !NO_DAMAGE_PART_RE.test(p));
}

/** Bojājuma rinda (cc_vin / ASV / VIN SCAN): summa vai faktisks apraksts. */
function damageRowCounts(d: Row): boolean {
  if (filled(d.amount)) return true;
  return isMeaningfulDamageText(str(d.description));
}

/**
 * Negadījumi un bojājumi: kopējās negadījumu tabulas rindas (ar summu) + rindas bez summas
 * (izsoļu / ASV bojājumi, apdrošināšanas ieraksti ar datumu) + VIN SCAN izsoļu bojājumi.
 */
export function hasIncidentSignal(blocks: WorkspaceSourceBlocks, input: Pick<DealerSignalsDetectInput, "vinScan"> = {}): boolean {
  const vendor = toPdfManualVendorBlocks(blocks);
  const rows = collectUnifiedIncidentRows({
    manualVendorBlocks: vendor,
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab, { csdd: blocks.csdd }),
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
  });
  if (rows.length > 0) return true;
  // Negadījums ar datumu, bet bez summas (AutoDNA / CarVertical / citi avoti / reģistri).
  if (vendor.some((b) => (b.incidentRows ?? []).some((r) => filled(r.csngDate) || filled(r.lossAmount)))) return true;
  if ((blocks.ltab.rows ?? []).some((r) => filled(r.csngDate) && filled(r.lossAmount))) return true;
  if ([...(blocks.cc_vin.damages ?? []), ...(blocks.asv.damages ?? [])].some((d) => damageRowCounts(d as Row))) return true;
  const parsed = scanParsed(input);
  return (parsed?.damages ?? []).some((d) => damageRowCounts(d as Row));
}

/** Izsoļu fotogrāfijas: izsoļu arhīva bildes, izsoļu ierakstu (TheCarApi) bildes vai VIN SCAN izsoļu foto. */
export function hasAuctionPhotoSignal(blocks: WorkspaceSourceBlocks, input: Pick<DealerSignalsDetectInput, "vinScan"> = {}): boolean {
  const cc = blocks.cc_vin;
  if ((cc.photos ?? []).length > 0) return true;
  if ((cc.photoGroups ?? []).some((g) => (g.photos ?? []).length > 0)) return true;
  if ((cc.thecarapiRecords ?? []).some((r) => (r.photos ?? []).length > 0 || (r.photoUrls ?? []).some((u) => u.trim() !== ""))) {
    return true;
  }
  // VIN SCAN imports ieliek foto saites cc_vin RAW, arī ja bilžu augšupielāde neizdevās.
  if (/VIN SCAN izsoles foto:\s*\n\s*https?:\/\//i.test(cc.rawUnprocessedData ?? "")) return true;
  return scanIndicators(input).some(
    (i) =>
      i.status === "found" &&
      (i.auctions ?? []).some((a) => (a.photoCount ?? 0) > 0 || Boolean(str(a.photoUrl)) || (a.photoUrls ?? []).some((u) => str(u))),
  );
}

/** ASV vēsture: ASV rindas avotos, ASV vēstures bloks ar datiem vai ASV izsoļu ieraksts VIN SCAN. */
export function hasUsHistorySignal(blocks: WorkspaceSourceBlocks, input: Pick<DealerSignalsDetectInput, "vinScan"> = {}): boolean {
  const isUs = (v: unknown) => US_COUNTRY_RE.test(str(v));
  const cc = blocks.cc_vin;
  if ((cc.mileage ?? []).some((r) => isUs(r.country) && (filled(r.date) || filled(r.odometer)))) return true;
  if ((cc.sales ?? []).some((r) => US_AUCTION_VENUE_RE.test(str(r.venue)))) return true;
  if ((cc.damages ?? []).some((r) => US_AUCTION_VENUE_RE.test(str(r.region)) && damageRowCounts(r as Row))) return true;
  // ASV vēstures bloks (CARFAX / AutoCheck ASV atskaite): jebkura aizpildīta faktu rinda.
  const asv = blocks.asv as unknown as Record<string, Row[] | undefined>;
  const asvFact = (r: Row) => filled(r.date) && Object.entries(r).some(([k, v]) => k !== "date" && filled(v));
  if (["mileage", "damages", "titles", "sales", "brands"].some((k) => (asv[k] ?? []).some(asvFact))) return true;
  for (const b of toPdfManualVendorBlocks(blocks)) {
    if ((b.mileageRows ?? []).some((r) => isUs(r.country))) return true;
    if ((b.incidentRows ?? []).some((r) => isUs(r.incidentNo) && (filled(r.csngDate) || filled(r.lossAmount)))) return true;
    if ((b.vehicleHistoryTimeline ?? []).some((r) => isUs(r.country) && filled(r.date))) return true;
  }
  for (const i of scanIndicators(input)) {
    if (i.status !== "found") continue;
    if (US_AUCTION_SCAN_IDS.has(i.id) && ((i.auctions ?? []).length > 0 || (i.jojFacts?.sales ?? []).length > 0)) return true;
    if ((i.flags?.countries ?? []).some((c) => isUs(c))) return true;
  }
  return false;
}

function statusTextPositive(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || !SPECIAL_STATUS_RE.test(t)) return false;
  if (STATUS_NEGATION_RE.test(t)) return false;
  return true;
}

/**
 * Īpašs statuss: totālā bojāeja / salvage / rebuilt / flood u.c. strukturētos avotu laukos
 * (tituli, zīmoli, negadījumu rindas, reģistru statusi) un VIN SCAN dokumenta laukā.
 * Komentāri (AI / admina) netiek skatīti.
 */
export function hasSpecialStatusSignal(blocks: WorkspaceSourceBlocks, input: Pick<DealerSignalsDetectInput, "vinScan"> = {}): boolean {
  const parsed = scanParsed(input);
  const asv = blocks.asv as unknown as { brands?: Row[]; titles?: Row[]; damages?: Row[] };
  const loss = detectTotalLossFromPdfInput({
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: { rows: blocks.ltab.rows ?? [] },
    ccVinBlock: {
      damages: [...(blocks.cc_vin.damages ?? []), ...(parsed?.damages ?? [])],
      brands: [...(blocks.cc_vin.brands ?? []), ...((asv.brands ?? []) as never[])],
      titles: [...(blocks.cc_vin.titles ?? []), ...((asv.titles ?? []) as never[]), ...(parsed?.titles ?? [])],
    },
    asvBlock: { damages: (asv.damages ?? []) as never[] },
  });
  if (loss.found) return true;
  const titleLike: Row[] = [
    ...(blocks.cc_vin.brands ?? []),
    ...(blocks.cc_vin.titles ?? []),
    ...(asv.brands ?? []),
    ...(asv.titles ?? []),
    ...(parsed?.titles ?? []),
  ] as Row[];
  if (titleLike.some((r) => statusTextPositive([r.label, r.detail, r.note].map(str).join(" ")))) return true;
  for (const i of scanIndicators(input)) {
    if (i.status !== "found") continue;
    for (const m of str(i.detail).matchAll(SCAN_DOC_LINE_RE)) {
      if (statusTextPositive(m[1] ?? "")) return true;
    }
    // NICB «total loss / salvage ieraksts» (bez noliegumu filtriem kopsavilkumā).
    if (i.id === "nicb" && textIndicatesTotalLoss(str(i.summary))) return true;
  }
  return false;
}

/** Citas valsts reģistrs: kādā ārvalstu reģistrā ir nobraukuma vai hronoloģijas ieraksts. */
export function hasForeignRegistrySignal(blocks: WorkspaceSourceBlocks): boolean {
  return FOREIGN_REGISTRY_KEYS.some((k) => {
    const b = blocks[k];
    return (b.mileage ?? []).some(registryRowHasFact) || (b.timeline ?? []).some(registryRowHasFact);
  });
}

/* ---------- Maksas atskaišu bezmaksas priekšskatījumi (Nils 27.11) ---------- */

/** AutoDNA priekšskata sadaļas ar negadījumiem / bojājumiem (ja lapa tādas rāda). */
const PREVIEW_INCIDENT_SECTION_RE = /bojāj|negadīj|avārij|damage|accident|unfall|schaden/i;

function scanRow(input: Pick<DealerSignalsDetectInput, "vinScan">, id: string): VinScanIndicator | undefined {
  return scanIndicators(input).find((i) => i.id === id);
}

/** AutoDNA priekšskats (`autodna_precheck`): sadaļas un ierakstu skaits. Nav nolasīts -> null. */
function autodnaPreview(input: Pick<DealerSignalsDetectInput, "vinScan">): AutodnaPrecheck | null {
  const row = scanRow(input, "autodna_precheck");
  if (!row || (row.status !== "found" && row.status !== "none")) return null;
  return parseAutodnaPrecheckDetail(row.detail);
}

function countIn(text: string, re: RegExp): number {
  const n = Number(re.exec(text)?.[1] ?? NaN);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Arhīva fotogrāfijas: maksas atskaites priekšskatā ir vēsturiskas bildes (AutoDNA «Auto arhīva fotogrāfijas»,
 * CheckCar.vin atskaitē foto). Kas tieši tur ir, nav zināms (bojājumi, izsoles, sludinājumi u.c.).
 */
export function hasArchivePhotoSignal(input: Pick<DealerSignalsDetectInput, "vinScan">): boolean {
  if ((autodnaSectionCount(autodnaPreview(input), AUTODNA_KEY_SECTIONS[1]) ?? 0) > 0) return true;
  const cc = scanRow(input, "checkcar_vin");
  return cc?.status === "found" && countIn(str(cc.summary), /(\d+)\s*foto/i) > 0;
}

/**
 * Papildu vēstures ieraksti: maksas atskaites priekšskatā ir vēstures ieraksti (AutoDNA «Transportlīdzekļa vēsture»,
 * CARFAX.eu nobraukums / apskates / serviss vai vairāki ieraksti), ko dīlera dati nesatur.
 */
export function hasExtraHistorySignal(input: Pick<DealerSignalsDetectInput, "vinScan">): boolean {
  if ((autodnaSectionCount(autodnaPreview(input), AUTODNA_KEY_SECTIONS[0]) ?? 0) > 0) return true;
  const cf = scanRow(input, "carfax_eu");
  if (cf?.status !== "found") return false;
  const detail = str(cf.detail);
  // Viens ieraksts bez nobraukuma / apskates / servisa parasti ir tikai pati reģistrācija - nav pārdodama vēsture.
  const records = Math.max(countIn(detail, /^Ieraksti:\s*(\d+)/m), countIn(str(cf.summary), /(\d+)\s*ierakst/i));
  return (
    records >= 2 ||
    [/^Nobraukuma rādījumi:\s*(\d+)/m, /^Tehniskās apskates:\s*(\d+)/m, /^Serviss un remonti:\s*(\d+)/m].some((re) => countIn(detail, re) > 0)
  );
}

/** Priekšskatā ir negadījumu / bojājumu sadaļa ar ierakstiem. */
export function hasPreviewIncidentSignal(input: Pick<DealerSignalsDetectInput, "vinScan">): boolean {
  const data = autodnaPreview(input);
  return (data?.sections ?? []).some((s) => PREVIEW_INCIDENT_SECTION_RE.test(s.name) && s.available && (s.count ?? 0) > 0);
}

/** Atrastie signālu tipi kanoniskā secībā. Viena pārbaude ar dīvainiem datiem neaptur pārējās. */
export function detectDealerSignals(input: DealerSignalsDetectInput): DealerSignalKind[] {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks ?? {});
  const checks: Record<DealerSignalKind, () => boolean> = {
    mileage_mismatch: () => hasMileageMismatchSignal(input.sourceIssues),
    special_status: () => hasSpecialStatusSignal(blocks, input),
    incidents: () => hasIncidentSignal(blocks, input) || hasPreviewIncidentSignal(input),
    us_history: () => hasUsHistorySignal(blocks, input),
    auction_photos: () => hasAuctionPhotoSignal(blocks, input),
    archive_photos: () => hasArchivePhotoSignal(input),
    foreign_registry: () => hasForeignRegistrySignal(blocks),
    extra_history: () => hasExtraHistorySignal(input),
  };
  const found = DEALER_SIGNAL_KINDS.filter((k) => {
    try {
      return checks[k]();
    } catch {
      return false;
    }
  });
  // Izsoļu + arhīva foto -> viena rinda «Arhīva fotogrāfijas» (tās teksts min arī izsoles), bez dublēšanās.
  return found.includes("archive_photos") ? found.filter((k) => k !== "auction_photos") : found;
}
