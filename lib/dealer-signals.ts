/**
 * Dīlera PDF «Signāli ārpus dīlera datiem» (Nils 27.11): teksti, valodas, stāvokļa loģika un audita saite.
 * Bez skaitļiem, datumiem un km; bez avotu nosaukumiem, bez verdikta. Viens ieraksts uz signāla tipu.
 * Tīrs modulis (der klienta komponentei, PDF un testiem).
 */

import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  DEALER_SIGNAL_KINDS,
  DEALER_SIGNAL_TEXT_MAX,
  DEALER_SIGNAL_TONES,
  type DealerSignalItem,
  type DealerSignalKind,
  type DealerSignalsState,
  type DealerSignalTone,
} from "@/lib/dealer-signals-persist";

export {
  DEALER_SIGNAL_KINDS,
  DEALER_SIGNAL_TONES,
  type DealerSignalTone,
  type DealerSignalItem,
  type DealerSignalKind,
  type DealerSignalsState,
} from "@/lib/dealer-signals-persist";

type L4 = Record<ClientReportLang, string>;

export const DEALER_SIGNALS_SECTION_TITLE: L4 = {
  lv: "Signāli ārpus dīlera datiem",
  en: "Signals beyond dealer data",
  ru: "Сигналы вне данных дилера",
  de: "Signale außerhalb der Händlerdaten",
};

export const DEALER_SIGNAL_TITLES: Record<DealerSignalKind, L4> = {
  mileage_mismatch: {
    lv: "Nobraukuma nesakritība",
    en: "Mileage mismatch",
    ru: "Несоответствие пробега",
    de: "Abweichung beim Kilometerstand",
  },
  special_status: {
    lv: "Īpašs statuss",
    en: "Special status",
    ru: "Особый статус",
    de: "Sonderstatus",
  },
  incidents: {
    lv: "Negadījumu un bojājumu ieraksti",
    en: "Accident and damage records",
    ru: "Записи о происшествиях и повреждениях",
    de: "Unfall- und Schadenseinträge",
  },
  us_history: {
    lv: "ASV vēsture",
    en: "US history",
    ru: "История в США",
    de: "US-Historie",
  },
  auction_photos: {
    lv: "Izsoļu fotogrāfijas",
    en: "Auction photos",
    ru: "Фотографии с аукционов",
    de: "Auktionsfotos",
  },
  archive_photos: {
    lv: "Arhīva fotogrāfijas",
    en: "Archive photos",
    ru: "Архивные фотографии",
    de: "Archivfotos",
  },
  foreign_registry: {
    lv: "Citas valsts reģistra dati",
    en: "Foreign registry data",
    ru: "Данные реестра другой страны",
    de: "Registerdaten aus einem anderen Land",
  },
  extra_history: {
    lv: "Papildu vēstures ieraksti",
    en: "Additional history records",
    ru: "Дополнительные записи истории",
    de: "Zusätzliche Historieneinträge",
  },
};

export const DEALER_SIGNAL_DEFAULT_TEXTS: Record<DealerSignalKind, L4> = {
  mileage_mismatch: {
    lv: "Iespējama odometra korekcija",
    en: "Possible odometer correction",
    ru: "Возможна корректировка одометра",
    de: "Mögliche Korrektur des Kilometerzählers",
  },
  special_status: {
    lv: "Vēsturē ir ieraksts par totālo bojāeju vai īpašu statusu",
    en: "The history includes a total loss or special status record",
    ru: "В истории есть запись о полной гибели или особом статусе",
    de: "Die Historie enthält einen Eintrag zu Totalschaden oder Sonderstatus",
  },
  incidents: {
    lv: "Par šo auto pieejami negadījumu vai bojājumu ieraksti",
    en: "Accident or damage records are available for this car",
    ru: "По этому автомобилю доступны записи о происшествиях или повреждениях",
    de: "Für dieses Fahrzeug liegen Unfall- oder Schadenseinträge vor",
  },
  us_history: {
    lv: "Auto vēsturē ir ieraksti no ASV",
    en: "The car's history includes records from the USA",
    ru: "В истории автомобиля есть записи из США",
    de: "Die Fahrzeughistorie enthält Einträge aus den USA",
  },
  auction_photos: {
    lv: "Pieejamas izsoļu fotogrāfijas",
    en: "Auction photos are available",
    ru: "Доступны фотографии с аукционов",
    de: "Auktionsfotos sind verfügbar",
  },
  archive_photos: {
    lv: "Pieejamas vēsturiskas fotogrāfijas (piem. bojājumi, izsoles, sludinājumi)",
    en: "Historical photos are available (e.g. damage, auctions, listings)",
    ru: "Доступны исторические фотографии (например, повреждения, аукционы, объявления)",
    de: "Historische Fotos sind verfügbar (z. B. Schäden, Auktionen, Inserate)",
  },
  foreign_registry: {
    lv: "Pieejami citas valsts reģistra dati",
    en: "Registry data from another country is available",
    ru: "Доступны данные реестра другой страны",
    de: "Registerdaten aus einem anderen Land sind verfügbar",
  },
  extra_history: {
    lv: "Citos avotos pieejami papildu vēstures ieraksti",
    en: "Additional history records are available from other sources",
    ru: "В других источниках доступны дополнительные записи истории",
    de: "In anderen Quellen sind zusätzliche Historieneinträge verfügbar",
  },
};

/** 1. lapas žetonu rinda (Nils 28.11, makets B): norāde uz pilno sadaļu. */
export const DEALER_SIGNALS_HERO_MORE: L4 = {
  lv: "Sīkāk sadaļā «Signāli ārpus dīlera datiem»",
  en: "Details in the section “Signals beyond dealer data”",
  ru: "Подробнее в разделе «Сигналы вне данных дилера»",
  de: "Details im Abschnitt „Signale außerhalb der Händlerdaten“",
};

/** Sarkanā rinda (kā PDF sarkanie brīdinājumi). */
export const DEALER_SIGNAL_ALERT_KINDS: ReadonlySet<DealerSignalKind> = new Set<DealerSignalKind>([
  "mileage_mismatch",
  "special_status",
]);

export function isDealerSignalAlert(kind: DealerSignalKind): boolean {
  return DEALER_SIGNAL_ALERT_KINDS.has(kind);
}

/** Oranžā rinda pēc noklusējuma (Nils 27.11: maksas priekšskatu arhīva foto). */
export const DEALER_SIGNAL_ORANGE_KINDS: ReadonlySet<DealerSignalKind> = new Set<DealerSignalKind>(["archive_photos"]);

/** Noklusētā krāsa pēc tipa (vecie ieraksti bez `tone`). */
export function dealerSignalDefaultTone(kind: DealerSignalKind): DealerSignalTone {
  if (isDealerSignalAlert(kind)) return "red";
  return DEALER_SIGNAL_ORANGE_KINDS.has(kind) ? "orange" : "neutral";
}

/** Krāsa: admina izvēlētā vai noklusējums pēc tipa. */
export function dealerSignalTone(item: Pick<DealerSignalItem, "kind" | "tone">): DealerSignalTone {
  return item.tone && (DEALER_SIGNAL_TONES as readonly string[]).includes(item.tone) ? item.tone : dealerSignalDefaultTone(item.kind);
}

/** Admina krāsu izvēles nosaukumi (LV). */
export const DEALER_SIGNAL_TONE_LABEL_LV: Record<DealerSignalTone, string> = {
  red: "Sarkans",
  orange: "Oranžs",
  neutral: "Parasts",
};

/** Maina krāsu; noklusējuma krāsa -> lauks noņemts (vecie ieraksti paliek tīri). */
export function setDealerSignalTone(state: DealerSignalsState, kind: DealerSignalKind, tone: DealerSignalTone): DealerSignalsState {
  let changed = false;
  const items = state.items.map((it) => {
    if (it.kind !== kind || dealerSignalTone(it) === tone) return it;
    changed = true;
    const next: DealerSignalItem = { ...it };
    if (tone === dealerSignalDefaultTone(kind)) delete next.tone;
    else next.tone = tone;
    return next;
  });
  return changed ? { ...state, items } : state;
}

/** Admin rindas īsais tips (latviski). */
export const DEALER_SIGNAL_ADMIN_KIND_LV: Record<DealerSignalKind, string> = {
  mileage_mismatch: "Nobraukums",
  special_status: "Statuss",
  incidents: "Negadījumi",
  us_history: "ASV",
  auction_photos: "Foto",
  archive_photos: "Arhīva foto",
  foreign_registry: "Reģistrs",
  extra_history: "Vēsture",
};

/** Klusā audita saite. */
export const DEALER_SIGNALS_AUDIT_LINK_LABEL: L4 = {
  lv: "Pasūtīt PROVIN AUDITU",
  en: "Order PROVIN AUDITS",
  ru: "Заказать PROVIN AUDITS",
  de: "PROVIN AUDITS bestellen",
};

/**
 * Nils 28.11 (makets B): PDF signālu sadaļas apakšā maza pelēka info rinda; saite tikai uz vārda `link`.
 * Bez cenas. E-pastus/WhatsApp neietekmē.
 */
export const DEALER_SIGNALS_AUDIT_INFO: Record<ClientReportLang, { lead: string; link: string }> = {
  lv: { lead: "Detalizētu pārbaudi piedāvā PROVIN AUDITS - ", link: "pasūtīt" },
  en: { lead: "A detailed check is available with PROVIN AUDITS - ", link: "order" },
  ru: { lead: "Детальную проверку предлагает PROVIN AUDITS - ", link: "заказать" },
  de: { lead: "Eine detaillierte Prüfung bietet PROVIN AUDITS - ", link: "bestellen" },
};

/** Viena nemainīga e-pasta rinda (tikai, ja sadaļa ieslēgta). */
export const DEALER_SIGNALS_EMAIL_LINE: L4 = {
  lv: "Atskaitē ir sadaļa ar papildu signāliem - ieteicams iepazīties.",
  en: "The report includes a section with additional signals - we recommend reviewing it.",
  ru: "В отчёте есть раздел с дополнительными сигналами - рекомендуем ознакомиться.",
  de: "Der Bericht enthält einen Abschnitt mit zusätzlichen Signalen - wir empfehlen, ihn zu lesen.",
};

const DIGIT_RE = /\d/;

/**
 * Avotu nosaukumi (Nila likums: klientam tikai datu tipi, ne avoti). Labotā tekstā vai tulkojumā -> standarta teksts.
 */
const SOURCE_NAME_RE =
  /autodna|carfax|car\s*vertical|e\.?csdd|csdd|thecarapi|the\s*car\s*api|ltab|copart|iaai|bid\.?cars|checkcar|tjekbil|mnt\.ee|lkf\.ee|car\.?info|oneauto|one\s*auto|joj|carstat|speckr|outvin|traficom|nummerplade|car-?pass|auchistory|autobid|openlane|adesa|auto1|mobile\.de|ecarstrade|stat\.vin|kfzgutachten/i;

/** Admina teksts derīgs tikai bez cipariem (Nila likums: nekādu skaitļu, datumu, km) un bez avotu nosaukumiem. */
export function isDealerSignalTextAllowed(text: string): boolean {
  return !DIGIT_RE.test(text) && !SOURCE_NAME_RE.test(text);
}

export function tidyDealerSignalText(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DEALER_SIGNAL_TEXT_MAX);
}

const tidyText = tidyDealerSignalText;

/** Admina labotais teksts (derīgs, atšķiras no LV standarta) vai `null`. */
export function dealerSignalCustomText(item: Pick<DealerSignalItem, "kind" | "text">): string | null {
  const custom = tidyText(item.text ?? "");
  if (!custom || !isDealerSignalTextAllowed(custom)) return null;
  if (custom === DEALER_SIGNAL_DEFAULT_TEXTS[item.kind].lv) return null;
  return custom;
}

/** Saglabātais tulkojums (tas, ko admins redzēja priekšskatā), ja tas atbilst pašreizējam tekstam. */
export function dealerSignalStoredTranslation(
  item: Pick<DealerSignalItem, "kind" | "text" | "tr">,
  lang: ClientReportLang,
): string | null {
  if (lang === "lv") return null;
  const custom = dealerSignalCustomText(item);
  const tr = item.tr?.[lang];
  if (!custom || !tr || tr.src !== custom) return null;
  const text = tidyText(tr.text);
  return text && isDealerSignalTextAllowed(text) ? text : null;
}

/**
 * PDF secinājums (Nils 27.11): LV - admina labotais teksts (bez cipariem un avotiem);
 * EN/RU/DE - tā AI tulkojums (saglabātais no priekšskata vai `translated` no PDF tulkošanas).
 * Nav tulkojuma / tulkojumā cipari vai avots -> standarta teksts klienta valodā (nekad latviski).
 */
export function dealerSignalText(
  item: Pick<DealerSignalItem, "kind" | "text" | "tr">,
  lang: ClientReportLang,
  translated?: string | null,
): string {
  const custom = dealerSignalCustomText(item);
  if (!custom) return DEALER_SIGNAL_DEFAULT_TEXTS[item.kind][lang];
  if (lang === "lv") return custom;
  const stored = dealerSignalStoredTranslation(item, lang);
  if (stored) return stored;
  const fresh = tidyText(translated ?? "");
  if (fresh && fresh !== custom && isDealerSignalTextAllowed(fresh)) return fresh;
  return DEALER_SIGNAL_DEFAULT_TEXTS[item.kind][lang];
}

/** Tulkojamie teksti: ķeksētie signāli ar admina labotu tekstu (`kind` -> LV teksts). */
export function dealerSignalsTextsToTranslate(
  state: DealerSignalsState | null | undefined,
): Partial<Record<DealerSignalKind, string>> {
  const out: Partial<Record<DealerSignalKind, string>> = {};
  if (!state || state.enabled !== true) return out;
  for (const it of state.items) {
    if (!it.checked) continue;
    const custom = dealerSignalCustomText(it);
    if (custom) out[it.kind] = custom;
  }
  return out;
}

/** Tulkojums, kas vēl nav saglabāts šai valodai (priekšskatam jāpieprasa). */
export function dealerSignalsMissingTranslations(
  state: DealerSignalsState | null | undefined,
  lang: ClientReportLang,
): Partial<Record<DealerSignalKind, string>> {
  if (lang === "lv" || !state) return {};
  const all = dealerSignalsTextsToTranslate(state);
  const out: Partial<Record<DealerSignalKind, string>> = {};
  for (const it of state.items) {
    const src = all[it.kind];
    if (src && !dealerSignalStoredTranslation(it, lang)) out[it.kind] = src;
  }
  return out;
}

/** Saglabā tulkojumus stāvoklī (tikai tiem tipiem, kuru teksts joprojām ir tas pats `src`). */
export function withDealerSignalTranslations(
  state: DealerSignalsState,
  lang: ClientReportLang,
  translated: Partial<Record<DealerSignalKind, { src: string; text: string }>>,
): DealerSignalsState {
  if (lang === "lv") return state;
  let changed = false;
  const items = state.items.map((it) => {
    const t = translated[it.kind];
    const custom = dealerSignalCustomText(it);
    if (!t || !custom || t.src !== custom) return it;
    const text = tidyText(t.text);
    if (!text) return it;
    if (it.tr?.[lang]?.src === custom && it.tr?.[lang]?.text === text) return it;
    changed = true;
    return { ...it, tr: { ...(it.tr ?? {}), [lang]: { src: custom, text } } };
  });
  return changed ? { ...state, items } : state;
}

/** Noklusējums: izslēgts, bez signāliem. */
export function emptyDealerSignalsState(): DealerSignalsState {
  return { enabled: false, items: [] };
}

/**
 * Izsoļu foto un arhīva foto klientam ir viena doma: ja abi sarakstā un tieši viens ir manuāls,
 * automātiski atrasto nepievieno (admina rinda to jau saka). Abi manuāli - paliek abi (admina izvēle).
 */
function withoutPhotoDuplicate(items: DealerSignalItem[]): DealerSignalItem[] {
  const a = items.find((i) => i.kind === "auction_photos");
  const b = items.find((i) => i.kind === "archive_photos");
  if (!a || !b || Boolean(a.manual) === Boolean(b.manual)) return items;
  const drop = a.manual ? b : a;
  return items.filter((i) => i !== drop);
}

/**
 * «Pārģenerēt no datiem»: atrastie tipi (ķeksēti), esošie ķekši un labotie teksti paliek tiem tipiem,
 * kas joprojām ir datos. Slēdzis «Ir PDF» netiek mainīts (nekad neieslēdzas automātiski).
 */
export function regenerateDealerSignals(
  current: DealerSignalsState | null | undefined,
  detected: readonly DealerSignalKind[],
  opts: { keepEdits?: boolean } = {},
): DealerSignalsState {
  const keep = opts.keepEdits !== false;
  const prev = new Map((current?.items ?? []).map((i) => [i.kind, i]));
  const found = new Set(detected);
  const items: DealerSignalItem[] = [];
  for (const kind of DEALER_SIGNAL_KINDS) {
    const p = prev.get(kind);
    // Manuāli pievienotie paliek ar admina ķeksi un tekstu arī pēc «Pārģenerēt no datiem».
    if (p?.manual) {
      items.push({ ...p, kind });
      continue;
    }
    if (!found.has(kind)) continue;
    const kept = keep ? p : undefined;
    // Admina izvēlētā krāsa paliek arī atiestatot (Nils 27.11).
    items.push(kept ? { ...kept, kind } : { kind, checked: true, ...(p?.tone ? { tone: p.tone } : {}) });
  }
  return { enabled: current?.enabled === true, items: withoutPhotoDuplicate(items) };
}

/** Tipi, ko var pievienot manuāli (vēl nav sarakstā - viens ieraksts uz tipu). */
export function dealerSignalsAddableKinds(state: DealerSignalsState | null | undefined): DealerSignalKind[] {
  const have = new Set((state?.items ?? []).map((i) => i.kind));
  return DEALER_SIGNAL_KINDS.filter((k) => !have.has(k));
}

/**
 * «+ Pievienot signālu» (Nils 27.11): standarta teksts, ķeksis ieslēgts, atzīme `manual`.
 * Ja tips jau ir (automātisks vai manuāls) - stāvoklis nemainās. Slēdzis «Ir PDF» netiek mainīts.
 */
export function addManualDealerSignal(state: DealerSignalsState | null | undefined, kind: DealerSignalKind): DealerSignalsState {
  const base = state ?? emptyDealerSignalsState();
  if (base.items.some((i) => i.kind === kind)) return base;
  const byKind = new Map(base.items.map((i) => [i.kind, i]));
  byKind.set(kind, { kind, checked: true, manual: true });
  return { ...base, items: DEALER_SIGNAL_KINDS.filter((k) => byKind.has(k)).map((k) => byKind.get(k)!) };
}

/** Noņem signālu (izmanto manuāli pievienotajiem). */
export function removeDealerSignal(state: DealerSignalsState, kind: DealerSignalKind): DealerSignalsState {
  if (!state.items.some((i) => i.kind === kind)) return state;
  return { ...state, items: state.items.filter((i) => i.kind !== kind) };
}

export type DealerSignalPdfRow = {
  kind: DealerSignalKind;
  title: string;
  text: string;
  /** `tone === "red"` (saderībai). */
  alert: boolean;
  tone: DealerSignalTone;
};

/** PDF rindas: tikai ieslēgts + ķeksēts; viens uz tipu. Tukšs -> sadaļas nav. */
export function dealerSignalsPdfRows(
  state: DealerSignalsState | null | undefined,
  lang: ClientReportLang,
  translated?: Partial<Record<DealerSignalKind, string>> | null,
): DealerSignalPdfRow[] {
  if (!state || state.enabled !== true) return [];
  const seen = new Set<DealerSignalKind>();
  const out: DealerSignalPdfRow[] = [];
  for (const kind of DEALER_SIGNAL_KINDS) {
    const item = state.items.find((i) => i.kind === kind && i.checked);
    if (!item || seen.has(kind)) continue;
    seen.add(kind);
    const tone = dealerSignalTone(item);
    out.push({ kind, title: DEALER_SIGNAL_TITLES[kind][lang], text: dealerSignalText(item, lang, translated?.[kind]), alert: tone === "red", tone });
  }
  return out;
}

/** Vai sadaļa būs PDF (ieslēgta un ir vismaz viens ķeksēts signāls). */
export function dealerSignalsSectionOn(state: DealerSignalsState | null | undefined): boolean {
  return dealerSignalsPdfRows(state, "lv").length > 0;
}

/** Audita saite PDF beigās: BF laikā ar cenu «- 79,99 €», ārpus BF bez cenas. */
export type DealerSignalsAuditLink = {
  url: string;
  priceLabel?: string | null;
  /**
   * `true` - saite uz izveidoto dīlera -> AUDITS piedāvājumu (tikai sūtīšanas brīdī, Nils 27.11);
   * `false` - sūtot mēģināts, bet piedāvājumu nevar izveidot (piem. jau apmaksāts); nav - ģenerēts bez sūtīšanas.
   */
  offer?: boolean;
};

/** Sūtīšanas brīdī: PDF ar «Signāli» sadaļu, bet bez piedāvājuma saites -> jāizveido piedāvājums un PDF jāpārveido. */
export function dealerSignalsPdfNeedsOffer(link: DealerSignalsAuditLink | null | undefined): boolean {
  return Boolean(link && link.offer === undefined);
}

export function dealerSignalsAuditLinkLabel(lang: ClientReportLang, link: DealerSignalsAuditLink): string {
  const base = DEALER_SIGNALS_AUDIT_LINK_LABEL[lang];
  const price = (link.priceLabel ?? "").trim();
  return price ? `${base} - ${price}` : base;
}

/** Rezerves saite (ja upsell piedāvājumu nevar izveidot): AUDITS ar VIN, klienta valodā. */
export function dealerSignalsFallbackAuditUrl(vin: string | null | undefined, lang: ClientReportLang): string {
  const q = new URLSearchParams({ plan: "audits" });
  const v = (vin ?? "").trim().toUpperCase();
  if (v) q.set("vin", v);
  return `https://www.provin.lv/${lang}?${q.toString()}`;
}

/** E-pasta teksts: viena rinda pēc ievada rindkopas (pirms paraksta). Atkārtoti nepievieno. */
export function withDealerSignalsEmailLine(text: string, lang: ClientReportLang): string {
  const line = DEALER_SIGNALS_EMAIL_LINE[lang];
  if (!text.trim() || text.includes(line)) return text;
  const paras = text.split(/\n{2,}/);
  const at = paras.length >= 3 ? 2 : paras.length;
  paras.splice(at, 0, line);
  return paras.join("\n\n");
}

/**
 * Audita saite no esošā dīlera -> AUDITS piedāvājuma (`/api/admin/order-upsell`).
 * Cena tikai BF laikā un tikai BF piemaksai (79,99 €); citādi bez cenas.
 */
export function dealerSignalsAuditLinkFromOffer(
  offer: { url?: string | null; chargeCents?: number | null } | null | undefined,
  opts: { vin?: string | null; lang: ClientReportLang; nowMs: number; bfWindow: (nowMs: number) => boolean; bfChargeCents: number },
): DealerSignalsAuditLink {
  const url = (offer?.url ?? "").trim();
  if (!/^https:\/\//.test(url)) return { url: dealerSignalsFallbackAuditUrl(opts.vin, opts.lang) };
  const bf = offer?.chargeCents === opts.bfChargeCents && opts.bfWindow(opts.nowMs);
  return bf ? { url, priceLabel: formatEurCents(opts.bfChargeCents), offer: true } : { url, offer: true };
}

function formatEurCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

/**
 * «Datu nav (atmaksa)» (Nils 28.11): dīlera dati nav pieejami, PDF netiek sūtīts - ieslēgtie un ķeksētie
 * signāli nonāk pašā ziņā (e-pasts / WhatsApp) klienta valodā. Tie paši teksti kā PDF sadaļā.
 */
export const DEALER_SIGNALS_NO_DATA_INTRO: L4 = {
  lv: "Lai gan dīlera dati nav pieejami, citos datos par šo auto redzami šādi signāli:",
  en: "Although dealer data is not available, other data for this car shows the following signals:",
  ru: "Хотя данные дилера недоступны, в других данных по этому автомобилю видны следующие сигналы:",
  de: "Obwohl keine Händlerdaten verfügbar sind, zeigen andere Daten zu diesem Fahrzeug folgende Signale:",
};

/** Signālu bloks ziņas tekstam (ievads + rinda katram signālam). Nav signālu -> tukšs. */
export function dealerSignalsMessageBlock(
  state: DealerSignalsState | null | undefined,
  lang: ClientReportLang,
  translated?: Partial<Record<DealerSignalKind, string>> | null,
): string {
  const rows = dealerSignalsPdfRows(state, lang, translated);
  if (rows.length === 0) return "";
  return [DEALER_SIGNALS_NO_DATA_INTRO[lang], ...rows.map((r) => `- ${r.title}: ${r.text}`)].join("\n");
}

/**
 * Ievieto signālu bloku ziņā: pirms PROVIN AUDITA ieteikuma rindkopas (veidne labojama adminā),
 * citādi pirms pēdējām divām rindkopām (jautājums + paraksts). Atkārtoti nepievieno.
 */
export function withDealerSignalsMessageBlock(text: string, block: string): string {
  const b = block.trim();
  if (!b || !text.trim() || text.includes(b)) return text;
  const paras = text.split(/\n{2,}/);
  let at = paras.findIndex((p, i) => i > 0 && /PROVIN\s+AUDIT/i.test(p));
  if (at < 0) at = Math.max(paras.length >= 3 ? paras.length - 2 : paras.length, 0);
  paras.splice(at, 0, b);
  return paras.join("\n\n");
}
