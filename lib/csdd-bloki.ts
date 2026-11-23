/**
 * e.csdd papildu bloki (Nila lēmums 23.11.2026): brīdinājumi, aizliegumi + CSNg, TA defektu analīze,
 * tehniskie mērījumi. Viens modelis admin avotu sadaļai un klienta PDF (PDF tikai ar ieslēgtu ķeksi).
 *
 * Tikai fakti no e.csdd teksta - bez ieteikumiem. Katram blokam avots «e.csdd, DD.MM.YYYY»
 * („Informācija sagatavota” datums). Parsē no saglabātā RAW katrā reizē - datus nepārraksta.
 */

import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  effectiveInspectionSeverity,
  normalizeCsddRawText,
  type CsddTechnicalInspectionRow,
} from "@/lib/csdd-extended-parse";
import { parseCsddRegistrySignals, type CsddRegistrySignals, type CsddSectionState } from "@/lib/csdd-registry-signals";

/* -------------------------------------------------------------------------- */
/* PDF karogi                                                                  */
/* -------------------------------------------------------------------------- */

export { CSDD_PDF_BLOK_KEYS, CSDD_PDF_BLOKI_OFF, type CsddPdfBlokKey, type CsddPdfBlokiFlags } from "@/lib/pdf-visibility";

/* -------------------------------------------------------------------------- */
/* Teksti (LV/EN/RU/DE)                                                        */
/* -------------------------------------------------------------------------- */

type Tx = Record<ClientReportLang, string>;

function fill(t: string, vars: Record<string, string | number>): string {
  return t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

export const CSDD_BLOKI_TX = {
  adminTitle: { lv: "CSDD brīdinājumi un TA analīze", en: "", ru: "", de: "" },
  warningsTitle: { lv: "CSDD brīdinājumi", en: "CSDD warnings", ru: "Предупреждения CSDD", de: "CSDD-Hinweise" },
  restrictionsTitle: {
    lv: "Aizliegumi un būtiski bojājumi (CSNg)",
    en: "Restrictions and major damage (CSNg)",
    ru: "Запреты и существенные повреждения (CSNg)",
    de: "Verbote und erhebliche Schäden (CSNg)",
  },
  sectionMissing: {
    lv: "e.csdd tekstā šīs sadaļas nav",
    en: "section not present in the e.csdd text",
    ru: "раздела нет в тексте e.csdd",
    de: "Abschnitt fehlt im e.csdd-Text",
  },
  restrictions: { lv: "Aizliegumi", en: "Restrictions", ru: "Запреты", de: "Verbote" },
  csngPolice: {
    lv: "Policijas atzīmes (CSNg)",
    en: "Police records (CSNg)",
    ru: "Отметки полиции (CSNg)",
    de: "Polizeiliche Einträge (CSNg)",
  },
  csngInsurers: {
    lv: "Apdrošinātāju atzīmes (CSNg)",
    en: "Insurer records (CSNg)",
    ru: "Отметки страховщиков (CSNg)",
    de: "Einträge der Versicherer (CSNg)",
  },
  none: { lv: "Nav", en: "None", ru: "Нет", de: "Keine" },
  notChecked: { lv: "nav pārbaudīts", en: "not checked", ru: "не проверено", de: "nicht geprüft" },
  noData: { lv: "nav datu", en: "no data", ru: "нет данных", de: "keine Daten" },
  measurementsTitle: {
    lv: "Tehniskie mērījumi",
    en: "Technical measurements",
    ru: "Технические измерения",
    de: "Technische Messwerte",
  },
  brakesTitle: { lv: "Bremžu mērījumi", en: "Brake measurements", ru: "Замеры тормозов", de: "Bremsmesswerte" },
  axle: { lv: "Ass", en: "Axle", ru: "Ось", de: "Achse" },
  left: { lv: "Kreisais", en: "Left", ru: "Левый", de: "Links" },
  right: { lv: "Labais", en: "Right", ru: "Правый", de: "Rechts" },
  diff: { lv: "Starpība", en: "Difference", ru: "Разница", de: "Differenz" },
  brakeType: { lv: "Tips", en: "Type", ru: "Тип", de: "Typ" },
  co2: { lv: "CO2", en: "CO2", ru: "CO2", de: "CO2" },
  consumption: { lv: "Patēriņš", en: "Consumption", ru: "Расход", de: "Verbrauch" },
  city: { lv: "pilsētā", en: "city", ru: "в городе", de: "innerorts" },
  euro: { lv: "Euro klase", en: "Euro class", ru: "Экокласс", de: "Euro-Norm" },
  co: { lv: "CO", en: "CO", ru: "CO", de: "CO" },
  coHigh: { lv: "paaugst. apgr.", en: "high idle", ru: "повыш. обороты", de: "erhöhte Drehzahl" },
  hc: { lv: "HC", en: "HC", ru: "HC", de: "HC" },
  lambda: { lv: "Lambda", en: "Lambda", ru: "Лямбда", de: "Lambda" },
  smoke: { lv: "Dūmainība", en: "Smoke opacity", ru: "Дымность", de: "Trübung" },
  particles: { lv: "Daļiņas", en: "Particle number", ru: "Число частиц", de: "Partikelanzahl" },
  ta: { lv: "TA", en: "Inspection", ru: "Техосмотр", de: "HU" },
  taTitle: {
    lv: "TA defektu analīze",
    en: "Inspection defect analysis",
    ru: "Анализ дефектов техосмотра",
    de: "HU-Mängelanalyse",
  },
  taCount: { lv: "Apskates LV", en: "Inspections in Latvia", ru: "Техосмотры в Латвии", de: "Prüfungen in Lettland" },
  taFailed: { lv: "Ar vērtējumu 2 / 3", en: "Rated 2 / 3", ru: "С оценкой 2 / 3", de: "Bewertung 2 / 3" },
  taReinspections: { lv: "Atkārtotās pārbaudes", en: "Re-inspections", ru: "Повторные проверки", de: "Nachprüfungen" },
  taRepeated: { lv: "Atkārtoti defekti", en: "Repeated defects", ru: "Повторяющиеся дефекты", de: "Wiederkehrende Mängel" },
  taNodes: { lv: "{n} mezgli", en: "{n} areas", ru: "узлов: {n}", de: "{n} Baugruppen" },
  taNode1: { lv: "1 mezgls", en: "1 area", ru: "узлов: 1", de: "1 Baugruppe" },
  taNodeCol: { lv: "Mezgls (kodi)", en: "Area (codes)", ru: "Узел (коды)", de: "Baugruppe (Codes)" },
  taYearsCol: { lv: "Gadi", en: "Years", ru: "Лет", de: "Jahre" },
  taLatest: { lv: "Pēdējais {d}", en: "Latest {d}", ru: "Последний {d}", de: "Zuletzt {d}" },
  taNotes: { lv: "TA piezīmes", en: "Inspection notes", ru: "Примечания техосмотра", de: "HU-Bemerkungen" },
  legend1: { lv: "pieļaujams", en: "minor", ru: "допустимый", de: "geringfügig" },
  legend2: {
    lv: "labojams mēneša laikā",
    en: "to be fixed within a month",
    ru: "устранить в течение месяца",
    de: "binnen eines Monats zu beheben",
  },
  legend3: { lv: "braukšanai nederīgs", en: "not roadworthy", ru: "эксплуатация запрещена", de: "nicht verkehrssicher" },
  legend0: { lv: "nav defekta", en: "no defect", ru: "нет дефекта", de: "kein Mangel" },
} satisfies Record<string, Tx>;

export function csddBlokiT(key: keyof typeof CSDD_BLOKI_TX, lang: ClientReportLang, vars: Record<string, string | number> = {}): string {
  const e = CSDD_BLOKI_TX[key] as Tx;
  return fill(e[lang] || e.lv, vars);
}

/** Avota atsauce «e.csdd, DD.MM.YYYY» (bez datuma - «e.csdd»). */
export function csddSourceRef(infoDate: string): string {
  return infoDate ? `e.csdd, ${infoDate}` : "e.csdd";
}

/* -------------------------------------------------------------------------- */
/* Brīdinājumi                                                                 */
/* -------------------------------------------------------------------------- */

export type CsddWarningTone = "alert" | "warn";

export type CsddWarning = {
  id: "registration" | "octa" | "roadTax" | "powerOfAttorney" | "tradeRegister" | "restrictions" | "csng" | "taRating3";
  tone: CsddWarningTone;
  label: string;
  value: string;
  note: string;
};

const W = {
  registration: { lv: "Reģistrācija", en: "Registration", ru: "Регистрация", de: "Zulassung" },
  removed: { lv: "Noņemts no uzskaites", en: "Deregistered", ru: "Снят с учёта", de: "Abgemeldet" },
  permitExpired: {
    lv: "Atļauja beigusies {d}",
    en: "Road permit expired {d}",
    ru: "Допуск к движению истёк {d}",
    de: "Fahrerlaubnis abgelaufen {d}",
  },
  removedAllowedUntil: {
    lv: "Noņemts no uzskaites, atļauts piedalīties ceļu satiksmē līdz {d}",
    en: "Deregistered, allowed on public roads until {d}",
    ru: "Снят с учёта, допуск к дорожному движению до {d}",
    de: "Abgemeldet, Teilnahme am Straßenverkehr erlaubt bis {d}",
  },
  allowedUntil: {
    lv: "Atļauts piedalīties ceļu satiksmē līdz {d}",
    en: "Allowed on public roads until {d}",
    ru: "Допуск к дорожному движению до {d}",
    de: "Teilnahme am Straßenverkehr erlaubt bis {d}",
  },
  permitNoDate: {
    lv: "Atļaujas termiņš e.csdd nav norādīts",
    en: "No permit end date in e.csdd",
    ru: "Срок допуска в e.csdd не указан",
    de: "Kein Fristende in e.csdd angegeben",
  },
  octa: { lv: "OCTA", en: "Motor liability (OCTA)", ru: "ОСАГО (OCTA)", de: "Kfz-Haftpflicht (OCTA)" },
  octaNone: {
    lv: "Nav spēkā esošas OCTA",
    en: "No valid policy",
    ru: "Нет действующего полиса",
    de: "Keine gültige Police",
  },
  octaNoneNote: {
    lv: "Civiltiesiskā apdrošināšana: nav",
    en: "Motor liability insurance: none",
    ru: "Страхование гражданской ответственности: нет",
    de: "Haftpflichtversicherung: keine",
  },
  octaExpired: { lv: "Polise beigusies {d}", en: "Policy expired {d}", ru: "Полис истёк {d}", de: "Police abgelaufen {d}" },
  octaShort: { lv: "Polise {n} dienas", en: "Policy for {n} days", ru: "Полис на {n} дн.", de: "Police für {n} Tage" },
  octaEnds: { lv: "Polise beidzas {d}", en: "Policy ends {d}", ru: "Полис заканчивается {d}", de: "Police endet {d}" },
  octaDaysLeft: { lv: "Atlikušas {n} dienas", en: "{n} days left", ru: "Осталось дней: {n}", de: "Noch {n} Tage" },
  roadTax: {
    lv: "Transporta nodoklis",
    en: "Vehicle operation tax",
    ru: "Налог на эксплуатацию ТС",
    de: "Kfz-Betriebssteuer",
  },
  roadTaxUnpaidYear: { lv: "Par {y} nav samaksāts", en: "Not paid for {y}", ru: "За {y} не уплачен", de: "Für {y} nicht bezahlt" },
  roadTaxUnpaid: {
    lv: "Par tekošo gadu nav samaksāts",
    en: "Not paid for the current year",
    ru: "За текущий год не уплачен",
    de: "Für das laufende Jahr nicht bezahlt",
  },
  roadTaxRate: { lv: "Gada likme {eur}", en: "Annual rate {eur}", ru: "Годовая ставка {eur}", de: "Jahressatz {eur}" },
  poa: { lv: "Pilnvara", en: "Power of attorney", ru: "Доверенность", de: "Vollmacht" },
  poaValue: {
    lv: "Izsniegta pilnvara atsavināt",
    en: "Power of attorney to dispose issued",
    ru: "Выдана доверенность на отчуждение",
    de: "Veräußerungsvollmacht erteilt",
  },
  poaNote: {
    lv: "Atsavināt TL citai personai, {d}",
    en: "Transfer of the vehicle to another person, {d}",
    ru: "Отчуждение ТС другому лицу, {d}",
    de: "Übertragung des Fahrzeugs an eine andere Person, {d}",
  },
  trade: { lv: "Tirdzniecības reģistrs", en: "Trade register", ru: "Торговый реестр", de: "Händlerregister" },
  tradeValue: {
    lv: "Ievietots tirdzniecības reģistrā",
    en: "Listed in the CSDD trade register",
    ru: "Внесён в торговый реестр CSDD",
    de: "Im CSDD-Händlerregister eingetragen",
  },
  restrictionsValue: { lv: "Ir aizliegumi", en: "Restrictions recorded", ru: "Есть запреты", de: "Verbote eingetragen" },
  csng: { lv: "Būtiski bojājumi (CSNg)", en: "Major damage (CSNg)", ru: "Существенные повреждения (CSNg)", de: "Erhebliche Schäden (CSNg)" },
  csngValue: { lv: "Ir CSNg atzīmes", en: "CSNg records present", ru: "Есть отметки CSNg", de: "CSNg-Einträge vorhanden" },
  taHistory: { lv: "TA vēsture", en: "Inspection history", ru: "История техосмотров", de: "HU-Historie" },
  taRating3: { lv: "Vērtējums 3 - {d}", en: "Rating 3 - {d}", ru: "Оценка 3 - {d}", de: "Bewertung 3 - {d}" },
  taRating3Note: {
    lv: "{n} no {m} apskatēm ar vērtējumu 3",
    en: "{n} of {m} inspections rated 3",
    ru: "{n} из {m} техосмотров с оценкой 3",
    de: "{n} von {m} Prüfungen mit Bewertung 3",
  },
} satisfies Record<string, Tx>;

function w(key: keyof typeof W, lang: ClientReportLang, vars: Record<string, string | number> = {}): string {
  return fill((W[key] as Tx)[lang] || W[key].lv, vars);
}

function annualTaxRateEur(raw: string, lang: ClientReportLang): string {
  const m = normalizeCsddRawText(raw).match(/([\d\s]+[.,]\d{2})\s*EUR\s*-?\s*uz\s+gadu/i);
  if (!m?.[1]) return "";
  const n = Number.parseFloat(m[1].replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n)) return "";
  return `${formatNum(n.toFixed(2), lang)} €`;
}

/** Brīdinājumu kartītes: sarkans - reģistrācija/OCTA nav/nodoklis/aizliegumi/CSNg/TA 3; dzeltens - īsa OCTA, tirdzniecības reģistrs, pilnvara. */
export function buildCsddWarnings(
  csdd: CsddFormFields | null | undefined,
  lang: ClientReportLang = "lv",
  nowMs: number = Date.now(),
): CsddWarning[] {
  if (!csdd || !(csdd.rawUnprocessedData ?? "").trim()) return [];
  const s = parseCsddRegistrySignals(csdd, nowMs);
  const out: CsddWarning[] = [];

  if (s.status.removedFromRegister) {
    const d = s.status.allowedUntil;
    if (d && s.status.permitExpired) {
      out.push({
        id: "registration",
        tone: "alert",
        label: w("registration", lang),
        value: w("permitExpired", lang, { d }),
        note: w("removedAllowedUntil", lang, { d }),
      });
    } else {
      out.push({
        id: "registration",
        tone: "alert",
        label: w("registration", lang),
        value: w("removed", lang),
        note: d ? w("allowedUntil", lang, { d }) : w("permitNoDate", lang),
      });
    }
  }

  if (s.octa.state === "none") {
    out.push({ id: "octa", tone: "alert", label: w("octa", lang), value: w("octaNone", lang), note: w("octaNoneNote", lang) });
  } else if (s.octa.state === "policy" && s.octa.daysLeft != null) {
    if (s.octa.daysLeft < 0) {
      out.push({ id: "octa", tone: "alert", label: w("octa", lang), value: w("octaExpired", lang, { d: s.octa.validUntil }), note: "" });
    } else if (s.octa.termDays != null && s.octa.termDays <= 31) {
      out.push({
        id: "octa",
        tone: "warn",
        label: w("octa", lang),
        value: w("octaShort", lang, { n: s.octa.termDays }),
        note: `${s.octa.validFrom}-${s.octa.validUntil}`,
      });
    } else if (s.octa.daysLeft < 30) {
      out.push({
        id: "octa",
        tone: "warn",
        label: w("octa", lang),
        value: w("octaEnds", lang, { d: s.octa.validUntil }),
        note: w("octaDaysLeft", lang, { n: s.octa.daysLeft }),
      });
    }
  }

  if (s.roadTax.state === "unpaid") {
    const y = s.infoDate.slice(6);
    const rate = annualTaxRateEur(csdd.rawUnprocessedData, lang);
    out.push({
      id: "roadTax",
      tone: "alert",
      label: w("roadTax", lang),
      value: y ? w("roadTaxUnpaidYear", lang, { y }) : w("roadTaxUnpaid", lang),
      note: rate ? w("roadTaxRate", lang, { eur: rate }) : "",
    });
  }

  if (s.restrictions.state === "present") {
    out.push({ id: "restrictions", tone: "alert", label: csddBlokiT("restrictions", lang), value: w("restrictionsValue", lang), note: s.restrictions.text });
  }
  const csngTexts = [s.csngPolice, s.csngInsurers].filter((x) => x.state === "present").map((x) => x.text);
  if (csngTexts.length > 0) {
    out.push({ id: "csng", tone: "alert", label: w("csng", lang), value: w("csngValue", lang), note: csngTexts.join("; ") });
  }

  const ta = buildCsddTaAnalysis(csdd);
  if (ta.rating3Count > 0 && ta.lastRating3Date) {
    out.push({
      id: "taRating3",
      tone: "alert",
      label: w("taHistory", lang),
      value: w("taRating3", lang, { d: ta.lastRating3Date }),
      note: w("taRating3Note", lang, { n: ta.rating3Count, m: ta.inspectionCount }),
    });
  }

  if (s.tradeRegisterListed) {
    out.push({ id: "tradeRegister", tone: "warn", label: w("trade", lang), value: w("tradeValue", lang), note: "" });
  }
  if (s.powerOfAttorney) {
    const d = s.powerOfAttorney.match(/\d{2}\.\d{2}\.\d{4}/)?.[0] ?? "";
    out.push({
      id: "powerOfAttorney",
      tone: "warn",
      label: w("poa", lang),
      value: w("poaValue", lang),
      note: d ? w("poaNote", lang, { d }) : "",
    });
  }

  // Sarkanie pirmie, tad dzeltenie (stabila secība grupas iekšienē).
  return [...out.filter((x) => x.tone === "alert"), ...out.filter((x) => x.tone === "warn")];
}

/* -------------------------------------------------------------------------- */
/* Aizliegumi + CSNg                                                           */
/* -------------------------------------------------------------------------- */

export type CsddRestrictionRow = { key: "restrictions" | "csngPolice" | "csngInsurers"; state: CsddSectionState; text: string };

export type CsddRestrictionsBlock = {
  infoDate: string;
  /** Visas trīs sadaļas tekstā nav. */
  allMissing: boolean;
  rows: CsddRestrictionRow[];
};

export function buildCsddRestrictionsBlock(signals: CsddRegistrySignals): CsddRestrictionsBlock {
  const rows: CsddRestrictionRow[] = [
    { key: "restrictions", ...signals.restrictions },
    { key: "csngPolice", ...signals.csngPolice },
    { key: "csngInsurers", ...signals.csngInsurers },
  ];
  return { infoDate: signals.infoDate, allMissing: rows.every((r) => r.state === "not_checked"), rows };
}

/* -------------------------------------------------------------------------- */
/* Tehniskie mērījumi                                                          */
/* -------------------------------------------------------------------------- */

export type CsddBrakeRow = { axle: string; left: string; right: string; diffPct: number | null; type: string };

export type CsddMeasurements = {
  /** Pēdējās TA datums (DD.MM.YYYY), pie kura mērījumi; tukšs, ja nav. */
  taDate: string;
  co2: string;
  /** „WLTP” / „NEDC” / tukšs. */
  co2Cycle: string;
  consumption: string;
  consumptionCycle: string;
  consumptionCity: string;
  euro: string;
  co: string;
  coHigh: string;
  hc: string;
  lambda: string;
  smoke: string;
  particles: string;
  brakes: CsddBrakeRow[];
};

function firstMatch(text: string, re: RegExp): RegExpMatchArray | null {
  return text.match(re);
}

function cleanNum(raw: string | undefined): string {
  return String(raw ?? "").trim().replace(/[.,]$/, "");
}

export function parseCsddBrakes(text: string): CsddBrakeRow[] {
  const start = text.search(/Bremžu\s+vērtējums/i);
  if (start < 0) return [];
  const out: CsddBrakeRow[] = [];
  for (const line of text.slice(start).split("\n").slice(1, 14)) {
    const t = line.trim();
    if (!t || /^Ass\b/i.test(t)) {
      if (!t && out.length > 0) break;
      continue;
    }
    const m = t.match(/^(\d)\s+([\d.,]+)\s+([\d.,]+)\s+([A-ZĀ-Ž]{1,3})$/u);
    if (!m) break;
    const l = Number.parseFloat(m[2]!.replace(",", "."));
    const r = Number.parseFloat(m[3]!.replace(",", "."));
    const max = Math.max(l, r);
    out.push({
      axle: m[1]!,
      left: m[2]!,
      right: m[3]!,
      diffPct: Number.isFinite(l) && Number.isFinite(r) && max > 0 ? Math.round((Math.abs(l - r) / max) * 100) : null,
      type: m[4]!,
    });
  }
  return out;
}

/** Brīdinājuma slieksnis bremžu starpībai vienas ass ietvaros (CSDD defekts 1.2.1 - virs 30 %). */
export const CSDD_BRAKE_DIFF_WARN_PCT = 30;

export function parseCsddMeasurements(csdd: Pick<CsddFormFields, "rawUnprocessedData" | "emissionStandard" | "prevInspectionBlock" | "prevInspectionDate" | "technicalInspectionHistory">): CsddMeasurements {
  const text = normalizeCsddRawText(csdd.rawUnprocessedData ?? "");
  const co2 = firstMatch(text, /(?:^|\n)\s*CO2(?:\s+(WLTP|NEDC))?\s*:\s*([\d.,]+)/i);
  const cons = firstMatch(text, /Degviela\s?s\s+patēriņš(?:\s+(WLTP|NEDC))?\s*:\s*([\d.,]+)/i);
  const city = firstMatch(text, /patēriņš\s+pie\s+maza\s+ātruma[^:\n]*:\s*([\d.,]+)/i);
  const co = firstMatch(text, /(?:^|\n)\s*CO\s*\(%\)\s*:\s*([\d.,]+)/i);
  const coHigh = firstMatch(text, /CO\s+paaugst\.?\s*\(%\)\s*:\s*([\d.,]+)/i);
  const hc = firstMatch(text, /HC\s*\(ppm\)\s*:\s*([\d.,]+)/i);
  const lambda = firstMatch(text, /Lambda\s*:\s*([\d.,]+)/i);
  const euro = String(csdd.emissionStandard ?? "").trim() || (firstMatch(text, /Emisiju\s+standarts\s*:\s*([^\n]+)/i)?.[1] ?? "").trim();

  const prev = csdd.prevInspectionBlock;
  const firstRowWithSmoke = (csdd.technicalInspectionHistory ?? []).find((r) => r.smokeCoefficient.trim());
  const smoke = (prev?.smokeCoefficient ?? "").trim() || (firstRowWithSmoke?.smokeCoefficient ?? "").trim();
  const particles = (prev?.particleNumber ?? "").trim();

  const iso = String(csdd.prevInspectionDate ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const taDate = iso ? `${iso[3]}.${iso[2]}.${iso[1]}` : (prev?.inspectionDateText ?? "").trim();

  return {
    taDate,
    co2: cleanNum(co2?.[2]),
    co2Cycle: (co2?.[1] ?? "").toUpperCase(),
    consumption: cleanNum(cons?.[2]),
    consumptionCycle: (cons?.[1] ?? "").toUpperCase(),
    consumptionCity: cleanNum(city?.[1]),
    euro,
    co: cleanNum(co?.[1]),
    coHigh: cleanNum(coHigh?.[1]),
    hc: cleanNum(hc?.[1]),
    lambda: cleanNum(lambda?.[1]),
    smoke,
    particles,
    brakes: parseCsddBrakes(text),
  };
}

export function csddMeasurementsHasData(m: CsddMeasurements): boolean {
  return Boolean(
    m.co2 || m.consumption || m.consumptionCity || m.euro || m.co || m.coHigh || m.hc || m.lambda || m.smoke || m.particles || m.brakes.length,
  );
}

/** Decimāldaļas atdalītājs pēc valodas (EN - punkts, pārējās - komats). */
export function formatNum(raw: string, lang: ClientReportLang): string {
  const t = raw.trim();
  if (!t) return "";
  return lang === "en" ? t.replace(",", ".") : t.replace(/(\d)\.(\d)/, "$1,$2");
}

/* -------------------------------------------------------------------------- */
/* TA defektu analīze                                                          */
/* -------------------------------------------------------------------------- */

/** ES Direktīvas 2014/45/ES I pielikuma mezgli (koda pirmie divi līmeņi). */
const NODE_LABELS: Record<string, Tx> = {
  "0.1": { lv: "Numura zīmes", en: "Number plates", ru: "Номерные знаки", de: "Kennzeichen" },
  "0.2": { lv: "VIN", en: "VIN", ru: "VIN", de: "FIN" },
  "1.1": { lv: "Bremžu mehānisms", en: "Brake components", ru: "Тормозные механизмы", de: "Bremsanlage, Bauteile" },
  "1.2": { lv: "Darba bremze", en: "Service brake", ru: "Рабочий тормоз", de: "Betriebsbremse" },
  "1.3": { lv: "Rezerves bremze", en: "Secondary brake", ru: "Запасной тормоз", de: "Hilfsbremse" },
  "1.4": { lv: "Stāvbremze", en: "Parking brake", ru: "Стояночный тормоз", de: "Feststellbremse" },
  "1.5": { lv: "Palēninātājs", en: "Retarder", ru: "Замедлитель", de: "Dauerbremse" },
  "1.6": { lv: "ABS", en: "ABS", ru: "ABS", de: "ABS" },
  "1.7": { lv: "EBS", en: "EBS", ru: "EBS", de: "EBS" },
  "1.8": { lv: "Bremžu šķidrums", en: "Brake fluid", ru: "Тормозная жидкость", de: "Bremsflüssigkeit" },
  "2.1": { lv: "Stūres mehānisms", en: "Steering gear", ru: "Рулевой механизм", de: "Lenkung" },
  "2.2": { lv: "Stūres rats", en: "Steering wheel", ru: "Рулевое колесо", de: "Lenkrad" },
  "2.3": { lv: "Stūres brīvkustība", en: "Steering play", ru: "Люфт рулевого управления", de: "Lenkungsspiel" },
  "2.4": { lv: "Riteņu iestatījums", en: "Wheel alignment", ru: "Развал-схождение", de: "Spureinstellung" },
  "2.6": { lv: "Stūres pastiprinātājs", en: "Power steering", ru: "Усилитель руля", de: "Servolenkung" },
  "3.1": { lv: "Redzamības lauks", en: "Field of vision", ru: "Обзорность", de: "Sichtfeld" },
  "3.2": { lv: "Stikli", en: "Glazing", ru: "Стёкла", de: "Scheiben" },
  "3.3": { lv: "Spoguļi", en: "Mirrors", ru: "Зеркала", de: "Spiegel" },
  "3.4": { lv: "Stikla tīrītāji", en: "Wipers", ru: "Стеклоочистители", de: "Scheibenwischer" },
  "3.5": { lv: "Stikla mazgātāji", en: "Washers", ru: "Омыватели", de: "Scheibenwaschanlage" },
  "4.1": { lv: "Tuvās/tālās gaismas", en: "Headlamps", ru: "Фары", de: "Scheinwerfer" },
  "4.2": { lv: "Gabarītlukturi", en: "Position lamps", ru: "Габаритные огни", de: "Begrenzungsleuchten" },
  "4.3": { lv: "Bremžu signāli", en: "Stop lamps", ru: "Стоп-сигналы", de: "Bremsleuchten" },
  "4.4": { lv: "Pagrieziena rādītāji", en: "Direction indicators", ru: "Указатели поворота", de: "Fahrtrichtungsanzeiger" },
  "4.5": { lv: "Miglas lukturi", en: "Fog lamps", ru: "Противотуманные фары", de: "Nebelscheinwerfer" },
  "4.6": { lv: "Atpakaļgaitas lukturi", en: "Reversing lamps", ru: "Фонари заднего хода", de: "Rückfahrscheinwerfer" },
  "4.7": { lv: "Numura apgaismojums", en: "Plate lamp", ru: "Подсветка номера", de: "Kennzeichenbeleuchtung" },
  "4.8": { lv: "Atstarotāji", en: "Reflectors", ru: "Световозвращатели", de: "Rückstrahler" },
  "4.9": { lv: "Kontrollampas", en: "Tell-tales", ru: "Контрольные лампы", de: "Kontrollleuchten" },
  "4.11": { lv: "Elektroinstalācija", en: "Wiring", ru: "Электропроводка", de: "Elektrische Leitungen" },
  "4.13": { lv: "Akumulators", en: "Battery", ru: "Аккумулятор", de: "Batterie" },
  "5.1": { lv: "Asis, rumbas, gultņi", en: "Axles, hubs, bearings", ru: "Оси, ступицы, подшипники", de: "Achsen, Naben, Lager" },
  "5.2": { lv: "Riteņi un riepas", en: "Wheels and tyres", ru: "Колёса и шины", de: "Räder und Reifen" },
  "5.3": { lv: "Balstiekārta", en: "Suspension", ru: "Подвеска", de: "Radaufhängung" },
  "6.1": { lv: "Rāmis, virsbūves pamatne", en: "Chassis and underbody", ru: "Рама, днище", de: "Rahmen, Unterboden" },
  "6.2": { lv: "Kabīne un virsbūve", en: "Cab and body", ru: "Кабина и кузов", de: "Fahrerhaus und Aufbau" },
  "7.1": { lv: "Drošības jostas, SRS", en: "Seat belts, SRS", ru: "Ремни безопасности, SRS", de: "Sicherheitsgurte, SRS" },
  "7.3": { lv: "Slēdzenes", en: "Locks", ru: "Замки", de: "Schlösser" },
  "7.7": { lv: "Skaņas signāls", en: "Horn", ru: "Звуковой сигнал", de: "Hupe" },
  "7.8": { lv: "Spidometrs", en: "Speedometer", ru: "Спидометр", de: "Tachometer" },
  "7.11": { lv: "Odometrs", en: "Odometer", ru: "Одометр", de: "Kilometerzähler" },
  "7.12": { lv: "ESC", en: "ESC", ru: "ESC", de: "ESC" },
  "8.1": { lv: "Troksnis", en: "Noise", ru: "Шум", de: "Geräusch" },
  "8.2": { lv: "Izplūdes gāzes", en: "Exhaust emissions", ru: "Выхлопные газы", de: "Abgasemissionen" },
  "8.4": { lv: "Šķidrumu noplūde", en: "Fluid leaks", ru: "Утечки жидкостей", de: "Flüssigkeitsverluste" },
};

export function csddDefectNodeLabel(node: string, lang: ClientReportLang): string {
  const e = NODE_LABELS[node];
  return e ? e[lang] || e.lv : node;
}

function nodeOf(code: string): string {
  const parts = code.trim().replace(/\.+$/, "").split(".").filter(Boolean);
  if (parts.length >= 2 && parts.every((p) => /^\d+$/.test(p))) return `${parts[0]}.${parts[1]}`;
  return /^\d{3}$/.test(code.trim()) ? code.trim() : "";
}

function yearOf(date: string): number | null {
  const m = date.trim().match(/(\d{4})$/);
  return m ? Number(m[1]) : null;
}

export type CsddTaNodeRow = {
  node: string;
  codes: string[];
  /** Gads -> sliktākais vērtējums šajā mezglā (0 = apskate bija, defekta mezglā nav). */
  byYear: Record<number, 0 | 1 | 2 | 3>;
  yearCount: number;
  latestDate: string;
  latestText: string;
};

export type CsddTaNote = { text: string; dates: string[] };

export type CsddTaAnalysis = {
  inspectionCount: number;
  rating2Count: number;
  rating3Count: number;
  lastRating3Date: string;
  reinspectionCount: number;
  years: number[];
  /** Mezgli, kas atkārtojas vismaz 2 dažādos gados. */
  repeated: CsddTaNodeRow[];
  notes: CsddTaNote[];
};

export const CSDD_TA_REPEAT_MIN_YEARS = 2;

function dedupeRows(rows: readonly CsddTechnicalInspectionRow[]): CsddTechnicalInspectionRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const d = r.date.trim();
    const key = `${d}|${r.inspectionType.trim().toLowerCase()}`;
    if (!d || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function buildCsddTaAnalysis(
  csdd: Pick<CsddFormFields, "technicalInspectionHistory" | "prevInspectionBlock">,
): CsddTaAnalysis {
  const rows = dedupeRows(csdd.technicalInspectionHistory ?? []);
  let rating2Count = 0;
  let rating3Count = 0;
  let lastRating3Date = "";
  let reinspectionCount = 0;
  const yearsSet = new Set<number>();
  const nodes = new Map<string, CsddTaNodeRow>();
  const notes = new Map<string, string[]>();

  const addNote = (text: string, date: string) => {
    const t = text.replace(/\s+/g, " ").trim();
    if (!t || !date) return;
    const arr = notes.get(t) ?? [];
    if (!arr.includes(date)) arr.push(date);
    notes.set(t, arr);
  };

  for (const r of rows) {
    const sev = effectiveInspectionSeverity(r);
    if (sev === 2) rating2Count += 1;
    if (sev === 3) {
      rating3Count += 1;
      if (!lastRating3Date) lastRating3Date = r.date.trim();
    }
    if (/atkārtot/i.test(r.inspectionType)) reinspectionCount += 1;
    addNote(r.notes, r.date.trim());
    const y = yearOf(r.date);
    if (y == null) continue;
    yearsSet.add(y);
    for (const d of r.defects ?? []) {
      const node = nodeOf(d.code);
      if (!node) continue;
      const lvl = Number.parseInt(d.rating, 10);
      const level = (lvl === 1 || lvl === 2 || lvl === 3 ? lvl : 0) as 0 | 1 | 2 | 3;
      const e = nodes.get(node) ?? { node, codes: [], byYear: {}, yearCount: 0, latestDate: "", latestText: "" };
      const code = d.code.trim().replace(/\.+$/, "");
      if (code && !e.codes.includes(code)) e.codes.push(code);
      e.byYear[y] = Math.max(e.byYear[y] ?? 0, level) as 0 | 1 | 2 | 3;
      // Rindas ir jaunākā augšā - pirmais sastaptais ir jaunākais.
      if (!e.latestDate && d.description.trim()) {
        e.latestDate = r.date.trim();
        e.latestText = d.description.replace(/\s+/g, " ").trim();
      }
      nodes.set(node, e);
    }
  }
  // Iepriekšējās apskates piezīmes (vecais formāts tās dod tikai šeit).
  const prev = csdd.prevInspectionBlock;
  if (prev?.notes?.trim()) addNote(prev.notes, (prev.inspectionDateText ?? "").trim() || rows[0]?.date.trim() || "");

  const years = [...yearsSet].sort((a, b) => a - b);
  const repeated = [...nodes.values()]
    .map((e) => {
      for (const y of years) if (e.byYear[y] == null && rowsHaveYear(rows, y)) e.byYear[y] = 0;
      const yearCount = Object.values(e.byYear).filter((v) => v > 0).length;

      return { ...e, codes: [...e.codes].sort(), yearCount };
    })
    .filter((e) => e.yearCount >= CSDD_TA_REPEAT_MIN_YEARS)
    .sort((a, b) => b.yearCount - a.yearCount || a.node.localeCompare(b.node, undefined, { numeric: true }));

  return {
    inspectionCount: rows.length,
    rating2Count,
    rating3Count,
    lastRating3Date,
    reinspectionCount,
    years,
    repeated,
    notes: [...notes.entries()].map(([text, dates]) => ({ text, dates })).slice(0, 5),
  };
}

function rowsHaveYear(rows: readonly CsddTechnicalInspectionRow[], y: number): boolean {
  return rows.some((r) => yearOf(r.date) === y);
}

/* -------------------------------------------------------------------------- */
/* Viss kopā                                                                   */
/* -------------------------------------------------------------------------- */

export type CsddBloki = {
  hasRaw: boolean;
  infoDate: string;
  warnings: CsddWarning[];
  restrictions: CsddRestrictionsBlock;
  measurements: CsddMeasurements;
  ta: CsddTaAnalysis;
};

export function buildCsddBloki(
  csdd: CsddFormFields | null | undefined,
  lang: ClientReportLang = "lv",
  nowMs: number = Date.now(),
): CsddBloki | null {
  if (!csdd || !(csdd.rawUnprocessedData ?? "").trim()) return null;
  const signals = parseCsddRegistrySignals(csdd, nowMs);
  return {
    hasRaw: true,
    infoDate: signals.infoDate,
    warnings: buildCsddWarnings(csdd, lang, nowMs),
    restrictions: buildCsddRestrictionsBlock(signals),
    measurements: parseCsddMeasurements(csdd),
    ta: buildCsddTaAnalysis(csdd),
  };
}
