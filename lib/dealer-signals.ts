/**
 * Dīlera PDF «Signāli ārpus dīlera datiem» (Nils 27.11): teksti, valodas, stāvokļa loģika un audita saite.
 * Bez skaitļiem, datumiem un km; bez avotu nosaukumiem, bez verdikta. Viens ieraksts uz signāla tipu.
 * Tīrs modulis (der klienta komponentei, PDF un testiem).
 */

import type { ClientReportLang } from "@/lib/client-report-i18n";
import {
  DEALER_SIGNAL_KINDS,
  DEALER_SIGNAL_TEXT_MAX,
  type DealerSignalItem,
  type DealerSignalKind,
  type DealerSignalsState,
} from "@/lib/dealer-signals-persist";

export {
  DEALER_SIGNAL_KINDS,
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
  incidents: {
    lv: "Negadījumu ieraksti",
    en: "Accident records",
    ru: "Записи о происшествиях",
    de: "Unfalleinträge",
  },
  auction_photos: {
    lv: "Izsoļu fotogrāfijas",
    en: "Auction photos",
    ru: "Фотографии с аукционов",
    de: "Auktionsfotos",
  },
  foreign_registry: {
    lv: "Citas valsts reģistra dati",
    en: "Foreign registry data",
    ru: "Данные реестра другой страны",
    de: "Registerdaten aus einem anderen Land",
  },
};

export const DEALER_SIGNAL_DEFAULT_TEXTS: Record<DealerSignalKind, L4> = {
  mileage_mismatch: {
    lv: "Iespējama odometra korekcija",
    en: "Possible odometer correction",
    ru: "Возможна корректировка одометра",
    de: "Mögliche Korrektur des Kilometerzählers",
  },
  incidents: {
    lv: "Par šo auto pieejami negadījumu ieraksti",
    en: "Accident records are available for this car",
    ru: "По этому автомобилю доступны записи о происшествиях",
    de: "Für dieses Fahrzeug liegen Unfalleinträge vor",
  },
  auction_photos: {
    lv: "Pieejamas izsoļu fotogrāfijas",
    en: "Auction photos are available",
    ru: "Доступны фотографии с аукционов",
    de: "Auktionsfotos sind verfügbar",
  },
  foreign_registry: {
    lv: "Pieejami citas valsts reģistra dati",
    en: "Registry data from another country is available",
    ru: "Доступны данные реестра другой страны",
    de: "Registerdaten aus einem anderen Land sind verfügbar",
  },
};

/** Sarkanā rinda (kā PDF sarkanie brīdinājumi). */
export const DEALER_SIGNAL_ALERT_KINDS: ReadonlySet<DealerSignalKind> = new Set<DealerSignalKind>(["mileage_mismatch"]);

export function isDealerSignalAlert(kind: DealerSignalKind): boolean {
  return DEALER_SIGNAL_ALERT_KINDS.has(kind);
}

/** Admin rindas īsais tips (latviski). */
export const DEALER_SIGNAL_ADMIN_KIND_LV: Record<DealerSignalKind, string> = {
  mileage_mismatch: "Nobraukums",
  incidents: "Negadījumi",
  auction_photos: "Foto",
  foreign_registry: "Reģistrs",
};

/** Klusā audita saite. */
export const DEALER_SIGNALS_AUDIT_LINK_LABEL: L4 = {
  lv: "Pasūtīt PROVIN AUDITU",
  en: "Order PROVIN AUDITS",
  ru: "Заказать PROVIN AUDITS",
  de: "PROVIN AUDITS bestellen",
};

/** Viena nemainīga e-pasta rinda (tikai, ja sadaļa ieslēgta). */
export const DEALER_SIGNALS_EMAIL_LINE: L4 = {
  lv: "Atskaitē ir sadaļa ar papildu signāliem - ieteicams iepazīties.",
  en: "The report includes a section with additional signals - we recommend reviewing it.",
  ru: "В отчёте есть раздел с дополнительными сигналами - рекомендуем ознакомиться.",
  de: "Der Bericht enthält einen Abschnitt mit zusätzlichen Signalen - wir empfehlen, ihn zu lesen.",
};

const DIGIT_RE = /\d/;

/** Admina teksts derīgs tikai bez cipariem (Nila likums: nekādu skaitļu, datumu, km). */
export function isDealerSignalTextAllowed(text: string): boolean {
  return !DIGIT_RE.test(text);
}

function tidyText(text: string): string {
  return text
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, DEALER_SIGNAL_TEXT_MAX);
}

/**
 * PDF secinājums: admina labotais teksts tikai LV atskaitē (un tikai bez cipariem);
 * citās valodās vienmēr standarta tulkojums, lai klients nesaņem latviešu tekstu.
 */
export function dealerSignalText(item: Pick<DealerSignalItem, "kind" | "text">, lang: ClientReportLang): string {
  const custom = tidyText(item.text ?? "");
  if (lang === "lv" && custom && isDealerSignalTextAllowed(custom)) return custom;
  return DEALER_SIGNAL_DEFAULT_TEXTS[item.kind][lang];
}

/** Noklusējums: izslēgts, bez signāliem. */
export function emptyDealerSignalsState(): DealerSignalsState {
  return { enabled: false, items: [] };
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
  const items = DEALER_SIGNAL_KINDS.filter((k) => found.has(k)).map((kind): DealerSignalItem => {
    const p = keep ? prev.get(kind) : undefined;
    return p ? { ...p, kind } : { kind, checked: true };
  });
  return { enabled: current?.enabled === true, items };
}

/** PDF rindas: tikai ieslēgts + ķeksēts; viens uz tipu. Tukšs -> sadaļas nav. */
export function dealerSignalsPdfRows(
  state: DealerSignalsState | null | undefined,
  lang: ClientReportLang,
): { kind: DealerSignalKind; title: string; text: string; alert: boolean }[] {
  if (!state || state.enabled !== true) return [];
  const seen = new Set<DealerSignalKind>();
  const out: { kind: DealerSignalKind; title: string; text: string; alert: boolean }[] = [];
  for (const kind of DEALER_SIGNAL_KINDS) {
    const item = state.items.find((i) => i.kind === kind && i.checked);
    if (!item || seen.has(kind)) continue;
    seen.add(kind);
    out.push({ kind, title: DEALER_SIGNAL_TITLES[kind][lang], text: dealerSignalText(item, lang), alert: isDealerSignalAlert(kind) });
  }
  return out;
}

/** Vai sadaļa būs PDF (ieslēgta un ir vismaz viens ķeksēts signāls). */
export function dealerSignalsSectionOn(state: DealerSignalsState | null | undefined): boolean {
  return dealerSignalsPdfRows(state, "lv").length > 0;
}

/** Audita saite PDF beigās: BF laikā ar cenu «- 79,99 €», ārpus BF bez cenas. */
export type DealerSignalsAuditLink = { url: string; priceLabel?: string | null };

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
  return bf ? { url, priceLabel: formatEurCents(opts.bfChargeCents) } : { url };
}

function formatEurCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}
