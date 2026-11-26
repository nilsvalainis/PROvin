/**
 * Papildinājuma (upsell) lapa /{lang}/papildinajums/[token] un Stripe teksti klienta valodā (Nils 26.11).
 * E-pasta / WhatsApp teksti nāk no `localized-templates.ts` (#1241). Tīrs modulis.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import type { OrderUpsellKind } from "@/lib/order-upsell";

export function normalizeUpsellLang(raw: unknown): ClientReportLang {
  const t = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 2) : "";
  return t === "en" || t === "ru" || t === "de" ? t : "lv";
}

export type UpsellPageCopy = {
  title: string;
  replacedTitle: string;
  replacedBody: string;
  paidTitle: string;
  paidBody: string;
  processingTitle: string;
  processingBody: string;
  expiredTitle: string;
  /** [pirms saites, pēc saites] - saite «provin.lv» starpā. */
  expiredBody: [string, string];
  title2: string;
  lead: string;
  confirmTo: (email: string) => string;
  alreadyPaid: string;
  now: string;
  total: string;
  pay: (amount: string) => string;
  opening: string;
  errOpen: string;
  errNetwork: string;
  productDealer: string;
  productAudit: string;
  stripeDescription: string;
};

const LV: UpsellPageCopy = {
  title: "PROVIN papildinājums",
  replacedTitle: "Šī saite ir nomainīta",
  replacedBody: "Palūdziet jaunu apmaksas saiti, rakstot uz info@provin.lv.",
  paidTitle: "Papildu apmaksa saņemta",
  paidBody: "Pasūtījums tiek papildināts. Sagatavošana aizņem līdz 48 stundām. Jau nosūtītie materiāli paliek spēkā.",
  processingTitle: "Maksājums tiek apstrādāts",
  processingBody: "Tiklīdz maksājums būs apstiprināts, pasūtījums tiks papildināts. Ja maksājumu neveicāt, atveriet saiti vēlreiz.",
  expiredTitle: "Piedāvājuma termiņš ir beidzies",
  expiredBody: ["Šī saite vairs nav derīga. Jaunu pasūtījumu var izveidot vietnē ", "."],
  title2: "Papildināt esošo pasūtījumu",
  lead: "Šī apmaksa papildina jau esošo pasūtījumu. Jaunu pasūtījumu neveido.",
  confirmTo: (e) => ` Apstiprinājums aizies uz ${e}.`,
  alreadyPaid: "Jau samaksāts",
  now: "Tagad",
  total: "Kopā",
  pay: (a) => `Apmaksāt ${a}`,
  opening: "Atver…",
  errOpen: "Apmaksas saiti šobrīd neizdevās atvērt. Uzrakstiet uz info@provin.lv.",
  errNetwork: "Tīkla kļūda. Mēģiniet vēlreiz.",
  productDealer: "Oficiālā dīlera dati (papildinājums)",
  productAudit: "PROVIN AUDITS papildinājums",
  stripeDescription: "Papildinājums jau apmaksātam pasūtījumam.",
};

const EN: UpsellPageCopy = {
  title: "PROVIN upgrade",
  replacedTitle: "This link has been replaced",
  replacedBody: "Please ask for a new payment link by writing to info@provin.lv.",
  paidTitle: "Additional payment received",
  paidBody: "Your order is being upgraded. Preparation takes up to 48 hours. Materials already sent remain valid.",
  processingTitle: "Payment is being processed",
  processingBody: "As soon as the payment is confirmed, your order will be upgraded. If you did not pay, please open the link again.",
  expiredTitle: "This offer has expired",
  expiredBody: ["This link is no longer valid. You can place a new order at ", "."],
  title2: "Upgrade your existing order",
  lead: "This payment upgrades your existing order. No new order is created.",
  confirmTo: (e) => ` The confirmation will be sent to ${e}.`,
  alreadyPaid: "Already paid",
  now: "Now",
  total: "Total",
  pay: (a) => `Pay ${a}`,
  opening: "Opening…",
  errOpen: "The payment link could not be opened right now. Please write to info@provin.lv.",
  errNetwork: "Network error. Please try again.",
  productDealer: "Official dealer data (upgrade)",
  productAudit: "PROVIN AUDITS upgrade",
  stripeDescription: "Upgrade of an order already paid.",
};

const RU: UpsellPageCopy = {
  title: "PROVIN дополнение",
  replacedTitle: "Эта ссылка заменена",
  replacedBody: "Запросите новую ссылку на оплату, написав на info@provin.lv.",
  paidTitle: "Доплата получена",
  paidBody: "Заказ дополняется. Подготовка занимает до 48 часов. Уже отправленные материалы остаются в силе.",
  processingTitle: "Платёж обрабатывается",
  processingBody: "Как только платёж будет подтверждён, заказ будет дополнен. Если вы не оплатили, откройте ссылку ещё раз.",
  expiredTitle: "Срок предложения истёк",
  expiredBody: ["Эта ссылка больше не действительна. Новый заказ можно оформить на сайте ", "."],
  title2: "Дополнить существующий заказ",
  lead: "Эта оплата дополняет уже существующий заказ. Новый заказ не создаётся.",
  confirmTo: (e) => ` Подтверждение придёт на ${e}.`,
  alreadyPaid: "Уже оплачено",
  now: "Сейчас",
  total: "Итого",
  pay: (a) => `Оплатить ${a}`,
  opening: "Открываем…",
  errOpen: "Не удалось открыть ссылку на оплату. Напишите на info@provin.lv.",
  errNetwork: "Ошибка сети. Попробуйте снова.",
  productDealer: "Данные официального дилера (дополнение)",
  productAudit: "Дополнение PROVIN AUDITS",
  stripeDescription: "Дополнение к уже оплаченному заказу.",
};

const DE: UpsellPageCopy = {
  title: "PROVIN Erweiterung",
  replacedTitle: "Dieser Link wurde ersetzt",
  replacedBody: "Bitte fordern Sie einen neuen Zahlungslink unter info@provin.lv an.",
  paidTitle: "Zusatzzahlung erhalten",
  paidBody: "Ihre Bestellung wird erweitert. Die Vorbereitung dauert bis zu 48 Stunden. Bereits gesendete Unterlagen bleiben gültig.",
  processingTitle: "Zahlung wird verarbeitet",
  processingBody: "Sobald die Zahlung bestätigt ist, wird Ihre Bestellung erweitert. Wenn Sie nicht bezahlt haben, öffnen Sie den Link erneut.",
  expiredTitle: "Das Angebot ist abgelaufen",
  expiredBody: ["Dieser Link ist nicht mehr gültig. Eine neue Bestellung können Sie auf ", " aufgeben."],
  title2: "Bestehende Bestellung erweitern",
  lead: "Diese Zahlung erweitert Ihre bestehende Bestellung. Es wird keine neue Bestellung erstellt.",
  confirmTo: (e) => ` Die Bestätigung geht an ${e}.`,
  alreadyPaid: "Bereits bezahlt",
  now: "Jetzt",
  total: "Gesamt",
  pay: (a) => `${a} bezahlen`,
  opening: "Wird geöffnet…",
  errOpen: "Der Zahlungslink konnte gerade nicht geöffnet werden. Bitte schreiben Sie an info@provin.lv.",
  errNetwork: "Netzwerkfehler. Bitte versuchen Sie es erneut.",
  productDealer: "Offizielle Händlerdaten (Erweiterung)",
  productAudit: "PROVIN AUDITS Erweiterung",
  stripeDescription: "Erweiterung einer bereits bezahlten Bestellung.",
};

const COPY: Record<ClientReportLang, UpsellPageCopy> = { lv: LV, en: EN, ru: RU, de: DE };

export function upsellPageCopy(lang: unknown): UpsellPageCopy {
  return COPY[normalizeUpsellLang(lang)];
}

export function upsellStripeProductNameFor(kind: OrderUpsellKind, lang: unknown): string {
  const c = upsellPageCopy(lang);
  return kind === "mini_to_dealer" ? c.productDealer : c.productAudit;
}
