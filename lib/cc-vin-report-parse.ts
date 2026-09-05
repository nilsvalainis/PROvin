/**
 * Starptautiskās vēstures atskaites (admin: „CC.VIN”) PDF teksta parseris.
 *
 * Nolasa tikai vēstures faktus: odometru, bojājumus, apdrošinātāju / norakstīšanas ierakstus,
 * īpašumtiesību atzīmes (total loss, salvage, junk), title ierakstus un izsoļu pārdošanas.
 * Specifikācijas tabula apzināti tiek ignorēta — PROVIN atskaitē tā jau ir no citiem avotiem.
 *
 * Viss izvads ir latviski; avota nosaukums netiek pārnests ne vienā laukā.
 */

import { formatAutoRecordsDateForOutput, normalizeAutoRecordsOdometer } from "@/lib/auto-records-paste-parse";
import type {
  CcVinCheckRow,
  CcVinDamageRow,
  CcVinRecordRow,
  CcVinSaleRow,
  CcVinTitleRow,
} from "@/lib/cc-vin-report";
import { normalizeCountryNameLv } from "@/lib/country-names-lv";
import { convertAmountTextToEur, describeEurConversion } from "@/lib/currency-eur-convert";

export type CcVinParsedReport = {
  vin: string;
  vehicleLine: string;
  reportDate: string;
  attentionMarks: string;
  ownersCount: string;
  checks: CcVinCheckRow[];
  mileage: { date: string; odometer: string; country: string }[];
  damages: CcVinDamageRow[];
  insurance: CcVinRecordRow[];
  brands: CcVinRecordRow[];
  titles: CcVinTitleRow[];
  sales: CcVinSaleRow[];
  notes: string[];
};

export function emptyCcVinParsedReport(): CcVinParsedReport {
  return {
    vin: "",
    vehicleLine: "",
    reportDate: "",
    attentionMarks: "",
    ownersCount: "",
    checks: [],
    mileage: [],
    damages: [],
    insurance: [],
    brands: [],
    titles: [],
    sales: [],
    notes: [],
  };
}

/* ------------------------------------------------------------------ teksts */

/**
 * PDF teksta slānis nāk ar salauztām ligatūrām: `ti` → U+099E, `ft` → `[`, `tt` → U+0082.
 * Bez šī soļa sadaļu nosaukumi tipa „Salvage Retention” nekad nesakrīt.
 */
export function normalizeCcVinPdfText(raw: string): string {
  return raw
    .replace(/\u099e/g, "ti")
    .replace(/\u0082/g, "tt")
    .replace(/\[/g, "ft")
    .replace(/\ufb00/g, "ff")
    .replace(/\ufb01/g, "fi")
    .replace(/\ufb02/g, "fl")
    .replace(/\ufb03/g, "ffi")
    .replace(/\ufb04/g, "ffl")
    .replace(/\ufb05|\ufb06/g, "st")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n");
}

function textLines(raw: string): string[] {
  return normalizeCcVinPdfText(raw)
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0 && !/^source\s*:/i.test(l));
}

export function looksLikeCcVinReport(rawText: string, fileName = ""): boolean {
  const text = normalizeCcVinPdfText(rawText);
  const head = `${fileName}\n${text.slice(0, 8000)}`;
  if (!/vehicle\s+history\s+report/i.test(head)) return false;
  return /attention\s+marks/i.test(head) || /report\s+id\s*:/i.test(head) || /checkcar/i.test(head);
}

/* ------------------------------------------------------------- vārdnīcas LV */

const CHECK_LABEL_LV: Record<string, string> = {
  "odometer records": "Odometra ieraksti",
  "vehicle damages": "Fiksētie bojājumi",
  accidents: "Negadījumi",
  "salvage auction records": "Norakstīto auto izsoles",
  "salvage records": "Norakstīšanas ieraksti",
  "theft records": "Zādzību ieraksti",
  "lien / impound / export records": "Ķīlas, aresta un eksporta ieraksti",
  "junk / salvage / insurance records": "Apdrošinātāju un norakstīšanas ieraksti",
  "other titles brands check": "Citas īpašumtiesību atzīmes",
  "title history": "Īpašumtiesību vēsture",
  "title records": "Īpašumtiesību ieraksti",
  "title checks": "Īpašumtiesību atzīmju pārbaude",
  "sales history": "Pārdošanas vēsture",
  "number of owners": "Īpašnieku skaits",
  taxi: "Izmantots kā taksometrs",
  "services records": "Servisa ieraksti",
  "registrations records": "Reģistrācijas ieraksti",
  "registration records": "Reģistrācijas ieraksti",
  "auction sale history": "Izsoļu pārdošanas vēsture",
  "safety recall campaigns": "Ražotāja drošības atsaukumi",
  mileages: "Odometra ieraksti",
};

/** Kopsavilkuma lauciņu secība atskaitē (dažādām atskaitēm atšķiras — pārbaudām visus). */
const CHECK_LABELS_EN = Object.keys(CHECK_LABEL_LV);

const CHECK_STATUS_OK_RE = /^(no\s+problems\s+found|no\s+records\s+found|no\s+found\s+records|not\s+rated)$/i;

function translateCheckStatus(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^no\s+problems\s+found$/i.test(t)) return "Nav atrastu problēmu";
  if (/^(no\s+records\s+found|no\s+found\s+records)$/i.test(t)) return "Nav ierakstu";
  if (/^found\s+problem\(s\)$/i.test(t)) return "Atrastas problēmas";
  const km = t.match(/^([\d.,\s]+)\s*km$/i);
  if (km) return `${formatKmDisplay(km[1]!)} km`;
  const counted = t.match(/^(\d+)\s*(problem|damage|sale|owner|record|recond|registration)\(s\)$/i);
  if (counted) {
    const n = Number(counted[1]);
    const kind = counted[2]!.toLowerCase();
    const word =
      kind === "problem" ? (n === 1 ? "problēma" : "problēmas")
      : kind === "damage" ? (n === 1 ? "bojājums" : "bojājumi")
      : kind === "sale" ? (n === 1 ? "pārdošana" : "pārdošanas")
      : kind === "owner" ? (n === 1 ? "īpašnieks" : "īpašnieki")
      : kind === "registration" ? (n === 1 ? "reģistrācija" : "reģistrācijas")
      : n === 1 ? "ieraksts"
      : "ieraksti";
    return `${n} ${word}`;
  }
  return t;
}

const DISPOSITION_LV: Record<string, string> = {
  sold: "Pārdots",
  salvage: "Norakstīts (salvage)",
  "to be determined": "Nav noteikts",
  junk: "Norakstīts detaļās (junk)",
  "not sold": "Nav pārdots",
  pending: "Gaida izsoli",
  repaired: "Remontēts",
};

const DAMAGE_TERM_LV: { re: RegExp; lv: string }[] = [
  { re: /^front\s*(end|damage)?$/i, lv: "Priekšpuses bojājums" },
  { re: /^rear\s*(end|damage)?$/i, lv: "Aizmugures bojājums" },
  { re: /^side\s*(damage)?$/i, lv: "Sāna bojājums" },
  { re: /^left\s*(side|front|rear)?.*$/i, lv: "Kreisās puses bojājums" },
  { re: /^right\s*(side|front|rear)?.*$/i, lv: "Labās puses bojājums" },
  { re: /^all\s*over$/i, lv: "Bojājumi visā virsbūvē" },
  { re: /^undercarriage$/i, lv: "Apakšas bojājums" },
  { re: /^top\s*\/?\s*roof$/i, lv: "Jumta bojājums" },
  { re: /^(water|flood)(\s*\/\s*flood)?$/i, lv: "Ūdens / plūdu bojājums" },
  { re: /^hail$/i, lv: "Krusas bojājums" },
  { re: /^vandalism$/i, lv: "Vandālisms" },
  { re: /^rollover$/i, lv: "Apgāšanās" },
  { re: /^burn.*$/i, lv: "Ugunsgrēka bojājums" },
  { re: /^mechanical$/i, lv: "Mehānisks bojājums" },
  { re: /^minor\s*dent\s*\/?\s*scratches$/i, lv: "Nelieli iespiedumi un skrāpējumi" },
  { re: /^normal\s*wear$/i, lv: "Normāls nolietojums" },
  { re: /^stripped$/i, lv: "Izjaukts / nokomplektēts" },
  { re: /^partial\s*repair$/i, lv: "Daļēji remontēts" },
  { re: /^none$/i, lv: "Nav" },
  { re: /^unknown$/i, lv: "Nav norādīts" },
  { re: /^n\/?a$/i, lv: "Nav norādīts" },
];

function translateDamageTerm(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  for (const { re, lv } of DAMAGE_TERM_LV) {
    if (re.test(t)) return lv;
  }
  return t;
}

/**
 * Īpašumtiesību atzīmes („title brands”) — pilnais saraksts atskaites secībā.
 * Klienta PDF drukājam tikai tās, kurām avotā ir ieraksts.
 */
const TITLE_BRAND_LV: [string, string][] = [
  ["Flood damage", "Plūdu bojājums"],
  ["Fire damage", "Ugunsgrēka bojājums"],
  ["Hail damage", "Krusas bojājums"],
  ["Salt water damage", "Sālsūdens bojājums"],
  ["Record of Vandalism?", "Vandālisma ieraksts"],
  ["Kit", "Salikts no dažādu auto daļām (kit)"],
  ["Record of Dismantled?", "Izjaukts / tikai detaļām"],
  ["Record of Junk?", "Norakstīts metāllūžņos (junk)"],
  ["Record of Vehicle Rebuilt?", "Atjaunots pēc norakstīšanas (rebuilt)"],
  ["Record of Reconstructed?", "Pārbūvēts (reconstructed)"],
  ["Salvage: Damage or Not Specified", "Norakstīts pēc bojājumiem (salvage)"],
  ["Salvage: Stolen", "Norakstīts pēc zādzības"],
  ["Salvage: Reasons Other Than Damage or Stolen", "Norakstīts citu iemeslu dēļ"],
  ["Test Vehicle", "Ražotāja testa auto"],
  ["Record of Vehicle Refurbished?", "Pilnībā atjaunots (refurbished)"],
  ["Record of Collision?", "Sadursmes ieraksts"],
  ["Salvage Retention", "Norakstīts, palicis pie īpašnieka"],
  ["Prior Taxi", "Iepriekš taksometrs"],
  ["Prior Police", "Iepriekš policijas auto"],
  ["Original Taxi", "Reģistrēts kā taksometrs"],
  ["Original Police", "Reģistrēts kā policijas auto"],
  ["Remanufactured", "Ražotāja pārbūvēts"],
  ["Gray Market", "Pelēkais imports"],
  ["Warranty Return", "Atgriezts ražotājam garantijas dēļ"],
  ["Antique", "Antīks auto"],
  ["Classic", "Klasisks auto"],
  ["Agricultural Vehicle", "Lauksaimniecības transports"],
  ["Logging Vehicle", "Mežizstrādes transports"],
  ["Street Rod", "Pārbūvēts street rod"],
  ["Vehicle Contains Reissued VIN", "Atkārtoti piešķirts VIN"],
  ["Replica", "Replika"],
  ["Record of Totaled?", "Pilnīgi bojāts — total loss"],
  ["Owner Retained", "Total loss, palicis pie īpašnieka"],
  ["Bond Posted", "Īpašumtiesības apstiprinātas ar garantiju"],
  ["Memorandum Copy", "Title dokuments ir kopija"],
  ["Parts Only", "Tikai detaļām"],
  ["Recovered Theft", "Atgūts pēc zādzības"],
  ["Undisclosed Lien", "Neatklāta ķīla"],
  ["Prior Owner Retained", "Iepriekš total loss pie īpašnieka"],
  ["Vehicle Non-conformity Uncorrected", "Nenovērsta ražotāja neatbilstība"],
  ["Vehicle Non-conformity Corrected", "Novērsta ražotāja neatbilstība"],
  ["Vehicle Safety Defect Uncorrected", "Nenovērsts drošības defekts"],
  ["Vehicle Safety Defect Corrected", "Novērsts drošības defekts"],
  ["VIN Replaced", "VIN nomainīts"],
  ["Gray Market: Non-compliant", "Pelēkais imports — neatbilst standartiem"],
  ["Gray Market: Compliant", "Pelēkais imports — atbilst standartiem"],
  ["Manufacturer Buy Back", "Ražotājs atpircis (lemon law)"],
  ["Former Rental", "Iepriekš nomas auto"],
  ["Disclosed Damage", "Deklarēti bojājumi"],
  ["Prior Non-Repairable / Repaired", "Bijis neremontējams, pēc tam remontēts"],
  ["Record of Vehicle Crushed?", "Sapresēts"],
  ["Hazardous", "Piesārņots ar bīstamām vielām"],
  ["Export Only Vehicle", "Tikai eksportam"],
  ["Odometer: Actual", "Odometrs: patiess rādījums"],
  ["Odometer: Not Actual", "Odometrs: nepatiess rādījums"],
  ["Odometer: Tampering Verified", "Odometrs: pierādīta viltošana"],
  ["Odometer: Exempt from Odometer Disclosure", "Odometrs: rādījums nav jādeklarē"],
  ["Odometer: Exceeds Mechanical Limits Rectified", "Odometrs: labots pārsniegtais limits"],
  ["Odometer: Exceeds Mechanical Limits", "Odometrs: pārsniegts mehāniskais limits"],
  ["Odometer: May be Altered", "Odometrs: iespējama korekcija"],
  ["Odometer: Replaced", "Odometrs: nomainīts"],
  ["Odometer: Reading at Time of Renewal", "Odometrs: rādījums reģistrācijas atjaunošanā"],
  ["Odometer: Discrepancy", "Odometrs: pretrunīgi rādījumi"],
  ["Odometer: Call Title Division", "Odometrs: nepieciešams reģistra skaidrojums"],
];

const US_STATES = new Set(
  [
    "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
    "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa", "kansas", "kentucky",
    "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota", "mississippi",
    "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey", "new mexico",
    "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon", "pennsylvania",
    "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah", "vermont",
    "virginia", "washington", "west virginia", "wisconsin", "wyoming", "district of columbia",
  ],
);

/** VERSALIEM tekstiem — cilvēklasāms izskats; īsie akronīmi (IAA, IAAI, CA) paliek. */
function titleCase(raw: string): string {
  const words = raw.trim().split(/\s+/);
  return words
    .map((w) => {
      if (!w) return w;
      const isAcronym =
        w.length <= 4 && w === w.toUpperCase() && (words.length === 1 || !/[AEIOUY]/.test(w));
      if (isAcronym) return w;
      return w[0]!.toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

/** ASV štats → reģiona teksts + valsts „ASV” nobraukuma tabulai. */
function regionDisplay(raw: string): { region: string; country: string } {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return { region: "", country: "" };
  const key = t.toLowerCase();
  if (US_STATES.has(key)) return { region: `${titleCase(t)} (ASV)`, country: "ASV" };
  return { region: titleCase(t), country: "" };
}

/* ---------------------------------------------------------------- palīgi */

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const KM_LINE_RE = /^([\d.,\s]+)\s*km$/i;

function lvDate(raw: string): string {
  const m = raw.trim().match(DATE_RE);
  if (!m) return formatAutoRecordsDateForOutput(raw.trim());
  return `${m[1]}.${m[2]}.${m[3]}`;
}

function formatKmDisplay(raw: string): string {
  const digits = normalizeAutoRecordsOdometer(raw);
  if (!digits) return raw.trim();
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Summu attēlojums CC.VIN tabulās — nav-EUR valūtas automātiski pārrēķina uz EUR
 * (tāpat kā AutoDNA/CarVertical), lai avota valūta nekad neparādās klientam neizmainīta.
 * Pārrēķina audita ieraksts (ja `notes` padots) nonāk operatora paziņojumos pēc PDF augšupielādes.
 */
function moneyDisplay(raw: string, notes?: string[]): string {
  const m = raw.trim().match(/^([\d.,\s]+)\s*(USD|EUR|GBP)$/i);
  if (!m) return raw.trim();
  const digits = m[1]!.replace(/[.,\s]/g, "");
  if (!digits) return raw.trim();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const currency = m[2]!.toUpperCase();
  const display = `${grouped} ${currency}`;
  if (currency === "EUR") return display;
  const conversion = convertAmountTextToEur(display);
  if (!conversion) return display;
  if (notes) {
    const note = describeEurConversion(display, conversion);
    if (note) notes.push(note);
  }
  return conversion.display;
}

function squish(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, "");
}

/* --------------------------------------------------------------- parseris */

function parseHeader(lines: string[], out: CcVinParsedReport): void {
  for (let i = 0; i < Math.min(lines.length, 60); i++) {
    const line = lines[i]!;
    if (/^vin\s*:?$/i.test(line)) {
      const next = lines[i + 1] ?? "";
      if (/^[A-HJ-NPR-Z0-9]{11,17}$/i.test(next)) out.vin = next.toUpperCase();
      const prev = lines[i - 1] ?? "";
      if (/,\s*\d{4}$/.test(prev)) out.vehicleLine = prev;
      continue;
    }
    if (/^report\s+date\s*:?$/i.test(line)) {
      const next = lines[i + 1] ?? "";
      if (DATE_RE.test(next)) out.reportDate = lvDate(next);
      continue;
    }
    const marks = line.match(/^(\d+)\s*\/\s*(\d+)\s+attention\s+marks$/i);
    if (marks) out.attentionMarks = `${marks[1]}/${marks[2]}`;
  }
}

/** Kopsavilkuma lauciņi: nosaukums var būt sadalīts 2–3 rindās, statuss ir nākamā rinda. */
function parseChecks(lines: string[], out: CcVinParsedReport): void {
  const start = lines.findIndex((l) => /^general\s+information$/i.test(l));
  if (start < 0) return;
  const endMarkers = /^(found\s+\d+\s+photos|vehicle\s+specifications)$/i;
  let end = lines.findIndex((l, i) => i > start && endMarkers.test(l));
  if (end < 0) end = Math.min(lines.length, start + 60);

  const seen = new Set<string>();
  let i = start + 1;
  while (i < end) {
    let matched: { label: string; span: number } | null = null;
    for (const span of [3, 2, 1]) {
      const joined = lines.slice(i, i + span).join(" ");
      const key = joined.toLowerCase().replace(/\s+/g, " ").trim();
      if (CHECK_LABELS_EN.includes(key)) {
        matched = { label: CHECK_LABEL_LV[key]!, span };
        break;
      }
    }
    if (!matched) {
      i += 1;
      continue;
    }
    const statusRaw = lines[i + matched.span] ?? "";
    const status = translateCheckStatus(statusRaw);
    const severity: CcVinCheckRow["severity"] = CHECK_STATUS_OK_RE.test(statusRaw.trim()) ? "ok" : "alert";
    if (!seen.has(matched.label)) {
      seen.add(matched.label);
      out.checks.push({ label: matched.label, status: status || "—", severity });
      const owners = statusRaw.match(/^(\d+)\s*owner\(s\)$/i);
      if (owners) out.ownersCount = owners[1]!;
    }
    i += matched.span + 1;
  }
  calibrateCheckSeverity(out);
}

/**
 * Teksta slānī nav ikonu krāsu, tāpēc skaitliskus statusus („1 ieraksts”) sākotnēji uzskatām par
 * brīdinājumu. Atskaites galvenē norādītais brīdinājumu skaits ļauj pārliekos atzīmēt kā neitrālus,
 * sākot ar sadaļām, kuras pašas par sevi nav sarkanais karogs.
 */
const SOFT_CHECK_LABELS = [
  "Servisa ieraksti",
  "Reģistrācijas ieraksti",
  "Pārdošanas vēsture",
  "Izsoļu pārdošanas vēsture",
  "Īpašnieku skaits",
  "Īpašumtiesību ieraksti",
];

function calibrateCheckSeverity(out: CcVinParsedReport): void {
  const declared = Number(out.attentionMarks.split("/")[0]);
  if (!Number.isFinite(declared)) return;
  let alerts = out.checks.filter((c) => c.severity === "alert").length;
  for (const label of SOFT_CHECK_LABELS) {
    if (alerts <= declared) break;
    const row = out.checks.find((c) => c.label === label && c.severity === "alert");
    if (!row) continue;
    row.severity = "ok";
    alerts -= 1;
  }
}

/**
 * Odometra ieraksti: „19/09/2019” + „5660 km” pāri (grafika ass vērtībām nav „km”).
 * Atskaites lapu kolonnas teksta slānī pārklājas, tāpēc skenējam visu dokumentu un dublikātus
 * apvienojam pēc datuma + km.
 */
function parseMileage(lines: string[], out: CcVinParsedReport): void {
  const sameLine = /^(\d{2}\/\d{2}\/\d{4})\s*([\d.,\s]+)\s*km$/i;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const same = line.match(sameLine);
    if (same) {
      const odometer = normalizeAutoRecordsOdometer(same[2]!);
      if (odometer) out.mileage.push({ date: lvDate(same[1]!), odometer, country: "" });
      continue;
    }
    if (!DATE_RE.test(line)) continue;
    let odometer = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 8); j++) {
      const nxt = lines[j]!;
      if (DATE_RE.test(nxt)) break;
      if (isMileageNoiseLine(nxt)) continue;
      const km = nxt.match(KM_LINE_RE);
      if (!km) break;
      odometer = normalizeAutoRecordsOdometer(km[1]!) || "";
      break;
    }
    if (!odometer) continue;
    out.mileage.push({ date: lvDate(line), odometer, country: "" });
  }
}

function isMileageNoiseLine(line: string): boolean {
  return (
    isSectionHeading(line) ||
    /^vehicle\s+value/i.test(line) ||
    /^(no\s+records?\s+found|no\s+problems\s+found|no\s+found\s+records)$/i.test(line) ||
    /^\d+\s+record\(s\)$/i.test(line) ||
    /^mileages$/i.test(line)
  );
}

/** Sadaļu virsraksti nav ne izsoles vieta, ne uzņēmums — teksta slānī tie stāv līdzās ierakstiem. */
function isSectionHeading(line: string): boolean {
  const key = line.trim().toLowerCase();
  if (CHECK_LABEL_LV[key]) return true;
  if (/^vehicle\s+info$/i.test(key)) return true;
  return /\b(records?|history|checks?|informa(?:tion)?|campaigns|details|photos)$/i.test(key);
}

const AUCTION_DAMAGE_PREFIX_RE = /^Norakstīto auto izsole:/;

/** „Damage 1Front Damage” — apraksts ar tuvāko iepriekšējo datumu. */
function parseDamages(lines: string[], out: CcVinParsedReport): void {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!.match(/^damage\s*(\d+)\s*(.+)$/i);
    if (!m) continue;
    const description = translateDamageTerm(m[2]!);
    if (!description || /^nav$/i.test(description)) continue;
    let date = "";
    for (let j = i - 1; j >= 0 && j >= i - 6; j--) {
      if (DATE_RE.test(lines[j]!)) {
        date = lvDate(lines[j]!);
        break;
      }
    }
    out.damages.push({ date, region: "", amount: "", description });
  }

  // Norakstīto izsoļu ieraksti: datums + km + „Primary Damage: …”.
  for (let i = 0; i < lines.length; i++) {
    const primary = lines[i]!.match(/^primary\s+damage\s*:\s*(.+)$/i);
    if (!primary) continue;
    const secondary = (lines[i + 1] ?? "").match(/^secondary\s+damage\s*:\s*(.+)$/i);
    let date = "";
    let venue = "";
    let odometer = "";
    for (let j = i - 1; j >= 0 && j >= i - 5; j--) {
      const line = lines[j]!;
      if (!odometer) {
        const km = line.match(KM_LINE_RE);
        if (km) {
          odometer = normalizeAutoRecordsOdometer(km[1]!);
          continue;
        }
      }
      if (!date && DATE_RE.test(line)) {
        date = lvDate(line);
        continue;
      }
      if (
        !venue &&
        /^[A-Z][A-Za-z0-9&.,'’\- ]{2,60}$/.test(line) &&
        !/km$/i.test(line) &&
        !isSectionHeading(line)
      ) {
        venue = line.trim();
      }
    }
    const parts = [translateDamageTerm(primary[1]!)];
    const sec = secondary ? translateDamageTerm(secondary[1]!) : "";
    if (sec && !/^nav$/i.test(sec)) parts.push(sec);
    const description = parts.filter(Boolean).join(" · ");
    if (!description) continue;
    if (odometer) out.mileage.push({ date, odometer, country: "" });
    out.damages.push({
      date,
      region: venue,
      amount: "",
      description: `Norakstīto auto izsole: ${description}`,
    });
  }

  parseAccidentRecords(lines, out);
}

/**
 * Eiropas CheckCar.vin: „Accident records” / „Accident #1” + CountryDE + remonta tāme.
 * ASV atskaitēs šī sadaļa bieži ir „No records found” — tad rindu nav.
 */
function parseAccidentRecords(lines: string[], out: CcVinParsedReport): void {
  for (let i = 0; i < lines.length; i++) {
    if (!/^accident\s*#\s*\d+$/i.test(lines[i]!)) continue;

    let date = "";
    for (let j = i - 1; j >= 0 && j >= i - 8; j--) {
      if (DATE_RE.test(lines[j]!)) {
        date = lvDate(lines[j]!);
        break;
      }
    }

    let region = "";
    let amount = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 14); j++) {
      const line = lines[j]!;
      if (/^accident\s*#\s*\d+$/i.test(line)) break;
      if (
        /^(mileages|accident records|services records|vehicle damages|salvage auction records|title records)$/i.test(
          line,
        )
      ) {
        break;
      }

      const countryLine = line.match(/^country\s*:?\s*(.+)$/i);
      if (countryLine) {
        region = countryFromCcVinLabel(countryLine[1]!);
        continue;
      }

      const cost = line.match(
        /total\s+repair(?:\s*\([^)]*\))?\s*cost\s*:?\s*([\d.,\s]+)\s*(USD|EUR|GBP)/i,
      );
      if (cost) {
        amount = moneyDisplay(`${cost[1]!.trim()} ${cost[2]!.toUpperCase()}`, out.notes);
      }
    }

    if (!date && !region && !amount) continue;
    out.damages.push({
      date,
      region,
      amount,
      description: "Negadījums",
    });
  }
}

/** „CountryDE” / „DE” / „Germany” → latviskais nosaukums, ja atpazīstams. */
function countryFromCcVinLabel(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return normalizeCountryNameLv(t) || titleCase(t);
}

/** Apdrošinātāju / junk-salvage ieraksti: datums, uzņēmums, DETAILS, Location/Disposition. */
function parseInsuranceRecords(lines: string[], out: CcVinParsedReport): void {
  for (let i = 0; i < lines.length; i++) {
    if (!/^details$/i.test(lines[i]!)) continue;
    const company = (lines[i - 1] ?? "").trim();
    const dateLine = (lines[i - 2] ?? "").trim();
    if (!company || /^details$/i.test(company)) continue;
    const date = DATE_RE.test(dateLine) ? lvDate(dateLine) : "";
    let location = "";
    let disposition = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
      const line = lines[j]!;
      if (/^details$/i.test(line) || DATE_RE.test(line)) break;
      const loc = line.match(/^location\s*(.*)$/i);
      if (loc) {
        location = loc[1]!.trim();
        continue;
      }
      const disp = line.match(/^disposition\s*(.*)$/i);
      if (disp) disposition = disp[1]!.trim();
    }
    if (!disposition && !location) continue;
    const dispLv = disposition ? (DISPOSITION_LV[disposition.toLowerCase()] ?? titleCase(disposition)) : "";
    const detail = [dispLv ? `Statuss: ${dispLv}` : "", location ? `Vieta: ${titleCase(location)}` : ""]
      .filter(Boolean)
      .join(" · ");
    out.insurance.push({ date, label: titleCase(company), detail });
  }
}

/** „Record #4” + „28/05/2020 California 20477 km”. */
function parseTitleRecords(lines: string[], out: CcVinParsedReport): void {
  for (let i = 0; i < lines.length - 1; i++) {
    if (!/^record\s*#\d+$/i.test(lines[i]!)) continue;
    const detail = lines[i + 1]!;
    const m = detail.match(/^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+([\d.,\s]+)\s*km$/i);
    if (!m) continue;
    const { region, country } = regionDisplay(m[2]!);
    const odometer = normalizeAutoRecordsOdometer(m[3]!);
    out.titles.push({ date: lvDate(m[1]!), region, odometer, note: "" });
    if (odometer) out.mileage.push({ date: lvDate(m[1]!), odometer, country });
  }
}

const SALE_COMBO_RE = /^([\d.,\s]+)\s*km\s*(.*?)(\d{2}\/\d{2}\/\d{4})$/i;
const SALE_KM_VENUE_RE = /^([\d.,\s]+)\s*km\s+(.+)$/i;
const SALE_MONEY_RE = /^([\d.,\s]+)\s*(USD|EUR|GBP)$/i;
const SALE_STOP_RE =
  /^(vehicle\s+info|safety\s+ratings|complaints|materials\s+installed|work\s+performed|found\s+\d+\s+photos|make[a-z]|model[a-z]|year\d{4})/i;

const AUCTION_VENUE_COUNTRY: Record<string, string> = {
  autobid: "Vācija",
  iaai: "ASV",
  iaa: "ASV",
};

function countryFromAuctionVenue(venue: string): string {
  const key = squish(venue);
  if (AUCTION_VENUE_COUNTRY[key]) return AUCTION_VENUE_COUNTRY[key]!;
  if (key.startsWith("autobid")) return "Vācija";
  return "";
}

function isSaleBlockStop(line: string): boolean {
  return isSectionHeading(line) || SALE_STOP_RE.test(line);
}

function isSaleVenueLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  if (DATE_RE.test(t) || KM_LINE_RE.test(t) || SALE_MONEY_RE.test(t)) return false;
  if (isSaleBlockStop(t)) return false;
  if (/\(\d{5,}\)/.test(t)) return false;
  return /^[A-Za-z][A-Za-z0-9.&'’()\-/, ]{1,60}$/.test(t);
}

/**
 * „SOLD #1” + cena + „5,660 kmBmw Of Murrieta (Murrieta, CA)20/11/2019”.
 * Eiropas CheckCar bieži sadala ikonu laukus pa rindām: cena, km, AUTOBID, datums.
 */
function parseSales(lines: string[], out: CcVinParsedReport): void {
  const soldLine = /^(sold|not\s+sold)\s*#?\s*(\d+)?$/i;
  for (let i = 0; i < lines.length; i++) {
    if (!soldLine.test(lines[i]!)) continue;
    let price = "";
    let odometer = "";
    let venue = "";
    let date = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 24); j++) {
      const line = lines[j]!;
      if (soldLine.test(line) || isSaleBlockStop(line)) break;

      const combo = line.match(SALE_COMBO_RE);
      if (combo) {
        odometer = normalizeAutoRecordsOdometer(combo[1]!) || odometer;
        venue = combo[2]!.trim() || venue;
        date = lvDate(combo[3]!);
        if (price && odometer && venue && date) break;
        continue;
      }

      const money = line.match(SALE_MONEY_RE);
      if (money && !price) {
        price = moneyDisplay(line, out.notes);
        continue;
      }

      const kmOnly = line.match(KM_LINE_RE);
      if (kmOnly && !odometer) {
        odometer = normalizeAutoRecordsOdometer(kmOnly[1]!) || odometer;
        continue;
      }

      const kmVenue = line.match(SALE_KM_VENUE_RE);
      if (kmVenue && !odometer) {
        odometer = normalizeAutoRecordsOdometer(kmVenue[1]!) || odometer;
        venue = kmVenue[2]!.trim() || venue;
        continue;
      }

      const gluedKmVenue = line.match(/^([\d.,\s]+)\s*km([A-Za-z].+)$/i);
      if (gluedKmVenue && !odometer) {
        odometer = normalizeAutoRecordsOdometer(gluedKmVenue[1]!) || odometer;
        venue = gluedKmVenue[2]!.trim() || venue;
        continue;
      }

      if (DATE_RE.test(line) && !date) {
        date = lvDate(line);
        continue;
      }

      if (!venue && isSaleVenueLine(line)) venue = line.trim();
    }
    if (!price && !odometer && !date) continue;
    const country = countryFromAuctionVenue(venue);
    if (odometer && date) out.mileage.push({ date, odometer, country });
    out.sales.push({
      date,
      venue,
      odometer: odometer ? formatKmDisplay(odometer) : "",
      price,
      status: /^not\s+sold/i.test(lines[i]!) ? "Nav pārdots" : "Pārdots",
    });
  }

  // Nepārdotās izsoles bez „#” numura: datums, cena, vieta, „Not Sold”.
  for (let i = 0; i < lines.length; i++) {
    if (!/^not\s+sold$/i.test(lines[i]!)) continue;
    const venue = (lines[i - 1] ?? "").trim();
    const price = (lines[i - 2] ?? "").trim();
    const dateLine = (lines[i - 3] ?? "").trim();
    if (!DATE_RE.test(dateLine)) continue;
    out.sales.push({
      date: lvDate(dateLine),
      venue,
      odometer: "",
      price: moneyDisplay(price, out.notes),
      status: "Nav pārdots",
    });
  }
}

/**
 * „Title checks” matrica: statusu straume (`No records found` / `Record found!`) lapā ir pirms
 * atzīmju nosaukumiem, tāpēc pārim izmantojam kārtas numuru, nevis pozīciju.
 * Ja skaits nesakrīt, atgriežam tikai kopsavilkuma rindu — nekad nepiešķiram nepareizu atzīmi.
 */
function parseTitleBrands(lines: string[], out: CcVinParsedReport): void {
  const start = lines.findIndex((l) => /^title\s+checks$/i.test(l));
  if (start < 0) return;
  const region = lines.slice(start + 1);
  const declaredMatch = (region[0] ?? "").match(/^(\d+)\s+record\(s\)$/i);
  const declared = declaredMatch ? Number(declaredMatch[1]) : null;

  /** Šo sadaļu statusi nepieder atzīmju matricai, lai gan teksta slānī iekrīt tajā pašā zonā. */
  const foreignHeader =
    /^(safety\s+recall\s+campaigns|safety\s+ratings|complaints|theft\s+records|lien\s*\/\s*impound\s*\/\s*export\s+records|accident\s+records|services\s+records|registrations?\s+records|auction\s+sale\s+history|salvage\s+auction\s+records|title\s+records|vehicle\s+value\s+information|mileages|junk\s*\/\s*salvage\s*\/\s*insurance\s+records|other\s+titles\s+brands\s+check|vehicle\s+damages)$/i;

  const brandKeys = TITLE_BRAND_LV.map(([en, lv]) => ({ lv, key: squish(en) })).sort(
    (a, b) => b.key.length - a.key.length,
  );

  const order: { lv: string }[] = [];
  const statuses: { found: boolean; date: string; region: string }[] = [];
  for (let i = 0; i < region.length; i++) {
    const line = region[i]!;

    if (/^(no\s+records\s+found|record\s+found!?)$/i.test(line)) {
      const prev = (region[i - 1] ?? "").trim();
      if (foreignHeader.test(prev)) continue;
      if (/^no\s+records\s+found$/i.test(line)) {
        statuses.push({ found: false, date: "", region: "" });
        continue;
      }
      const info = squish(region[i + 1] ?? "").match(/^branddate(\d{2}\/\d{2}\/\d{4})brand([a-z]+)$/);
      statuses.push({
        found: true,
        date: info ? lvDate(info[1]!) : "",
        region: info ? regionDisplay(info[2]!).region : "",
      });
      continue;
    }

    // Nosaukums var būt pārrauts ligatūrā („Speci” + „fied”), tāpēc mēģinām arī divu rindu savienojumu.
    for (const span of [1, 2]) {
      const key = squish(region.slice(i, i + span).join(""));
      const hit = brandKeys.find((b) => b.key === key);
      if (hit) {
        order.push({ lv: hit.lv });
        i += span - 1;
        break;
      }
    }
  }

  const foundCount = statuses.filter((s) => s.found).length;
  if (foundCount === 0) return;

  if (order.length !== statuses.length) {
    out.brands.push({
      date: "",
      label: `Atrastas īpašumtiesību atzīmes: ${declared ?? foundCount}`,
      detail: "Atzīmju nosaukumus nevarēja droši sasaistīt — jāpārbauda avota atskaitē.",
    });
    out.notes.push("Īpašumtiesību atzīmju tabulu nevarēja sasaistīt pa rindām.");
    return;
  }

  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i]!;
    if (!s.found) continue;
    out.brands.push({
      date: s.date,
      label: order[i]!.lv,
      detail: s.region ? `Reģistrēts: ${s.region}` : "",
    });
  }
}

export function parseCcVinReportText(rawText: string): CcVinParsedReport {
  const out = emptyCcVinParsedReport();
  const lines = textLines(rawText);
  if (lines.length === 0) return out;

  parseHeader(lines, out);
  parseChecks(lines, out);
  parseMileage(lines, out);
  parseDamages(lines, out);
  parseInsuranceRecords(lines, out);
  parseTitleRecords(lines, out);
  parseSales(lines, out);
  parseTitleBrands(lines, out);

  out.mileage = dedupeMileage(applyDefaultCountry(out));
  out.damages = dropDuplicateDamages(
    dedupeBy(out.damages, (r) => `${r.date}|${squish(r.description)}`),
  );
  out.insurance = dedupeBy(out.insurance, (r) => `${r.date}|${squish(r.label)}|${squish(r.detail)}`);
  out.brands = dedupeBy(out.brands, (r) => `${r.date}|${squish(r.label)}`);
  out.titles = dedupeBy(out.titles, (r) => `${r.date}|${r.odometer}|${squish(r.region)}`);
  out.sales = dedupeBy(out.sales, (r) => `${r.date}|${r.odometer}|${squish(r.venue)}|${r.status}`);
  return out;
}

/**
 * Bojājumu bloks un norakstīto izsoļu ieraksti bieži apraksta vienu notikumu: tajā pašā datumā
 * izsoles ieraksts satur to pašu bojājumu, tikai ar vietu. Tad paliek tikai bagātākais ieraksts.
 */
function dropDuplicateDamages(rows: CcVinDamageRow[]): CcVinDamageRow[] {
  const auctionByDate = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.region.trim() && !AUCTION_DAMAGE_PREFIX_RE.test(r.description)) continue;
    const list = auctionByDate.get(r.date) ?? [];
    list.push(squish(r.description));
    auctionByDate.set(r.date, list);
  }
  return rows.filter((r) => {
    if (r.region.trim() || AUCTION_DAMAGE_PREFIX_RE.test(r.description)) return true;
    const others = auctionByDate.get(r.date) ?? [];
    const own = squish(r.description);
    return !others.some((o) => o.includes(own));
  });
}

/** Ja atskaitē ir ASV title ieraksti, arī pārējie tā perioda rādījumi ir no ASV reģistriem. */
function applyDefaultCountry(p: CcVinParsedReport): { date: string; odometer: string; country: string }[] {
  const hasUs = p.titles.some((t) => /\(ASV\)/.test(t.region));
  if (!hasUs) return p.mileage;
  return p.mileage.map((r) => (r.country ? r : { ...r, country: "ASV" }));
}

function dedupeBy<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function dedupeMileage(
  rows: { date: string; odometer: string; country: string }[],
): { date: string; odometer: string; country: string }[] {
  const byKey = new Map<string, { date: string; odometer: string; country: string }>();
  for (const r of rows) {
    if (!r.date || !r.odometer) continue;
    const k = `${r.date}|${r.odometer}`;
    const prev = byKey.get(k);
    if (!prev) {
      byKey.set(k, r);
      continue;
    }
    if (!prev.country && r.country) byKey.set(k, r);
  }
  return [...byKey.values()].sort((a, b) => sortableDate(b.date) - sortableDate(a.date));
}

function sortableDate(lv: string): number {
  const m = lv.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return 0;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

/** Cik faktu rindas parseris atrada (kļūdas ziņojumam / kopsavilkumam). */
export function countCcVinParsedRows(p: CcVinParsedReport): number {
  return (
    p.mileage.length +
    p.damages.length +
    p.insurance.length +
    p.brands.length +
    p.titles.length +
    p.sales.length
  );
}
