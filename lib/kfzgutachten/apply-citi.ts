/**
 * kfzgutachten.at dati -> «Citi avoti» sadaļa «Austrija · §57a apskates (kfzgutachten.at)».
 *
 * Kāpēc Citi avoti: tā sadaļa jau nonāk nobraukuma tabulā (`collectUnifiedMileageRows`), valstu laikjoslā,
 * pretrunu pārbaudē, AI kontekstā, faktu lapā un PDF avotu sarakstā - jauns bloka tips nav vajadzīgs.
 *
 * Avota dati glabājas sadaļas RAW laukā kā JSON (tikai admin), lai atkārtots imports apvieno, nevis dublē.
 * Komentāri un nobraukuma rindas tiek pārrēķinātas no visiem zināmajiem atzinumiem.
 */

import {
  emptyAutoRecordsServiceRow,
  emptyCitiAvotiSection,
  citiAvotiSectionHasContent,
  type AutoRecordsServiceRow,
  type CitiAvotiBlockState,
  type CitiAvotiSectionState,
} from "@/lib/admin-source-blocks";
import {
  KFZ_AT_COUNTRY_LV,
  KFZ_AT_SECTION_LABEL,
  kfzExactDateDdMmYyyy,
} from "@/lib/kfzgutachten/kfzgutachten";
import {
  kfzFindingLineLv,
  kfzOverallLv,
  normalizeAtPlate,
  type KfzGutachtenReport,
} from "@/lib/kfzgutachten/parse-gutachten";

/** Viena rinda no bezmaksas meklēšanas saraksta (bez nobraukuma). */
export type KfzSearchListRow = {
  date: string;
  plate: string;
  vin: string;
  model: string;
};

export type KfzAtStore = {
  v: 1;
  reports: KfzGutachtenReport[];
  list: KfzSearchListRow[];
};

const RAW_HEAD = "kfzgutachten.at dati (JSON, ģenerēts automātiski - nelabot):";

const PLATE_COLOR_LV: Record<string, string> = {
  weiß: "balta",
  weiss: "balta",
  grün: "zaļa",
  gruen: "zaļa",
  rot: "sarkana",
  gelb: "dzeltena",
  blau: "zila",
  orange: "oranža",
};

function dayMs(ddmmyyyy: string): number {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(ddmmyyyy);
  return m ? Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!) : 0;
}

function fmtKm(km: string): string {
  const d = km.replace(/\D/g, "");
  return d ? `${d.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} km` : "";
}

export function emptyKfzAtStore(): KfzAtStore {
  return { v: 1, reports: [], list: [] };
}

export function readKfzAtStore(section: Pick<CitiAvotiSectionState, "rawUnprocessedData"> | null | undefined): KfzAtStore {
  const raw = section?.rawUnprocessedData ?? "";
  const i = raw.indexOf(RAW_HEAD);
  if (i < 0) return emptyKfzAtStore();
  try {
    const parsed = JSON.parse(raw.slice(i + RAW_HEAD.length).trim()) as Partial<KfzAtStore>;
    return {
      v: 1,
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      list: Array.isArray(parsed.list) ? parsed.list : [],
    };
  } catch {
    return emptyKfzAtStore();
  }
}

function reportKey(r: KfzGutachtenReport): string {
  return r.gutachtenNr || `${r.date}|${r.odometerKm}`;
}

export function mergeKfzAtStore(prev: KfzAtStore, add: { reports?: KfzGutachtenReport[]; list?: KfzSearchListRow[] }): KfzAtStore {
  const reports = new Map<string, KfzGutachtenReport>();
  for (const r of [...prev.reports, ...(add.reports ?? [])]) reports.set(reportKey(r), r);
  const list = new Map<string, KfzSearchListRow>();
  for (const r of [...prev.list, ...(add.list ?? [])]) {
    if (!r.date) continue;
    list.set(`${r.date}|${r.plate.replace(/\s/g, "")}`, r);
  }
  const byDate = <T extends { date: string }>(a: T, b: T) => dayMs(a.date) - dayMs(b.date);
  return { v: 1, reports: [...reports.values()].sort(byDate), list: [...list.values()].sort(byDate) };
}

/* ---------------- Bezmaksas saraksta ielīmēšana ---------------- */

/**
 * Ielīmēts kfzgutachten.at «Suchergebnisse» saraksts (Marke und Type | Gutachtendatum | Kennzeichen | FIN).
 * Rindu var ielīmēt ar tabulācijām, atstarpēm vai etiķetēm («Gutachtendatum: 23.11.2020»).
 */
export function parseKfzSearchListText(raw: string, vin?: string): KfzSearchListRow[] {
  const out: KfzSearchListRow[] = [];
  const want = (vin ?? "").trim().toUpperCase();
  // Tabulas rinda ar tabulācijām (ielīmēts no tabulas vai PROVIN skripts): Modelis | Datums | Numurzīme | VIN.
  // Numurzīmi ņemam no šūnas kā ir (arī «W-12345A», «GU 123 AB»), nevis tikai pēc parauga.
  const rest: string[] = [];
  for (const line of raw.replace(/\r\n?/g, "\n").split("\n")) {
    const cells = line.split("\t").map((c) => c.replace(/\s+/g, " ").trim());
    if (cells.length >= 4) {
      const date = kfzExactDateDdMmYyyy(cells[1]);
      const rowVin = (cells[3] ?? "").replace(/\s/g, "").toUpperCase();
      if (date && /^[A-HJ-NPR-Z0-9]{17}$/.test(rowVin) && cells[2]) {
        if (!want || rowVin === want) out.push({ date, plate: normalizeAtPlate(cells[2]), vin: rowVin, model: cells[0] ?? "" });
        continue;
      }
    }
    rest.push(line);
  }
  const text = rest.join("\n").replace(/(Marke und Type|Gutachtendatum|Kennzeichen|FIN):/gi, " ");
  // Viens ieraksts: … datums … numurzīme … VIN (17 zīmes). Strādā arī, ja viss vienā rindā.
  const re = /([^\n]*?)\s*(\d{2}\.\d{2}\.\d{4})\s+([A-ZÄÖÜ]{1,2}\s?\d[A-Z0-9]*)\s+([A-HJ-NPR-Z0-9]{17})/g;
  for (const m of text.matchAll(re)) {
    const date = kfzExactDateDdMmYyyy(m[2]);
    const rowVin = m[4]!.toUpperCase();
    if (!date || (want && rowVin !== want)) continue;
    out.push({ date, plate: normalizeAtPlate(m[3]!), vin: rowVin, model: m[1]!.replace(/\s+/g, " ").trim() });
  }
  return out;
}

/* ---------------- Rindas un teksti ---------------- */

export function kfzAtMileageRows(store: KfzAtStore): AutoRecordsServiceRow[] {
  const seen = new Set<string>();
  const out: AutoRecordsServiceRow[] = [];
  const push = (date: string, km: string) => {
    const d = kfzExactDateDdMmYyyy(date);
    const k = km.replace(/\D/g, "");
    if (!d || !k) return;
    const key = `${d}|${k}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ date: d, odometer: k, country: KFZ_AT_COUNTRY_LV });
  };
  for (const r of store.reports) {
    push(r.date, r.odometerKm);
    if (r.previous) push(r.previous.date, r.previous.odometerKm);
  }
  return out.sort((a, b) => dayMs(a.date) - dayMs(b.date));
}

/** Numurzīmju secība pēc datuma: katra maiņa ir fakts «numurzīme mainīta» (iemeslu neizdomājam). */
export function kfzAtPlateChanges(store: KfzAtStore): { date: string; from: string; to: string; fromDate: string }[] {
  const seen = new Map<string, string>();
  for (const r of store.list) if (r.plate) seen.set(`${r.date}`, r.plate);
  for (const r of store.reports) if (r.plate) seen.set(`${r.date}`, r.plate);
  const rows = [...seen.entries()]
    .map(([date, plate]) => ({ date, plate }))
    .filter((r) => dayMs(r.date) > 0)
    .sort((a, b) => dayMs(a.date) - dayMs(b.date));
  const out: { date: string; from: string; to: string; fromDate: string }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!;
    const b = rows[i]!;
    if (a.plate.replace(/\s/g, "") !== b.plate.replace(/\s/g, "")) {
      out.push({ date: b.date, from: a.plate, to: b.plate, fromDate: a.date });
    }
  }
  return out;
}

export function kfzAtCommentsLv(store: KfzAtStore): string {
  const lines: string[] = [];
  const firstReg = store.reports.find((r) => r.firstRegistration)?.firstRegistration ?? "";
  if (firstReg) lines.push(`Pirmā reģistrācija (Erstzulassung, atzinumā): ${firstReg}.`);
  if (store.list.length > 0) {
    const items = store.list.map((r) => (r.plate ? `${r.date} (${r.plate})` : r.date));
    lines.push(`Austrijas §57a apskates (saraksts, ${store.list.length}): ${items.join(", ")}.`);
  }
  for (const r of [...store.reports].reverse()) {
    const facts = [
      r.odometerKm ? fmtKm(r.odometerKm) : "",
      r.plate ? `numurzīme ${r.plate}` : "",
      kfzOverallLv(r.overall) ? `rezultāts: ${kfzOverallLv(r.overall)}` : "",
      r.plaketteColor ? `plāksnīte ${PLATE_COLOR_LV[r.plaketteColor.toLowerCase()] ?? r.plaketteColor}` : "",
      r.nextInspection ? `nākamā apskate ${r.nextInspection}` : "",
    ].filter(Boolean);
    lines.push(`${r.date || "?"} - §57a atzinums${r.gutachtenNr ? ` Nr. ${r.gutachtenNr}` : ""}: ${facts.join("; ")}.`);
    const defects = r.findings.filter((f) => f.severity);
    const notes = r.findings.filter((f) => !f.severity);
    if (defects.length > 0) lines.push(`  Trūkumi: ${defects.map(kfzFindingLineLv).join("; ")}.`);
    else lines.push("  Trūkumi: nav konstatēti.");
    if (notes.length > 0) lines.push(`  Piezīmes: ${notes.map(kfzFindingLineLv).join("; ")}.`);
    if (r.previous?.date) {
      lines.push(
        `  Iepriekšējā apskate: ${r.previous.date}${r.previous.odometerKm ? `, ${fmtKm(r.previous.odometerKm)}` : ""}.`,
      );
    }
  }
  for (const c of kfzAtPlateChanges(store)) {
    lines.push(`Numurzīme mainīta: ${c.from} (${c.fromDate}) -> ${c.to} (${c.date}).`);
  }
  return lines.join("\n");
}

/* ---------------- Sadaļas atrašana un ielikšana ---------------- */

export function findKfzAtSectionIndex(block: CitiAvotiBlockState | null | undefined): number {
  const sections = block?.sections ?? [];
  return sections.findIndex((s) => (s.label ?? "").trim() === KFZ_AT_SECTION_LABEL);
}

export type KfzAtApplyResult = {
  block: CitiAvotiBlockState;
  sectionIndex: number;
  addedReports: number;
  addedListRows: number;
  warnings: string[];
};

/**
 * Ieliek atzinumus / saraksta rindas sadaļā. Cita VIN atzinumus neliek (brīdinājums).
 * Sadaļas komentāri un nobraukums tiek pārrēķināti; foto un AI konteksts paliek.
 */
export function applyKfzAtToCitiAvoti(
  block: CitiAvotiBlockState | null | undefined,
  add: { reports?: KfzGutachtenReport[]; list?: KfzSearchListRow[] },
  opts: { vin?: string } = {},
): KfzAtApplyResult {
  const warnings: string[] = [];
  const vin = (opts.vin ?? "").trim().toUpperCase();
  const reports = (add.reports ?? []).filter((r) => {
    if (vin && r.vin && r.vin !== vin) {
      warnings.push(`Atzinums${r.gutachtenNr ? ` Nr. ${r.gutachtenNr}` : ""} ir citam VIN (${r.vin}) - nav ielikts.`);
      return false;
    }
    return true;
  });
  const list = (add.list ?? []).filter((r) => !vin || !r.vin || r.vin === vin);

  const sections = [...(block?.sections ?? [])];
  let idx = findKfzAtSectionIndex({ sections });
  if (idx < 0) {
    if (sections.length === 1 && !citiAvotiSectionHasContent(sections[0]!) && !(sections[0]!.label ?? "").trim()) {
      idx = 0;
    } else {
      sections.push(emptyCitiAvotiSection());
      idx = sections.length - 1;
    }
  }
  const prevSection = { ...emptyCitiAvotiSection(), ...sections[idx]! };
  const prevStore = readKfzAtStore(prevSection);
  const store = mergeKfzAtStore(prevStore, { reports, list });
  const addedReports = store.reports.length - prevStore.reports.length;
  const addedListRows = store.list.length - prevStore.list.length;

  sections[idx] = {
    ...prevSection,
    label: KFZ_AT_SECTION_LABEL,
    serviceHistory: (() => {
      const rows = kfzAtMileageRows(store);
      return rows.length > 0 ? rows : [emptyAutoRecordsServiceRow()];
    })(),
    comments: kfzAtCommentsLv(store),
    rawUnprocessedData: `${RAW_HEAD}\n${JSON.stringify(store)}`,
  };
  return { block: { sections }, sectionIndex: idx, addedReports, addedListRows, warnings };
}
