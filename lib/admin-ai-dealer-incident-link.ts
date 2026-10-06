/**
 * OFICIĀLĀ DĪLERA DATI ↔ negadījumu vēsture.
 * Deterministiska datumu / konteksta sasaiste ✨ komentāriem.
 */
import {
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  SOURCE_BLOCK_LABELS,
  toPdfLtabManualBlock,
  toPdfManualVendorBlocks,
  vinRegistryIncidentRowHasData,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import {
  autoRecordsServiceWorkRowHasData,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import { oneautoDisplayToServiceWorks } from "@/lib/oneauto-dealer";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { parseMileageDateForSort } from "@/lib/unified-mileage";

const LINK_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;
const UNIQUE_PAIR_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

const BODY_GLASS_RE =
  /stikl|vējstikl|windshield|windscreen|scheibe|frontscheibe|glass|virsbūv|bodywork|body\s*(?:repair|shop)|karosser|pane[lļ]|spārn|fender|kotflügel|durv(?:is|ju)|door\s*panel|bamper|bumper|sto[sß]stange|stoßfänger|pārkrās|repaint|respray|lackier|paint|krāsoj|krāsot|hood|bonnet|pārsegs|tailgate|heckklappe|bagāžniek|sliekš|ark(?:a|as|u)|quarter|sān(?:a|u)\s+panel|negadīj|accident|unfall|collision|crash|dent|izlīdzin|skārda|smart\s*repair/i;

const ROUTINE_ONLY_RE =
  /^(?:eļļas?\s+maiņa|oil\s+(?:service|change)|inspection|vehicle\s+check|tehnisk(?:ā|a)\s+apskate|salona\s+filtr|air\s+filter|brake\s+fluid|bremžu\s+šķidrum)s?\b/i;

export type DealerIncidentLinkItem = {
  date: string;
  ms: number;
  monthOnly: boolean;
  label: string;
};

export type DealerIncidentPair = {
  incident: DealerIncidentLinkItem;
  work: DealerIncidentLinkItem;
};

export type DealerIncidentLinkAnalysis = {
  pairs: DealerIncidentPair[];
  unmatchedWorks: DealerIncidentLinkItem[];
  unmatchedIncidents: DealerIncidentLinkItem[];
};

export function dealerWorkLooksLikeBodyOrGlassRepair(works: string): boolean {
  const t = works.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (ROUTINE_ONLY_RE.test(t) && !BODY_GLASS_RE.test(t)) return false;
  return BODY_GLASS_RE.test(t);
}

function monthOnlyDate(raw: string): boolean {
  const t = formatAutoRecordsDateForOutput(raw) || raw.trim();
  return /^01\.\d{2}\.\d{4}$/.test(t) || /^\d{1,2}\.\d{4}$/.test(raw.trim());
}

function sameYearMonth(aMs: number, bMs: number): boolean {
  const a = new Date(aMs);
  const b = new Date(bMs);
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

function datesLink(a: DealerIncidentLinkItem, b: DealerIncidentLinkItem, windowMs: number): boolean {
  if (!Number.isFinite(a.ms) || !Number.isFinite(b.ms) || a.ms <= 0 || b.ms <= 0) return false;
  if (Math.abs(a.ms - b.ms) <= windowMs) return true;
  if ((a.monthOnly || b.monthOnly) && sameYearMonth(a.ms, b.ms)) return true;
  return false;
}

function collectDealerBodyWorks(blocks: WorkspaceSourceBlocks): DealerIncidentLinkItem[] {
  const rows: AutoRecordsServiceWorkRow[] = [
    ...(blocks.auto_records.serviceWorks ?? []),
    ...oneautoDisplayToServiceWorks(blocks.oneauto.display),
  ];
  const out: DealerIncidentLinkItem[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!autoRecordsServiceWorkRowHasData(row)) continue;
    const works = row.works.trim();
    if (!dealerWorkLooksLikeBodyOrGlassRepair(works)) continue;
    const date = formatAutoRecordsDateForOutput(row.date) || row.date.trim();
    const ms = parseMileageDateForSort(date);
    if (ms === Number.NEGATIVE_INFINITY) continue;
    const km = row.odometer.trim();
    const label = [`dīleris ${date}`, km ? `${km} km` : "", works].filter(Boolean).join(" · ");
    const key = `${date}|${works}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date, ms, monthOnly: monthOnlyDate(row.date), label });
  }
  return out;
}

function collectIncidentItems(blocks: WorkspaceSourceBlocks): DealerIncidentLinkItem[] {
  const out: DealerIncidentLinkItem[] = [];
  const seen = new Set<string>();
  const push = (dateRaw: string, extra: string, source: string) => {
    const date = formatAutoRecordsDateForOutput(dateRaw) || dateRaw.trim();
    const ms = parseMileageDateForSort(date);
    if (!date || ms === Number.NEGATIVE_INFINITY) return;
    const label = [source, date, extra].filter(Boolean).join(" · ");
    const key = `${date}|${extra.replace(/\D/g, "").slice(0, 6)}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ date, ms, monthOnly: monthOnlyDate(dateRaw), label });
  };

  for (const key of ["autodna", "carvertical"] as const) {
    for (const r of blocks[key].incidents.filter(ltabRowHasData)) {
      push(r.csngDate, [r.lossAmount, r.incidentNo].filter((x) => x.trim()).join(" "), SOURCE_BLOCK_LABELS[key]);
    }
  }
  for (const [i, section] of blocks.citi_avoti.sections.entries()) {
    const head = section.label?.trim() || `Citi avoti ${i + 1}`;
    for (const r of section.incidents.filter(ltabRowHasData)) {
      push(r.csngDate, [r.lossAmount, r.incidentNo].filter((x) => x.trim()).join(" "), head);
    }
  }
  for (const r of blocks.ltab.rows.filter(ltabRowHasData)) {
    push(r.csngDate, [r.lossAmount, r.incidentNo].filter((x) => x.trim()).join(" "), SOURCE_BLOCK_LABELS.ltab);
  }
  for (const key of ["tjekbil", "finnik", "mnt_ee", "lkf_ee", "carinfo", "traficom_fi"] as const) {
    for (const r of (blocks[key].incidents ?? []).filter(vinRegistryIncidentRowHasData)) {
      push(r.date, [r.amount, r.country, r.note].filter((x) => x.trim()).join(" "), SOURCE_BLOCK_LABELS[key]);
    }
  }
  for (const r of collectUnifiedIncidentRows({
    manualVendorBlocks: toPdfManualVendorBlocks(blocks),
    manualLtabBlock: toPdfLtabManualBlock(blocks.ltab),
    ccVinBlock: blocks.cc_vin,
    asvBlock: blocks.asv,
  })) {
    push(r.date, [r.lossAmount, r.country].filter((x) => x.trim() && x !== "—").join(" "), r.sourceLabel);
  }
  return out;
}

export function analyzeDealerIncidentLinks(sourceBlocks: WorkspaceSourceBlocks): DealerIncidentLinkAnalysis {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const works = collectDealerBodyWorks(blocks);
  const incidents = collectIncidentItems(blocks);
  const usedWorks = new Set<number>();
  const usedIncidents = new Set<number>();
  const pairs: DealerIncidentPair[] = [];

  const tryMatch = (windowMs: number) => {
    for (let wi = 0; wi < works.length; wi++) {
      if (usedWorks.has(wi)) continue;
      let best = -1;
      let bestDelta = Number.POSITIVE_INFINITY;
      for (let ii = 0; ii < incidents.length; ii++) {
        if (usedIncidents.has(ii)) continue;
        if (!datesLink(works[wi]!, incidents[ii]!, windowMs)) continue;
        const delta = Math.abs(works[wi]!.ms - incidents[ii]!.ms);
        if (delta < bestDelta) {
          bestDelta = delta;
          best = ii;
        }
      }
      if (best >= 0) {
        usedWorks.add(wi);
        usedIncidents.add(best);
        pairs.push({ incident: incidents[best]!, work: works[wi]! });
      }
    }
  };

  tryMatch(LINK_WINDOW_MS);
  if (works.length === 1 && incidents.length === 1 && pairs.length === 0) {
    tryMatch(UNIQUE_PAIR_WINDOW_MS);
  }

  const pairedIncidentDates = new Set(pairs.map((p) => p.incident.date));
  const pairedWorkDates = new Set(pairs.map((p) => p.work.date));
  return {
    pairs,
    unmatchedWorks: works.filter((_, i) => !usedWorks.has(i) && !pairedWorkDates.has(works[i]!.date)),
    unmatchedIncidents: incidents.filter(
      (_, i) => !usedIncidents.has(i) && !pairedIncidentDates.has(incidents[i]!.date),
    ),
  };
}

export function orderHasDealerBodyOrGlassWork(sourceBlocks: WorkspaceSourceBlocks): boolean {
  return collectDealerBodyWorks(mergeSourceBlocksWithDefaults(sourceBlocks)).length > 0;
}

export function buildDealerIncidentLinkBrief(sourceBlocks: WorkspaceSourceBlocks): string {
  const analysis = analyzeDealerIncidentLinks(sourceBlocks);
  if (
    analysis.pairs.length === 0 &&
    analysis.unmatchedWorks.length === 0 &&
    analysis.unmatchedIncidents.length === 0
  ) {
    return "";
  }

  const lines = [
    "### Dīlera remonta un negadījumu sasaiste (deterministisks)",
    "OBLIGĀTI abos laukos (OFICIĀLĀ DĪLERA DATI „Komentārs” UN NEGADĪJUMU VĒSTURES KOPSAVILKUMS): lasi otru avotu. „Tikai šī avota fakti” šo sasaisti neatceļ.",
  ];
  if (analysis.pairs.length > 0) {
    lines.push("- SASAISTĪTS (raksti kā vienu notikumu, ne divus nesaistītus):");
    for (const pair of analysis.pairs) {
      lines.push(`  - ${pair.incident.label} ↔ ${pair.work.label}`);
    }
  }
  if (analysis.unmatchedWorks.length > 0) {
    lines.push("- DĪLERIS BEZ NEGADĪJUMA IERAKSTA (dīlera fakts; neizdomā avāriju):");
    for (const w of analysis.unmatchedWorks) lines.push(`  - ${w.label}`);
  }
  if (analysis.unmatchedIncidents.length > 0) {
    lines.push("- NEGADĪJUMS BEZ DĪLERA VIRSBŪVES/STIKLA REMONTA ŠAJĀ LOGĀ:");
    for (const i of analysis.unmatchedIncidents) lines.push(`  - ${i.label}`);
  }
  lines.push("Datumus, darbus un summas NEizdomā. Bez remonta EUR tāmēm.");
  return lines.join("\n");
}
