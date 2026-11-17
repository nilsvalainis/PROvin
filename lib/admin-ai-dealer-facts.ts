/**
 * Strukturēti OFICIĀLĀ DĪLERA DATI (OneAuto) faktiem tehnisko risku v2 kartei, QA un validatoram.
 *
 * Katrai dīlera servisa rindai ir stabils ID (D1, D2, …), lai karte (`already_done_evidence`)
 * un teksts varētu atsaukties uz konkrētu ierakstu. Tikai deterministiska izvilkšana:
 * nekādu secinājumu, EUR vai intervālu matemātikas.
 */
import type { OneautoBlockState } from "@/lib/oneauto-block";
import { oneautoDisplayToServiceWorks, oneautoWorksNeedLvTranslation } from "@/lib/oneauto-dealer";
import {
  filledOneautoKvRows,
  filledOneautoServiceEvents,
  formatOneautoWorksText,
  type OneautoServiceEvent,
} from "@/lib/oneauto-catalog";
import {
  autoRecordsServiceWorkRowHasData,
  type AutoRecordsServiceWorkRow,
} from "@/lib/auto-records-service-works";
import type { TechnicalRiskMap } from "@/lib/admin-ai-technical-risk-map-types";

export type DealerFactKind = "service" | "campaign";

export type DealerComponentId =
  | "timing_chain"
  | "timing_belt"
  | "water_pump"
  | "dual_mass_flywheel"
  | "clutch"
  | "gearbox_oil"
  | "injectors"
  | "egr"
  | "dpf"
  | "turbo"
  | "glow_plugs"
  | "spark_plugs"
  | "brake_discs"
  | "aux_belt"
  | "battery"
  | "haldex";

export type DealerFact = {
  id: string;
  date: string;
  odometerKm: number | null;
  place: string;
  /** Iekšējais teksts faktu/kampaņu atpazīšanai (oriģināls, ja ir). Klientam nelieto. */
  works: string;
  /** Klienta / prompta teksts: tikai latviski. */
  worksLv: string;
  /** Oriģinālvalodas darbi (OEM PDF); tikai atpazīšanai, nekopēt izejā. */
  worksOriginal: string;
  kind: DealerFactKind;
  components: DealerComponentId[];
  /** Kampaņas / atsaukuma kods no oriģinālvalodas teksta, ja ir. */
  campaignCode: string | null;
};

/** Draftos OneAuto `display.serviceTimeline` parasti ir tukšs; dati ir auto_records. */
export type DealerFactsAutoRecords = {
  serviceWorks?: AutoRecordsServiceWorkRow[] | null;
  oneautoIngest?: { serviceTimelineOriginal?: OneautoServiceEvent[] | null } | null;
};

export type DealerFactsSource = {
  oneauto?: OneautoBlockState | null;
  autoRecords?: DealerFactsAutoRecords | null;
};

export type DealerVehicleFact = { label: string; value: string };

export type DealerFacts = {
  rows: DealerFact[];
  vehicle: DealerVehicleFact[];
};

type ComponentDef = { id: DealerComponentId; lv: string; re: RegExp };

/** Mezglu atpazīšana LV/EN/DE/NL/SV dīlera tekstā un LV atskaites tekstā. */
export const DEALER_COMPONENTS: readonly ComponentDef[] = [
  { id: "timing_chain", lv: "sadales ķēde", re: /sadales\s+ķēd|ķēdes\s+(komplekt|spriegot|maiņ)|timing\s+chain|steuerkette|distributieketting|kamkedja/i },
  { id: "timing_belt", lv: "zobsiksna", re: /zobsiksn|timing\s+belt|zahnriemen|distributieriem|kamrem/i },
  { id: "water_pump", lv: "ūdens sūknis", re: /ūdens\s+sūk[nņ]|dzesēšanas\s+sūk[nņ]|water\s*pump|coolant\s+pump|wasserpumpe|kühlmittelpumpe|waterpomp|vattenpump/i },
  { id: "dual_mass_flywheel", lv: "divmasu spararats", re: /divmasu|spararat|dual[\s-]?mass|flywheel|zweimassen|schwungrad|vliegwiel|svänghjul/i },
  { id: "clutch", lv: "sajūgs", re: /sajūg|clutch|kupplung|koppeling|koppling/i },
  {
    id: "gearbox_oil",
    lv: "kārbas eļļa",
    // j26: DSG / DQ400E / S tronic / DCT eļļa (arī zviedriski „DSG-olja”), tikai kopā ar eļļas vārdu.
    re: /kārbas\s+eļļ|transmission\s+(oil|fluid)|gearbox\s+oil|atf\b|getriebeöl|versnellingsbakolie|växellådsolja|(?:\bdsg|\bdq\d{3}\w?|s[\s-]?tronic|\bdct)\b.{0,20}(?:eļļ|oil|öl|olja|olie|fluid|šķidr)|(?:eļļ|oil|öl|olja|olie)\w*.{0,20}(?:\bdsg|\bdq\d{3}\w?|s[\s-]?tronic|\bdct)\b/i,
  },
  { id: "injectors", lv: "iesmidzinātāji", re: /iesmidzin|sprausl|injector|injektor|einspritzdüse|verstuiver|insprutning/i },
  { id: "egr", lv: "EGR", re: /\begr\b|agr[-\s]?(ventil|kühler)|izplūdes\s+gāzu\s+recirk/i },
  { id: "dpf", lv: "sodrēju filtrs", re: /sodrēju\s+filtr|\bdpf\b|\bfap\b|particulate|partikelfilter|roetfilter|partikelfilter/i },
  { id: "turbo", lv: "turbokompresors", re: /turbo|turbolader|turbocharger/i },
  { id: "glow_plugs", lv: "kvēlsveces", re: /kvēlsvec|glow\s*plug|glühkerze|gloeibougie|glödstift/i },
  { id: "spark_plugs", lv: "aizdedzes sveces", re: /aizdedzes\s+svec|spark\s*plug|zündkerze|bougie|tändstift/i },
  { id: "brake_discs", lv: "bremžu diski", re: /bremžu\s+disk|brake\s+disc|bremsscheibe|remschijf|bromsskiv/i },
  { id: "aux_belt", lv: "piedziņas siksna", re: /piedziņas\s+siksn|papildsiksn|ķīļsiksn|drive\s+belt|serpentine|keilrippenriemen|multiriem|drivrem/i },
  { id: "battery", lv: "akumulators", re: /akumulator|battery|batterie|accu\b|batteri\b/i },
  { id: "haldex", lv: "pilnpiedziņas sajūgs", re: /haldex|awd\s+coupling|allradkupplung|hidromuft/i },
];

/**
 * Kampaņu / atsaukumu / akciju marķieri oriģinālvalodas tekstā.
 * Stumbriem (kampaņ / atsauk / servisa akcij) nav beigu `\b`: pēc `ņ`/`k`/`j`
 * JS `\b` nestrādā un `kampaņa` / `atsaukums` / `akcija` neiekrīt.
 */
const CAMPAIGN_WORD_RE =
  /(?:^|[^\p{L}\p{N}_])(?:recalls?|campaigns?|kampaņ\p{L}*|atsauk\p{L}*|r(?:ü|u)ckruf|technische\s+aktion|service\s+actions?|field\s+fix|tsb|sib|servisa\s+akcij\p{L}*|safety\s+recall|recall\s+uitgevoerd(?:\s+volgens\s+qb)?|actie\s+uitgevoerd|type:\s*(?:campaign|recall)|qb\b)/iu;

const CAMPAIGN_CODE_PATTERNS: readonly RegExp[] = [
  /\bQB[\s.:-]*((?:[RS]\s*)?\d{4,6})\b/i,
  /\bType:\s*(?:Campaign|Recall)\b[\s:/,-]*([A-Z0-9]{3,10})\b/i,
  /\bAktion\s+([A-Z0-9]{3,10})\b/i,
  /\bQB\s*(R\d{4,6})\b/i,
  /\bSafety\s+Recall\s+(P\d{1,3})\b/i,
  /\b(S\d{5})\b/,
  /\b(\d{3}[A-Z]\d{2})\b/,
];

export function extractDealerCampaignCode(text: string): string | null {
  const t = text ?? "";
  for (const re of CAMPAIGN_CODE_PATTERNS) {
    const m = re.exec(t);
    const code = (m?.[1] ?? "").replace(/\s+/g, "").trim().toUpperCase();
    if (code) return code;
  }
  return null;
}

export function isDealerCampaignText(text: string): boolean {
  const t = text ?? "";
  return CAMPAIGN_WORD_RE.test(t) || extractDealerCampaignCode(t) != null;
}

const VEHICLE_FACT_LABEL_RE =
  /garant|warranty|garantie|first\s+registration|pirmreģ|erstzulassung|delivery|piegād|auslieferung|production|ražoš|produktion|build\s+date/i;

export function detectDealerComponents(text: string): DealerComponentId[] {
  const t = text ?? "";
  return DEALER_COMPONENTS.filter((c) => c.re.test(t)).map((c) => c.id);
}

export function dealerComponentLv(id: DealerComponentId): string {
  return DEALER_COMPONENTS.find((c) => c.id === id)?.lv ?? id;
}

function dateSortKey(raw: string): number {
  const t = raw.trim();
  const lv = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(t);
  if (lv) return Date.UTC(Number(lv[3]), Number(lv[2]) - 1, Number(lv[1]));
  const iso = Date.parse(t);
  return Number.isFinite(iso) ? iso : Number.POSITIVE_INFINITY;
}

function digitsOnly(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

function parseKm(raw: string): number | null {
  const digits = digitsOnly(raw);
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Oriģinālvalodas „Darbi” pēc datuma + km. Tikai atpazīšanai, ne klienta tekstam. */
export function originalDealerWorksForRow(
  row: AutoRecordsServiceWorkRow,
  original: readonly OneautoServiceEvent[] | null | undefined,
): string {
  const events = original ?? [];
  if (events.length === 0) return "";
  const date = (row.date ?? "").trim();
  const km = digitsOnly(row.odometer ?? "");
  const exact = events.find(
    (ev) => ev.date.trim() === date && (!km || digitsOnly(ev.odometer) === km),
  );
  if (exact) return formatOneautoWorksText(exact.works);
  if (!date) return "";
  const sameDate = events.filter((ev) => ev.date.trim() === date);
  if (sameDate.length === 1) return formatOneautoWorksText(sameDate[0]!.works);
  return "";
}

function uniqueDealerComponents(ids: readonly DealerComponentId[]): DealerComponentId[] {
  const seen = new Set<DealerComponentId>();
  const out: DealerComponentId[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Klienta rinda: LV darbi, citādi mezglu nosaukumi + kampaņas kods. Nekad oriģinālu. */
export function customerDealerWorksLv(args: {
  worksLvRaw: string;
  components: readonly DealerComponentId[];
  campaignCode: string | null;
  kind: DealerFactKind;
}): string {
  const lv = (args.worksLvRaw ?? "").replace(/\s+/g, " ").trim();
  if (lv && !oneautoWorksNeedLvTranslation(lv)) return lv;
  const parts = args.components.map(dealerComponentLv);
  if (args.campaignCode) parts.push(`[kampaņa ${args.campaignCode}]`);
  else if (args.kind === "campaign") parts.push("[kampaņa]");
  return parts.join(" ").trim() || "darbs nav norādīts";
}

function isLegacyOneautoBlock(
  input: DealerFactsSource | OneautoBlockState | null | undefined,
): input is OneautoBlockState {
  return !!input && typeof input === "object" && "display" in input && !("autoRecords" in input) && !("oneauto" in input);
}

function resolveDealerFactsSource(
  input: DealerFactsSource | OneautoBlockState | null | undefined,
): DealerFactsSource {
  if (!input) return {};
  if (isLegacyOneautoBlock(input)) return { oneauto: input };
  return input;
}

/**
 * D-ID no latviešu `serviceWorks` (kā admin / PDF). Oriģināls tikai tad, ja LV rindu nav.
 * Vecais OneAuto display - pēdējais ceļš.
 */
export function dealerServiceWorksFromSources(source: DealerFactsSource): AutoRecordsServiceWorkRow[] {
  const works = (source.autoRecords?.serviceWorks ?? []).filter(autoRecordsServiceWorkRowHasData);
  if (works.length > 0) return works;
  const original = filledOneautoServiceEvents(source.autoRecords?.oneautoIngest?.serviceTimelineOriginal);
  if (original.length > 0) {
    return oneautoDisplayToServiceWorks({
      equipment: [],
      powertrain: [],
      serviceTimeline: original,
    });
  }
  return oneautoDisplayToServiceWorks(source.oneauto?.display);
}

function factFromServiceWork(
  w: AutoRecordsServiceWorkRow,
  id: string,
  originalTimeline?: readonly OneautoServiceEvent[] | null,
): DealerFact | null {
  const worksLvRaw = (w.works ?? "").replace(/\s+/g, " ").trim();
  const worksOriginal = originalDealerWorksForRow(w, originalTimeline).replace(/\s+/g, " ").trim();
  const detection = worksOriginal || worksLvRaw;
  if (!detection && !(w.odometer ?? "").trim()) return null;
  const campaignCode =
    extractDealerCampaignCode(worksOriginal) ?? extractDealerCampaignCode(worksLvRaw);
  const kind: DealerFactKind =
    isDealerCampaignText(worksOriginal) || isDealerCampaignText(worksLvRaw) ? "campaign" : "service";
  const components = uniqueDealerComponents([
    ...detectDealerComponents(worksOriginal),
    ...detectDealerComponents(worksLvRaw),
  ]);
  return {
    id,
    date: (w.date ?? "").trim(),
    odometerKm: parseKm(w.odometer ?? ""),
    place: (w.location ?? "").trim(),
    works: detection,
    worksLv: customerDealerWorksLv({ worksLvRaw, components, campaignCode, kind }),
    worksOriginal,
    kind,
    components,
    campaignCode,
  };
}

/** Stabils D-ID saraksts no servisa rindām (vecākais = D1). Dīlera PDF / admin neatkarīgi no audita. */
export function extractDealerFactsFromServiceWorks(
  serviceWorks: readonly AutoRecordsServiceWorkRow[] | null | undefined,
  originalTimeline?: readonly OneautoServiceEvent[] | null,
): DealerFacts {
  const works = [...(serviceWorks ?? [])].sort(
    (a, b) => dateSortKey(a.date ?? "") - dateSortKey(b.date ?? ""),
  );
  const rows: DealerFact[] = [];
  for (const w of works) {
    const fact = factFromServiceWork(w, `D${rows.length + 1}`, originalTimeline);
    if (fact) rows.push(fact);
  }
  return { rows, vehicle: [] };
}

export function extractDealerFacts(
  input: DealerFactsSource | OneautoBlockState | null | undefined,
): DealerFacts {
  const source = resolveDealerFactsSource(input);
  const original = filledOneautoServiceEvents(source.autoRecords?.oneautoIngest?.serviceTimelineOriginal);
  const fromWorks = extractDealerFactsFromServiceWorks(dealerServiceWorksFromSources(source), original);
  const display = source.oneauto?.display;
  const vehicle = [
    ...filledOneautoKvRows(display?.powertrain ?? []),
    ...filledOneautoKvRows(display?.equipment ?? []),
  ]
    .filter((r) => VEHICLE_FACT_LABEL_RE.test(r.label))
    .map((r) => ({ label: r.label.trim(), value: r.value.trim() }));
  return { rows: fromWorks.rows, vehicle };
}

export function dealerFactsHaveData(facts: DealerFacts): boolean {
  return facts.rows.length > 0 || facts.vehicle.length > 0;
}

function fmtKm(n: number | null): string {
  if (n == null) return "km nav";
  return `${n.toLocaleString("lv-LV").replace(/\u00a0/g, " ")} km`;
}

export function formatDealerAlreadyDoneEvidence(fact: DealerFact): string {
  return `${fact.id} ${fact.date}, ${fmtKm(fact.odometerKm)}: ${fact.worksLv}`.slice(0, 200);
}

/** Bloks kartes / teksta / QA promptam. Tukšs, ja OneAuto datu nav. */
export function buildDealerFactsBrief(facts: DealerFacts): string {
  if (!dealerFactsHaveData(facts)) return "";
  const lines = [
    "### OFICIĀLĀ DĪLERA FAKTI (OneAuto, deterministisks saraksts - NEIZDOMĀ pretējo)",
    "- Katram ierakstam ir ID. Ja risks kartē attiecas uz mezglu, kas te jau ir nomainīts vai apkopts, `already_done_evidence` raksti formā „D<n> <datums> <km>: <darbs latviski>” un riska tekstā nesaki, ka darbs jāveic.",
    "- Ja ieraksta nav, tas nozīmē tikai to, ka oficiālajā dīlerī darbs nav fiksēts. Darbs var būt veikts ārpus oficiālā dīlera; to lūdz pierādīt pārdevējam.",
    "- Kampaņas (kind=campaign) salīdzini ar atsaukumiem: ja dīleris kampaņu izpildījis, recalls ierakstā to norādi ar D<n>.",
    "- Dīlera ierakstus citē tikai latviski, oriģinālvalodas tekstu nekopē.",
  ];
  for (const r of facts.rows) {
    const comp = r.components.length ? ` [mezgli: ${r.components.map(dealerComponentLv).join(", ")}]` : "";
    const kind =
      r.kind === "campaign" && !/\[kampaņa/i.test(r.worksLv)
        ? r.campaignCode
          ? ` [kampaņa ${r.campaignCode}]`
          : " [kampaņa]"
        : "";
    lines.push(`- ${r.id} ${r.date || "datums nav"}, ${fmtKm(r.odometerKm)}${r.place ? `, ${r.place}` : ""}: ${r.worksLv || "darbs nav norādīts"}${kind}${comp}`);
  }
  for (const v of facts.vehicle) {
    lines.push(`- Auto dati: ${v.label}: ${v.value} (tikai fakts, bez secinājumiem par garantijas segumu)`);
  }
  return lines.join("\n");
}

/** Mezgli, kuru maiņa / apkope ir fiksēta dīlera datos → pēdējais ieraksts. */
export function dealerDoneComponents(facts: DealerFacts): Map<DealerComponentId, DealerFact> {
  const out = new Map<DealerComponentId, DealerFact>();
  for (const r of facts.rows) {
    for (const c of r.components) out.set(c, r);
  }
  return out;
}

export type DealerMapIssue = {
  id: "DF1" | "DF2" | "DF3";
  message: string;
};

/**
 * Kartes pārbaude pret dīlera faktiem:
 * DF1 — risks par mezglu, kura darbs fiksēts dīlerī, bet `already_done_evidence` tukšs.
 * DF2 — recalls tikai „nav atrasts”, bet dīlera datos ir kampaņa.
 */
export function checkMapAgainstDealerFacts(
  map: TechnicalRiskMap | null | undefined,
  facts: DealerFacts,
): DealerMapIssue[] {
  if (!map || facts.rows.length === 0) return [];
  const issues: DealerMapIssue[] = [];
  const done = dealerDoneComponents(facts);
  for (const risk of map.risks ?? []) {
    const comps = detectDealerComponents(`${risk.component} ${risk.failure_mode}`);
    for (const c of comps) {
      const fact = done.get(c);
      if (fact && !(risk.already_done_evidence ?? "").trim()) {
        issues.push({
          id: "DF1",
          message: `Risks „${risk.component}”: dīlera datos ${fact.id} (${fact.date}, ${fmtKm(fact.odometerKm)}) ir darbs pie mezgla „${dealerComponentLv(c)}”, bet already_done_evidence tukšs.`,
        });
        break;
      }
    }
  }
  const campaigns = facts.rows.filter((r) => r.kind === "campaign");
  const recalls = map.recalls ?? [];
  const onlyNotFound = recalls.length === 0 || recalls.every((r) => /nav\s+atrast/i.test(r.id_or_title));
  if (campaigns.length > 0 && onlyNotFound) {
    issues.push({
      id: "DF2",
      message: `Atsaukumos tikai „nav atrasts”, bet dīlera datos ir kampaņa: ${campaigns.map((c) => `${c.id} ${c.date}`).join(", ")}.`,
    });
  }
  return issues;
}

/** Aizpilda trūkstošo `already_done_evidence` no dīlera faktiem (deterministiski, neko neizdzēš). */
export function fillAlreadyDoneEvidenceFromDealer(
  map: TechnicalRiskMap,
  facts: DealerFacts,
): TechnicalRiskMap {
  if (facts.rows.length === 0) return map;
  const done = dealerDoneComponents(facts);
  return {
    ...map,
    risks: map.risks.map((risk) => {
      if ((risk.already_done_evidence ?? "").trim()) return risk;
      const c = detectDealerComponents(`${risk.component} ${risk.failure_mode}`).find((x) => done.has(x));
      if (!c) return risk;
      const f = done.get(c)!;
      return {
        ...risk,
        already_done_evidence: formatDealerAlreadyDoneEvidence(f),
      };
    }),
  };
}

/** Ja AI ierakstījis oriģinālvalodu evidence, aizvieto ar latviešu D-ID rindu. */
export function replaceForeignAlreadyDoneEvidenceFromDealer(
  map: TechnicalRiskMap,
  facts: DealerFacts,
): TechnicalRiskMap {
  if (facts.rows.length === 0) return map;
  const done = dealerDoneComponents(facts);
  return {
    ...map,
    risks: map.risks.map((risk) => {
      const ev = (risk.already_done_evidence ?? "").trim();
      if (!ev || !oneautoWorksNeedLvTranslation(ev)) return risk;
      const idMatch = /\b(D\d+)\b/.exec(ev);
      const byId = idMatch ? facts.rows.find((r) => r.id === idMatch[1]) : undefined;
      const c = detectDealerComponents(`${risk.component} ${risk.failure_mode}`).find((x) => done.has(x));
      const f = byId ?? (c ? done.get(c) : undefined);
      if (!f) return risk;
      return { ...risk, already_done_evidence: formatDealerAlreadyDoneEvidence(f) };
    }),
  };
}

/** DF3: V2 teksts, evidence vai AVOTU FAKTI citē dīlera oriģinālvalodu. */
export function collectForeignDealerLanguageFlags(
  text: string | null | undefined,
  map?: TechnicalRiskMap | null,
  extras?: { briefs?: Array<string | null | undefined>; facts?: DealerFacts },
): DealerMapIssue[] {
  const out: DealerMapIssue[] = [];
  const seen = new Set<string>();
  const add = (message: string) => {
    if (seen.has(message)) return;
    seen.add(message);
    out.push({ id: "DF3", message });
  };
  const facts = extras?.facts;
  const scan = (label: string, raw: string | null | undefined, fragmentsOnly = false) => {
    const t = (raw ?? "").trim();
    if (!t) return;
    const hit = fragmentsOnly
      ? Boolean(facts && dealerOriginalLanguageFragments(facts).some((frag) => t.includes(frag)))
      : oneautoWorksNeedLvTranslation(t) || textContainsDealerOriginalLanguage(t, facts);
    if (hit) add(`${label} satur oriģinālvalodu: ${t.replace(/\s+/g, " ").trim().slice(0, 160)}`);
  };
  for (const risk of map?.risks ?? []) {
    scan("already_done_evidence", risk.already_done_evidence);
  }
  for (const s of sentences(text ?? "")) {
    scan("teksts", s);
  }
  for (const brief of extras?.briefs ?? []) {
    const sourceFacts = /^\s*AVOTU FAKTI/i.test(brief ?? "");
    for (const s of sentences(brief ?? "")) {
      // Dīlera brīfs: tikai zināmie oriģināla fragmenti (Warranty start u.c. paliek).
      // AVOTU FAKTI: arī palikušos EN darbu nosaukumus no komentāriem / avotu datiem.
      scan("AVOTU FAKTI / brīfs", s, !sourceFacts);
    }
  }
  return out;
}

function looksForeignDealerWorks(text: string): boolean {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  if (t.length < 8) return false;
  if (oneautoWorksNeedLvTranslation(t)) return true;
  return /[A-Za-z]{5,}/.test(t) && !/[āčēģīķļņšūž]/i.test(t);
}

/** Oriģinālvalodas dīlera fragmenti (A/B: Pneumatic spring, rear u.c.) - tikai atpazīšanai. */
export function dealerOriginalLanguageFragments(facts: DealerFacts | null | undefined): string[] {
  if (!facts) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim();
    if (t.length < 8 || !looksForeignDealerWorks(t) || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push(t);
  };
  for (const f of facts.rows) {
    for (const blob of [f.worksOriginal, f.works]) {
      if (!blob) continue;
      add(blob);
      for (const part of blob.split(/[;\n]/)) add(part);
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

export function textContainsDealerOriginalLanguage(
  text: string,
  facts?: DealerFacts | null,
): boolean {
  const t = text ?? "";
  if (oneautoWorksNeedLvTranslation(t)) return true;
  if (!facts) return looksForeignDealerWorks(t) && /\b(spring|intake|tube|pneumatic|hybrid|health check|hhc)\b/i.test(t);
  return dealerOriginalLanguageFragments(facts).some((frag) => t.includes(frag));
}

/** Nomaina oriģinālvalodas dīlera darbus pret worksLv. Citiem avotiem nemaina. */
export function redactDealerOriginalLanguage(text: string, facts: DealerFacts): string {
  let out = text ?? "";
  if (!out) return out;
  for (const f of facts.rows) {
    const lv = f.worksLv || "darbs nav norādīts";
    for (const frag of dealerOriginalLanguageFragments({ rows: [f], vehicle: [] })) {
      if (!out.includes(frag)) continue;
      out = out.split(frag).join(lv);
    }
  }
  return out;
}

/**
 * AVOTU FAKTI / avotu komentāri: zināmo oriģinālu aizstāj ar worksLv,
 * palikušos EN dīlera darbu gabalus izmet (A/B: komentārs, ne tikai brīfs).
 */
export function sanitizeDealerLanguageForSourceFacts(text: string, facts: DealerFacts): string {
  const redacted = redactDealerOriginalLanguage(text ?? "", facts);
  if (!redacted.trim()) return "";
  const tokens = redacted.split(/([;\n])/);
  const kept: string[] = [];
  for (const tok of tokens) {
    if (tok === ";" || tok === "\n") {
      kept.push(tok);
      continue;
    }
    const piece = tok.trim();
    if (!piece) {
      kept.push(tok);
      continue;
    }
    if (oneautoWorksNeedLvTranslation(piece) || textContainsDealerOriginalLanguage(piece, facts)) {
      continue;
    }
    kept.push(tok);
  }
  return kept
    .join("")
    .replace(/[ \t]*;[ \t]*/g, "; ")
    .replace(/(?:;|\s)*\n(?:;|\s)*/g, "\n")
    .replace(/^[;\s]+|[;\s]+$/g, "")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

/** Kompaktas LV dīlera rindas AVOTU FAKTIEM (nekad oriģināls). */
export function buildDealerFactsLvSourceLines(facts: DealerFacts): string {
  return facts.rows
    .map((r) => `${r.id} ${r.date || "datums nav"}, ${fmtKm(r.odometerKm)}: ${r.worksLv}`)
    .join("\n");
}

const MUST_REPLACE_RE =
  /(jāmaina|jānomaina|jāveic\s+maiņ|maiņa\s+(ir\s+)?(nepieciešam|jāveic|gaidām|tuvojas)|nomaiņa\s+nepieciešam|vajadzēs\s+mainīt|plāno\s+maiņ|ieplāno\s+maiņ)/i;

function sentences(text: string): string[] {
  return (text ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Nolietojuma mezgli: dīlera maiņa var būt sena, tāpēc pretruna ir tikai brīdinājums. */
export const DEALER_WEAR_COMPONENTS: ReadonlySet<DealerComponentId> = new Set([
  "timing_belt",
  "brake_discs",
  "battery",
  "spark_plugs",
  "glow_plugs",
  "aux_belt",
  "gearbox_oil",
]);

/** Teksta teikumi, kas prasa mainīt mezglu, kura darbs jau ir dīlera datos. */
export function findTextContradictionsWithDealer(
  text: string,
  facts: DealerFacts,
): Array<{ sentence: string; component: DealerComponentId; fact: DealerFact }> {
  if (facts.rows.length === 0) return [];
  const done = dealerDoneComponents(facts);
  const out: Array<{ sentence: string; component: DealerComponentId; fact: DealerFact }> = [];
  for (const s of sentences(text)) {
    if (!MUST_REPLACE_RE.test(s)) continue;
    if (/\bD\d+\b|dīlera\s+datos\s+(jau\s+)?(fiksēt|ir)/i.test(s)) continue;
    for (const c of detectDealerComponents(s)) {
      const fact = done.get(c);
      if (fact) {
        out.push({ sentence: s, component: c, fact });
        break;
      }
    }
  }
  return out;
}

/** Vai teksts piemin dīlera izpildīto kampaņu (ID vai datumu). */
export function textMentionsDealerCampaigns(text: string, facts: DealerFacts): boolean {
  const campaigns = facts.rows.filter((r) => r.kind === "campaign");
  if (campaigns.length === 0) return true;
  return campaigns.some(
    (c) => new RegExp(`\\b${c.id}\\b`).test(text) || (c.date && text.includes(c.date)),
  );
}
