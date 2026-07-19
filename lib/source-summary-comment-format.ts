/**
 * Īsi, faktiski avota komentāri (PDF imports, Gemini Plan B, ✨ avota komentāri).
 * Hibrīds: objektīvs konteksts + skaidri atzīmētas anomālijas.
 */
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";

export const SOURCE_COMMENT_NO_ISSUES_LV = "Problēmas nav konstatētas.";

export const SOURCE_COMMENT_ANOMALY_PREFIX = "ANOMĀLIJA: ";

/** Obligātā vārdu krājuma un rindkopu disciplīna — visi ✨ eksperta komentāri. */
export const PROVIN_REPORT_COPY_VOCABULARY = `LATVIAN VOCABULARY & PHRASING (mandatory):
- Use "automašīna" (or "auto", "šī automašīna") when referring to the vehicle in buyer-facing prose — NEVER "automobīlis".
- "transportlīdzeklis" is allowed only when citing official CSDD/registry wording verbatim; otherwise prefer "automašīna".
- Mid-sentence dashes for ranges (piem. 2007–2015, 300–400 €) are fine; NEVER start a paragraph or standalone sentence with "- " or "– ".`;

/** Aizstāj „automobīlis” formas ar „automašīna” pircējam domātajā tekstā. */
export function applyProvinReportCopyVocabulary(text: string): string {
  let out = text;
  const replacements: Array<[RegExp, string]> = [
    [/\bAutomobīļiem\b/g, "Automašīnām"],
    [/\bautomobīļiem\b/g, "automašīnām"],
    [/\bAutomobīļu\b/g, "Automašīnu"],
    [/\bautomobīļu\b/g, "automašīnu"],
    [/\bAutomobīlim\b/g, "Automašīnai"],
    [/\bautomobīlim\b/g, "automašīnai"],
    [/\bAutomobīļa\b/g, "Automašīnas"],
    [/\bautomobīļa\b/g, "automašīnas"],
    [/\bAutomobīlis\b/g, "Automašīna"],
    [/\bautomobīlis\b/g, "automašīna"],
  ];
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  return out;
}

/** No rindkopām noņem sarakstu prefiksus un normalizē atstarpes — ✨ eksperta komentāri. */
export function normalizeProvinExpertGeminiComment(raw: string | undefined | null, maxLen = 2400): string {
  const t = applyProvinReportCopyVocabulary((raw ?? "").trim());
  if (!t) return t;
  return normalizeExpertSourcePdfComment(t, maxLen);
}

/** Gatavo PROVIN audita atskaišu komentāru paraugi — few-shot stils ✨ ģeneratoram. */
export const PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES = `FEW-SHOT STYLE EXAMPLES (match this exact paragraph structure, bold hooks, and tone):

Example 1 (CSDD — avota fokuss, nevis pilna nobraukuma eseja):
"**Pirmā reģistrācija Latvijā.** Automašīna CSDD datos Latvijā pirmo reizi reģistrēta **2016. gada 22. janvārī**, kā izcelsmes valsti norādot Vāciju; īpašnieku maiņu ķēde pēc importa ir īsa un bez ierobežojumu atzīmēm.

**Tehnisko apskašu tendence.** Pamata pārbaudi ar pirmo reizi nav izgājusi **sešas reizes**; hroniski atkārtojas korozija, eļļas noplūdes un priekšējā tilta brīvkustības. Salīdzinājumā ar AutoDNA/CarVertical CSDD šeit ir vienīgais avots ar atkārtotu TA defektu sēriju."

Example 2 (CSDD tehniskā apskate):
"**Tehnisko apskašu vēsture.** Automašīna nav izgājusi pamatpārbaudi ar pirmo reizi **kopumā sešas reizes**, pēdējo reizi novērtējumu '2' saņemot **2025. gada 16. decembrī**. Sistēmā hroniski atkārtojas vieni un tie paši defekti: progresējoša nesošo elementu korozija, pastāvīgas eļļas noplūdes no motora un transmisijas, kā arī brīvkustības priekšējā tilta svirās.

**Dūmainības un dzinēja resursa signāli.** Atgāzu pārbaudes uzrāda nestabilitāti — iepriekšējos gados dūmainības koeficients ir sasniedzis kritisku **2.32 un 2.95 atzīmi**, kas liecina par dzinēja un degvielas sistēmas resursa izsīkumu, lai gan pēdējā apskatē fiksēts koeficients **0.58**."

Example 3 (negadījumi):
"**Apdrošināšanas ieraksti un avotu salīdzinājums.** CarVertical fiksē **2019. gada jūlijā** Vācijā reģistrētu negadījumu ar zaudējumu diapazonu **5 001–10 000 €**, savukārt LTAB un AutoDNA šim periodam konkrētu izmaksu neuzrāda. Šāda datu asinhronija tipiski nozīmē, ka daļa bojājumu tika novērsta ārpus oficiālās apdrošināšanas vai ieraksts nav nonācis visās datubāzēs.

**Praktiskā nozīme pircējam.** Pat ja summas nav milzīgas, šāds ieraksts obligāti jāsasaista ar virsbūves stāvokli klātienē — īpaši krāsas biezums, šuvju platums un panelu simetrija. Bez fiziskas pārbaudes nevar izslēgt strukturālu remontu vai slēptu kosmētiku."

Example 4 (cena / tirgus):
"**Cenas pozīcija Latvijas tirgū.** Sludinājumā norādītā cena **14 900 €** atbilst vidējam līmenim ss.lv segmentā šim modeļa gadam un dzinējam, tomēr **nobraukums 218 000 km** un ierobežota servisa dokumentācija samazina faktisko vērtību pret līdzīgiem auto ar pilnu vēsturi.

**Importa un izsoles konteksts.** IRISS dati rāda līdzīgus eksemplārus Vācijas wholesale segmentā **11 500–12 800 €** apmērā, kas pēc loģiskā uzcenojuma, reģistrācijas un risku rezerves atstāj ierobežotu telpu sarunām par cenu samazinājumu."

Example 5 (AutoDNA — bojājumi; īss salīdzinājums, bez nobraukuma pārstāsta):
"**Apdrošināšanas un zaudējumu ieraksti.** AutoDNA fiksē **2018. gada martā** Vācijā reģistrētu negadījumu ar zaudējumu **2 930 €**, bojājot galvenokārt priekšējo labo sānu un priekšējo kreiso durvi. Pret CarVertical laika līniju datums sakrīt — AutoDNA šeit dod precīzāku summu un zonas.

**Datu asinhronija.** CSDD/LTAB šim periodam konkrētu izmaksu neuzrāda; praktiski tas nozīmē, ka virsbūves kvalitāte jāpārbauda klātienē, nevis jāatkārto visa odometra stāsta no citiem avotiem."

Example 6 (AUTO RECORDS / dīlera dati):
"**Dīlera servisa vēsture un komerciālais konteksts.** Outvin datos automašīna klasificēta ar tipa kodu, kas atbilst taksometra/komerciālai ekspluatācijai (**937**), un servisa žurnālā redzamas regulāras apkopes ik **15 000–18 000 km** Vācijā pirms ievešanas. Šis ir unikāls dīlera signāls, ko CSDD/AutoDNA tabulas nesniedz.

**Īss km salīdzinājums.** Pēdējais dīlera fiksējums (**198 420 km**, **2023. gada augusts**) sakrīt ar CSDD/AutoDNA līkni tajā pašā logā — detalizēto nobraukuma forenziku atstāj „NOBRAUKUMA VĒSTURES KOMENTĀRAM”."

Example 7 (NOBRAUKUMA VĒSTURES KOMENTĀRS — vienīgā vieta pilnai apkopošanai):
"**Hronoloģija un lineārums.** Visos pieejamajos avotos nobraukuma līkne ir lineāra ar vidēji **22 000–24 000 km gadā** pēc pirmās reģistrācijas Vācijā **2014. gadā**; kritiski kritumi nav konstatēti. Automašīnas profils atbilst šosejas režīmam ar zemāku motorstundu slodzi nekā tipiskam Rīgas pilsētas auto.

**Datu blīvums un vakuums.** Ieraksti ir bieži (reizi 6–12 mēnešos), kas ļauj objektīvi secināt par braukšanas režīmu; tomēr pirms ievešanas Latvijā ir **astoņu gadu datu vakuums** (2007–2015), un ņemot vērā dīlera **kodu 937**, reālais Eiropas nobraukums varētu būt ievērojami augstāks — šī ir atskaites apkopojošā nobraukuma interpretācija."`;

const PDF_HYBRID_COMMENT_RULES = `COMMENTARY (mandatory) — hybrid "Factual Context + Anomalies":
1. NEVER suppress normal context: damage zones, body sides, dealer/service milestones, registration facts, policy periods, Status Center notes, historical remarks — always extract as objective Latvian facts.
2. Ultra-concise bullet list (- prefix per line), zero conversational fluff, max 4 bullets, max ~350 characters total.
3. If the report is entirely clean (no substantive history/notes/descriptions — empty or only generic blank markers): set comments EXACTLY to "Problēmas nav konstatētas." (nothing else).
4. If the source contains ANY history, metadata, or descriptive notes: summarize the factual timeline in short sentences (not only problems).
5. For clear conflicts, major mileage issues, or text mentioning damage/claims without structured rows: add a bullet prefixed "ANOMĀLIJA: " (e.g. "- ANOMĀLIJA: nobraukuma nesakritība …").
6. NEVER use asterisk (*) for bullets — only hyphen (-) at line start.
Example:
- Reģistrēts neliels virsbūves bojājums Vācijā (summa <=100 EUR). Bojāta labā sāna priekšpuse un kreisais sāns.
- 07.03.2021 Dīlera apkope pie 46,441 km.`;

/** Vienots eksperta komentāru vizuālais formāts — ✨ avoti, PDF, cena, nobraukums u.c. */
export const GEMINI_EXPERT_PARAGRAPH_PRESENTATION = `
VISUAL PRESENTATION (mandatory for all expert client PDF comments):
${PROVIN_REPORT_COPY_VOCABULARY}
- STRUCTURE: Write ONLY in paragraphs — separate paragraphs with a blank line (double newline). NEVER start any line with "- ", "• ", "* ", "– ", or "1." / "2." — no bullet lists, no numbered lists, no list-style prefixes of any kind. (Exception: dedicated inspection checklist fields may use "- " list lines — not paragraph prose.)
- PARAGRAPH OPENER: Every paragraph MUST begin with a short **bold** topic hook (3–10 words) naming the theme — e.g. **Nobraukuma vēsture Latvijā**, **Cenu pozīcija tirgū**, **Tehnisko apskašu tendence** — then continue in natural prose in the same paragraph.
- SCANABILITY: Keep each paragraph to 2–4 sentences. Prefer several short focused paragraphs over one dense wall of text.
- EMPHASIS: Use **bold** inline for key dates, km, EUR sums, option codes, and risk labels — never bold an entire paragraph.
- HUMAN TONE: Write like a senior Latvian inspector briefing a buyer — concrete, varied rhythm, no AI filler ("Kopumā var secināt", "Svarīgi atzīmēt", "Turklāt jāpiemin", "Nav šaubu"). Do not wrap the whole output in quotation marks.
- ANOMALIES: State risks inside prose; you may use **Anomālija:** as a bold paragraph opener when a clear conflict exists — still never prefix with "- ".
- STYLE REFERENCE: When the user prompt includes existing expert comments or drafts from this order, treat them as the canonical finished-report reference — match their paragraph rhythm, bold hooks, vocabulary ("automašīna"), and tone; extend with new facts, do not switch to a different format.
`;

/** Vēsturisko auditu konteksts — citu klientu gatavas atskaites ar līdzīgiem agregātiem. */
export const GEMINI_HISTORICAL_REPORTS_CONTEXT_RULES = `HISTORICAL AUDIT REPORTS (cross-client reference — when present below):
- These excerpts come from OTHER completed PROVIN audits with similar make/model/year, engine code, transmission, or fuel type — use them to reuse model-specific forensic patterns, inspection checklist themes, phrasing rhythm, and aggregate-specific advice (e.g. known weak points for that engine/gearbox generation).
- NEVER copy client-specific facts from historical excerpts: no VIN, plate, km, dates, EUR sums, seller names, or order IDs — adapt the logic and style only.
- Prefer historical inspection recommendations and model-technical commentary when the current order lacks depth; always reconcile with the ACTIVE order's actual data.
- Match the same paragraph + **bold** hook format and "automašīna" vocabulary as in historical excerpts.`;

/** Dziļā eksperta analīze — CSDD, AutoDNA, CarVertical, LTAB ✨ admin komentāri. */
export const HYBRID_COMMENT_RULES = `
COMMENTARY RULES for PROVIN Senior Auto Expert:
${GEMINI_EXPERT_PARAGRAPH_PRESENTATION}
- LENGTH: Target 600–1100 characters for per-source comments; thorough on THIS source, not a second full-report essay.
- STYLE: Analytical, professional automotive forensic Latvian. No conversational fluff or meta-commentary.
- LOGIC: Interpret contradictions and what findings mean for the buyer — do not only list raw facts.
- ANTI-REPETITION (critical): Do NOT restate the same mileage timeline, annual averages, engine-hour essay, data-vacuum narrative, or global risk conclusion already suitable for „NOBRAUKUMA VĒSTURES KOMENTĀRS” or already written in other source comments. Per-source text = unique facts from THIS source + a short cross-check (1–2 sentences) vs other sources. Leave the full chronological mileage synthesis to the mileage-history comment field.
`;

/** Gemini PDF extract JSON — eksperta komentārs (visi avoti). */
export const SOURCE_PDF_COMMENT_GEMINI_RULES = `COMMENTS field (client PDF expert commentary):
${HYBRID_COMMENT_RULES}
- Extract and interpret ALL substantive facts from this report: mileage, damage zones, registration, insurance, policy periods, dealer/service milestones — not only anomalies.
- Never return a generic one-liner when tables or descriptive history exist in the PDF.`;

/** ✨ Visu avotu bloku „Komentāri” ģenerēšana (admin) — dziļā forenzika. */
export const SOURCE_BLOCK_COMMENT_GEMINI_RULES = `OUTPUT FORMAT (mandatory):\n${HYBRID_COMMENT_RULES}`;

/** @deprecated Izmanto SOURCE_BLOCK_COMMENT_GEMINI_RULES — vairs nav īsā režīma. */
export const SOURCE_BLOCK_BRIEF_COMMENT_GEMINI_RULES = SOURCE_BLOCK_COMMENT_GEMINI_RULES;

/** auto-records.com / Outvin PDF — papildus dīlera specifika virs SOURCE_PDF_COMMENT_GEMINI_RULES. */
export const AUTO_RECORDS_PDF_COMMENT_GEMINI_RULES = `COMMENTS field (OFICIĀLĀ DĪLERA DATI / Outvin / auto-records):
${HYBRID_COMMENT_RULES}
- Cover type code, engine code, equipment, accident/stolen checks, and dealer service timeline—not only km digits.
- Explain fleet/taxi/commercial type-code signals for Latvian buyers when present.
- Never return a generic one-liner when VEHICLE INFORMATION or service tables exist in the PDF.`;

/** Saglabā rindkopas no Gemini (PDF imports), nevis piespiedu 4 bulletus. */
export function normalizeExpertSourcePdfComment(raw: string | undefined | null, maxLen = 1600): string {
  const t = applyProvinReportCopyVocabulary((raw ?? "").trim());
  if (!t) return SOURCE_COMMENT_NO_ISSUES_LV;
  if (
    /^problēmas\s+nav\s+konstatētas\.?$/i.test(t) ||
    /^nav\s+konstatētas?\s+problēmas\.?$/i.test(t) ||
    (/^problēmas\s+nav\s+konstatētas/i.test(t) && t.length < 80)
  ) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (/^(ok|clean|none|no issues)/i.test(t) && t.length < 60) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  const paras = t
    .split(/\n\n+/)
    .map((p) =>
      p
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^\s*[-•*–]\s+/gm, "")
        .replace(/^\s*\d+[\.)]\s+/gm, ""),
    )
    .filter(Boolean)
    .slice(0, 8);
  let out = paras.join("\n\n");
  if (out.length > maxLen) out = `${out.slice(0, maxLen - 1).trim()}…`;
  return out || SOURCE_COMMENT_NO_ISSUES_LV;
}

export function formatAnomalyBullet(text: string): string {
  const core = text.trim().replace(/^[-•]\s*/, "").replace(/^ANOMĀLIJA:\s*/i, "");
  if (!core) return "";
  return `${SOURCE_COMMENT_ANOMALY_PREFIX}${core}`;
}

/** Viena nobraukuma / apkopes rinda kā īss fakts. */
export function formatMileageTimelineFact(row: AutoRecordsServiceRow): string {
  const date = formatAutoRecordsDateForOutput(row.date).trim();
  const kmDigits = row.odometer.replace(/\D/g, "");
  const km =
    kmDigits ?
      `${Number.parseInt(kmDigits, 10).toLocaleString("lv-LV")} km`
    : row.odometer.trim();
  const place = row.country.trim();
  const parts: string[] = [];
  if (date) parts.push(date);
  if (place && km) parts.push(`${place}, ${km}`);
  else if (km) parts.push(km);
  else if (place) parts.push(place);
  return parts.join(" — ").trim();
}

/** Līdz `max` jaunākajām nobraukuma rindām kā fakti. */
export function mileageTimelineFacts(rows: AutoRecordsServiceRow[], max = 2): string[] {
  const data = sortAutoRecordsDescending(rows.filter(autoRecordsRowHasData));
  return data.slice(0, max).map(formatMileageTimelineFact).filter(Boolean);
}

/** Negadījuma rinda kā īss fakts. */
export function formatIncidentFact(row: LtabIncidentRow): string {
  const parts: string[] = [];
  const date = formatAutoRecordsDateForOutput(row.csngDate).trim();
  if (date) parts.push(date);
  if (row.lossAmount.trim()) parts.push(`zaudējums ${row.lossAmount.trim()}`);
  if (row.incidentNo.trim()) parts.push(row.incidentNo.trim());
  if (parts.length === 0) return "";
  return `Negadījums: ${parts.join(", ")}`;
}

/** Bojājumu zonu / virsbūves apraksti no PDF teksta (CarVertical, AutoDNA u.c.). */
export function extractBodyDamageSnippets(text: string, max = 2): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const patterns = [
    /Virsbūves\s+bojājums[^\n]{0,240}/gi,
    /(?:Neliels|Liels|mazs)\s+virsbūves\s+bojājums[^\n]{0,220}/gi,
    /Bojāta\s+(?:labā|kreisā|priekšējā|aizmugurējā)[^\n]{0,180}/gi,
    /Reģistrēts\s+[^\n]{0,40}bojājums[^\n]{0,180}/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].replace(/\s+/g, " ").trim();
      const key = s.toLowerCase();
      if (s.length < 14 || seen.has(key)) continue;
      seen.add(key);
      out.push(s.slice(0, 220));
      if (out.length >= max) return out;
    }
  }
  return out;
}

/**
 * Hibrīds komentārs: fakti + anomālijas.
 * Ja nav nekā būtiska — "Problēmas nav konstatētas."
 */
export function buildHybridSourcePdfComments(opts: { facts?: string[]; anomalies?: string[] }): string {
  const lines: string[] = [];
  for (const f of opts.facts ?? []) {
    const t = f.trim();
    if (t) lines.push(t);
  }
  for (const a of opts.anomalies ?? []) {
    const t = formatAnomalyBullet(a);
    if (t) lines.push(t);
  }
  if (lines.length === 0) return SOURCE_COMMENT_NO_ISSUES_LV;
  return formatSourcePdfComments(lines);
}

/** Lokālie / Gemini komentāri → vienots īss formāts. */
export function formatSourcePdfComments(facts: string[]): string {
  const bullets = facts
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => {
      const trimmed = f.trim().replace(/^[-•]\s*/, "");
      if (/^ANOMĀLIJA:\s*/i.test(trimmed)) return `- ${trimmed}`;
      return `- ${trimmed}`;
    })
    .slice(0, 4);
  if (bullets.length === 0) return SOURCE_COMMENT_NO_ISSUES_LV;
  return bullets.join("\n");
}

/** Normalizē Gemini atgriezto komentāru. */
export function normalizeSourcePdfComment(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return SOURCE_COMMENT_NO_ISSUES_LV;
  if (
    /^problēmas\s+nav\s+konstatētas\.?$/i.test(t) ||
    /^nav\s+konstatētas?\s+problēmas\.?$/i.test(t) ||
    (/^problēmas\s+nav\s+konstatētas/i.test(t) && !t.includes("-") && t.length < 80)
  ) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (/^(ok|clean|none|no issues)/i.test(t) && t.length < 60) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (t.includes("-") || t.includes("ANOMĀLIJA")) {
    const lines = t
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
    return formatSourcePdfComments(lines.map((l) => l.replace(/^[-•]\s*/, "")));
  }
  if (t.length > 400) return formatSourcePdfComments([t.slice(0, 380) + "…"]);
  return formatSourcePdfComments([t]);
}
