/**
 * Deterministiska pretrunu pārbaude pret KANONISKAJIEM FAKTIEM un starp laukiem.
 * Tekstu nemaina; tikai karodziņi adminam (E/W). Nav maksas modeļa.
 */
import type { RegistryCountryPeriod } from "@/lib/registry-country-periods";
import {
  CANONICAL_FACTS_HEADER,
  LARGE_ODOMETER_DROP_KM,
  SUSPECTED_ENTRY_ERROR_LINE_PREFIX,
  isMileageRelatedCommentField,
  rollbackMentionRequired,
  type CanonicalFacts,
} from "@/lib/canonical-facts-sheet";
import { formatForensicsInt } from "@/lib/admin-ai-mileage-forensics";
import { extractCampaignCodes, splitSentences } from "@/lib/unit-facts/check";
import type { FactCheckFlag, FactCheckLevel } from "@/lib/unit-facts/types";
import {
  extractLoadedPowertrainIdentity,
  findPowertrainContradictions,
  powertrainContradictionsToFlags,
} from "@/lib/comment-powertrain-guard";

export type ContradictionCheckInput = {
  text: string;
  field?: string;
  facts: CanonicalFacts;
  /** Citu lauku teksti (plain) — km/datumiem starp laukiem. */
  otherFieldTexts?: Array<{ field: string; label: string; text: string }>;
  /** Ielādētie avoti: OE VIN Lookup / dīleris / CSDD degviela un dzinējs. */
  sourceBlocks?: import("@/lib/admin-source-blocks").WorkspaceSourceBlocks;
  vin?: string | null;
  /** Avota komentāram: fokusa avota nosaukums (piem. „CSDD”, „AutoDNA”). */
  focusSourceLabel?: string | null;
  /** Fokusa avota datu teksts (km skaitļi `csdd_foreign_mileage` pārbaudei). */
  focusSourceText?: string | null;
};

const ROLLBACK_CONTEXT_RE = /kritum|korekcij|samazin|atgriez|atpakaļgait|rollback|griezt/i;

/** Visi km lieluma skaitļi tekstā („179 862”, „179862”, „179.862”). */
export function extractKmLikeNumbers(text: string): number[] {
  const out: number[] = [];
  for (const m of (text ?? "").matchAll(/(?<![\d.,])(\d{1,3}(?:[ \u00a0\u202f.]\d{3})+|\d{4,7})(?![\d,]|\.\d)/g)) {
    const n = Number(m[1]!.replace(/[^\d]/g, ""));
    if (n >= 1_000) out.push(n);
  }
  return out;
}

function mentionsKm(text: string, km: number): boolean {
  return extractKmLikeNumbers(text).includes(km);
}

function isCsddFocus(field: string, focus?: string | null): boolean {
  if ((focus ?? "").trim().toLowerCase() === "csdd") return true;
  return field.toLowerCase().split(":")[0] === "csdd";
}

const ROLLBACK_MENTION_RE =
  /odometr|kritum|atpakaļgait|rollback|neatbilstīb.{0,40}nobrauk|nobraukum.{0,40}neatbilst|korekcij|anomāl/i;
const MINIMISING_RE =
  /nelielas?\s+nobīd|niecīg\w*\s+(?:nobīd|atšķir|kritum)|minimāl\w*\s+(?:nobīd|atšķir)|sīkas?\s+atšķir|neliels\s+kritums/i;
const NO_ACCIDENT_RE =
  /\bnav\s+(fiksēt|reģistrēt|konstatēt|zinām)\w*.{0,40}(?:negadījum|csng|avārij)|(?:negadījum|avārij|csng)\w*.{0,30}\bnav\b/i;
/** „Nav bojājumu / atlīdzību / zaudējumu” - j26: plašāks par `NO_ACCIDENT_RE`. */
const NO_DAMAGE_RE =
  /\bnav\b.{0,50}(?:negadījum|csng|avārij|bojāj|atlīdz|zaudējum)|\bnav\s+(?:fiksēt|reģistrēt|konstatēt|zinām)\w*.{0,40}(?:negadījum|csng|avārij|bojāj|atlīdz|zaudējum)|(?:negadījum|avārij|csng|bojāj|atlīdz|zaudējum)\w*.{0,30}\bnav\b|bez\s+(?:negadījum|bojāj|avārij)\w*/i;
/** Teikums par to, ka nav SUMMAS (ne bojājuma) - nav pretruna bojājumiem bez summas. */
const AMOUNT_ONLY_RE = /summ|\beur\b|€|apmēr|izmaks/i;
/** Neskaidrība („nav zināms, vai…”) - nav apgalvojums, ka bojājumu nav. */
const DAMAGE_UNCERTAIN_RE = /nav\s+(?:zināms|skaidrs|informācij\w*)\W{0,3}(?:\s+\S+){0,3}\s+vai\b/i;
/** Teikums pats apgalvo bojājumu (piem. „izsolē fiksēti bojājumi…, LTAB atlīdzības nav”). */
const DAMAGE_POSITIVE_RE =
  /bojājum\w*\s+(?:ir\s+)?(?:fiksēt|reģistrēt|konstatēt|norādīt)|(?<!nav\s)(?<!nav\s\S{1,12}\s)(?:fiksēt|reģistrēt|konstatēt|norādīt)\w*\s+(?:\S+\s+)?bojāj|bojājuma\s+dēļ/i;
/** j26: dīlera skaitu etiķete -> teksta atpazīšana (LV). */
const DEALER_COUNT_TEXT_RE: Array<{ label: RegExp; re: string }> = [
  { label: /^dzinēja eļļas maiņas$/i, re: "(?:dzinēja|motor)\\p{L}*\\s+eļļ\\p{L}*|eļļas\\s+maiņ\\p{L}*" },
  { label: /^kārbas eļļas maiņas$/i, re: "(?:kārb|dsg|pārnesumkārb)\\p{L}*\\s+(?:eļļ|apkop|šķidr)\\p{L}*" },
];

function dealerCountMentionSource(label: string): string {
  const known = DEALER_COUNT_TEXT_RE.find((d) => d.label.test(label.trim()));
  if (known) return known.re;
  return label
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => `${w.slice(0, Math.max(4, w.length - 2)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\p{L}*`)
    .join("\\s+");
}

/** „nav (nevienas) X” / „X nav” / „bez X” tuvu komponentam. */
function negatesDealerComponent(sentence: string, mention: string): boolean {
  const before = new RegExp(`(?:\\bnav\\b|nevien\\p{L}*|netika|\\bbez\\b)(?:\\s+\\S+){0,4}?\\s+(?:${mention})`, "iu");
  const after = new RegExp(`(?:${mention})(?:\\s+\\S+){0,3}?\\s+(?:nav|netika)\\b`, "iu");
  return before.test(sentence) || after.test(sentence);
}

const COUNTRY_STAY_RE = /posm|ekspluatācij|ekspluatēt|lietot|atradās|reģistrēt|izmantot/i;
const COUNTRY_STEMS: Array<[string, string]> = [
  ["zviedrij", "Zviedrija"],
  ["somij", "Somija"],
  ["dānij", "Dānija"],
  ["igaunij", "Igaunija"],
  ["nīderland", "Nīderlande"],
];

const NO_RECALL_RE =
  /\bnav\s+(fiksēt|reģistrēt|konstatēt|atrast|zinām)\w*.{0,40}(?:atsaukum|kampaņ)|(?:atsaukum|kampaņ)\w*.{0,30}\bnav\b/i;
const OWNER_COUNT_RE = /(\d{1,2})\s+īpašniek/gi;
const OWNER_CHANGE_RE = /(\d{1,2})\s+īpašnieku\s+maiņ/gi;
const FIRST_REG_LV_RE = /pirmā\s+reģistrācija.{0,40}latvij/i;
const FIRST_REG_DE_RE = /pirmā\s+reģistrācija.{0,40}vācij|izcelsmes\s+valst.{0,20}vācij/i;
const ATSAVINASANAI_RE = /atsavināšanai/i;
const LEAK_PHRASES: Array<{ re: RegExp; id: string; label: string }> = [
  { re: /operatora\s+norād/i, id: "leak_operator_notes", label: "operatora norādes" },
  { re: /šajā\s+auditā/i, id: "leak_this_audit", label: "šajā auditā" },
  {
    re: /kā\s+minēts.{0,40}(?:sadaļ|komentār)|skat(?:īt|\.)\s+(?:1\.|2\.|3\.)|nobraukuma\s+vēstures\s+komentār|tehnisko\s+risku\s+analīzē\s+jau/i,
    id: "leak_other_section",
    label: "atsauce uz citu sadaļu",
  },
];

const LV_MONTHS: Record<string, string> = {
  janvār: "01",
  februār: "02",
  mart: "03",
  aprīl: "04",
  maij: "05",
  jūnij: "06",
  jūlij: "07",
  august: "08",
  septembr: "09",
  oktobr: "10",
  novembr: "11",
  decembr: "12",
};

function normalizeDateToken(raw: string): string {
  const t = raw.trim();
  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (dmy) {
    const y = dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]!;
    return `${y}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  }
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return t;
  return t;
}

function haystackHasDate(haystack: string, token: string): boolean {
  const n = normalizeDateToken(token);
  const compact = haystack.replace(/[.\-/]/g, "");
  const nCompact = n.replace(/-/g, "");
  if (haystack.includes(token) || haystack.includes(n) || compact.includes(nCompact)) return true;
  const parts = n.split("-");
  if (parts.length === 3) {
    const [y, m, d] = parts;
    if (haystack.includes(`${d}.${m}.${y}`) || haystack.includes(`${y}.${m}`)) return true;
  }
  return false;
}

function haystackHasMonthYear(haystack: string, year: string, month: string, monthLv: string): boolean {
  const compact = haystack.replace(/[.\-/]/g, " ");
  if (compact.includes(`${year} ${month}`) || haystack.includes(`${month}.${year}`) || haystack.includes(`${year}-${month}`)) {
    return true;
  }
  return new RegExp(`${year}.{0,12}${monthLv}`, "i").test(haystack);
}

const KM_READING_RE = /\b(\d{1,3})(?:[\s\u00a0](\d{3})|\.(\d{3}))?\s*km\b/gi;
const KM_EXCLUDE_WINDOW_RE = /intervāl|interval|starpīb/i;
const KM_EXCLUDE_IMMEDIATE_RE =
  /(?:\bpēc|\blīdz|\bik|\bno\s+[\d\s.]{1,12}\s+līdz|\bvairāk\s+nekā|\bvairāk\s+kā|\bmazāk\s+nekā|\bmazāk\s+kā)\s*$/i;
const KM_INCLUDE_RE = /\bpie\b|\bnobraukum|\bodometr|\brādījum/i;
const KM_DATE_NEAR_RE = /\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b|\b20\d{2}\.\s*gada/i;

function parseKmMatch(m: RegExpExecArray): number | null {
  const head = Number(m[1]);
  const tail = m[2] ?? m[3];
  const n = tail ? head * 1000 + Number(tail) : head;
  return n >= 1000 ? n : null;
}

/** Vai „X km” ir odometra rādījums, ne intervāls / diapazons / „pēc/līdz/ik”. */
export function isOdometerReadingKmContext(text: string, matchIndex: number): boolean {
  const before = text.slice(Math.max(0, matchIndex - 80), matchIndex);
  const window = text.slice(Math.max(0, matchIndex - 80), matchIndex + 28);
  if (KM_EXCLUDE_WINDOW_RE.test(window)) return false;
  if (KM_EXCLUDE_IMMEDIATE_RE.test(before.replace(/\s+/g, " "))) return false;
  if (KM_INCLUDE_RE.test(before)) return true;
  if (KM_DATE_NEAR_RE.test(before)) return true;
  return false;
}

/** Tikai odometra rādījumi (pie X km, nobraukums X km, datēts rādījums). */
export function extractOdometerReadingKms(text: string): number[] {
  const out: number[] = [];
  const re = new RegExp(KM_READING_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!isOdometerReadingKmContext(text, m.index)) continue;
    const n = parseKmMatch(m);
    if (n != null) out.push(n);
  }
  return out;
}

function kmNumbers(text: string): number[] {
  return extractOdometerReadingKms(text);
}

function flagKey(f: FactCheckFlag): string {
  return `${f.id}|${f.sentence}`;
}

function firstMatchingSentence(sentences: string[], re: RegExp): string {
  return sentences.find((s) => re.test(s)) ?? sentences[0] ?? "";
}

export function checkCommentContradictions(input: ContradictionCheckInput): FactCheckFlag[] {
  const text = (input.text ?? "").trim();
  if (!text) return [];
  const facts = input.facts;
  const field = input.field ?? "";
  const sentences = splitSentences(text);
  const flags: FactCheckFlag[] = [];
  const seen = new Set<string>();
  const push = (partial: Omit<FactCheckFlag, "level"> & { level?: FactCheckLevel }) => {
    const f: FactCheckFlag = { ...partial, level: partial.level ?? "E" };
    const k = flagKey(f);
    if (seen.has(k)) return;
    seen.add(k);
    flags.push(f);
  };

  if (input.sourceBlocks) {
    const identity = extractLoadedPowertrainIdentity(input.sourceBlocks, { vin: input.vin });
    for (const flag of powertrainContradictionsToFlags(findPowertrainContradictions(text, identity))) {
      push(flag);
    }
  }

  // 1) Odometra kritums / CarVertical brīdinājums jāpiemin (tikai laukos, kur tas ir vietā).
  if (rollbackMentionRequired(field, facts, input.focusSourceLabel)) {
    if (!ROLLBACK_MENTION_RE.test(text)) {
      const drop = facts.maxRollbackDropKm;
      push({
        id: "rollback_omitted",
        kind: "rollback_omitted",
        level: "E",
        message: `Nobraukuma datos ir odometra kritums${drop ? ` (${formatForensicsInt(drop)} km)` : ""}${facts.carverticalMileageWarning ? " un/vai CarVertical brīdinājums" : ""}, bet šis komentārs to nepiemin.`,
        sentence: firstMatchingSentence(sentences, /nobrauk|odometr|km/i) || sentences[0]!,
      });
    }
  }
  if (
    isMileageRelatedCommentField(field) &&
    facts.maxRollbackDropKm >= LARGE_ODOMETER_DROP_KM &&
    MINIMISING_RE.test(text)
  ) {
    push({
      id: "rollback_minimised",
      kind: "rollback_minimised",
      level: "E",
      message: `Kritums ${formatForensicsInt(facts.maxRollbackDropKm)} km nav „nelielas nobīdes”.`,
      sentence: firstMatchingSentence(sentences, MINIMISING_RE),
    });
  }

  // 1b) Izolēta ievades kļūda nav korekcija un nav jāatkārto vairākos laukos (tikai karodziņš).
  for (const e of facts.suspectedEntryErrors ?? []) {
    const kmSentences = sentences.filter((s) => mentionsKm(s, e.km));
    if (kmSentences.length === 0) continue;
    const asRollback = kmSentences.find((s) => ROLLBACK_CONTEXT_RE.test(s));
    const isMileageField = field.toLowerCase() === "mileage";
    const repeatedElsewhere = (input.otherFieldTexts ?? []).some(
      (o) => o.field !== field && mentionsKm(o.text, e.km),
    );
    if (asRollback || !isMileageField || repeatedElsewhere) {
      push({
        id: "entry_error_as_rollback",
        kind: "entry_error_as_rollback",
        level: "W",
        message: asRollback
          ? `${formatForensicsInt(e.km)} km (${e.date}, ${e.source}) ir izolēta ievades kļūda, ne odometra kritums vai korekcija.`
          : `${formatForensicsInt(e.km)} km (${e.date}) ir izolēta ievades kļūda: drīkst vienu neitrālu teikumu tikai nobraukuma laukā.`,
        sentence: asRollback ?? kmSentences[0]!,
      });
    }
  }

  // 1d) j26: neticams rādījums (piem. 100 km) nav korekcija / kritums. Tikai karodziņš.
  for (const r of facts.implausibleReadings ?? []) {
    const km = r.odometer.replace(/\D/g, "");
    if (!km) continue;
    const kmRe = new RegExp(`(?<!\\d)(?<!\\d[\\s.,])${km}\\s*km\\b`, "i");
    const bad = sentences.find((s) => kmRe.test(s) && ROLLBACK_CONTEXT_RE.test(s));
    if (!bad) continue;
    push({
      id: "entry_error_as_rollback",
      kind: "entry_error_as_rollback",
      level: "W",
      message: `${km} km (${r.date}, ${r.sourceLabel}) ir neticams ievades ieraksts, ne odometra korekcija vai kritums.`,
      sentence: bad,
    });
  }

  // 1e) j26: „posms {valsts}” gadā, kas neietilpst šīs valsts posmā (no reģistru laika līnijas).
  const periods = facts.countryPeriods ?? [];
  if (periods.length > 0) {
    for (const sentence of sentences) {
      if (!COUNTRY_STAY_RE.test(sentence)) continue;
      const years = [...sentence.matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => Number(m[1]));
      if (years.length === 0) continue;
      for (const [stem, country] of COUNTRY_STEMS) {
        if (!new RegExp(stem, "iu").test(sentence)) continue;
        const own = periods.filter((p) => p.country === country);
        if (own.length === 0) continue;
        const covered = (y: number) =>
          own.some((p) => {
            const fromY = new Date(p.from).getUTCFullYear();
            const toY = p.to == null ? 9999 : new Date(p.to).getUTCFullYear();
            return y >= fromY && y <= toY;
          });
        const outside = years.filter((y) => !covered(y));
        if (outside.length === 0) continue;
        push({
          id: "country_period_mismatch",
          kind: "country_period_mismatch",
          level: "W",
          message: `${country}: ${outside.join(", ")}. gads neietilpst valsts posmā pēc reģistru laika līnijas (${own
            .map((p) => `${p.fromLabel} - ${p.toLabel}`)
            .join("; ")}).`,
          sentence,
        });
      }
    }
  }

  // 1c) CSDD komentārā tikai CSDD km (cita avota rādījums nav CSDD fakts). Tikai karodziņš.
  const focusText = input.focusSourceText ?? (input.sourceBlocks && isCsddFocus(field, input.focusSourceLabel)
    ? csddKmHaystack(input.sourceBlocks)
    : null);
  if (focusText != null && isCsddFocus(field, input.focusSourceLabel)) {
    const csddKms = new Set(extractKmLikeNumbers(focusText));
    for (const km of kmNumbers(text)) {
      if (csddKms.has(km)) continue;
      push({
        id: `csdd_foreign_mileage_${km}`,
        kind: "csdd_foreign_mileage",
        level: "W",
        message: `${formatForensicsInt(km)} km nav CSDD datos - CSDD komentārā tikai CSDD rādījumi.`,
        sentence: sentences.find((s) => mentionsKm(s, km)) ?? sentences[0]!,
      });
    }
  }

  // 2) Īpašnieki vs maiņas; pirmā reģistrācijas valsts.
  const ownerMentions = [...text.matchAll(OWNER_COUNT_RE)].map((m) => Number(m[1]));
  const changeMentions = [...text.matchAll(OWNER_CHANGE_RE)].map((m) => Number(m[1]));
  if (facts.owners.totalCount > 0) {
    for (const n of ownerMentions) {
      if (n !== facts.owners.totalCount && (facts.owners.latviaOwners == null || n !== facts.owners.latviaOwners)) {
        push({
          id: "owner_count",
          kind: "owner_count",
          level: "E",
          message: `Teksts saka ${n} īpašniekus, kanoniskā lapa: ${facts.owners.totalCount}${facts.owners.latviaOwners != null ? ` (LV ${facts.owners.latviaOwners})` : ""}.`,
          sentence: firstMatchingSentence(sentences, new RegExp(`${n}\\s+īpašniek`, "i")),
        });
      }
    }
    for (const n of changeMentions) {
      const expectedTotal = facts.owners.changeCount;
      const expectedLv = facts.owners.latviaChanges;
      if (n !== expectedTotal && (expectedLv == null || n !== expectedLv)) {
        push({
          id: "owner_changes",
          kind: "owner_changes",
          level: "E",
          message: `Teksts saka ${n} īpašnieku maiņas; N īpašnieki = N-1 maiņas (lapā maiņas: ${expectedTotal}${expectedLv != null ? `, LV ${expectedLv}` : ""}).`,
          sentence: firstMatchingSentence(sentences, new RegExp(`${n}\\s+īpašnieku\\s+maiņ`, "i")),
        });
      }
    }
  }
  for (const n of ownerMentions) {
    if (changeMentions.includes(n) && n > 0) {
      push({
        id: "owner_changes_eq_owners",
        kind: "owner_changes",
        level: "E",
        message: `${n} īpašnieki nevar būt ${n} maiņas (jābūt ${n - 1}).`,
        sentence: firstMatchingSentence(sentences, new RegExp(`${n}\\s+īpašniek`, "i")),
      });
    }
  }

  const countryLv = facts.firstReg.countryLv.toLowerCase();
  const iso = (facts.firstReg.countryIso || "").toUpperCase();
  const originDe = countryLv.includes("vācij") || iso === "DE";
  const originLv = countryLv.includes("latvij") || iso === "LV";
  if (originDe && FIRST_REG_LV_RE.test(text)) {
    push({
      id: "first_reg_country",
      kind: "first_reg_country",
      level: "E",
      message: `Pirmā reģistrācija / izcelsme lapā ir ${facts.firstReg.countryLv || "DE"}, teksts saka Latviju.`,
      sentence: firstMatchingSentence(sentences, FIRST_REG_LV_RE),
    });
  }
  if (originLv && !originDe && FIRST_REG_DE_RE.test(text) && !/pēc\s+importa|latvijā\s+reģistrēta/i.test(text)) {
    push({
      id: "first_reg_country",
      kind: "first_reg_country",
      level: "E",
      message: `Pirmā reģistrācija lapā ir ${facts.firstReg.countryLv || "LV"}, teksts saka Vāciju kā pirmo reģistrāciju.`,
      sentence: firstMatchingSentence(sentences, FIRST_REG_DE_RE),
    });
  }

  // 3) Nav negadījumu / nav atsaukumu pret lapu.
  if (facts.incidents.length > 0 && NO_ACCIDENT_RE.test(text) && !/neizslēdz|bez\s+fizisk/i.test(text)) {
    push({
      id: "no_accidents_claim",
      kind: "no_accidents_claim",
      level: "E",
      message: `Teksts saka, ka negadījumu nav, bet lapā ir ${facts.incidents.length} rinda(-s).`,
      sentence: firstMatchingSentence(sentences, NO_ACCIDENT_RE),
    });
  }
  // 3b) j26: bojājumi IR (arī bez summas) - „nav bojājumu/atlīdzību” ir kļūda; „neizslēdz” neattaisno.
  const damageTotal = facts.damageEvidence?.total ?? 0;
  if (damageTotal > 0) {
    const bad = sentences.find(
      (s) =>
        NO_DAMAGE_RE.test(s) &&
        !AMOUNT_ONLY_RE.test(s) &&
        !DAMAGE_UNCERTAIN_RE.test(s) &&
        !DAMAGE_POSITIVE_RE.test(s),
    );
    if (bad) {
      push({
        id: "no_damage_claim",
        kind: "no_damage_claim",
        level: "E",
        message: `Teksts saka, ka bojājumu / negadījumu nav, bet lapā ir ${damageTotal} bojājuma ieraksts(-i) (arī bez summas). Min tos ar avotu un datumu.`,
        sentence: bad,
      });
    }
  }
  // 3c) j26: „nav nevienas kārbas apkopes”, bet dīlera skaitos ir > 0.
  for (const c of facts.dealerComponentCounts ?? []) {
    if (c.dates.length === 0) continue;
    const mention = dealerCountMentionSource(c.label);
    const bad = sentences.find(
      (s) => negatesDealerComponent(s, mention) && !DAMAGE_UNCERTAIN_RE.test(s),
    );
    if (!bad) continue;
    // Teikums ar periodu („pēc 2021”) var būt patiess - tikai karodziņš.
    const periodScoped = /\b(?:pēc|kopš|līdz|no)\s+(?:\d{1,2}\.\d{1,2}\.)?(?:19|20)\d{2}/i.test(bad);
    push({
      id: "negated_fact",
      kind: "negated_fact",
      level: periodScoped ? "W" : "E",
      message: `Teksts saka, ka „${c.label.toLowerCase()}” nav, bet dīlera datos ir ${c.dates.length} (${c.dates.join(", ")}).`,
      sentence: bad,
    });
  }
  if (facts.recallCodes.length > 0 && NO_RECALL_RE.test(text) && !/jāpārbauda|izpild/i.test(text)) {
    push({
      id: "no_recalls_claim",
      kind: "no_recalls_claim",
      level: "E",
      message: `Teksts saka, ka atsaukumu nav, bet datos ir: ${facts.recallCodes.join(", ")}.`,
      sentence: firstMatchingSentence(sentences, NO_RECALL_RE),
    });
  }

  // 4) Atsaukuma kodi, kuru nav datos / lapā.
  const known = new Set(facts.recallCodes.map((c) => c.toUpperCase()));
  for (const code of extractCampaignCodes(text)) {
    if (known.has(code) || facts.sourceHaystack.toUpperCase().includes(code)) continue;
    push({
      id: "unsourced_recall_code",
      kind: "unsourced",
      level: "W",
      message: `Atsaukuma/kampaņas kods ${code} nav pasūtījuma datos vai kanoniskajā lapā.`,
      sentence: sentences.find((s) => s.toUpperCase().includes(code)) ?? code,
    });
  }

  // 5) Iekšējās noplūdes frāzes.
  for (const leak of LEAK_PHRASES) {
    if (!leak.re.test(text)) continue;
    push({
      id: leak.id,
      kind: "leak_phrase",
      level: "W",
      message: `Iekšēja frāze „${leak.label}” klienta tekstā.`,
      sentence: firstMatchingSentence(sentences, leak.re),
    });
  }

  // 6) atsavināšanai, ja nav avotā.
  if (ATSAVINASANAI_RE.test(text) && !ATSAVINASANAI_RE.test(facts.sourceHaystack)) {
    push({
      id: "atsavinasanai",
      kind: "atsavinasanai",
      level: "W",
      message: "Vārds „atsavināšanai” nav avota datos.",
      sentence: firstMatchingSentence(sentences, ATSAVINASANAI_RE),
    });
  }

  // 7) Precīzi datumi / mēneši, kuru nav datos.
  const dayDates = text.match(/\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b/g) ?? [];
  for (const d of dayDates) {
    if (haystackHasDate(facts.dateHaystack, d)) continue;
    push({
      id: "unsourced_date",
      kind: "unsourced_date",
      level: "W",
      message: `Datums ${d} nav avota datos / kanoniskajā lapā.`,
      sentence: sentences.find((s) => s.includes(d)) ?? d,
    });
  }
  const monthRe =
    /(20\d{2})\.\s*gada\s+(?:(\d{1,2})\.\s*)?(janvār|februār|mart|aprīl|maij|jūnij|jūlij|august|septembr|oktobr|novembr|decembr)/gi;
  let mm: RegExpExecArray | null;
  while ((mm = monthRe.exec(text))) {
    const year = mm[1]!;
    const monthLv = mm[3]!;
    const month = LV_MONTHS[monthLv] ?? "";
    const day = mm[2];
    if (day) {
      const token = `${day}.${month}.${year}`;
      if (haystackHasDate(facts.dateHaystack, token)) continue;
    } else if (haystackHasMonthYear(facts.dateHaystack, year, month, monthLv)) {
      continue;
    }
    push({
      id: "unsourced_date",
      kind: "unsourced_date",
      level: "W",
      message: `Laiks „${mm[0]}” nav avota datos / kanoniskajā lapā.`,
      sentence: sentences.find((s) => s.includes(mm![0]!)) ?? mm[0]!,
    });
  }

  // 8) Km pret lapu (liels delta pret jaunāko / krituma punktiem).
  if (facts.latestKm != null) {
    const allowed = new Set<number>([
      facts.latestKm,
      ...facts.rollbacks.flatMap((r) => [r.fromKm, r.toKm, r.minDropKm]),
      ...facts.incidents
        .map((r) => Number.parseInt(r.lossAmount.replace(/\s/g, ""), 10))
        .filter((n) => Number.isFinite(n)),
    ]);
    for (const km of kmNumbers(text)) {
      const close = [...allowed].some((a) => Math.abs(a - km) <= 1500);
      if (close) continue;
      if (km === facts.owners.totalCount) continue;
      // Gadījuma km (intervāli u.c.) paliek W, ne E.
      if (Math.abs(km - facts.latestKm) > 25_000 && km > 10_000) {
        push({
          id: "km_mismatch",
          kind: "contradiction",
          level: "W",
          message: `Nobraukums ${formatForensicsInt(km)} km tālu no lapas jaunākā (${formatForensicsInt(facts.latestKm)} km).`,
          sentence: sentences.find((s) => s.includes(String(km)) || s.includes(formatForensicsInt(km))) ?? sentences[0]!,
        });
      }
    }
  }

  // 9) Starp laukiem: tas pats auto, dažādi īpašnieku skaiti / negadījumu skaiti.
  for (const other of input.otherFieldTexts ?? []) {
    if (!other.text.trim() || other.field === field) continue;
    const otherOwners = [...other.text.matchAll(OWNER_COUNT_RE)].map((m) => Number(m[1]));
    const theseOwners = ownerMentions;
    if (theseOwners.length && otherOwners.length) {
      const a = theseOwners[0]!;
      const b = otherOwners[0]!;
      if (a !== b && facts.owners.totalCount > 0) {
        push({
          id: "cross_field_owners",
          kind: "owner_count",
          level: "W",
          message: `Šis lauks saka ${a} īpašniekus, „${other.label}” saka ${b}.`,
          sentence: firstMatchingSentence(sentences, new RegExp(`${a}\\s+īpašniek`, "i")),
        });
      }
    }
  }

  flags.sort((a, b) => (a.level === b.level ? 0 : a.level === "E" ? -1 : 1));
  return flags;
}

export function mergeFactCheckFlags(primary: FactCheckFlag[], extra: FactCheckFlag[]): FactCheckFlag[] {
  const seen = new Set(primary.map(flagKey));
  const out = [...primary];
  for (const f of extra) {
    const k = flagKey(f);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  out.sort((a, b) => (a.level === b.level ? 0 : a.level === "E" ? -1 : 1));
  return out;
}

function parseSpacedInt(raw: string): number {
  return Number(raw.replace(/\s/g, "")) || 0;
}

const EMPTY_TA = {
  level: "none" as const,
  lastInspectionDate: null,
  lastInspectionAgeDays: null,
  nextInspectionDate: null,
  nextInspectionValid: false,
  kmSinceInspection: null,
  ratingLevel: null,
  maxDefectLevel: null,
  ratingLabel: "",
  vehicleAgeYears: null,
  minorDefectOnOlderCar: false,
  coveredGroups: [] as const,
};

/**
 * Izvelk kanonisko lapu no ✨ user prompta (P12). Bez maksas.
 */
function csddKmHaystack(blocks: import("@/lib/admin-source-blocks").WorkspaceSourceBlocks): string {
  const csdd = blocks.csdd;
  if (!csdd) return "";
  return [
    ...(csdd.mileageHistory ?? []).map((r) => r.odometer),
    JSON.stringify(csdd),
  ].join("\n");
}

export function extractCanonicalFactsFromPrompt(prompt: string): CanonicalFacts | null {
  const t = prompt ?? "";
  const re = new RegExp(
    `=== ${CANONICAL_FACTS_HEADER} ===([\\s\\S]*?)=== BEIGAS ${CANONICAL_FACTS_HEADER} ===`,
  );
  const m = t.match(re);
  if (!m) return null;
  const sheet = m[1] ?? "";
  const totalCount = Number(sheet.match(/- Skaits:\s*(\d+)/)?.[1] ?? 0);
  const changeCount = Number(sheet.match(/- Maiņas:\s*(\d+)/)?.[1] ?? 0);
  const lv = sheet.match(/- Latvijā:\s*(\d+)\s+īpašniek/);
  const firstRegLine = sheet.match(/Pirmā reģistrācija:\s*([^\n]+)/)?.[1] ?? "";
  const date = firstRegLine.split("|")[0]?.trim() ?? "";
  const countryLv =
    firstRegLine.match(/izcelsmes valsts:\s*([^(|]+)/)?.[1]?.trim().replace(/\s+$/, "") ?? "";
  const countryIso = firstRegLine.match(/\(([A-Z]{2})\)/)?.[1] ?? "";
  const latestKmRaw = sheet.match(/Jaunākais rādījums:\s*([\d\s]+)\s*km/)?.[1];
  const rollbacks = [...sheet.matchAll(
    /- Kritums:\s+(\S+)\s+([\d\s]+?)\s+km(?:\s+\(([^)\n]*)\))?\s+[→-]\s+(\S+)\s+([\d\s]+?)\s+km(?:\s+\(([^)\n]*)\))?;\s+minimums\s+([\d\s]+?)\s+km/g,
  )].map((row) => {
    const minDropKm = parseSpacedInt(row[7] ?? "0");
    return {
      fromDate: row[1] ?? "",
      toDate: row[4] ?? "",
      fromKm: parseSpacedInt(row[2] ?? "0"),
      toKm: parseSpacedInt(row[5] ?? "0"),
      fromSource: row[3] ?? "",
      toSource: row[6] ?? "",
      gapDays: 0,
      minDropKm,
      previousKmPerDay: null,
      previousRateClass: null,
      ceilingAdditionalKm: null,
      maxDropKm: minDropKm,
    };
  });
  const suspectedPrefix = SUSPECTED_ENTRY_ERROR_LINE_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const suspectedEntryErrors = [...sheet.matchAll(
    new RegExp(`- ${suspectedPrefix}:\\s*([^,\\n]+),\\s*([\\d\\s]+?)\\s*km,\\s*([^\\n]+)`, "g"),
  )].map((row) => ({
    date: row[1]!.trim(),
    km: parseSpacedInt(row[2] ?? "0"),
    source: row[3]!.trim(),
  }));
  const incidentCount = Number(sheet.match(/Negadījumi \/ zaudējumi:\s*(\d+)/)?.[1] ?? 0);
  const damageTotal = Number(sheet.match(/Bojājumi \(visi avoti[^)]*\):\s*(\d+)/)?.[1] ?? 0);
  const recallLine = sheet.match(/Atsaukumi \/ kampaņu kodi datos:\s*([^\n]+)/)?.[1] ?? "";
  const recallCodes = /nav fiksētu/i.test(recallLine)
    ? []
    : recallLine
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && !/^nav/i.test(s));
  const maxRollbackDropKm = rollbacks.reduce((n, b) => Math.max(n, b.minDropKm), 0);
  const facts: CanonicalFacts = {
    vin: sheet.match(/VIN:\s*(\S+)/)?.[1] ?? "",
    makeModel: sheet.match(/Marka\/modelis:\s*([^|]+)/)?.[1]?.trim() ?? "",
    year: sheet.match(/Gads:\s*(\S+)/)?.[1] ?? "",
    owners: {
      totalCount,
      noteLine: "",
      changeCount,
      latviaOwners: lv ? Number(lv[1]) : null,
      latviaChanges: lv ? Math.max(0, Number(lv[1]) - 1) : null,
    },
    firstReg: {
      date: date === "datums nav" ? "" : date,
      countryRaw: countryLv,
      countryLv,
      countryIso,
    },
    latestKm: latestKmRaw ? parseSpacedInt(latestKmRaw) : null,
    rollbacks,
    suspectedEntryErrors,
    csddUndatedOdometer: null,
    odometerAnomaly: /Forenzikas karogs[^:\n]*:\s*JĀ/i.test(sheet),
    carverticalMileageWarning: /CarVertical nobraukuma brīdinājums:\s*JĀ/i.test(sheet),
    maxRollbackDropKm,
    incidents: Array.from({ length: incidentCount }, (_, i) => ({
      date: "",
      lossAmount: "",
      country: "",
      sortableTime: 0,
      sourceOrder: i,
      sourceLabel: `rinda ${i + 1}`,
    })),
    damageEvidence: {
      rows: [],
      total: damageTotal,
      withoutAmountCount: 0,
      hasDealerBodyOrGlassWork: false,
    },
    alertBannerTexts: [],
    dealerComponentCounts: parseDealerComponentCountsFromSheet(sheet),
    implausibleReadings: [...sheet.matchAll(/- Izlaists neticams rādījums[^:\n]*:\s*([^,\n]+),\s*(\d+)\s*km,\s*([^\n]+)/g)].map(
      (m, i) => ({
        date: m[1]!.trim(),
        odometer: m[2]!,
        country: "",
        sourceLabel: m[3]!.trim(),
        sourceOrder: i,
        sortableTime: 0,
      }),
    ),
    countryPeriods: parseCountryPeriodsFromSheet(sheet),
    registryStatusLines: [],
    ta: EMPTY_TA,
    dealerRowsLv: "",
    dealerCampaigns: [],
    recallCodes,
    listingSummary: "",
    photoSummary: "",
    dateHaystack: sheet,
    sourceHaystack: t,
    sheet,
  };
  return facts;
}

/** „Dīlera darbu skaiti” rindas no faktu lapas teksta. */
export function parseDealerComponentCountsFromSheet(sheet: string): Array<{ label: string; dates: string[] }> {
  const head = sheet.indexOf("Dīlera darbu skaiti");
  if (head < 0) return [];
  const out: Array<{ label: string; dates: string[] }> = [];
  for (const line of sheet.slice(head).split("\n").slice(1)) {
    const m = line.match(/^- ([^:]+):\s*(\d+)\s*\(([^)]*)\)/);
    if (!m) break;
    out.push({ label: m[1]!.trim(), dates: m[3]!.split(",").map((d) => d.trim()).filter(Boolean) });
  }
  return out;
}

/** „Valstu posmi” rindas no faktu lapas teksta. */
export function parseCountryPeriodsFromSheet(sheet: string): RegistryCountryPeriod[] {
  const head = sheet.indexOf("Valstu posmi");
  if (head < 0) return [];
  const toMs = (label: string): number | null => {
    const m = label.match(/^(\d{2})\.(\d{4})$/);
    return m ? Date.UTC(Number(m[2]), Number(m[1]) - 1, 1) : null;
  };
  const out: RegistryCountryPeriod[] = [];
  for (const line of sheet.slice(head).split("\n").slice(1)) {
    const m = line.match(/^- (\d{2}\.\d{4}) - (\d{2}\.\d{4}|\.\.\.) (\S+) \(([^)]*)\)/);
    if (!m) break;
    const from = toMs(m[1]!);
    if (from == null) continue;
    out.push({ country: m[3]!, from, to: toMs(m[2]!), fromLabel: m[1]!, toLabel: m[2]!, basis: m[4]! });
  }
  return out;
}
