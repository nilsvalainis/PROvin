/**
 * Īpašnieku skaits no visiem avotiem — reconcilē pa valstīm, neskaita AutoDNA+CarVertical kopā.
 */

import {
  SOURCE_BLOCK_LABELS,
  type CitiAvotiBlockState,
  type ClientManualVendorBlockPdf,
  type CsddFormFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import type { CcVinBlockState } from "@/lib/cc-vin-report";

export type OwnerCountryId = "latvia" | "sweden" | "denmark" | "estonia" | "germany" | "other";

export type OwnerCountCandidate = {
  country: OwnerCountryId;
  count: number;
  source: string;
  /** Mazāks = uzticamāks (oficiālais reģistrs pirms vendor atskaites). */
  priority: number;
};

export type OwnerCountSynthesis = {
  chosen: Partial<Record<OwnerCountryId, OwnerCountCandidate>>;
  candidates: OwnerCountCandidate[];
  /** Kartītes trešā rinda, piem. „Latvijā: 2 | Zviedrijā: 6”. Tukšs, ja nav skaitļu. */
  noteLine: string;
  /** Summa pa valstīm (Latvija + Zviedrija, …) — neskaita to pašu tirgu divreiz. */
  totalCount: number;
};

const COUNTRY_LOCATIVE: Record<OwnerCountryId, string> = {
  latvia: "Latvijā",
  sweden: "Zviedrijā",
  denmark: "Dānijā",
  estonia: "Igaunijā",
  germany: "Vācijā",
  other: "ārvalstīs",
};

const COUNTRY_ISO: Record<OwnerCountryId, string> = {
  latvia: "LV",
  sweden: "SE",
  denmark: "DK",
  estonia: "EE",
  germany: "DE",
  other: "",
};

const DISPLAY_ORDER: OwnerCountryId[] = ["latvia", "sweden", "denmark", "estonia", "germany", "other"];

const TITLE = {
  autodna: SOURCE_BLOCK_LABELS.autodna,
  carvertical: SOURCE_BLOCK_LABELS.carvertical,
  carinfo: SOURCE_BLOCK_LABELS.carinfo,
  tjekbil: SOURCE_BLOCK_LABELS.tjekbil,
  mnt: SOURCE_BLOCK_LABELS.mnt_ee,
  lkf: SOURCE_BLOCK_LABELS.lkf_ee,
  citi: SOURCE_BLOCK_LABELS.citi_avoti,
} as const;

function parsePositiveCount(raw: string): number | null {
  const n = Number.parseInt(raw.replace(/\s+/g, ""), 10);
  if (!Number.isFinite(n) || n < 1 || n > 99) return null;
  return n;
}

/** Explicit „N īpašnieki” / „īpašnieku skaits: N” — ne „N īpašnieku maiņas”. */
export function extractExplicitOwnerCount(text: string): number | null {
  const cleaned = text.replace(/\d{1,2}\s*īpašniek[aāu]?\s*maiņ[aāu]?/gi, " ");
  const patterns = [
    /dānijas\s+īpašnieku\s+skaits[:\s]+(\d{1,2})/i,
    /(?:aplēstais\s+)?īpašnieku\s+skaits[:\s]+(\d{1,2})/i,
    /(\d{1,2})\s*īpašnieki(?:\s|\(|$)/i,
    /number of owners[:\s]+(\d{1,2})/i,
    /\bowners?[:\s]+(\d{1,2})\b/i,
  ];
  for (const re of patterns) {
    const m = re.exec(cleaned);
    if (m?.[1]) {
      const n = parsePositiveCount(m[1]);
      if (n != null) return n;
    }
  }
  const lone = cleaned.trim();
  if (/^\d{1,2}$/.test(lone)) return parsePositiveCount(lone);
  return null;
}

/**
 * CSDD ir vienīgais avots Latvijas īpašnieku skaitam.
 * Nepietiek ar lauku „īpašnieku skaits Latvijā”, ja reģistrācijas nav
 * (neimportēts auto, „Dati nav pieejami”, sludinājuma valsts Latvija).
 */
export function csddHasLatvianRegistryRecord(csdd?: CsddFormFields | null): boolean {
  if (!csdd) return false;
  if (csdd.registrationNumber.trim()) return true;
  if ((csdd.ownerRegistrationEvents ?? []).some((e) => e.date.trim() || e.label.trim())) return true;
  if ((csdd.technicalInspectionHistory ?? []).some((r) => r.date.trim())) return true;
  if (
    (csdd.mileageHistory ?? []).some(
      (r) => r.date.trim() && /latvij|\blv\b/i.test(r.country),
    )
  ) {
    return true;
  }
  const status = csdd.registrationStatus.trim();
  if (status && !/dati\s+nav\s+pieejami/i.test(status)) return true;
  return false;
}

export function inferOwnerCountry(text: string, sourceHint?: string): OwnerCountryId {
  const blob = `${sourceHint ?? ""} ${text}`.toLowerCase();
  // Latvija = tikai CSDD. „pirms importa Latvijā”, „vēl nav reģistrēta”, „ss.lv”
  // un sludinājuma valsts NAV Latvijas īpašnieku skaits — citādi kartīte rāda
  // „Latvijā N” auto, kas CSDD vispār nav.
  if (/zviedr|sweden|sverige|car\.info|zviedrijas\s+re[gģ]istr/.test(blob)) return "sweden";
  if (/dānij|danij|denmark|danmark|tjekbil/.test(blob)) return "denmark";
  if (/igaun|estonia|eesti|mnt\.ee|lkf\.ee/.test(blob)) return "estonia";
  if (/vācij|vacij|germany|deutschland|\bde\b/.test(blob)) return "germany";
  return "other";
}

function pushCandidate(
  out: OwnerCountCandidate[],
  country: OwnerCountryId,
  count: number | null,
  source: string,
  priority: number,
): void {
  if (count == null) return;
  out.push({ country, count, source, priority });
}

function choosePerCountry(candidates: OwnerCountCandidate[]): Partial<Record<OwnerCountryId, OwnerCountCandidate>> {
  const chosen: Partial<Record<OwnerCountryId, OwnerCountCandidate>> = {};
  for (const id of DISPLAY_ORDER) {
    const group = candidates.filter((c) => c.country === id);
    if (group.length === 0) continue;
    group.sort((a, b) => a.priority - b.priority || b.count - a.count);
    chosen[id] = group[0];
  }
  /** Ja ir konkrētas ārvalsts reģistrs, vendor „ārvalstīs” kopsumma ir tas pats stāsts — nerāda otru skaitli. */
  if (chosen.sweden || chosen.denmark || chosen.estonia || chosen.germany) {
    delete chosen.other;
  }
  return chosen;
}

export function formatOwnerCountBannerNoteParts(
  chosen: Partial<Record<OwnerCountryId, OwnerCountCandidate>>,
): string[] {
  const parts: string[] = [];
  for (const id of DISPLAY_ORDER) {
    const row = chosen[id];
    if (!row) continue;
    parts.push(`${COUNTRY_LOCATIVE[id]}: ${row.count}`);
  }
  return parts;
}

/** PDF kartītes valstu fakti — lokatīvs + skaits, bez ISO. */
export type OwnerCountCountryStat = {
  iso: string;
  name: string;
  count: number;
};

export function formatOwnerCountCountryStats(
  chosen: Partial<Record<OwnerCountryId, OwnerCountCandidate>>,
): OwnerCountCountryStat[] {
  const out: OwnerCountCountryStat[] = [];
  for (const id of DISPLAY_ORDER) {
    const row = chosen[id];
    if (!row) continue;
    out.push({ iso: COUNTRY_ISO[id], name: COUNTRY_LOCATIVE[id], count: row.count });
  }
  return out;
}

/** Variants I: pirmā valsts treknajā rindā, pārējās piezīmē. */
export function formatOwnerCountTileFacts(
  chosen: Partial<Record<OwnerCountryId, OwnerCountCandidate>>,
): { value: string; note: string } {
  const stats = formatOwnerCountCountryStats(chosen);
  if (stats.length === 0) return { value: "", note: "" };
  const fact = (s: OwnerCountCountryStat) => `${s.name} ${s.count}`;
  return {
    value: fact(stats[0]!),
    note: stats.slice(1).map(fact).join(", "),
  };
}

export function formatOwnerCountBannerNote(
  chosen: Partial<Record<OwnerCountryId, OwnerCountCandidate>>,
): string {
  return formatOwnerCountBannerNoteParts(chosen).join(" | ");
}

export function ownerCountTotal(chosen: Partial<Record<OwnerCountryId, OwnerCountCandidate>>): number {
  let n = 0;
  for (const id of DISPLAY_ORDER) {
    n += chosen[id]?.count ?? 0;
  }
  return n;
}

export function formatOwnerCountAiContext(synthesis: OwnerCountSynthesis): string {
  if (synthesis.candidates.length === 0) return "";
  const lines = [
    "Kartītes rinda (īpašnieku skaits): " +
      (synthesis.totalCount > 0
        ? `${synthesis.totalCount} — ${synthesis.noteLine || "nav sadalījuma"}`
        : "nav skaitļu"),
    "Avotu kandidāti — reconcilē pa valstīm; NEsummē AutoDNA+CarVertical+reģistru par to pašu tirgu:",
  ];
  for (const c of synthesis.candidates) {
    const picked = synthesis.chosen[c.country];
    const used = picked?.source === c.source && picked.count === c.count;
    lines.push(
      `- ${c.source} → ${COUNTRY_LOCATIVE[c.country]}: ${c.count}${used ? " (izvēlēts)" : " (nav saskaitīts klāt)"}`,
    );
  }
  return lines.join("\n");
}

function collectFromVendorPdf(
  blocks: ClientManualVendorBlockPdf[] | null | undefined,
): OwnerCountCandidate[] {
  const out: OwnerCountCandidate[] = [];
  for (const b of blocks ?? []) {
    const title = (b.title ?? "").trim();
    const blob = [b.ownersSummary, b.comments, b.sourceRaw, b.autoNotes].filter(Boolean).join("\n");
    const count = extractExplicitOwnerCount(blob);
    if (title === TITLE.carinfo) {
      pushCandidate(out, "sweden", count ?? extractExplicitOwnerCount(b.ownersSummary ?? ""), title, 0);
      continue;
    }
    if (title === TITLE.tjekbil) {
      pushCandidate(out, "denmark", count, title, 0);
      continue;
    }
    if (title === TITLE.mnt) {
      pushCandidate(out, "estonia", count, title, 0);
      continue;
    }
    if (title === TITLE.lkf) {
      pushCandidate(out, "estonia", count, title, 1);
      continue;
    }
    if (title === TITLE.autodna || title === TITLE.carvertical || title === TITLE.citi) {
      const country = inferOwnerCountry(blob, title);
      pushCandidate(out, country, count, title, country === "other" ? 3 : 2);
    }
  }
  return out;
}

export function synthesizeOwnerCountsFromPdfInput(input: {
  csddForm?: CsddFormFields | null;
  ccVinBlock?: CcVinBlockState | null;
  manualVendorBlocks?: ClientManualVendorBlockPdf[] | null;
  citiAvoti?: CitiAvotiBlockState | null;
}): OwnerCountSynthesis {
  const candidates: OwnerCountCandidate[] = [];
  if (csddHasLatvianRegistryRecord(input.csddForm)) {
    pushCandidate(
      candidates,
      "latvia",
      extractExplicitOwnerCount(input.csddForm?.ownerCountLatvia ?? ""),
      "CSDD",
      0,
    );
  }
  candidates.push(...collectFromVendorPdf(input.manualVendorBlocks));
  const citiText = (input.citiAvoti?.sections ?? [])
    .map((s) => [s.comments, s.aiContextRaw, s.rawUnprocessedData].filter(Boolean).join("\n"))
    .join("\n");
  if (citiText.trim()) {
    const country = inferOwnerCountry(citiText, TITLE.citi);
    pushCandidate(candidates, country, extractExplicitOwnerCount(citiText), TITLE.citi, 3);
  }
  const ccCount = extractExplicitOwnerCount(input.ccVinBlock?.ownersCount ?? "");
  if (ccCount != null) {
    const country = inferOwnerCountry(
      [input.ccVinBlock?.ownersCount, input.ccVinBlock?.comments, input.ccVinBlock?.aiContextRaw]
        .filter(Boolean)
        .join("\n"),
      "cc.vin",
    );
    pushCandidate(candidates, country, ccCount, "cc.vin", country === "other" ? 2 : 2);
  }
  const chosen = choosePerCountry(candidates);
  return {
    chosen,
    candidates,
    noteLine: formatOwnerCountBannerNote(chosen),
    totalCount: ownerCountTotal(chosen),
  };
}

export function synthesizeOwnerCountsFromBlocks(blocks: WorkspaceSourceBlocks): OwnerCountSynthesis {
  const candidates: OwnerCountCandidate[] = [];
  if (csddHasLatvianRegistryRecord(blocks.csdd)) {
    pushCandidate(candidates, "latvia", extractExplicitOwnerCount(blocks.csdd.ownerCountLatvia), "CSDD", 0);
  }

  const registry: Array<{ key: "carinfo" | "tjekbil" | "mnt_ee" | "lkf_ee"; country: OwnerCountryId; priority: number }> =
    [
      { key: "carinfo", country: "sweden", priority: 0 },
      { key: "tjekbil", country: "denmark", priority: 0 },
      { key: "mnt_ee", country: "estonia", priority: 0 },
      { key: "lkf_ee", country: "estonia", priority: 1 },
    ];
  for (const r of registry) {
    const b = blocks[r.key];
    const blob = [b.ownersSummary, b.comments, b.rawUnprocessedData, b.aiContextRaw].filter(Boolean).join("\n");
    pushCandidate(candidates, r.country, extractExplicitOwnerCount(blob), SOURCE_BLOCK_LABELS[r.key], r.priority);
  }

  for (const key of ["autodna", "carvertical"] as const) {
    const b = blocks[key];
    const blob = [b.comments, b.mileagePasteRaw, b.aiContextRaw].filter(Boolean).join("\n");
    const country = inferOwnerCountry(blob, SOURCE_BLOCK_LABELS[key]);
    pushCandidate(candidates, country, extractExplicitOwnerCount(blob), SOURCE_BLOCK_LABELS[key], 2);
  }

  const citiText = (blocks.citi_avoti.sections ?? [])
    .map((s) => [s.comments, s.aiContextRaw, s.rawUnprocessedData].filter(Boolean).join("\n"))
    .join("\n");
  if (citiText.trim()) {
    const country = inferOwnerCountry(citiText, TITLE.citi);
    pushCandidate(candidates, country, extractExplicitOwnerCount(citiText), TITLE.citi, 3);
  }

  const cc = blocks.cc_vin;
  const ccBlob = [cc.ownersCount, cc.comments, cc.aiContextRaw].filter(Boolean).join("\n");
  const ccCount = extractExplicitOwnerCount(cc.ownersCount) ?? extractExplicitOwnerCount(ccBlob);
  if (ccCount != null) {
    pushCandidate(candidates, inferOwnerCountry(ccBlob, "cc.vin"), ccCount, "cc.vin", 2);
  }

  const chosen = choosePerCountry(candidates);
  return {
    chosen,
    candidates,
    noteLine: formatOwnerCountBannerNote(chosen),
    totalCount: ownerCountTotal(chosen),
  };
}
