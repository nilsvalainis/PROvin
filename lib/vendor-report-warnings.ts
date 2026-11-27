/**
 * AutoDNA / CarVertical atskaites kopsavilkums fona pirkuma joslā (Nila prasība 27.11):
 * visi atskaites brīdinājumi (sarkans - risks, oranžs - uzmanību) + iekļauto fotogrāfiju skaits.
 *
 * Avoti: bloka strukturētie dati (negadījumi, nobraukums, laikposms, bojājumu detaļas) un automātiski
 * ieliktais PDF teksts AI kontekstā (`=== PDF teksts (automātiski): AutoDNA · ... ===`).
 * Tīra loģika (bez tīkla) - lieto admin UI.
 */
import type { VendorAvotuBlockState, WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import { readVendorPdfAiContextText } from "@/lib/vendor-ai-context-fill";
import type { VendorArchiveSource } from "@/lib/vendor-archive-photo-group";

export type VendorReportWarningLevel = "red" | "orange";

export type VendorReportWarningKey =
  | "theft"
  | "total_loss"
  | "mileage"
  | "damage"
  | "repair_cost"
  | "lien"
  | "taxi"
  | "rental"
  | "recall"
  | "auction"
  | "import"
  | "owners";

export type VendorReportWarning = {
  key: VendorReportWarningKey;
  level: VendorReportWarningLevel;
  /** Viena rinda: «Negadījumi / bojājumi: 2 · 03.2019, 08.2020». */
  text: string;
};

export type VendorReportPhotos = {
  /** Cik foto atskaitē (PDF teksts «Fotogrāfijas N» / «atradām N fotogrāfijas» vai priekšpārbaude); null - nav zināms. */
  inReport: number | null;
  /** Cik šī avota arhīva foto ievietots galerijās (Sludinājuma vēsture / izsoļu arhīvs). */
  inserted: number;
};

export type VendorReportSummary = {
  /** Blokā ir šī avota PDF teksts (atskaite ievietota). */
  hasReport: boolean;
  warnings: VendorReportWarning[];
  photos: VendorReportPhotos;
};

const LABEL: Record<VendorArchiveSource, string> = { autodna: "AutoDNA", carvertical: "CarVertical" };

/** Bez diakritiķiem, mazie burti, viena atstarpe. */
export function normWarnText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Paskaidrojoši teikumi (atskaites veidnes teksts) - nav fakts par šo auto. */
const EXPLANATORY_RE = /var noradit|nenozime|piemeram|ja transportlidzekl|kad remonta|ieteicams|parbaudiet zinojuma|datu interpretacijas/;
const NEGATION_RE =
  /(?:^|[^a-z])(?:nav|netika|netiek|nekonstat\w*|neatrast\w*|neatrad\w*|bez|nebija|not|no records|none|no data|nav datu)(?:[^a-z]|$)/;
const POSITIVE_RE = /registret|konstatet|fiksets|atrast[sai]?(?:[^a-z]|$)|(?:^|[^a-z])ja(?:[^a-z]|$)|ierakstu skaits:? ?[1-9]|(?:^|[^0-9])[1-9]\d* ierakst/;
const SHORT_LINE = 110;
const BARE_LABEL_LINE = 45;

type TextRule = {
  key: VendorReportWarningKey;
  level: VendorReportWarningLevel;
  label: string;
  re: RegExp;
};

const TEXT_RULES: TextRule[] = [
  { key: "theft", level: "red", label: "Zādzība", re: /zagt|zadzib|stolen|theft|meklesana/ },
  {
    key: "total_loss",
    level: "red",
    label: "Totālā bojāeja / norakstīts",
    re: /kopejie zaudejumi|pilnig\w* zaudejum|total loss|salvage|utilizet|norakstit|bojaej/,
  },
  {
    key: "mileage",
    level: "red",
    label: "Nobraukuma neatbilstība",
    re: /odometra (?:radijumu )?(?:neatbilst|korekc|attis|manipul)|nobraukuma (?:neatbilst|attis|samazin|manipul|korekc)|viltots nobraukums|rollback|odometer (?:discrep|anomal)|mileage (?:discrep|mismatch|anomal)/,
  },
  { key: "lien", level: "orange", label: "Līzings / ķīla", re: /lizing|(?:^|[^a-z])kil(?:a|as|u|ai)(?:[^a-z]|$)|apgrutinaj|finansu saistib|(?:^|[^a-z])lien|leasing/ },
  { key: "taxi", level: "orange", label: "Taksometrs", re: /taksomet|(?:^|[^a-z])taxi/ },
  {
    key: "rental",
    level: "orange",
    label: "Noma / komerclietošana",
    re: /(?:^|[^a-z])nomas (?:auto|transport|lietosan|uznem)|rental|komercial\w* (?:izmanto|lieto)|commercial use/,
  },
  { key: "recall", level: "orange", label: "Atsaukšanas kampaņas", re: /atsauksan\w* kampan|atsaukum|(?:^|[^a-z])recall/ },
];

function firstCount(s: string): number | null {
  const m = /(?:^|[^0-9.,])(\d{1,3})(?:[^0-9.,]|$)/.exec(s);
  return m ? Number(m[1]) : null;
}

/** Teksta rindu likumi: rinda ar atslēgvārdu + nākamā rinda kā statuss («Zādzība» / «Reģistrēts»). */
function textRuleHits(lines: string[]): Map<VendorReportWarningKey, { count: number | null }> {
  const hits = new Map<VendorReportWarningKey, { count: number | null }>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line || line.length > SHORT_LINE || EXPLANATORY_RE.test(line)) continue;
    for (const rule of TEXT_RULES) {
      if (!rule.re.test(line)) continue;
      const next = lines[i + 1] ?? "";
      const nextIsStatus = next.length > 0 && next.length <= 60 && !TEXT_RULES.some((r) => r.re.test(next)) && !EXPLANATORY_RE.test(next);
      const ctx = nextIsStatus ? `${line} · ${next}` : line;
      if (NEGATION_RE.test(ctx)) continue;
      const positive = POSITIVE_RE.test(ctx);
      // Tikai nosaukums bez statusa (piem. sadaļas virsraksts garākā teikumā) - nav fakts.
      if (!positive && line.length > BARE_LABEL_LINE) continue;
      if (!positive && !nextIsStatus && rule.level === "orange") continue;
      const prev = hits.get(rule.key);
      const count = firstCount(ctx.replace(rule.re, ""));
      hits.set(rule.key, { count: Math.max(prev?.count ?? 0, count ?? 0) || null });
    }
  }
  return hits;
}

/** «DD.MM.GGGG» / «MM.GGGG» / «GGGG-MM-DD» / «GGGG» -> salīdzināms skaitlis (GGGGMMDD). */
export function warnDateKey(raw: string): number | null {
  const t = raw.trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(t);
  if (m) return Number(m[3]) * 10000 + Number(m[2]) * 100 + Number(m[1]);
  m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(t);
  if (m) return Number(m[1]) * 10000 + Number(m[2]) * 100 + Number(m[3] ?? 15);
  m = /^(\d{1,2})\.(\d{4})/.exec(t);
  if (m) return Number(m[2]) * 10000 + Number(m[1]) * 100 + 15;
  m = /^(\d{4})$/.exec(t);
  if (m) return Number(m[1]) * 10000 + 615;
  return null;
}

function km(raw: string, unit?: "km" | "mi"): number | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  if (!Number.isFinite(n) || n <= 0) return null;
  return unit === "mi" ? Math.round(n * 1.609344) : n;
}

const fmtKm = (n: number) => `${n.toLocaleString("lv-LV").replace(/ /g, " ")} km`;

/** Lielākais nobraukuma kritums hronoloģiski (> 1000 km zem iepriekšējā maksimuma). */
export function biggestMileageDrop(rows: VendorAvotuBlockState["serviceHistory"]): { dropKm: number; date: string } | null {
  const pts = (rows ?? [])
    .map((r) => ({ key: warnDateKey(r.date ?? ""), km: km(r.odometer ?? "", r.unit), date: r.date }))
    .filter((p): p is { key: number; km: number; date: string } => p.key != null && p.km != null)
    .sort((a, b) => a.key - b.key);
  let max = 0;
  let best: { dropKm: number; date: string } | null = null;
  for (const p of pts) {
    if (max - p.km > 1000 && (!best || max - p.km > best.dropKm)) best = { dropKm: max - p.km, date: p.date };
    max = Math.max(max, p.km);
  }
  return best;
}

function hasIncidentData(r: { csngDate?: string; lossAmount?: string; incidentNo?: string }): boolean {
  return Boolean((r.csngDate ?? "").trim() || (r.lossAmount ?? "").trim());
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Negadījumu skaits no teksta: CarVertical «atrasto bojājumu skaits: N», AutoDNA «zaudējumu apjoms» ieraksti. */
function textDamage(norm: string[]): { count: number; dates: string[] } {
  let cv = 0;
  let dna = 0;
  const dates: string[] = [];
  for (let i = 0; i < norm.length; i++) {
    const l = norm[i]!;
    const m = /atrasto bojajumu skaits:? ?(\d{1,3})/.exec(l);
    if (m) cv = Math.max(cv, Number(m[1]));
    if (/^transportlidzekla zaudejumu apjoms$/.test(l)) {
      dna++;
      const d = /^(\d{2}\.\d{4}|\d{2}\.\d{2}\.\d{4})\.?$/.exec(norm[i - 1] ?? "")?.[1];
      if (d) dates.push(d);
    }
  }
  return { count: Math.max(cv, dna), dates };
}

/** Cik foto atskaitē pēc PDF teksta. */
export function reportPhotoCountFromText(source: VendorArchiveSource, text: string): number | null {
  const lines = text.split(/\r?\n/).map(normWarnText);
  if (source === "carvertical") {
    for (const l of lines) {
      const m = /atradam (\d{1,3}) fotografij/.exec(l) ?? /^(\d{1,3}) fotografij/.exec(l);
      if (m) return Number(m[1]);
    }
    return null;
  }
  let started = false;
  let sum = 0;
  let any = false;
  for (const l of lines) {
    if (/arhiva fotografij/.test(l)) {
      started = true;
      continue;
    }
    if (!started) continue;
    const m = /^fotografijas:? ?(\d{1,3})$/.exec(l) ?? /^(\d{1,3}) fotografijas$/.exec(l);
    if (m) {
      sum += Number(m[1]);
      any = true;
    }
  }
  return any ? sum : null;
}

/** Šī avota arhīva foto visos blokos (grupas ar `archive.source`). */
export function insertedArchivePhotoCount(blocks: Partial<WorkspaceSourceBlocks> | null | undefined, source: VendorArchiveSource): number {
  if (!blocks) return 0;
  let n = 0;
  for (const b of Object.values(blocks)) {
    const groups = (b as { photoGroups?: unknown } | null)?.photoGroups;
    if (!Array.isArray(groups)) continue;
    for (const g of groups as { archive?: { source?: string }; photos?: unknown[] }[]) {
      if (g?.archive?.source === source && Array.isArray(g.photos)) n += g.photos.length;
    }
  }
  return n;
}

const ORDER: VendorReportWarningKey[] = [
  "theft",
  "total_loss",
  "mileage",
  "damage",
  "repair_cost",
  "lien",
  "taxi",
  "rental",
  "recall",
  "auction",
  "owners",
  "import",
];

/** Brīdinājumi no atskaites teksta + bloka strukturētajiem datiem. */
export function vendorReportWarnings(block: VendorAvotuBlockState, pdfText: string): VendorReportWarning[] {
  const lines = pdfText
    .split(/\r?\n/)
    .map(normWarnText)
    .filter(Boolean);
  const out = new Map<VendorReportWarningKey, VendorReportWarning>();
  const put = (w: VendorReportWarning) => {
    if (!out.has(w.key)) out.set(w.key, w);
  };

  const hits = textRuleHits(lines);
  const drop = biggestMileageDrop(block.serviceHistory);
  if (drop || hits.has("mileage")) {
    put({
      key: "mileage",
      level: "red",
      text: drop ? `Nobraukuma kritums: -${fmtKm(drop.dropKm)} · ${drop.date}` : "Nobraukuma neatbilstība",
    });
  }

  const incidents = (block.incidents ?? []).filter(hasIncidentData);
  const details = (block.damageDetails ?? []).filter((r) => (r.date ?? "").trim() || (r.lossAmount ?? "").trim());
  const fromText = textDamage(lines);
  const damageCount = Math.max(incidents.length, details.length, fromText.count);
  if (damageCount > 0) {
    const dates = uniq(
      [...incidents.map((r) => (r.csngDate ?? "").trim()), ...details.map((r) => (r.date ?? "").trim()), ...fromText.dates].filter(Boolean),
    );
    const shown = dates.slice(0, 4).join(", ");
    put({
      key: "damage",
      level: "red",
      text: `Negadījumi / bojājumi: ${damageCount}${shown ? ` · ${shown}${dates.length > 4 ? "…" : ""}` : ""}`,
    });
  }

  for (const rule of TEXT_RULES) {
    const h = hits.get(rule.key);
    if (!h || out.has(rule.key)) continue;
    put({ key: rule.key, level: rule.level, text: h.count && rule.key === "recall" ? `${rule.label}: ${h.count}` : rule.label });
  }

  // CarVertical «Remonta izmaksu reitings» + nākamā rinda «Augsts» / «Ļoti augsts».
  for (let i = 0; i < lines.length; i++) {
    if (!/^remonta izmaksu reitings/.test(lines[i]!)) continue;
    const v = /augsts/.test(lines[i]!) ? lines[i]! : (lines[i + 1] ?? "");
    if (/(?:^|[^a-z])(?:augsts|loti augsts|kritisk)/.test(v)) {
      const pct = /(\d{1,3}) ?% no transportlidzekla vertibas/.exec(lines.slice(i, i + 4).join(" "));
      put({ key: "repair_cost", level: "orange", text: `Augstas remonta izmaksas${pct ? ` · ${pct[1]} % no vērtības` : ""}` });
      break;
    }
  }

  const timeline = block.vehicleHistoryTimeline ?? [];
  const auctions = timeline.filter((r) => /izsol|auction|uzsol/i.test(r.description ?? "")).length;
  if (auctions > 0) put({ key: "auction", level: "orange", text: `Izsoļu ieraksti: ${auctions}` });

  let owners: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const m = /ipasnieku skaits:? ?(\d{1,2})(?:[^0-9]|$)/.exec(l) ?? /^(\d{1,2}) ipasniek/.exec(l);
    if (m) owners = Math.max(owners ?? 0, Number(m[1]));
    else if (/^ipasnieku skaits:?$|^ipasnieki$/.test(l) && /^\d{1,2}$/.test(lines[i + 1] ?? "")) {
      owners = Math.max(owners ?? 0, Number(lines[i + 1]));
    }
  }
  if (owners != null && owners >= 3) put({ key: "owners", level: "orange", text: `Īpašnieki: ${owners}` });

  const chrono = [
    ...(block.serviceHistory ?? []).map((r) => ({ key: warnDateKey(r.date ?? ""), country: (r.country ?? "").trim() })),
    ...timeline.map((r) => ({ key: warnDateKey(r.date ?? ""), country: (r.country ?? "").trim() })),
  ]
    .filter((p): p is { key: number; country: string } => p.key != null && Boolean(p.country))
    .sort((a, b) => a.key - b.key);
  const countries: string[] = [];
  for (const p of chrono) if (countries[countries.length - 1] !== p.country && !countries.includes(p.country)) countries.push(p.country);
  if (countries.length > 1) put({ key: "import", level: "orange", text: `Valstis: ${countries.join(" → ")}` });

  const list = [...out.values()];
  list.sort((a, b) => (a.level === b.level ? ORDER.indexOf(a.key) - ORDER.indexOf(b.key) : a.level === "red" ? -1 : 1));
  return list;
}

export function vendorReportSummary(args: {
  source: VendorArchiveSource;
  block: VendorAvotuBlockState;
  blocks?: Partial<WorkspaceSourceBlocks> | null;
  /** AutoDNA priekšpārbaudes foto skaits, ja PDF tekstā skaita nav. */
  precheckPhotos?: number | null;
}): VendorReportSummary {
  const text = readVendorPdfAiContextText(args.block, LABEL[args.source]);
  const hasReport = text.trim().length > 0;
  return {
    hasReport,
    warnings: hasReport ? vendorReportWarnings(args.block, text) : [],
    photos: {
      inReport: (hasReport ? reportPhotoCountFromText(args.source, text) : null) ?? args.precheckPhotos ?? null,
      inserted: insertedArchivePhotoCount(args.blocks, args.source),
    },
  };
}
