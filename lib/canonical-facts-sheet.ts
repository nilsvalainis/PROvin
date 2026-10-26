/**
 * Deterministiska „KANONISKIE FAKTI” lapa ✨ promptiem (2–4k rakstzīmes).
 * Bez LLM: īpašnieki, nobraukums + forenzika, negadījumi, TA, dīleris (LV),
 * atsaukumi, sludinājums, foto kopsavilkums. Nav EUR remonta tāmes.
 */
import {
  collectRegistryCountryPeriods,
  countryAtFromPeriods,
  formatRegistryCountryPeriodLine,
  type RegistryCountryPeriod,
} from "@/lib/registry-country-periods";
import { collectEngineOilChangeRows } from "@/lib/oil-change-intervals";
import { collectDamageEvidence, type DamageEvidence } from "@/lib/damage-evidence";
import { computeProvinAlertBannersFromWorkspace } from "@/lib/provin-alert-banners";
import {
  ODOMETER_REPLACEMENT_RE,
  analyzeOdometerRollbackBounds,
  approxLaterReadingFromPayload,
  formatForensicsInt,
  isRealOdometerDrop,
  type OdometerRollbackBound,
} from "@/lib/admin-ai-mileage-forensics";
import {
  analyzeTechnicalInspectionCoverage,
  type TechnicalInspectionCoverage,
} from "@/lib/admin-ai-ta-coverage";
import {
  buildDealerFactsLvSourceLines,
  DEALER_COMPONENTS,
  dealerServiceWorksFromSources,
  extractDealerFacts,
  type DealerFact,
} from "@/lib/admin-ai-dealer-facts";
import { adminRichHtmlToPlainText } from "@/lib/admin-rich-comment-html";
import {
  autoRecordsBlockToPlainText,
  citiAvotiToPlainText,
  csddFormToPlainText,
  listingAnalysisToPlainText,
  ltabBlockToPlainText,
  mergeSourceBlocksWithDefaults,
  oneautoBlockToPlainText,
  REGISTRY_STYLE_BLOCK_KEYS,
  SOURCE_BLOCK_LABELS,
  tirgusFormToPlainText,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  vendorAvotuBlockToPlainText,
  vinRegistryBlockToPlainText,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { asvBlockToPlainText } from "@/lib/asv-report";
import { ccVinBlockToPlainText } from "@/lib/cc-vin-report";
import {
  buildPreviouslyGeneratedSourceCommentsContext,
} from "@/lib/admin-source-comment-blocks";
import {
  ADMIN_INCIDENTS_SUMMARY_LABEL,
  ADMIN_MILEAGE_HISTORY_COMMENT_LABEL,
  ADMIN_SOURCES_COMPARISON_LABEL,
  ADMIN_TECHNICAL_RISKS_LABEL,
} from "@/lib/admin-workspace-field-labels";
import { countryLabelToIso2, normalizeCountryNameLv } from "@/lib/country-names-lv";
import {
  formatOwnerCountAiContext,
  ownerCountTotal,
  synthesizeOwnerCountsFromBlocks,
  type OwnerCountSynthesis,
} from "@/lib/owner-count-synthesis";
import {
  computeOdometerAnomalyBySourceOrder,
  collectImplausibleMileageReadings,
  collectUnifiedMileageRows,
  formatCsddUndatedOdometerLine,
  formatImplausibleReadingLine,
  type UnifiedMileageRow,
  hasAnyOdometerAnomaly,
  resolveCsddUndatedOdometer,
  type CsddUndatedOdometer,
  parseOdometerKm,
  sortMileageChronological,
  type UnifiedMileageSourcePayload,
} from "@/lib/unified-mileage";
import { collectUnifiedIncidentRows, type UnifiedIncidentRow } from "@/lib/unified-incidents";
import { extractCampaignCodes } from "@/lib/unit-facts/check";

export const CANONICAL_FACTS_HEADER = "KANONISKIE FAKTI";
export const CANONICAL_FACTS_INSTRUCTION =
  "Nerunā pretī šiem faktiem; ja avots ir pretrunā, norādi to piesardzīgi.";
export const CANONICAL_FACTS_MAX_CHARS = 4000;
export const CANONICAL_FACTS_TARGET_MIN_CHARS = 2000;

export const SUSPECTED_ENTRY_ERROR_LINE_PREFIX =
  "Atsevišķs neatbilstošs rādījums (iespējama ievades kļūda, NEPIEMINĒT kā korekciju)";

/** Kritums, no kura „nelielas nobīdes” ir minimizācija. */
export const IMPLAUSIBLE_READING_LINE_PREFIX =
  "Izlaists neticams rādījums (ievades kļūda; NEPIEMINĒT kā korekciju vai kritumu)";
export const LARGE_ODOMETER_DROP_KM = 5000;

/**
 * Tikai reāli CarVertical nobraukuma brīdinājumi ("Konstatēts potenciāla nobraukuma samazināšana",
 * "varētu būt viltots nobraukums", "odometer rollback"). NE vārds "odometr" pats par sevi: CV PDF
 * šablonā vienmēr ir "Odometra rādījumu ieraksti" / "...sakrīt ar automašīnas odometrā fiksēto rādījumu".
 */
const CARVERTICAL_MILEAGE_WARN_RE =
  /(?:konstatēt|fiksēt|atrast)\p{L}*\s+(?:potenciāl\p{L}*\s+|iespējam\p{L}*\s+)?nobraukuma\s+(?:samazinā|attīš|manipulācij|neatbilstīb|korekcij)|viltots\s+nobraukums|odometr\p{L}*\s+(?:rādījum\p{L}*\s+)?(?:neatbilstīb|korekcij|attīš|manipulācij|kritum)|nobraukuma\s+(?:neatbilstīb|attīš|manipulācij)|odometer.{0,30}(?:discrep|rollback|anomal)|mileage.{0,30}(?:discrep|mismatch|rollback|anomal)|korekcij.{0,30}odometr/giu;
/** "Nav odometra neatbilstības", "odometra neatbilstību ieraksti nav reģistrēti" - nav brīdinājums. */
const MILEAGE_WARN_NEGATION_BEFORE_RE = /(?:^|[^\p{L}])(?:nav|bez|nekād\p{L}*|netika|no|not|without|none)[^\p{L}][^.!?\n]{0,25}$/iu;
const MILEAGE_WARN_NEGATION_AFTER_RE = /^[^.!?\n]{0,60}(?:[^\p{L}])(?:nav|netika|nekonstatē\p{L}*|not found|none)(?:[^\p{L}]|$)/iu;

function hasCarverticalMileageWarningPhrase(blob: string): boolean {
  for (const m of blob.matchAll(CARVERTICAL_MILEAGE_WARN_RE)) {
    const at = m.index ?? 0;
    const before = blob.slice(Math.max(0, at - 40), at);
    const after = blob.slice(at + m[0].length, at + m[0].length + 80);
    if (MILEAGE_WARN_NEGATION_BEFORE_RE.test(before) || MILEAGE_WARN_NEGATION_AFTER_RE.test(after)) continue;
    return true;
  }
  return false;
}

export type CanonicalFactsInput = {
  vin?: string | null;
  listingUrl?: string | null;
  notes?: string | null;
  sourceBlocks: WorkspaceSourceBlocks;
  irissSummary?: string;
  inspectionPlan?: string;
  technicalRiskAnalysis?: string;
  priceFit?: string;
  extraSellerName?: string;
  internalComment?: string;
  mileageComment?: string;
  sourcesComparisonComment?: string;
};

export type CanonicalOwnerFacts = {
  totalCount: number;
  noteLine: string;
  /** N īpašnieki → N-1 maiņas (pa valstīm, tad summa). */
  changeCount: number;
  latviaOwners: number | null;
  latviaChanges: number | null;
};

export type CanonicalFirstReg = {
  date: string;
  countryRaw: string;
  countryLv: string;
  /** ISO alpha-2, ja zināms (DE vs LV pret lapu). */
  countryIso: string;
};

export type DealerComponentCount = { label: string; dates: string[] };

/** Dīlera sadaļas zīmju budžets faktu lapā (rindas + skaiti). */
export const CANONICAL_DEALER_ROWS_BUDGET_CHARS = 1600;
const DEALER_ROW_MAX_CHARS = 140;

export type SuspectedEntryError = { date: string; km: number; source: string };

export type CanonicalFacts = {
  vin: string;
  makeModel: string;
  year: string;
  owners: CanonicalOwnerFacts;
  firstReg: CanonicalFirstReg;
  latestKm: number | null;
  /** Tikai reāli kritumi (iespējama korekcija). Izolētas ievades kļūdas - `suspectedEntryErrors`. */
  rollbacks: OdometerRollbackBound[];
  /** Viens rādījums ārpus secības; AI to NEraksta kā korekciju (nobraukuma laukā max 1 neitrāls teikums). */
  suspectedEntryErrors: SuspectedEntryError[];
  /** j26: neticami rādījumi (< 1 000 km pēc > 1 gada), izslēgti no aprēķina un PDF. */
  implausibleReadings: UnifiedMileageRow[];
  /** j26: valstu posmi no reģistru laika līnijas. */
  countryPeriods: RegistryCountryPeriod[];
  /** CSDD rādījums bez datuma (nereģistrēts auto); nav krituma aprēķinā. */
  csddUndatedOdometer: CsddUndatedOdometer | null;
  odometerAnomaly: boolean;
  carverticalMileageWarning: boolean;
  maxRollbackDropKm: number;
  incidents: UnifiedIncidentRow[];
  /** Visi bojājumu pierādījumi, arī bez summas (izsoles, reģistru izņemšana bojājuma dēļ). */
  damageEvidence: DamageEvidence;
  /** Automātisko brīdinājumu (sarkano/dzelteno baneru) teksti, kas nonāk atskaitē. */
  alertBannerTexts: string[];
  ta: TechnicalInspectionCoverage;
  dealerRowsLv: string;
  /** j26: komponentu skaiti no VISĀM dīlera rindām (kods, ne modelis). */
  dealerComponentCounts: DealerComponentCount[];
  /** j26: reģistru statusi (FIN ierobežojumi, izņemšana no uzskaites u.c.). */
  registryStatusLines: string[];
  dealerCampaigns: DealerFact[];
  recallCodes: string[];
  listingSummary: string;
  photoSummary: string;
  dateHaystack: string;
  sourceHaystack: string;
  sheet: string;
};

function unifiedMileagePayload(blocks: WorkspaceSourceBlocks): UnifiedMileageSourcePayload {
  return {
    csddForm: blocks.csdd,
    autoRecordsBlock: blocks.auto_records,
    oneautoBlock: blocks.oneauto,
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    citiAvotiBlock: blocks.citi_avoti,
    tirgusForm: blocks.tirgus,
  };
}

function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function firstSentence(plain: string, max = 180): string {
  const t = plain.replace(/\s+/g, " ").trim();
  if (!t) return "";
  const m = t.match(/^.{8,180}?[.!?…](?:\s|$)/);
  return clip(m?.[0] ?? t, max);
}

function countryLv(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return normalizeCountryNameLv(t) || t;
}

function ownerChangesFromCount(n: number): number {
  return n > 0 ? n - 1 : 0;
}

function ownersFromSynthesis(synth: OwnerCountSynthesis, latviaEventCount: number): CanonicalOwnerFacts {
  const latvia = synth.chosen.latvia?.count ?? null;
  const changeCount = Object.values(synth.chosen).reduce(
    (sum, c) => sum + ownerChangesFromCount(c?.count ?? 0),
    0,
  );
  return {
    totalCount: ownerCountTotal(synth.chosen),
    noteLine: synth.noteLine,
    changeCount,
    latviaOwners: latvia,
    latviaChanges:
      latvia != null ? ownerChangesFromCount(latvia) : latviaEventCount > 0 ? latviaEventCount : null,
  };
}

function collectCarverticalMileageWarning(blocks: WorkspaceSourceBlocks): boolean {
  const cv = blocks.carvertical;
  const blob = [
    cv.comments,
    cv.mileagePasteRaw,
    cv.aiContextRaw,
    (cv.vehicleHistoryTimeline ?? []).map((r) => `${r.description} ${r.country}`).join("\n"),
  ].join("\n");
  return hasCarverticalMileageWarningPhrase(blob);
}

function collectDates(...parts: string[]): string {
  return parts.filter(Boolean).join("\n");
}

function listingSummaryFrom(blocks: WorkspaceSourceBlocks, listingUrl: string, extraSeller: string): string {
  const listing = blocks.listing_analysis;
  const tirgus = blocks.tirgus;
  const lines = [
    listingUrl ? `Saite: ${listingUrl}` : "",
    extraSeller ? `Pārdevējs: ${extraSeller}` : "",
    listing.extraSellerName.trim() ? `Pārdevējs (lauks): ${listing.extraSellerName.trim()}` : "",
    tirgus.listedForSale.trim() ? `Pārdošanā (dienas): ${tirgus.listedForSale.trim()}` : "",
    tirgus.listingCreated.trim() ? `Izveidots: ${tirgus.listingCreated.trim()}` : "",
    tirgus.priceDrop.trim() ? `Cenas izmaiņas: ${tirgus.priceDrop.trim()}` : "",
    tirgus.listingMileageOdometer.trim()
      ? `Sludinājuma odometrs: ${tirgus.listingMileageOdometer.trim()} ${tirgus.listingMileageDate.trim()} ${tirgus.listingMileageCountry.trim()}`.trim()
      : "",
    listing.listingPasteRaw.trim() ? `Apraksts: ${clip(listing.listingPasteRaw, 280)}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function photoSummaryFrom(blocks: WorkspaceSourceBlocks): string {
  const listing = blocks.listing_analysis;
  const photoCount = (listing.photoGroups ?? []).reduce((n, g) => n + (g.photos?.length ?? 0), 0);
  const comment = adminRichHtmlToPlainText(listing.photoAnalysis).trim();
  const lines = [
    photoCount > 0 ? `Foto skaits: ${photoCount}` : "",
    comment ? `Foto komentārs: ${clip(comment, 280)}` : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function sourceHaystackFrom(blocks: WorkspaceSourceBlocks, extra: string[]): string {
  const parts = [
    ...extra,
    csddFormToPlainText(blocks.csdd),
    vendorAvotuBlockToPlainText(blocks.autodna),
    vendorAvotuBlockToPlainText(blocks.carvertical),
    ltabBlockToPlainText(blocks.ltab),
    tirgusFormToPlainText(blocks.tirgus),
    listingAnalysisToPlainText(blocks.listing_analysis),
    autoRecordsBlockToPlainText(blocks.auto_records),
    oneautoBlockToPlainText(blocks.oneauto),
    ccVinBlockToPlainText(blocks.cc_vin),
    asvBlockToPlainText(blocks.asv),
    vinRegistryBlockToPlainText(blocks.tjekbil),
    vinRegistryBlockToPlainText(blocks.finnik),
    vinRegistryBlockToPlainText(blocks.mnt_ee),
    vinRegistryBlockToPlainText(blocks.lkf_ee),
    vinRegistryBlockToPlainText(blocks.carinfo),
    vinRegistryBlockToPlainText(blocks.traficom_fi),
    citiAvotiToPlainText(blocks.citi_avoti),
    listingSummaryFrom(blocks, "", ""),
  ];
  return parts.filter(Boolean).join("\n");
}

function firstRegFromCsdd(csdd: WorkspaceSourceBlocks["csdd"]): CanonicalFirstReg {
  const date = csdd.firstRegistration.trim() || csdd.registry?.data.firstRegistrationIso.trim() || "";
  const countryRaw = csdd.previousRegistrationCountry.trim();
  const countryLvResolved = countryRaw ? countryLv(countryRaw) : date ? "Latvija" : "";
  const isoFromRaw = countryRaw ? countryLabelToIso2(countryRaw) : null;
  const isoFromLv =
    /vācij/i.test(countryLvResolved) ? "DE" : /latvij/i.test(countryLvResolved) ? "LV" : "";
  return {
    date,
    countryRaw,
    countryLv: countryLvResolved,
    countryIso: (isoFromRaw || isoFromLv).toUpperCase(),
  };
}

export function buildCanonicalFacts(input: CanonicalFactsInput): CanonicalFacts {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const csdd = blocks.csdd;
  const mileageRows = collectUnifiedMileageRows(unifiedMileagePayload(blocks));
  const mileagePayload = unifiedMileagePayload(blocks);
  const csddUndated = resolveCsddUndatedOdometer(mileagePayload);
  const countryPeriods = collectRegistryCountryPeriods(blocks);
  const implausibleReadings = collectImplausibleMileageReadings(mileagePayload);
  const allDrops = analyzeOdometerRollbackBounds(mileageRows, {
    odometerReplacementNoted: ODOMETER_REPLACEMENT_RE.test(sourceHaystackFrom(blocks, [])),
    approxLaterReading: approxLaterReadingFromPayload(mileagePayload),
    // j26: valsts maiņa krituma brīdī tikai no reģistru laika līnijas, ne no avota cilnes.
    countryAt: (t) => countryAtFromPeriods(countryPeriods, t),
  });
  const rollbacks = allDrops.filter(isRealOdometerDrop);
  const suspectedEntryErrors = allDrops
    .filter((b) => !isRealOdometerDrop(b) && b.suspect)
    .map((b) => b.suspect!);
  const anomalyMap = computeOdometerAnomalyBySourceOrder(mileageRows);
  // Tabulas karogs no tā paša izolētā punkta nav korekcijas pazīme.
  const odometerAnomaly =
    hasAnyOdometerAnomaly(anomalyMap) && !(allDrops.length > 0 && rollbacks.length === 0);
  const carverticalMileageWarning = collectCarverticalMileageWarning(blocks);
  const chrono = sortMileageChronological(mileageRows);
  const lastWithKm = [...chrono].reverse().find((r) => parseOdometerKm(r.odometer) != null);
  const latestKm = lastWithKm ? parseOdometerKm(lastWithKm.odometer) : null;

  const synth = synthesizeOwnerCountsFromBlocks(blocks);
  const latviaEvents = (csdd.ownerRegistrationEvents ?? []).filter((r) => r.date.trim() || r.label.trim()).length;
  const owners = ownersFromSynthesis(synth, latviaEvents);

  const firstReg = firstRegFromCsdd(csdd);
  const firstRegDate = firstReg.date;

  const incidents = collectUnifiedIncidentRows({
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
  });

  const ta = analyzeTechnicalInspectionCoverage({ csdd, sourceBlocks: blocks });
  const dealer = extractDealerFacts({ oneauto: blocks.oneauto, autoRecords: blocks.auto_records });
  const dealerCampaigns = dealer.rows.filter((r) => r.kind === "campaign");
  const dealerRowsLv = dealer.rows
    .map((r) => {
      const km = r.odometerKm != null ? `${formatForensicsInt(r.odometerKm)} km` : "km nav";
      const kind = r.kind === "campaign" ? ` kampaņa${r.campaignCode ? ` ${r.campaignCode}` : ""}` : "";
      return `${r.date || "datums nav"}, ${km}: ${r.worksLv || "darbs nav norādīts"}${kind}`;
    })
    .join("\n");

  const dealerComponentCounts = buildDealerComponentCounts(
    dealer.rows,
    collectEngineOilChangeRows(dealerServiceWorksFromSources({ oneauto: blocks.oneauto, autoRecords: blocks.auto_records })),
  );
  const registryStatusLines = collectRegistryStatusLines(blocks);

  const haystack = sourceHaystackFrom(blocks, [
    input.vin ?? "",
    input.notes ?? "",
    input.listingUrl ?? "",
    dealerRowsLv,
    buildDealerFactsLvSourceLines(dealer),
  ]);
  const recallCodes = [
    ...extractCampaignCodes(haystack),
    ...dealerCampaigns.map((r) => (r.campaignCode ?? "").toUpperCase()).filter(Boolean),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const listingSummary = listingSummaryFrom(
    blocks,
    input.listingUrl?.trim() ?? "",
    input.extraSellerName?.trim() ?? "",
  );
  const photoSummary = photoSummaryFrom(blocks);

  const dateHaystack = collectDates(
    firstRegDate,
    ta.lastInspectionDate ?? "",
    ta.nextInspectionDate ?? "",
    ...mileageRows.map((r) => r.date),
    ...incidents.map((r) => r.date),
    ...dealer.rows.map((r) => r.date),
    haystack,
  );

  const facts: CanonicalFacts = {
    vin: input.vin?.trim() ?? "",
    makeModel: csdd.makeModel.trim(),
    year: csdd.modelYear.trim(),
    owners,
    firstReg,
    latestKm,
    rollbacks,
    suspectedEntryErrors,
    csddUndatedOdometer: csddUndated,
    implausibleReadings,
    countryPeriods,
    odometerAnomaly,
    carverticalMileageWarning,
    maxRollbackDropKm: rollbacks.reduce((m, r) => Math.max(m, r.minDropKm), 0),
    incidents,
    damageEvidence: collectDamageEvidence(blocks),
    alertBannerTexts: computeProvinAlertBannersFromWorkspace(blocks).map((b) => b.text.trim()).filter(Boolean),
    ta,
    dealerRowsLv,
    dealerComponentCounts,
    registryStatusLines,
    dealerCampaigns,
    recallCodes,
    listingSummary,
    photoSummary,
    dateHaystack,
    sourceHaystack: haystack,
    sheet: "",
  };
  facts.sheet = formatCanonicalFactsSheet(facts, synth);
  return facts;
}

function clipSheet(text: string): string {
  if (text.length <= CANONICAL_FACTS_MAX_CHARS) return text;
  const lines = text.split("\n");
  const out: string[] = [];
  let n = 0;
  for (const line of lines) {
    if (n + line.length + 1 > CANONICAL_FACTS_MAX_CHARS - 20) {
      out.push("… (kanoniskā lapa saīsināta līdz 4000 rakstzīmēm)");
      break;
    }
    out.push(line);
    n += line.length + 1;
  }
  return out.join("\n");
}

export function formatCanonicalFactsSheet(facts: CanonicalFacts, synth?: OwnerCountSynthesis): string {
  const lines: string[] = [
    `=== ${CANONICAL_FACTS_HEADER} ===`,
    CANONICAL_FACTS_INSTRUCTION,
  ];
  const id = [
    facts.vin ? `VIN: ${facts.vin}` : "",
    facts.makeModel ? `Marka/modelis: ${facts.makeModel}` : "",
    facts.year ? `Gads: ${facts.year}` : "",
  ].filter(Boolean);
  if (id.length) lines.push(id.join(" | "));

  lines.push("Īpašnieki:");
  if (facts.owners.totalCount > 0) {
    lines.push(
      `- Skaits: ${facts.owners.totalCount}${facts.owners.noteLine ? ` (${facts.owners.noteLine})` : ""}`,
    );
    lines.push(
      `- Maiņas: ${facts.owners.changeCount} (N īpašnieki = N-1 maiņas; nesummē to pašu tirgu divreiz)`,
    );
    if (facts.owners.latviaOwners != null) {
      lines.push(
        `- Latvijā: ${facts.owners.latviaOwners} īpašnieki, ${facts.owners.latviaChanges ?? ownerChangesFromCount(facts.owners.latviaOwners)} maiņas`,
      );
    }
  } else {
    lines.push("- Skaitlis datos nav fiksēts");
  }
  if (synth) {
    const ctx = formatOwnerCountAiContext(synth).trim();
    if (ctx) lines.push(clip(ctx.replace(/^/gm, "  "), 500));
  }

  const countryBit = facts.firstReg.countryLv
    ? `izcelsmes valsts: ${facts.firstReg.countryLv}${facts.firstReg.countryIso ? ` (${facts.firstReg.countryIso})` : facts.firstReg.countryRaw && facts.firstReg.countryRaw !== facts.firstReg.countryLv ? ` (${facts.firstReg.countryRaw})` : ""}`
    : "izcelsmes valsts datos nav";
  lines.push(
    `Pirmā reģistrācija: ${facts.firstReg.date || "datums nav"} | ${countryBit}`,
  );

  lines.push("Nobraukums:");
  lines.push(
    `- Jaunākais rādījums: ${facts.latestKm != null ? `${formatForensicsInt(facts.latestKm)} km` : "nav"}`,
  );
  if (facts.csddUndatedOdometer) {
    lines.push(`- ${formatCsddUndatedOdometerLine(facts.csddUndatedOdometer)}`);
  }
  lines.push(
    `- Forenzikas karogs (odometra anomālija tabulā): ${facts.odometerAnomaly ? "JĀ" : "nē"}`,
  );
  lines.push(
    `- CarVertical nobraukuma brīdinājums: ${facts.carverticalMileageWarning ? "JĀ" : "nē"}`,
  );
  if (facts.rollbacks.length === 0) {
    lines.push("- Odometra kritums: nav (vai zem sliekšņa)");
  } else {
    for (const b of facts.rollbacks) {
      lines.push(
        `- Kritums: ${b.fromDate} ${formatForensicsInt(b.fromKm)} km${dropPointOrigin(b.fromSource, b.fromCountry)} → ${b.toDate} ${formatForensicsInt(b.toKm)} km${dropPointOrigin(b.toSource, b.toCountry)}; minimums ${formatForensicsInt(b.minDropKm)} km${b.maxDropKm != null ? `, robeža ~${formatForensicsInt(b.maxDropKm)} km` : ""}`,
      );
    }
    if (facts.maxRollbackDropKm >= LARGE_ODOMETER_DROP_KM) {
      lines.push(
        `- Liels kritums (${formatForensicsInt(facts.maxRollbackDropKm)} km): aizliegts mīkstināt ar „nelielas nobīdes”.`,
      );
    }
  }

  for (const e of facts.suspectedEntryErrors) {
    lines.push(
      `- ${SUSPECTED_ENTRY_ERROR_LINE_PREFIX}: ${e.date}, ${formatForensicsInt(e.km)} km, ${e.source}`,
    );
  }
  for (const r of facts.implausibleReadings) {
    lines.push(`- ${IMPLAUSIBLE_READING_LINE_PREFIX}: ${formatImplausibleReadingLine(r)}`);
  }
  if (facts.countryPeriods.length > 0) {
    lines.push("Valstu posmi (no reģistru laika līnijas; avota nosaukums NAV valsts posms):");
    for (const p of facts.countryPeriods) lines.push(`- ${formatRegistryCountryPeriodLine(p)}`);
  }

  lines.push(`Negadījumi / zaudējumi: ${facts.incidents.length} rindas`);
  for (const r of facts.incidents.slice(0, 8)) {
    lines.push(
      `- ${r.date || "datums nav"} | ${r.lossAmount || "summa nav"} | ${r.country || ""} | ${r.sourceLabel}`.trim(),
    );
  }
  if (facts.incidents.length > 8) lines.push(`- … vēl ${facts.incidents.length - 8}`);
  if (facts.damageEvidence.total > 0) {
    lines.push(
      `Bojājumi (visi avoti, arī bez summas): ${facts.damageEvidence.total} - bojājumi IR fiksēti; aizliegts rakstīt, ka bojājumu nav`,
    );
    for (const r of facts.damageEvidence.rows.slice(0, 8)) {
      lines.push(`- ${r.date} | ${r.descriptionLv} | ${r.amount || "summa nav"} | ${r.sourceLabel}`);
    }
    if (facts.damageEvidence.total > 8) lines.push(`- … vēl ${facts.damageEvidence.total - 8}`);
  }
  if (facts.alertBannerTexts.length > 0) {
    lines.push("Brīdinājumi atskaitē:");
    for (const t of facts.alertBannerTexts.slice(0, 6)) lines.push(`- ${t}`);
  }

  lines.push("TA nosegums:");
  lines.push(
    `- Līmenis: ${facts.ta.level}; pēdējā: ${facts.ta.lastInspectionDate ?? "nav"}; nākamā: ${facts.ta.nextInspectionDate ?? "nav"}`,
  );
  if (facts.ta.ratingLabel) lines.push(`- Novērtējums: ${facts.ta.ratingLabel}`);

  if (facts.dealerRowsLv.trim()) {
    lines.push(...formatDealerSection(facts.dealerRowsLv, facts.dealerComponentCounts));
  } else {
    lines.push("Dīlera fakti: nav");
  }
  if (facts.registryStatusLines.length > 0) {
    lines.push("Reģistru statusi (ierobežojumi, izņemšana no uzskaites):");
    for (const row of facts.registryStatusLines.slice(0, 10)) lines.push(`- ${row}`);
  }

  lines.push(
    `Atsaukumi / kampaņu kodi datos: ${facts.recallCodes.length ? facts.recallCodes.join(", ") : "nav fiksētu kodu"}`,
  );
  if (facts.dealerCampaigns.length > 0) {
    lines.push(`- Dīlera kampaņas: ${facts.dealerCampaigns.length}`);
  }

  if (facts.listingSummary) {
    lines.push("Sludinājums:");
    for (const row of facts.listingSummary.split("\n").slice(0, 8)) lines.push(`- ${row}`);
  }
  if (facts.photoSummary) {
    lines.push("Foto:");
    for (const row of facts.photoSummary.split("\n")) lines.push(`- ${row}`);
  }

  const body = lines.join("\n");
  const closed = `${clipSheet(body)}\n=== BEIGAS ${CANONICAL_FACTS_HEADER} ===`;
  return closed;
}

const ENGINE_OIL_COUNT_LABEL = "Dzinēja eļļas maiņas";

function buildDealerComponentCounts(
  rows: readonly DealerFact[],
  engineOilRows: readonly { date: string }[],
): DealerComponentCount[] {
  const out: DealerComponentCount[] = [];
  const oilDates = [...new Set(engineOilRows.map((r) => r.date.trim()).filter(Boolean))];
  if (oilDates.length > 0) out.push({ label: ENGINE_OIL_COUNT_LABEL, dates: oilDates });
  for (const c of DEALER_COMPONENTS) {
    const dates = [
      ...new Set(rows.filter((r) => r.components.includes(c.id)).map((r) => r.date.trim() || "datums nav")),
    ];
    if (dates.length === 0) continue;
    const label = c.id === "gearbox_oil" ? "Kārbas eļļas maiņas" : c.lv.charAt(0).toUpperCase() + c.lv.slice(1);
    out.push({ label, dates });
  }
  return out;
}

/** Visas dīlera rindas (bez 12 griestiem) zīmju budžetā; ja nepietiek - izlaiž VECĀKĀS, skaiti paliek pilni. */
function formatDealerSection(dealerRowsLv: string, counts: readonly DealerComponentCount[]): string[] {
  const rows = dealerRowsLv
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => (r.length > DEALER_ROW_MAX_CHARS ? `${r.slice(0, DEALER_ROW_MAX_CHARS - 1)}…` : r));
  const countLines = counts.map((c) => `- ${c.label}: ${c.dates.length} (${c.dates.join(", ")})`);
  let budget = CANONICAL_DEALER_ROWS_BUDGET_CHARS - countLines.reduce((n, l) => n + l.length + 1, 0);
  const kept: string[] = [];
  for (let i = rows.length - 1; i >= 0; i--) {
    const line = `- ${rows[i]}`;
    if (budget - line.length - 1 < 0 && kept.length > 0) break;
    kept.unshift(line);
    budget -= line.length + 1;
  }
  const omitted = rows.length - kept.length;
  const out = [`Dīlera fakti (latviski): ${rows.length} rindas`];
  if (omitted > 0) out.push(`- … ${omitted} agrākas rindas izlaistas (skaiti zemāk ir no VISĀM rindām)`);
  out.push(...kept);
  if (countLines.length > 0) {
    out.push("Dīlera darbu skaiti (no visām rindām; cits skaits aizliegts, „nav” aizliegts, ja skaits > 0):");
    out.push(...countLines);
  }
  return out;
}

/** FIN/registru statusi un piezīmes (ierobežojumi, izņemšana bojājuma dēļ) ar avotu. */
function collectRegistryStatusLines(blocks: WorkspaceSourceBlocks): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of REGISTRY_STYLE_BLOCK_KEYS) {
    const b = blocks[key];
    const label = SOURCE_BLOCK_LABELS[key];
    for (const raw of [b.statusRecords ?? "", b.autoNotes ?? ""].join("\n").split("\n")) {
      const line = raw.trim();
      if (!line || !REGISTRY_STATUS_RE.test(line)) continue;
      const k = `${label}|${line}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(`${line} (${label})`);
    }
  }
  return out;
}

const REGISTRY_STATUS_RE =
  /ierobežojum|aizliegum|noņemts no reģistra|izņemt\w* no uzskaites|apskate nav|decommission|restriction|prohibition/i;

function dropPointOrigin(source?: string, country?: string): string {
  const bits = [source?.trim(), country?.trim()].filter(Boolean);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

export function buildCanonicalFactsSheet(input: CanonicalFactsInput): string {
  return buildCanonicalFacts(input).sheet;
}

function plainField(html: string | undefined): string {
  return adminRichHtmlToPlainText(html ?? "").trim();
}

/** Viena rinda par jau uzrakstītiem laukiem (avotu komentāriem — bez eseju dublikātiem). */
/**
 * j26: „nav X” teikumi no citiem laukiem nav fakti (tie var būt kļūdaini) - tos nedod
 * tālāk, lai kļūda neizplatās („pretrunā ar citu reģistru negadījumu sadaļām”).
 */
export function isNegativeVerdict(sentence: string): boolean {
  return /(?<!\p{L})(?:nav|nevien\p{L}*|netika|neatrad\p{L}*)(?!\p{L})/iu.test(sentence);
}

export function buildOtherFieldVerdicts(
  input: CanonicalFactsInput,
  excludeLabel?: string,
): string {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const rows: string[] = [];
  const push = (label: string, html: string | undefined) => {
    if (excludeLabel && label === excludeLabel) return;
    const plain = plainField(html);
    if (!plain) return;
    const sentence = firstSentence(plain);
    if (isNegativeVerdict(sentence)) return;
    rows.push(`- ${label}: ${sentence}`);
  };

  const sourceComments = buildPreviouslyGeneratedSourceCommentsContext(null, blocks);
  if (sourceComments.trim()) {
    for (const block of sourceComments.split(/(?=^### )/m)) {
      const m = block.match(/^### ([^\n]+)\n([\s\S]*)$/);
      if (!m) continue;
      const label = m[1]!.trim();
      if (excludeLabel && label === excludeLabel) continue;
      const sentence = firstSentence(m[2] ?? "");
      if (sentence && !isNegativeVerdict(sentence)) rows.push(`- ${label}: ${sentence}`);
    }
  }

  push(ADMIN_MILEAGE_HISTORY_COMMENT_LABEL, input.mileageComment);
  push(ADMIN_INCIDENTS_SUMMARY_LABEL, input.internalComment);
  push("Cenas atbilstība", input.priceFit);
  push(ADMIN_TECHNICAL_RISKS_LABEL, input.technicalRiskAnalysis);
  push("2. Ieteikumi klātienes apskatei", input.inspectionPlan);
  push("3. Kopsavilkums", input.irissSummary);
  push(ADMIN_SOURCES_COMPARISON_LABEL, input.sourcesComparisonComment);
  push("Pārdevēja portrets", blocks.listing_analysis.sellerPortrait);
  push(SOURCE_BLOCK_LABELS.tirgus, blocks.tirgus.comments);

  if (rows.length === 0) return "";
  return `### Citu lauku verdikti (viena rinda; NEATKĀRTO eseju, nerunā pretī KANONISKAJIEM FAKTIEM)\n${rows.join("\n")}`;
}

/** Kopsavilkuma laukiem: visi komentāri vienu reizi (bez stila-references dublikāta). */
export function buildAllCommentsContext(input: CanonicalFactsInput): string {
  const blocks = mergeSourceBlocksWithDefaults(input.sourceBlocks);
  const parts: string[] = [];
  const sourceComments = buildPreviouslyGeneratedSourceCommentsContext(null, blocks).trim();
  if (sourceComments) parts.push(sourceComments);

  const expert: Array<[string, string | undefined]> = [
    [ADMIN_MILEAGE_HISTORY_COMMENT_LABEL, input.mileageComment],
    [ADMIN_INCIDENTS_SUMMARY_LABEL, input.internalComment],
    ["Cenas atbilstība", input.priceFit],
    [ADMIN_TECHNICAL_RISKS_LABEL, input.technicalRiskAnalysis],
    ["2. Ieteikumi klātienes apskatei", input.inspectionPlan],
    ["3. Kopsavilkums", input.irissSummary],
    [ADMIN_SOURCES_COMPARISON_LABEL, input.sourcesComparisonComment],
    ["Pārdevēja portrets", blocks.listing_analysis.sellerPortrait],
    ["Fotogrāfiju analīze", blocks.listing_analysis.photoAnalysis],
  ];
  for (const [label, html] of expert) {
    const plain = plainField(html);
    if (!plain) continue;
    parts.push(`### ${label}\n${plain}`);
  }
  if (parts.length === 0) return "";
  return `### Šī pasūtījuma komentāri (vienu reizi — neatkārto, nerunā pretī KANONISKAJIEM FAKTIEM)\n${parts.join("\n\n")}`;
}

export function hasRollbackOrMileageWarning(facts: CanonicalFacts): boolean {
  return facts.rollbacks.length > 0 || facts.odometerAnomaly || facts.carverticalMileageWarning;
}

function labelKey(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Admin bloka nosaukums ↔ nobraukuma rindas avots (piem. Izsoļu portālu arhīva rindas PDF nosaukums). */
const SOURCE_LABEL_ALIASES: Record<string, string[]> = {
  "cc.vin": ["izsoļu portālu arhīvs"],
  "izsoļu portālu arhīvs": ["cc.vin"],
  oneauto: ["oficiālā dīlera dati"],
};

export function sourceLabelsMatch(focusLabel: string, rowSources: string): boolean {
  const focus = labelKey(focusLabel);
  if (!focus) return false;
  const keys = [focus, ...(SOURCE_LABEL_ALIASES[focus] ?? [])];
  return rowSources
    .split(",")
    .map(labelKey)
    .some((s) => keys.includes(s));
}

/**
 * Vai šim laukam jāpiemin odometra kritums (`rollback_omitted`).
 * Nobraukums un kopsavilkums - vienmēr. Avota lauks - tikai, ja kritums ir ŠAJĀ avotā
 * (vai CarVertical brīdinājums CarVertical laukā). Pārējie lauki - nē.
 */
/** Lauki, kuros minimizējošs formulējums par lielu kritumu ir kļūda. */
export function isMileageRelatedCommentField(field?: string | null): boolean {
  const f = (field ?? "").toLowerCase();
  return (
    f === "mileage" ||
    f === "summary" ||
    f === "sources_comparison" ||
    f.startsWith("source") ||
    /csdd|autodna|carvertical|cc_vin|auto_records|mileage/.test(f)
  );
}

export function rollbackMentionRequired(
  field: string | null | undefined,
  facts: CanonicalFacts,
  focusSourceLabel?: string | null,
): boolean {
  const f = (field ?? "").toLowerCase();
  if (!hasRollbackOrMileageWarning(facts)) return false;
  if (f === "mileage" || f === "summary") return true;
  // Admin faktu pārbaude: lauks ir bloka atslēga („csdd”, „autodna”, „auto_records:oil…”).
  const [blockKey, subField] = f.split(":");
  const blockLabel = (SOURCE_BLOCK_LABELS as Record<string, string>)[blockKey ?? ""];
  let focus = "";
  if (blockLabel) {
    if (subField) return false;
    focus = blockKey === "oneauto" ? "OFICIĀLĀ DĪLERA DATI" : blockLabel;
  } else if (f.startsWith("source") && f !== "sources_comparison") {
    focus = focusSourceLabel?.trim() ?? "";
  }
  if (!focus) return false;
  if (facts.carverticalMileageWarning && labelKey(focus) === "carvertical") return true;
  return facts.rollbacks.some(
    (b) => sourceLabelsMatch(focus, b.fromSource ?? "") || sourceLabelsMatch(focus, b.toSource ?? ""),
  );
}
