/**
 * C4 (Nils 06.11 „jā”): maksājuma un atmaksas e-pasti klienta valodā.
 * Latviski paliek rediģējamās veidnes (/admin/teksti); šeit tikai EN/RU/DE.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { clientMessageSignOff } from "@/lib/email/report-ready-copy";
import { provinEmailSubject } from "@/lib/email/email-subject";
import { decideOrderClientLang, type ClientLangSignals } from "@/lib/client-lang-detect";

export { checkoutSessionSiteLang } from "@/lib/checkout-session-site-lang";

/** Stripe session.locale / pasūtījuma valoda -> e-pasta valoda (nezināma = lv). */
export function resolveClientEmailLang(raw: string | null | undefined): ClientReportLang {
  // Stripe «auto» (pārlūka valoda) nekad nenosaka e-pasta valodu.
  const t = (raw ?? "").trim().toLowerCase().slice(0, 2);
  return t === "en" || t === "ru" || t === "de" ? t : "lv";
}

/**
 * Pasūtījuma klienta valoda e-pastiem bez savas valodas izvēles (upsell, izsoļu arhīvs, maka atmaksa):
 * 1) B2B maka pirkumā partnera izvēlētā atskaites valoda (`report_lang=` piezīmēs),
 * 2) admina izvēle (`override`), 3) EN/DE vietne + Latvijas signāli -> LV,
 * 4) Stripe `session.locale` (vietnes valoda pasūtot), 5) citādi LV. Sk. `decideOrderClientLang`.
 */
export function resolveOrderClientLang(args: {
  notes?: string | null;
  locale?: string | null;
  override?: string | null;
  signals?: ClientLangSignals | null;
}): ClientReportLang {
  return decideOrderClientLang(args).lang;
}

type ForeignLang = Exclude<ClientReportLang, "lv">;

const PAYMENT: Record<ForeignLang, { event: string; greeting: string; lead: string; amount: string; invoice: string; cta: string; title: string }> = {
  en: {
    event: "Payment received",
    title: "Thank you for your order",
    greeting: "Hello!",
    lead: "Thank you for your order. We have received your payment.",
    amount: "Amount",
    invoice: "The PDF invoice is attached to this email. You can also download it here:",
    cta: "Download invoice (PDF)",
  },
  ru: {
    event: "Оплата получена",
    title: "Спасибо за заказ",
    greeting: "Здравствуйте!",
    lead: "Спасибо за заказ. Мы получили вашу оплату.",
    amount: "Сумма",
    invoice: "Счёт в формате PDF приложен к этому письму. Его также можно скачать здесь:",
    cta: "Скачать счёт (PDF)",
  },
  de: {
    event: "Zahlung erhalten",
    title: "Vielen Dank für Ihre Bestellung",
    greeting: "Guten Tag!",
    lead: "Vielen Dank für Ihre Bestellung. Wir haben Ihre Zahlung erhalten.",
    amount: "Betrag",
    invoice: "Die PDF-Rechnung ist dieser E-Mail beigefügt. Sie können sie auch hier herunterladen:",
    cta: "Rechnung herunterladen (PDF)",
  },
};

export function paymentConfirmationCopy(
  lang: ForeignLang,
  opts: { amountLine: string; vin?: string | null; invoiceUrl: string },
): { subject: string; text: string; title: string; lead: string; amountLabel: string; invoiceLine: string; cta: string } {
  const c = PAYMENT[lang];
  return {
    subject: provinEmailSubject(c.event, { vin: opts.vin }),
    text: [c.greeting, "", c.lead, "", `${c.amount}: ${opts.amountLine}`, "", `${c.invoice} ${opts.invoiceUrl}`, "", clientMessageSignOff(lang)].join("\n"),
    title: c.title,
    lead: c.lead,
    amountLabel: c.amount,
    invoiceLine: c.invoice,
    cta: c.cta,
  };
}

const REFUND: Record<ForeignLang, { noDataEvent: string; cancelledEvent: string; greeting: string; noData: string; cancelled: (a: string) => string; amount: (a: string) => string; bank: string; questions: string }> = {
  en: {
    noDataEvent: "Dealer data not available, money refunded",
    cancelledEvent: "Order cancelled, money refunded",
    greeting: "Hello!",
    noData: "Unfortunately, official dealer data is not available for this vehicle.",
    cancelled: (a) => `We have cancelled your official dealer data order and refunded ${a} in full to the card you paid with.`,
    amount: (a) => `Amount: ${a} (refunded in full to the same card).`,
    bank: "Depending on your bank, the money usually appears in your account within 1-7 days, often on the same day.",
    questions: "If you have any questions, simply reply to this email.",
  },
  ru: {
    noDataEvent: "Данные дилера недоступны, деньги возвращены",
    cancelledEvent: "Заказ отменён, деньги возвращены",
    greeting: "Здравствуйте!",
    noData: "К сожалению, официальные данные дилера для этого автомобиля недоступны.",
    cancelled: (a) => `Мы отменили ваш заказ официальных данных дилера и вернули ${a} в полном объёме на карту, которой вы платили.`,
    amount: (a) => `Сумма: ${a} (возвращена в полном объёме на ту же карту).`,
    bank: "В зависимости от банка деньги обычно поступают на счёт в течение 1-7 дней, часто в тот же день.",
    questions: "Если у Вас есть вопросы, просто ответьте на это письмо.",
  },
  de: {
    noDataEvent: "Händlerdaten nicht verfügbar, Geld erstattet",
    cancelledEvent: "Bestellung storniert, Geld erstattet",
    greeting: "Guten Tag!",
    noData: "Leider sind für dieses Fahrzeug keine offiziellen Händlerdaten verfügbar.",
    cancelled: (a) => `Wir haben Ihre Bestellung der offiziellen Händlerdaten storniert und ${a} vollständig auf die verwendete Karte erstattet.`,
    amount: (a) => `Betrag: ${a} (vollständig auf dieselbe Karte erstattet).`,
    bank: "Je nach Bank erscheint das Geld in der Regel innerhalb von 1-7 Tagen auf Ihrem Konto, oft noch am selben Tag.",
    questions: "Bei Fragen antworten Sie einfach auf diese E-Mail.",
  },
};

export function dealerRefundEmailCopy(
  lang: ForeignLang,
  opts: { cancelled: boolean; amount: string; vin?: string | null },
): { subject: string; text: string } {
  const c = REFUND[lang];
  const body = opts.cancelled ? [c.cancelled(opts.amount)] : [c.noData, "", c.amount(opts.amount)];
  return {
    subject: provinEmailSubject(opts.cancelled ? c.cancelledEvent : c.noDataEvent, { vin: opts.vin }),
    text: [c.greeting, "", ...body, "", c.bank, "", c.questions, "", clientMessageSignOff(lang)].join("\n"),
  };
}
