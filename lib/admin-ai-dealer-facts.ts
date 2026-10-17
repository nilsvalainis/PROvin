/**
 * Strukturēti OFICIĀLĀ DĪLERA DATI (OneAuto) faktiem tehnisko risku v2 kartei, QA un validatoram.
 *
 * Katrai dīlera servisa rindai ir stabils ID (D1, D2, …), lai karte (`already_done_evidence`)
 * un teksts varētu atsaukties uz konkrētu ierakstu. Tikai deterministiska izvilkšana:
 * nekādu secinājumu, EUR vai intervālu matemātikas.
 */
import type { OneautoBlockState } from "@/lib/oneauto-block";
import { oneautoDisplayToServiceWorks } from "@/lib/oneauto-dealer";
import {
  filledOneautoKvRows,
  filledOneautoServiceEvents,
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
  works: string;
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
  { id: "gearbox_oil", lv: "kārbas eļļa", re: /kārbas\s+eļļ|transmission\s+(oil|fluid)|gearbox\s+oil|atf\b|getriebeöl|versnellingsbakolie|växellådsolja/i },
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
  /(?:^|[^\p{L}\p{N}_])(?:recalls?|campaigns?|kampaņ\p{L}*|atsauk\p{L}*|r(?:ü|u)ckruf|aktion|actie|service\s+actions?|technische\s+aktion|field\s+fix|tsb|sib|servisa\s+akcij\p{L}*|safety\s+recall|recall\s+uitgevoerd(?:\s+volgens\s+qb)?|type:\s*(?:campaign|recall))/iu;

const CAMPAIGN_CODE_PATTERNS: readonly RegExp[] = [
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
    const code = (m?.[1] ?? "").trim().toUpperCase();
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

function parseKm(raw: string): number | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
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

/** Oriģinālvaloda no ingest, tad serviceWorks, tad vecais OneAuto display ceļš. */
export function dealerServiceWorksFromSources(source: DealerFactsSource): AutoRecordsServiceWorkRow[] {
  const original = filledOneautoServiceEvents(source.autoRecords?.oneautoIngest?.serviceTimelineOriginal);
  if (original.length > 0) {
    return oneautoDisplayToServiceWorks({
      equipment: [],
      powertrain: [],
      serviceTimeline: original,
    });
  }
  const works = (source.autoRecords?.serviceWorks ?? []).filter(autoRecordsServiceWorkRowHasData);
  if (works.length > 0) return works;
  return oneautoDisplayToServiceWorks(source.oneauto?.display);
}

function factFromServiceWork(w: AutoRecordsServiceWorkRow, id: string): DealerFact | null {
  const text = (w.works ?? "").replace(/\s+/g, " ").trim();
  if (!text && !(w.odometer ?? "").trim()) return null;
  const campaignCode = extractDealerCampaignCode(text);
  return {
    id,
    date: (w.date ?? "").trim(),
    odometerKm: parseKm(w.odometer ?? ""),
    place: (w.location ?? "").trim(),
    works: text,
    kind: isDealerCampaignText(text) ? "campaign" : "service",
    components: detectDealerComponents(text),
    campaignCode,
  };
}

export function extractDealerFacts(
  input: DealerFactsSource | OneautoBlockState | null | undefined,
): DealerFacts {
  const source = resolveDealerFactsSource(input);
  const works = [...dealerServiceWorksFromSources(source)].sort(
    (a, b) => dateSortKey(a.date ?? "") - dateSortKey(b.date ?? ""),
  );
  const rows: DealerFact[] = [];
  for (const w of works) {
    const fact = factFromServiceWork(w, `D${rows.length + 1}`);
    if (fact) rows.push(fact);
  }
  const display = source.oneauto?.display;
  const vehicle = [
    ...filledOneautoKvRows(display?.powertrain ?? []),
    ...filledOneautoKvRows(display?.equipment ?? []),
  ]
    .filter((r) => VEHICLE_FACT_LABEL_RE.test(r.label))
    .map((r) => ({ label: r.label.trim(), value: r.value.trim() }));
  return { rows, vehicle };
}

export function dealerFactsHaveData(facts: DealerFacts): boolean {
  return facts.rows.length > 0 || facts.vehicle.length > 0;
}

function fmtKm(n: number | null): string {
  if (n == null) return "km nav";
  return `${n.toLocaleString("lv-LV").replace(/\u00a0/g, " ")} km`;
}

/** Bloks kartes / teksta / QA promptam. Tukšs, ja OneAuto datu nav. */
export function buildDealerFactsBrief(facts: DealerFacts): string {
  if (!dealerFactsHaveData(facts)) return "";
  const lines = [
    "### OFICIĀLĀ DĪLERA FAKTI (OneAuto, deterministisks saraksts - NEIZDOMĀ pretējo)",
    "- Katram ierakstam ir ID. Ja risks kartē attiecas uz mezglu, kas te jau ir nomainīts vai apkopts, `already_done_evidence` raksti formā „D<n> <datums> <km>: <darbs>” un riska tekstā nesaki, ka darbs jāveic.",
    "- Ja ieraksta nav, tas nozīmē tikai to, ka oficiālajā dīlerī darbs nav fiksēts. Darbs var būt veikts ārpus oficiālā dīlera; to lūdz pierādīt pārdevējam.",
    "- Kampaņas (kind=campaign) salīdzini ar atsaukumiem: ja dīleris kampaņu izpildījis, recalls ierakstā to norādi ar D<n>.",
  ];
  for (const r of facts.rows) {
    const comp = r.components.length ? ` [mezgli: ${r.components.map(dealerComponentLv).join(", ")}]` : "";
    const kind =
      r.kind === "campaign" ? (r.campaignCode ? ` [kampaņa ${r.campaignCode}]` : " [kampaņa]") : "";
    lines.push(`- ${r.id} ${r.date || "datums nav"}, ${fmtKm(r.odometerKm)}${r.place ? `, ${r.place}` : ""}: ${r.works || "darbs nav norādīts"}${kind}${comp}`);
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
  id: "DF1" | "DF2";
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
        already_done_evidence: `${f.id} ${f.date}, ${fmtKm(f.odometerKm)}: ${f.works}`.slice(0, 200),
      };
    }),
  };
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
