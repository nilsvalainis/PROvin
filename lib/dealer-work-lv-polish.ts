/**
 * Dīlera servisa darbu LV teksta pulēšana (Nils 23.11.2026: „nav precīzi”).
 *
 * 1) Glosārijs: bieži sastopamās BMW / Mercedes / VW / PSA OE darbu frāzes → dabisks, vienots LV.
 *    To pašu sarakstu saņem AI tulkošanas prompts, lai jaunie tulkojumi jau nāk pareizi.
 * 2) Rindas tīrīšana drukājot (saglabātos datus nemaina): bez „transportlīdzeklim”, bez punkta
 *    beigās, „Vienas puses X” → „X (vienā pusē)”, „(apkope)” piebilde noņemta apkopes vizītē.
 * Tikai valodas forma - nekādi jauni fakti, nekādi ieteikumi.
 */

export type DealerWorkGlossaryEntry = {
  /** Oriģinālās OE frāzes (DE / EN), kā tās nāk izdrukā. */
  source: readonly string[];
  /** Vienotais LV formulējums. */
  lv: string;
};

/** OE frāze → LV. Lieto AI promptā (tulkojot) un testos. */
export const DEALER_WORK_LV_GLOSSARY: readonly DealerWorkGlossaryEntry[] = [
  {
    source: ["BREMSKREISLAUF ENTLEERT U BEFUELLT", "Bremsflüssigkeit erneuert", "Bremsflüssigkeitswechsel", "Brake fluid service", "Brake fluid change"],
    lv: "Bremžu šķidruma maiņa",
  },
  {
    source: ["SYSTEMATISCHE WARTUNGSARBEITEN", "Systematische Wartungsarbeit", "Routine maintenance work"],
    lv: "Kārtējā apkope",
  },
  { source: ["POLLENFILTER AUSTAUSCH", "Innenraumfilter ersetzt", "Microfilter replaced", "Cabin filter replaced"], lv: "Salona filtra maiņa" },
  { source: ["LUFTFILTEREINSATZ AUSTAUSCH", "Luftfiltereinsatz ersetzt", "Air filter element replaced"], lv: "Gaisa filtra maiņa" },
  { source: ["KRAFTSTOFFILTEREINSATZ AUSTAUSCH", "Kraftstofffilter ersetzt", "Fuel filter replaced"], lv: "Degvielas filtra maiņa" },
  { source: ["Ölwechsel mit Filter", "Engine oil service", "Oil and filter change"], lv: "Motoreļļas un eļļas filtra maiņa" },
  { source: ["PH KUEHLFLUESSIGKEIT GEPRUEFT", "Kühlmittel pH geprüft"], lv: "Dzesēšanas šķidruma pH pārbaude" },
  { source: ["VERSTOPFUNG PARTIKELFILTER GEPRUEFT"], lv: "Kvēpu filtra (DPF) aizsērējuma pārbaude" },
  { source: ["STEUERZAHNRIEMEN AUSTAUSCH", "Zahnriemen erneuert", "Timing belt replaced"], lv: "Zobsiksnas maiņa" },
  { source: ["KABELBAUM TUER HI 1 SEITE AUSTAUSCH"], lv: "Aizmugurējo durvju vadu kūļa maiņa (vienā pusē)" },
  { source: ["ZUSATZBATTERIE AUSTAUSCH"], lv: "Papildu akumulatora maiņa" },
  { source: ["ANLASSER AUSTAUSCH", "Starter replaced"], lv: "Startera maiņa" },
  { source: ["MOTORABDECKUNG AUS- U EINGEBAUT"], lv: "Dzinēja dekoratīvā pārsega noņemšana un uzstādīšana" },
  { source: ["DIAGNOSE - 15 FEHLERSUCHE AM FAHRZEUG", "Fehlersuche"], lv: "Kļūmju meklēšana (diagnostika)" },
  { source: ["ADDITIVTANK \"EOLYS\" (FAP) AUSTAUSCH"], lv: "Kvēpu filtra piedevas (Eolys) tvertnes maiņa" },
  { source: ["ADDITIVTANK \"EOLYS\" (FAP) GEFUELLT"], lv: "Kvēpu filtra piedevas (Eolys) uzpilde" },
  { source: ["PRAEVENTIVMASSNAHME 1 EINGRIFF AM FAHRZEUG"], lv: "Ražotāja kampaņa (profilaktisks darbs)" },
  { source: ["ECM programmieren", "ECM programming"], lv: "Dzinēja vadības bloka programmēšana" },
  { source: ["Diagnose mit MDI"], lv: "Diagnostika ar ražotāja testeri" },
  { source: ["UVV DURCHFÜHREN"], lv: "Drošības pārbaude (UVV)" },
  { source: ["2 BREMSSCHEIBEN VO AUSTAUSCH"], lv: "Priekšējo bremžu disku maiņa (2 gab.)" },
  { source: ["Zündkerzen ersetzt", "Spark plugs replaced"], lv: "Aizdedzes sveču maiņa" },
  { source: ["Wartung A", "Service A"], lv: "A apkope" },
  { source: ["Wartung B", "Service B"], lv: "B apkope" },
  { source: ["Inspektionsservice", "Inspection service"], lv: "Inspekcijas apkope" },
  { source: ["Klimaservice", "Klimaanlage desinfiziert", "Air conditioning service"], lv: "Kondicioniera apkope" },
  { source: ["Wischerblätter erneuert", "Wiper blades replaced"], lv: "Stikla tīrītāju slotiņu maiņa" },
  { source: ["Bremsscheiben vorne erneuert", "Front brake discs replaced"], lv: "Priekšējo bremžu disku maiņa" },
  { source: ["Bremsbeläge hinten erneuert", "Rear brake pads replaced"], lv: "Aizmugurējo bremžu kluču maiņa" },
];

/** AI tulkošanas promptam: stila noteikumi + glosārijs (viens avots visiem dīlera tulkojumiem). */
export const DEALER_WORK_LV_STYLE_RULES = `LATVIAN STYLE FOR WORK ITEMS (Nils 23.11.2026):
- Short and natural, as a Latvian service advisor writes it: noun phrase with „maiņa” / „pārbaude” / „uzpilde” („Salona filtra maiņa”), not a calque.
- Never write „transportlīdzeklim”, „transportlīdzeklī”, „pie automašīnas” (German „AM FAHRZEUG” / „am Fahrzeug” is omitted).
- German suffix „WARTUNG” / „im Rahmen der Wartung” only marks that the job was part of the service: omit it, never add „(apkope)”.
- „1 SEITE” / „einseitig” / „one side” → „(vienā pusē)” at the end; „2 SEITEN” / „beidseitig” / „both sides” → „(abās pusēs)” at the end.
- „Filtereinsatz” / „filter element” = just „filtrs” („Gaisa filtra maiņa”, not „Gaisa filtra elementa maiņa”).
- No trailing period. No double explanations or added comments. No advice.
- GLOSSARY (use exactly): ${DEALER_WORK_LV_GLOSSARY.map((g) => `„${g.source[0]}” = „${g.lv}”`).join("; ")}.`;

/** LV formulējumi (arī no agrākiem AI tulkojumiem) → vienotais LV. Noenkurots uz visu rindu. */
const LV_LINE_RULES: readonly { re: RegExp; lv: string | ((m: RegExpMatchArray) => string) }[] = [
  {
    re: /^bremžu\s+(?:sistēmas|kontūra|šķidruma)\s+(?:iztukšošana|atgaisošana|izlaišana)\s+un\s+(?:uzpilde|uzpildīšana|piepildīšana)$/iu,
    lv: "Bremžu šķidruma maiņa",
  },
  { re: /^(?:iztukšota\s+un\s+uzpildīta|iztukšošana\s+un\s+uzpilde)[:,]?\s+bremžu\s+(?:sistēma|kontūrs)$/iu, lv: "Bremžu šķidruma maiņa" },
  { re: /^bremžu\s+šķidruma\s+nomaiņa$/iu, lv: "Bremžu šķidruma maiņa" },
  {
    re: /^(?:sistemātiskie\s+apkopes\s+darbi|sistemātisks\s+apkopes\s+darbs|sistemātiskā\s+apkope|sistemātiskie\s+tehniskās\s+apkopes\s+darbi)$/iu,
    lv: "Kārtējā apkope",
  },
  // „Gaisa filtra elementa maiņa” → „Gaisa filtra maiņa” (filtra ieliktnis = filtrs).
  { re: /^(.+?\s+filtra)\s+(?:elementa|ieliktņa|ieliktņu)\s+(maiņa|nomaiņa)$/iu, lv: (m) => `${m[1]} maiņa` },
  { re: /^uvv\s+(?:pārbaudes\s+veikšana|pārbaude|drošības\s+pārbaude)$/iu, lv: "Drošības pārbaude (UVV)" },
  // „Diagnostika - 15 kļūmju meklēšana”, „Kļūmju meklēšanas diagnostika 4” - skaitlis ir operācijas kods.
  {
    re: /^(?:diagnostika\s*[-:]?\s*(?:\d+\s+)?kļūmju\s+meklēšana|kļūmju\s+meklēšanas\s+diagnostika(?:\s+\d+)?|kļūmju\s+meklēšana(?:\s+\d+)?|kļūmju\s+diagnostika)$/iu,
    lv: "Kļūmju meklēšana (diagnostika)",
  },
  { re: /^diagnostika\s+ar\s+mdi$/iu, lv: "Diagnostika ar ražotāja testeri" },
  { re: /^ecm\s+(?:programmēšana|programmēšana\s+un\s+kodēšana)$/iu, lv: "Dzinēja vadības bloka programmēšana" },
  {
    re: /^profilaktisks\s+pasākums\s*\(ražotāja\s+kampaņa\)(?:\s+\d+\s+darbīb\p{L}*)?$/iu,
    lv: "Ražotāja kampaņa (profilaktisks darbs)",
  },
  {
    re: /^eolys\s+piedevas\s+bākas\s*\(fap\)\s+(maiņa|uzpilde)$/iu,
    lv: (m) => (m[1]!.toLowerCase() === "uzpilde" ? "Kvēpu filtra piedevas (Eolys) uzpilde" : "Kvēpu filtra piedevas (Eolys) tvertnes maiņa"),
  },
  // „Nomaiņa: aizmugurējie bremžu diski” → „Aizmugurējo bremžu disku maiņa”.
  {
    re: /^nomaiņa:\s*(priekšēj|aizmugurēj)(?:ie|ais)\s+bremžu\s+(diski|kluči)$/iu,
    lv: (m) => `${capitalizeFirst(m[1]!.toLowerCase())}o bremžu ${m[2]!.toLowerCase() === "diski" ? "disku" : "kluču"} maiņa`,
  },
];

/** Puses precizējums sākumā → iekavās beigās („Vienas puses X maiņa” → „X maiņa (vienā pusē)”). */
const SIDE_PREFIX_RULES: readonly { re: RegExp; tail: string }[] = [
  { re: /^vienas\s+puses\s+(.+)$/iu, tail: "vienā pusē" },
  { re: /^abu\s+pušu\s+(.+)$/iu, tail: "abās pusēs" },
];

/** „… transportlīdzeklim / transportlīdzeklī / (transportlīdzeklim) / pie automašīnas” - lieks. */
const VEHICLE_FILLER_RE =
  /\s*\(?(?:pie\s+)?(?:transportlīdzek(?:lim|lī|ļa)|automašīn(?:ai|ā|as))\)?(?=\s*[.,;:)]?\s*$)/iu;

/** Kods rindas sākumā: burti+cipari (≥ 5 zīmes, vismaz 3 cipari), aiz tā komats vai atstarpe. */
const LEADING_CODE_RE = /^(?=[A-Z0-9]*\d[A-Z0-9]*\d[A-Z0-9]*\d)[A-Z0-9]{5,12}(?:,\s*|\s+)(?=\p{L})/u;

/** „Aizmugurējās labās riteņa rumbas” → „Aizmugurējā labā riteņa rumbas” (saskaņa ar „riteņa”). */
const WHEEL_SIDE_RE = /\b(Priekšēj|Aizmugurēj|priekšēj|aizmugurēj)ās\s+(lab|kreis)ās\s+riteņa/gu;

/** Saīsinājumi, kuru punktu beigās nenoņem. */
const ABBREV_END_RE = /(?:^|\s)(?:u\.c|u\.tml|utt|nr|apm|piem|plkst|mēn|g|st|sk)\.$/iu;

const APKOPE_NOTE_RE = /\s*\(apkope\)/giu;

function capitalizeFirst(s: string): string {
  return s ? s.charAt(0).toLocaleUpperCase("lv") + s.slice(1) : s;
}

function lowerFirst(s: string): string {
  // Saīsinājumu (DPF, UVV) un īpašvārdu ar lielajiem burtiem nemaina.
  if (/^\p{Lu}{2,}/u.test(s)) return s;
  return s ? s.charAt(0).toLocaleLowerCase("lv") + s.slice(1) : s;
}

function stripTrailingPeriod(s: string): string {
  if (!s.endsWith(".") || s.endsWith("..")) return s;
  if (ABBREV_END_RE.test(s)) return s;
  return s.slice(0, -1).trimEnd();
}

export type PolishDealerWorkLineOpts = {
  /** Vizīte ir apkope - „(apkope)” piebilde katrā rindā ir lieka. */
  maintenanceVisit?: boolean;
};

/** Viena darbu rinda → tīrs, vienots LV (tikai forma; saturs nemainās). */
export function polishDealerWorkLineLv(raw: string, opts: PolishDealerWorkLineOpts = {}): string {
  let s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return s;
  s = stripTrailingPeriod(s);
  s = s.replace(VEHICLE_FILLER_RE, "").trim();
  s = stripTrailingPeriod(s);
  // Detaļu / operāciju kodi rindas sākumā („147C0910, …”, „A000923 …”) klientam neko nesaka.
  s = s.replace(LEADING_CODE_RE, "").trim();
  s = s.replace(/\biebūvēšana\b/giu, "uzstādīšana");
  s = s.replace(WHEEL_SIDE_RE, (_m, pos: string, side: string) => `${pos}ā ${side}ā riteņa`);
  // „… abās pusēs” beigās → „… (abās pusēs)”; „… nomaiņa” → „… maiņa” (vienots vārds).
  s = s.replace(/\s+(abās pusēs|vienā pusē)$/u, " ($1)");
  s = s.replace(/\snomaiņa(?=$|\s\()/u, " maiņa");
  const count = s.match(/^(\d{1,2})\s+(\p{Lu}.*)$/u);
  if (count) s = `${count[2]} (${count[1]} gab.)`;
  const hadApkope = /\(apkope\)/iu.test(s);
  if (hadApkope) s = s.replace(APKOPE_NOTE_RE, "").trim();
  for (const rule of SIDE_PREFIX_RULES) {
    const m = s.match(rule.re);
    if (m) {
      s = `${capitalizeFirst(lowerFirst(m[1]!.trim()))} (${rule.tail})`;
      break;
    }
  }
  // Glosārijs pret rindu bez puses iekavām, lai „(vienā pusē)” paliek.
  const side = s.match(/\s\((vienā pusē|abās pusēs)\)$/u);
  let core = side ? s.slice(0, side.index).trim() : s;
  for (const rule of LV_LINE_RULES) {
    const m = core.match(rule.re);
    if (!m) continue;
    core = typeof rule.lv === "string" ? rule.lv : rule.lv(m);
    break;
  }
  s = side ? `${core} (${side[1]})` : core;
  // Apkopes vizītē „(apkope)” nedublē kategoriju; citur atstāj kā precizējumu.
  if (hadApkope && !opts.maintenanceVisit) s = `${s} (apkope)`;
  return capitalizeFirst(s.replace(/\s+/g, " ").trim());
}

/** „X pārbaude” ir lieka, ja tajā pašā vizītē ir „X maiņa” (tā pati detaļa). */
function checkLineCoveredByChange(line: string, all: readonly string[]): boolean {
  const m = line.match(/^(.+?)\s+pārbaude(?:\s+\((?:vienā|abās)\s+pusēs?\))?(?:\s+abās\s+pusēs)?$/iu);
  if (!m) return false;
  const subject = m[1]!.toLocaleLowerCase("lv");
  return all.some((other) => {
    const o = other.toLocaleLowerCase("lv");
    return o !== line.toLocaleLowerCase("lv") && o.startsWith(`${subject} maiņa`);
  });
}

/**
 * Visas vizītes rindas; vienādas rindas pēc pulēšanas apvieno vienā ar skaitu «(2×)» (piem. divi bremžu kluči ar
 * dažādiem detaļu numuriem - nekas nepazūd), pārbaude + maiņa tai pašai detaļai → maiņa.
 */
export function polishDealerWorkLinesLv(lines: readonly string[], opts: PolishDealerWorkLineOpts = {}): string[] {
  const polished: string[] = [];
  const counts = new Map<string, number>();
  for (const line of lines) {
    const p = polishDealerWorkLineLv(line, opts);
    if (!p) continue;
    const key = p.toLocaleLowerCase("lv");
    const n = counts.get(key) ?? 0;
    counts.set(key, n + 1);
    if (n === 0) polished.push(p);
  }
  return polished
    .filter((line) => !checkLineCoveredByChange(line, polished))
    .map((line) => {
      const n = counts.get(line.toLocaleLowerCase("lv")) ?? 1;
      return n > 1 ? `${line} (${n}×)` : line;
    });
}
