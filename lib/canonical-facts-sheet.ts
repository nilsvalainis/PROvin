/**
 * Deterministiska „KANONISKIE FAKTI” lapa ✨ promptiem (2–4k rakstzīmes).
 * Bez LLM: īpašnieki, nobraukums + forenzika, negadījumi, TA, dīleris (LV),
 * atsaukumi, sludinājums, foto kopsavilkums. Nav EUR remonta tāmes.
 */
import {
  analyzeOdometerRollbackBounds,
  formatForensicsInt,
  type OdometerRollbackBound,
} from "@/lib/admin-ai-mileage-forensics";
import {
  analyzeTechnicalInspectionCoverage,
  type TechnicalInspectionCoverage,
} from "@/lib/admin-ai-ta-coverage";
import {
  buildDealerFactsLvSourceLines,
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
  collectUnifiedMileageRows,
  hasAnyOdometerAnomaly,
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

/** Kritums, no kura „nelielas nobīdes” ir minimizācija. */
export const LARGE_ODOMETER_DROP_KM = 5000;

const CARVERTICAL_MILEAGE_WARN_RE =
  /odometr|nobraukum.{0,50}neatbilst|neatbilst.{0,50}nobrauk|mileage.{0,30}(discrep|mismatch|rollback|anomal)|odometer.{0,30}(discrep|rollback|anomal)|korekcij.{0,30}odometr/i;

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

export type CanonicalFacts = {
  vin: string;
  makeModel: string;
  year: string;
  owners: CanonicalOwnerFacts;
  firstReg: CanonicalFirstReg;
  latestKm: number | null;
  rollbacks: OdometerRollbackBound[];
  odometerAnomaly: boolean;
  carverticalMileageWarning: boolean;
  maxRollbackDropKm: number;
  incidents: UnifiedIncidentRow[];
  ta: TechnicalInspectionCoverage;
  dealerRowsLv: string;
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
  return CARVERTICAL_MILEAGE_WARN_RE.test(blob);
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
  const rollbacks = analyzeOdometerRollbackBounds(mileageRows);
  const anomalyMap = computeOdometerAnomalyBySourceOrder(mileageRows);
  const odometerAnomaly = hasAnyOdometerAnomaly(anomalyMap);
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
    odometerAnomaly,
    carverticalMileageWarning,
    maxRollbackDropKm: rollbacks.reduce((m, r) => Math.max(m, r.minDropKm), 0),
    incidents,
    ta,
    dealerRowsLv,
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
        `- Kritums: ${b.fromDate} ${formatForensicsInt(b.fromKm)} km → ${b.toDate} ${formatForensicsInt(b.toKm)} km; minimums ${formatForensicsInt(b.minDropKm)} km${b.maxDropKm != null ? `, robeža ~${formatForensicsInt(b.maxDropKm)} km` : ""}`,
      );
    }
    if (facts.maxRollbackDropKm >= LARGE_ODOMETER_DROP_KM) {
      lines.push(
        `- Liels kritums (${formatForensicsInt(facts.maxRollbackDropKm)} km): aizliegts mīkstināt ar „nelielas nobīdes”.`,
      );
    }
  }

  lines.push(`Negadījumi / zaudējumi: ${facts.incidents.length} rindas`);
  for (const r of facts.incidents.slice(0, 8)) {
    lines.push(
      `- ${r.date || "datums nav"} | ${r.lossAmount || "summa nav"} | ${r.country || ""} | ${r.sourceLabel}`.trim(),
    );
  }
  if (facts.incidents.length > 8) lines.push(`- … vēl ${facts.incidents.length - 8}`);

  lines.push("TA nosegums:");
  lines.push(
    `- Līmenis: ${facts.ta.level}; pēdējā: ${facts.ta.lastInspectionDate ?? "nav"}; nākamā: ${facts.ta.nextInspectionDate ?? "nav"}`,
  );
  if (facts.ta.ratingLabel) lines.push(`- Novērtējums: ${facts.ta.ratingLabel}`);

  if (facts.dealerRowsLv.trim()) {
    lines.push("Dīlera fakti (latviski):");
    for (const row of facts.dealerRowsLv.split("\n").slice(0, 12)) lines.push(`- ${row}`);
  } else {
    lines.push("Dīlera fakti: nav");
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

export function buildCanonicalFactsSheet(input: CanonicalFactsInput): string {
  return buildCanonicalFacts(input).sheet;
}

function plainField(html: string | undefined): string {
  return adminRichHtmlToPlainText(html ?? "").trim();
}

/** Viena rinda par jau uzrakstītiem laukiem (avotu komentāriem — bez eseju dublikātiem). */
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
    rows.push(`- ${label}: ${firstSentence(plain)}`);
  };

  const sourceComments = buildPreviouslyGeneratedSourceCommentsContext(null, blocks);
  if (sourceComments.trim()) {
    for (const block of sourceComments.split(/(?=^### )/m)) {
      const m = block.match(/^### ([^\n]+)\n([\s\S]*)$/);
      if (!m) continue;
      const label = m[1]!.trim();
      if (excludeLabel && label === excludeLabel) continue;
      const sentence = firstSentence(m[2] ?? "");
      if (sentence) rows.push(`- ${label}: ${sentence}`);
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

export function isMileageRelatedCommentField(field?: string | null): boolean {
  const f = (field ?? "").toLowerCase();
  return (
    f === "mileage" ||
    f === "source" ||
    f === "source_dealer" ||
    f === "summary" ||
    f === "sources_comparison" ||
    f.startsWith("source") ||
    /csdd|autodna|carvertical|cc_vin|auto_records|mileage/.test(f)
  );
}
