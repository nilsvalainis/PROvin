/**
 * kfzgutachten.at nopirktā atzinuma («Gutachten gemäß § 57a Abs. 4 KFG 1967») PDF teksta parsētājs.
 * Ievade: PDF teksts (pdfjs rindas vai pdf-parse salīmēts teksts). Tīra loģika bez I/O.
 */

import { kfzExactDateDdMmYyyy } from "@/lib/kfzgutachten/kfzgutachten";

export type KfzGutachtenSeverity = "minor" | "major" | "dangerous";

export type KfzGutachtenFinding = {
  /** Harmonizētais kods (Direktīva 2014/45/ES II pielikums), piem. «5.3.3». */
  code: string;
  /** Vācu nosaukums no atzinuma (oriģināls). */
  titleDe: string;
  /** null: piezīme bez trūkuma pakāpes (piem. «angerostet» pie asīm). */
  severity: KfzGutachtenSeverity | null;
  /** «Bemerkung» vācu valodā (oriģināls). */
  remarkDe: string;
};

export type KfzGutachtenOverall = "ok" | "minor" | "major" | "dangerous" | "";

export type KfzGutachtenReport = {
  gutachtenNr: string;
  /** Atzinuma (apskates) datums DD.MM.YYYY («Druckdatum/Zeit»). */
  date: string;
  odometerKm: string;
  plate: string;
  make: string;
  type: string;
  vin: string;
  displacementCcm: string;
  vehicleClass: string;
  /** Erstzulassung DD.MM.YYYY. */
  firstRegistration: string;
  overall: KfzGutachtenOverall;
  overallDe: string;
  plaketteColor: string;
  /** Nākamā apskate MM.YYYY. */
  nextInspection: string;
  previous: { gutachtenNr: string; date: string; odometerKm: string } | null;
  findings: KfzGutachtenFinding[];
};

const SEVERITY_RE = /(leichter\s*Mangel|schwerer\s*Mangel|Gefahr\s*im\s*Verzug)\s*$/i;

function severityOf(raw: string): KfzGutachtenSeverity | null {
  const t = raw.replace(/\s+/g, "").toLowerCase();
  if (t.startsWith("leichter")) return "minor";
  if (t.startsWith("schwerer")) return "major";
  if (t.startsWith("gefahr")) return "dangerous";
  return null;
}

function overallOf(raw: string): KfzGutachtenOverall {
  const t = raw.replace(/\s+/g, "").toLowerCase();
  if (!t) return "";
  if (t.includes("gefahr")) return "dangerous";
  if (t.includes("schwere")) return "major";
  if (t.includes("leichte")) return "minor";
  if (/mängelfrei|keinemängel|ohnemängel|entspricht/.test(t)) return "ok";
  return "";
}

function digits(raw: string | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function m1(text: string, re: RegExp): string {
  return re.exec(text)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

/** Austrijas numurzīme ar atstarpi aiz apgabala burtiem («W81763N» -> «W 81763N»). */
export function normalizeAtPlate(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim().toUpperCase();
  const m = /^([A-ZÄÖÜ]{1,2})\s*(\d[A-Z0-9]*)$/.exec(t.replace(/-/g, " "));
  return m ? `${m[1]} ${m[2]}` : t;
}

/** Ievietojam rindu pārtraukumus pirms zināmajiem marķieriem (pdf-parse dažkārt salīmē rindas). */
function normalizeText(raw: string): string {
  return raw.replace(/\r\n?/g, "\n").replace(/ /g, " ");
}

/** true: teksts izskatās pēc §57a atzinuma. */
export function looksLikeKfzGutachten(text: string): boolean {
  return /Gutachten\s*gem(?:ä|a)(?:ß|ss)\s*§\s*57\s*a/i.test(text) && /Fahrgestell-?\s*Nr/i.test(text);
}

function parseFindings(chunk: string): KfzGutachtenFinding[] {
  const start = chunk.search(/folgende\s*Daten\s*und\s*M(?:ä|a)ngel\s*festgestellt/i);
  if (start < 0) return [];
  const endRel = chunk.slice(start).search(/Pr(?:ü|u)fumfang|\(7\)|Das\s*Fahrzeug\s*entspricht/i);
  const body = chunk.slice(start, endRel > 0 ? start + endRel : undefined);
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean).slice(1);
  const out: KfzGutachtenFinding[] = [];
  let current: KfzGutachtenFinding | null = null;
  const flush = () => {
    if (current && (current.severity || current.remarkDe)) out.push(current);
    current = null;
  };
  for (const line of lines) {
    const remark = /Bemerkung:\s*(.+)$/i.exec(line);
    if (remark) {
      if (current) current.remarkDe = [current.remarkDe, remark[1]!.trim()].filter(Boolean).join("; ");
      continue;
    }
    // Sadaļas virsraksts: «5.3 Aufhängung / 5.3.3 Drehstäbe … leichter Mangel».
    if (/^\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s*[A-Za-zÄÖÜäöü]/.test(line)) {
      flush();
      const sev = SEVERITY_RE.exec(line);
      const head = sev ? line.slice(0, sev.index).trim() : line;
      const codes = [...head.matchAll(/(\d{1,2}\.\d{1,2}(?:\.\d{1,2})?)/g)].map((m) => m[1]!);
      const titleDe = head
        .replace(/\d{1,2}\.\d{1,2}(?:\.\d{1,2})?\s*/g, "")
        .replace(/\s*\/\s*/g, " / ")
        .replace(/\s+/g, " ")
        .replace(/^\/\s*|\s*\/$/g, "")
        .trim()
        .split(" / ")
        .filter((seg, i, all) => i === 0 || seg !== all[i - 1])
        .join(" / ");
      current = {
        code: codes.at(-1) ?? "",
        titleDe,
        severity: sev ? severityOf(sev[1]!) : null,
        remarkDe: "",
      };
    }
  }
  flush();
  return out;
}

function parseOne(chunk: string): KfzGutachtenReport | null {
  const prevLine = /Letzte\s*Begutachtung:\s*Gutachten-?\s*Nr\.?\s*(\d+)\s*Datum\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*KM-?\s*Stand\s*(\d[\d .]*)/i.exec(chunk);
  const rest = prevLine ? chunk.replace(prevLine[0], " ") : chunk;
  const vin = m1(rest, /Fahrgestell-?\s*Nr\.?\s*([A-HJ-NPR-Z0-9]{11,17})/i).toUpperCase();
  if (!vin) return null;
  const date =
    kfzExactDateDdMmYyyy(m1(rest, /Druckdatum\s*\/?\s*Zeit\s*(\d{1,2}\.\d{1,2}\.\d{4})/i)) ||
    kfzExactDateDdMmYyyy(m1(rest, /Gutachten\s*vom\s*(\d{1,2}\.\d{1,2}\.\d{4})/i));
  const overallDe = m1(rest, /Betriebssicherheit:\s*([^\n]+)/i);
  const plaketteColor = m1(rest, /Farbe:\s*([A-Za-zÄÖÜäöüß]+?)\s*(?:Nr\.|\n|$)/i);
  return {
    gutachtenNr: m1(rest, /Gutachten-?\s*Nr\.?\s*(\d{5,})/i),
    date,
    odometerKm: digits(m1(rest, /KM-?\s*Stand\s*(\d[\d .]*\d|\d)/i)),
    plate: normalizeAtPlate(m1(rest, /Kennzeichen\s*([^\n]+?)\s*Marke/i)),
    make: m1(rest, /Marke\s*([^\n]+?)\s*Hubraum/i),
    type: m1(rest, /\bType\s*([^\n]+?)\s*(?:\(\d+\)|KM-?\s*Stand|\n|$)/i),
    vin,
    displacementCcm: digits(m1(rest, /Hubraum\s*(\d[\d .]*)\s*ccm/i)),
    vehicleClass: m1(rest, /Fahrzeugklasse\s*([A-Z]\d?[A-Z]?)/),
    firstRegistration: kfzExactDateDdMmYyyy(m1(rest, /Erstzulassung\s*(\d{1,2}\.\d{1,2}\.\d{4})/i)),
    overall: overallOf(overallDe),
    overallDe,
    plaketteColor,
    nextInspection: m1(rest, /N(?:ä|a)chste\s*Begutachtung\s*(\d{1,2}\.\d{4})/i),
    previous: prevLine
      ? {
          gutachtenNr: prevLine[1]!,
          date: kfzExactDateDdMmYyyy(prevLine[2]),
          odometerKm: digits(prevLine[3]),
        }
      : null,
    findings: parseFindings(rest),
  };
}

/** Viens PDF var saturēt vienu vai vairākus atzinumus (katrs sākas ar «Gutachten gemäß § 57a»). */
export function parseKfzGutachtenText(raw: string): KfzGutachtenReport[] {
  const text = normalizeText(raw);
  if (!looksLikeKfzGutachten(text)) return [];
  const starts = [...text.matchAll(/Gutachten\s*gem(?:ä|a)(?:ß|ss)\s*§\s*57\s*a/gi)].map((m) => m.index ?? 0);
  const chunks: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    // Galvene ar adresi un «Letzte Begutachtung» var būt pirms un pēc marķiera - ņemam līdz nākamajam.
    const from = i === 0 ? 0 : starts[i]!;
    const to = i + 1 < starts.length ? starts[i + 1]! : text.length;
    chunks.push(text.slice(from, to));
  }
  const out: KfzGutachtenReport[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    const r = parseOne(c);
    if (!r) continue;
    const key = r.gutachtenNr || `${r.date}|${r.odometerKm}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/* ---------------- Latviski ---------------- */

const SEVERITY_LV: Record<KfzGutachtenSeverity, string> = {
  minor: "neliels trūkums",
  major: "būtisks trūkums",
  dangerous: "bīstams trūkums",
};

export function kfzSeverityLv(s: KfzGutachtenSeverity | null): string {
  return s ? SEVERITY_LV[s] : "piezīme";
}

export function kfzOverallLv(o: KfzGutachtenOverall): string {
  switch (o) {
    case "ok":
      return "atbilst, bez trūkumiem";
    case "minor":
      return "atbilst, ar nelieliem trūkumiem";
    case "major":
      return "neatbilst - būtiski trūkumi";
    case "dangerous":
      return "neatbilst - bīstami trūkumi";
    default:
      return "";
  }
}

/** Direktīvas 2014/45/ES II pielikuma grupas (koda pirmais cipars). */
const GROUP_LV: Record<string, string> = {
  "0": "Identifikācija",
  "1": "Bremžu sistēma",
  "2": "Stūres iekārta",
  "3": "Redzamība",
  "4": "Apgaismojums un elektroiekārtas",
  "5": "Asis, riteņi, riepas, piekare",
  "6": "Šasija un virsbūve",
  "7": "Cits aprīkojums",
  "8": "Vides piesārņojums",
  "9": "Papildu pārbaudes",
};

export function kfzFindingGroupLv(code: string): string {
  const g = /^(\d{1,2})\./.exec(code.trim())?.[1] ?? "";
  return GROUP_LV[g] ?? "";
}

/** Viena rinda: «5.3.3 Asis, riteņi, riepas, piekare - neliels trūkums: Aufhängung / Drehstäbe … (oriģināls); Gummielemente brüchig (oriģināls)». */
export function kfzFindingLineLv(f: KfzGutachtenFinding): string {
  const group = kfzFindingGroupLv(f.code);
  const head = [f.code, group].filter(Boolean).join(" ");
  const de = [f.titleDe, f.remarkDe].filter(Boolean).join(" - ");
  return `${head} - ${kfzSeverityLv(f.severity)}${de ? `: ${de} (oriģināls)` : ""}`;
}
