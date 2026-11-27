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
const EXPLANATORY_RE =
  /var noradit|nenozime|piemeram|ja transportlidzekl|kad remonta|ieteicams|parbaudiet zinojuma|datu interpretacijas|mes parbaudijam|lauk, ko mes|skaidrojums/;

/**
 * Negatīva atbilde (LV/EN/LT/PL/DE/RU): «Ieraksti netika atrasti», «Nav fiksētu problēmu», «No records»,
 * «Nėra», «Brak», «Keine Einträge», «Не найдено», «0 ieraksti», «✓ Clean».
 */
const NEGATION_RE = new RegExp(
  [
    "(?:^|[^a-z])(?:nav|netika|netiek|nekonstat\\w*|neatrad\\w*|neatrast\\w*|nebija|nav datu|nav fiksetu|bez ierakst\\w*)(?:[^a-z]|$)",
    "(?:^|[^a-z])(?:not found|not registered|not stolen|no records?|no data|no issues?|no problems?|none|nothing found|clean|ok)(?:[^a-z]|$)",
    "(?:^|[^a-z])(?:nera|nerasta|nerastas|nerasti|neuzregistruot\\w*|brak|nie znalezion\\w*|nie odnotowan\\w*|keine|nicht gefunden|nicht registriert)(?:[^a-z]|$)",
    "(?:^|[^\\p{L}])(?:нет|не найден\\p{L}*|не обнаружен\\p{L}*|отсутству\\p{L}*|не зарегистрирован\\p{L}*)(?:[^\\p{L}]|$)",
    "ierakstu skaits:? ?0(?:[^0-9]|$)|(?:^|[^0-9])0 ierakst|^0$|[\u2713\u2714]",
  ].join("|"),
  "u",
);

/**
 * Pozitīvs apgalvojums (ar statusu / skaitu): «Reģistrēts», «Atrasts», «Jā», «Uzmanību», «Atradām 1 ierakstu»,
 * «Ierakstu skaits: 2», «izmantots kā taksometrs», «Stolen: Yes».
 */
const POSITIVE_RE = new RegExp(
  [
    "registret\\w*|konstatet\\w*|fiksets|fikseta|uzmanibu|atrast[sai]?(?:[^a-z]|$)|atradam [1-9]",
    "ierakstu skaits:? ?[1-9]|(?:^|[^0-9.,/])[1-9]\\d* ierakst|(?:izmantots|izmantota|atzimets|atzimeta|ir) ka(?: |$)",
    "^(?:ja|yes|taip|tak|ja, ?\\S.*)$|(?:^|[^a-z])(?:stolen|wanted|registered|found|recorded|gestohlen|vogtas|skradzion\\w*)(?:[^a-z]|$)",
    "(?:^|[^\\p{L}])(?:угнан\\p{L}*|в розыске|зарегистрирован\\p{L}*)(?:[^\\p{L}]|$)",
  ].join("|"),
  "u",
);
const SHORT_LINE = 110;
const STATUS_LINE = 200;
const WINDOW_LINES = 3;

type TextRule = {
  key: VendorReportWarningKey;
  level: VendorReportWarningLevel;
  label: string;
  /** Neskaidram gadījumam (ir sadaļa, nav statusa) - «Pārbaudīt: …» (tikai sarkanajām kategorijām). */
  checkLabel?: string;
  re: RegExp;
};

const TEXT_RULES: TextRule[] = [
  {
    key: "theft",
    level: "red",
    label: "Zādzība",
    checkLabel: "zādzības sadaļa",
    re: /zagt|zadzib|stolen|theft|meklesana|vogt|kradzi|gestohlen|diebstahl|угон|краж|розыск/u,
  },
  {
    key: "total_loss",
    level: "red",
    label: "Totālā bojāeja / norakstīts",
    checkLabel: "totālās bojāejas sadaļa",
    re: /kopejie zaudejumi|pilnig\w* zaudejum|total loss|salvage|utilizet|norakstit|bojaej|totalschaden|szkoda calkowita|visisk\w* netekt|тотал/u,
  },
  {
    key: "mileage",
    level: "red",
    label: "Nobraukuma neatbilstība",
    checkLabel: "nobraukuma neatbilstības sadaļa",
    re: /odometra (?:radijumu )?(?:neatbilst|korekc|attis|manipul)|nobraukuma (?:neatbilst|attis|samazin|manipul|korekc)|viltots nobraukums|rollback|odometer (?:discrep|anomal|rollback)|mileage (?:discrep|mismatch|anomal)/,
  },
  { key: "lien", level: "orange", label: "Līzings / ķīla", re: /lizing|(?:^|[^a-z])kil(?:a|as|u|ai)(?:[^a-z]|$)|apgrutinaj|finansu saistib|(?:^|[^a-z])lien|leasing/ },
  { key: "taxi", level: "orange", label: "Taksometrs", re: /taksomet|(?:^|[^a-z])taxi/ },
  {
    key: "rental",
    level: "orange",
    label: "Noma / komerclietošana",
    re: /^noma$|(?:^|[^a-z])nomas (?:auto|transport|lietosan|uznem)|rental|komercial\w* (?:izmanto|lieto)|commercial use/,
  },
  { key: "recall", level: "orange", label: "Atsaukšanas kampaņas", re: /atsauksan\w* kampan|atsaukum|(?:^|[^a-z])recall/ },
];

function firstCount(s: string): number | null {
  const m = /(?:^|[^0-9.,/])(\d{1,3})(?:[^0-9.,/]|$)/.exec(s);
  return m ? Number(m[1]) : null;
}

type Verdict = "neg" | "pos" | null;

function verdictOf(s: string): Verdict {
  if (!s.trim()) return null;
  if (NEGATION_RE.test(s)) return "neg";
  if (POSITIVE_RE.test(s)) return "pos";
  return null;
}

/** Rindas daļa no atslēgvārda līdz nākamās kategorijas atslēgvārdam (AutoDNA divu kolonnu rindas). */
function segmentAfter(line: string, rule: TextRule): string {
  const m = rule.re.exec(line);
  if (!m) return "";
  const from = m.index;
  const rest = line.slice(from + m[0].length);
  let cut = rest.length;
  for (const r of TEXT_RULES) {
    if (r === rule) continue;
    const o = r.re.exec(rest);
    if (o && o.index < cut) cut = o.index;
  }
  return line.slice(from, from + m[0].length + cut);
}

type RuleHit = { count: number | null };
type RuleHits = { pos: Map<VendorReportWarningKey, RuleHit>; neg: Set<VendorReportWarningKey>; unclear: Set<VendorReportWarningKey> };

/**
 * Teksta likumi: atslēgvārda rinda + statuss tajā pašā rindā vai nākamajās ≤3 rindās (līdz nākamajai kategorijai).
 * Pirmais atrastais statuss izšķir: negatīvs -> tīrs, pozitīvs (ar statusu/skaitu) -> brīdinājums,
 * bez statusa (tikai sadaļas virsraksts) -> neskaidrs.
 */
function textRuleHits(lines: string[]): RuleHits {
  const pos = new Map<VendorReportWarningKey, RuleHit>();
  const neg = new Set<VendorReportWarningKey>();
  const unclear = new Set<VendorReportWarningKey>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line || line.length > SHORT_LINE || EXPLANATORY_RE.test(line)) continue;
    for (const rule of TEXT_RULES) {
      if (!rule.re.test(line)) continue;
      const seg = segmentAfter(line, rule);
      let verdict = verdictOf(seg.replace(rule.re, " "));
      let ctx = seg;
      if (verdict == null && seg.length < line.length - 2) {
        // Atslēgvārds teikuma beigās («Neatradām datus, ka … zagts», «… reģistrēts kā zagts»): skatās teikuma sākumu.
        const prefix = line.slice(0, line.length - seg.length);
        const v = verdictOf(prefix);
        if (v === "neg" || (v === "pos" && /(?:^|[^a-z])(?:ka|as|kaip|jako|als|как)(?:[^a-z]|$)/u.test(prefix))) {
          verdict = v;
          ctx = line;
        }
      }
      for (let j = i + 1, n = 0; verdict == null && j < lines.length && n < WINDOW_LINES; j++) {
        const next = lines[j]!;
        if (!next) continue;
        if (next.length > STATUS_LINE || TEXT_RULES.some((r) => r.re.test(next))) break;
        n++;
        if (EXPLANATORY_RE.test(next)) continue;
        // «Ierakstu skaits:» + nākamā rinda «0».
        const joined = /:$/.test(next) && j + 1 < lines.length ? `${next} ${lines[j + 1]}` : next;
        verdict = verdictOf(joined);
        ctx = `${seg} · ${joined}`;
      }
      if (verdict === "neg") neg.add(rule.key);
      else if (verdict === "pos") {
        const prev = pos.get(rule.key);
        const count = firstCount(ctx.replace(rule.re, ""));
        pos.set(rule.key, { count: Math.max(prev?.count ?? 0, count ?? 0) || null });
      } else unclear.add(rule.key);
    }
  }
  return { pos, neg, unclear };
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
    const m = /(?:^|atrasto )bojajumu skaits:? ?(\d{1,3})/.exec(l);
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
  /** Sadaļas galvene: «Arhīva fotogrāfijas / Ierakstu skaits: 0» vai «… / Pārbaudīts, dati nav reģistrēti». */
  let header: number | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (/arhiva fotografij/.test(l)) {
      started = true;
      const after = lines.slice(i + 1, i + 3).filter(Boolean).join(" ");
      const n = /^ierakstu skaits:? ?(\d{1,3})(?:[^0-9]|$)/.exec(after)?.[1];
      if (n != null) header = Math.max(header ?? 0, Number(n));
      else if (/^parbaudits,? dati nav registreti/.test(after)) header = Math.max(header ?? 0, 0);
      continue;
    }
    if (!started) continue;
    // «Fotogrāfijas 20» vai PDF teksta kopā salipusi rinda «12.10.2026Fotogrāfijas 26».
    const m = /^(?:\d{1,2}\.\d{1,2}\.\d{4}|\d{1,2}\.\d{4}|\d{4}-\d{2}-\d{2})?\.? ?fotografijas:? ?(\d{1,3})$/.exec(l) ?? /^(\d{1,3}) fotografijas$/.exec(l);
    if (m) {
      sum += Number(m[1]);
      any = true;
    }
  }
  if (any) return header != null ? Math.max(sum, header) : sum;
  return header;
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

  const { pos: hits, neg, unclear } = textRuleHits(lines);
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
  // Sadaļa ir, bet nav ne pozitīva, ne negatīva statusa - oranžs «Pārbaudīt», nevis sarkans fakts.
  for (const rule of TEXT_RULES) {
    if (!rule.checkLabel || out.has(rule.key) || neg.has(rule.key) || !unclear.has(rule.key)) continue;
    put({ key: rule.key, level: "orange", text: `Pārbaudīt: ${rule.checkLabel}` });
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
