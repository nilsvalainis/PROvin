/**
 * Visi bojājumu pierādījumi pasūtījumā - arī bez zaudējumu summas (izsoles, reģistru
 * izņemšana bojājuma dēļ, dīlera virsbūves/stikla darbs). PDF negadījumu tabulai
 * (`collectUnifiedIncidentRows`, tikai rindas AR summu) šis modulis NEKO nemaina -
 * tas paliek kā ir. Šis ir papildu, plašāks saraksts TIKAI AI kontekstam un
 * kanoniskajai faktu lapai, lai modelis nekad nepaziņotu "bojājumu nav", kad tādi
 * ir, tikai bez EUR summas.
 */
import {
  ltabRowHasData,
  mergeSourceBlocksWithDefaults,
  REGISTRY_STYLE_BLOCK_KEYS,
  SOURCE_BLOCK_LABELS,
  vinRegistryIncidentRowHasData,
  type ClientManualLtabBlockPdf,
  type ClientManualVendorBlockPdf,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { ccVinDamageRowHasData, type CcVinBlockState } from "@/lib/cc-vin-report";
import { asvDamageRowHasData, type AsvBlockState } from "@/lib/asv-report";
import { orderHasDealerBodyOrGlassWork } from "@/lib/admin-ai-dealer-incident-link";
import { auctionDamageLv } from "@/lib/vin-scan/damage-labels-lv";
import { normalizeLossAmountEurDisplay } from "@/lib/loss-amount-format";

export type DamageEvidenceRow = {
  date: string;
  descriptionLv: string;
  /** Tukšs, ja avotā nav zaudējumu summas. */
  amount: string;
  sourceLabel: string;
};

export type DamageEvidence = {
  rows: DamageEvidenceRow[];
  total: number;
  /** Cik rindām NAV summas (tās, kuras PDF negadījumu tabulā neparādās). */
  withoutAmountCount: number;
  hasDealerBodyOrGlassWork: boolean;
};

/**
 * Reģistra ierobežojums «noņemts no reģistra bojājuma dēļ» (Traficom «Deregistrated due to a damage»).
 * Datētā izņemšanas vēsture Traficom ir maksas sadaļa - bieži ir tikai ierobežojuma teksts piezīmēs.
 */
const DEREGISTERED_DUE_TO_DAMAGE_RE = /noņemts no reģistra bojājuma dēļ|deregistrated due to a damage|deregistered due to (?:a )?damage/i;

function registryNotesSayDeregisteredDueToDamage(b: {
  autoNotes?: string | null;
  statusRecords?: string | null;
}): boolean {
  return DEREGISTERED_DUE_TO_DAMAGE_RE.test(`${b.autoNotes ?? ""}\n${b.statusRecords ?? ""}`);
}

function displayAmount(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return normalizeLossAmountEurDisplay(t) || t;
}

/** Visi bojājumu/negadījumu pierādījumi - arī bez summas. Nemaina PDF negadījumu tabulu. */
export function collectDamageEvidence(sourceBlocks: WorkspaceSourceBlocks): DamageEvidence {
  const blocks = mergeSourceBlocksWithDefaults(sourceBlocks);
  const rows: DamageEvidenceRow[] = [];

  const pushVendorIncidents = (
    incidents: Array<{ incidentNo: string; csngDate: string; lossAmount: string }> | null | undefined,
    label: string,
  ) => {
    for (const r of incidents ?? []) {
      if (!ltabRowHasData(r)) continue;
      rows.push({
        date: r.csngDate.trim() || "datums nav",
        descriptionLv: "Bojājuma / negadījuma ieraksts",
        amount: displayAmount(r.lossAmount),
        sourceLabel: label,
      });
    }
  };
  pushVendorIncidents(blocks.autodna.incidents, SOURCE_BLOCK_LABELS.autodna);
  pushVendorIncidents(blocks.carvertical.incidents, SOURCE_BLOCK_LABELS.carvertical);
  for (const section of blocks.citi_avoti.sections ?? []) {
    pushVendorIncidents(section.incidents, section.label?.trim() || "Citi avoti");
  }

  for (const key of REGISTRY_STYLE_BLOCK_KEYS) {
    const b = blocks[key];
    const incidents = (b.incidents ?? []).filter(vinRegistryIncidentRowHasData);
    for (const r of incidents) {
      rows.push({
        date: r.date.trim() || "datums nav",
        descriptionLv: r.note.trim() || "Bojājuma / negadījuma ieraksts",
        amount: displayAmount(r.amount),
        sourceLabel: SOURCE_BLOCK_LABELS[key],
      });
    }
    if (incidents.length === 0 && registryNotesSayDeregisteredDueToDamage(b)) {
      rows.push({
        date: "datums nav",
        descriptionLv: "Noņemts no reģistra bojājuma dēļ",
        amount: "",
        sourceLabel: SOURCE_BLOCK_LABELS[key],
      });
    }
  }

  for (const r of blocks.ltab.rows ?? []) {
    if (!ltabRowHasData(r)) continue;
    rows.push({
      date: r.csngDate.trim() || "datums nav",
      descriptionLv: "LTAB negadījuma ieraksts",
      amount: displayAmount(r.lossAmount),
      sourceLabel: "LTAB",
    });
  }

  for (const d of blocks.cc_vin.damages ?? []) {
    if (!ccVinDamageRowHasData(d)) continue;
    rows.push({
      date: d.date.trim() || "datums nav",
      descriptionLv: auctionDamageLv(d.description) || "Bojājuma ieraksts",
      amount: displayAmount(d.amount),
      sourceLabel: SOURCE_BLOCK_LABELS.cc_vin,
    });
  }
  for (const d of blocks.asv.damages ?? []) {
    if (!asvDamageRowHasData(d)) continue;
    rows.push({
      date: d.date.trim() || "datums nav",
      descriptionLv: auctionDamageLv(d.description) || "Bojājuma ieraksts",
      amount: displayAmount(d.amount),
      sourceLabel: "ASV",
    });
  }

  return {
    rows,
    total: rows.length,
    withoutAmountCount: rows.filter((r) => !r.amount).length,
    hasDealerBodyOrGlassWork: orderHasDealerBodyOrGlassWork(blocks),
  };
}

/**
 * Bojājumu ierakstu skaits no PDF ievades (tās pašas rindas, ko redz atskaite), arī bez
 * summas. Kopsavilkuma kartītei, kad unikālo negadījumu ar summu nav.
 */
export function countPdfDamageEvidence(input: {
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  manualLtabBlock?: ClientManualLtabBlockPdf | null;
  ccVinBlock?: CcVinBlockState | null;
  asvBlock?: AsvBlockState | null;
}): number {
  let n = 0;
  for (const b of input.manualVendorBlocks ?? []) {
    const k = b.incidentRows.filter(ltabRowHasData).length;
    n += k > 0 ? k : registryNotesSayDeregisteredDueToDamage(b) ? 1 : 0;
  }
  n += (input.manualLtabBlock?.rows ?? []).filter(ltabRowHasData).length;
  n += (input.ccVinBlock?.damages ?? []).filter(ccVinDamageRowHasData).length;
  n += (input.asvBlock?.damages ?? []).filter(asvDamageRowHasData).length;
  return n;
}
