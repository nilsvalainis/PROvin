import type { ClientReportLang } from "@/lib/client-report-i18n";

/**
 * Klientu e-pastu / WhatsApp šablonu tulkojumi EN / RU / DE (Nils 25.11: «nav tulkojumi, pārbaudi visas valodas»).
 * LV teksts paliek reģistrā (labojams adminā «Šabloni»); šeit - tie paši bloki un mainīgie citās valodās.
 * Ne-LV versijām admina LV pārrakstu NEizmanto (citādi latviešu teksts aizietu vācu klientam).
 *
 * Paraksts: «Nils» paliek tikai privātklientiem; B2B to noņem `applyB2bSignature` (paraksts tikai «PROVIN»).
 */

export type ForeignLang = Exclude<ClientReportLang, "lv">;
export type LocalizedTemplate = { subject?: string; body: string };

const SIGN_GREETING: Record<ForeignLang, string> = {
  en: "Best regards,",
  ru: "С уважением,",
  de: "Mit freundlichen Grüßen",
};

const emailSign = (lang: ForeignLang) => [SIGN_GREETING[lang], "Nils", "{{zimols}}"].join("\n");
const WA_SIGN = "Nils, {{zimols}}";

/* ---------- Dīlera dati: dati gatavi ---------- */

const DEALER_READY_EMAIL: Record<ForeignLang, LocalizedTemplate> = {
  en: {
    subject: "PROVIN · Report ready · Official dealer data{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Hello,",
      "",
      "The official dealer data you ordered{{#vin}} for the vehicle with VIN {{vin}}{{/vin}} is ready - the PDF is attached.",
      "",
      "{{#maksajuma_saite}}",
      "Dealer data only shows what has been recorded at official service centres. If you are considering buying this car, we recommend the full PROVIN AUDIT. Within the same order we will add:",
      "- accident and mileage history from several European databases;",
      "- a check of auction archives (photos, damage, prices);",
      "- an analysis of the listing and the risks - the facts we found and recommendations, including for an in-person inspection, so that you can make your purchase decision with confidence.",
      "",
      "Already paid: {{jau_samaksats}}",
      "Additional payment: {{piemaksa}}",
      "Total: {{kopa}}",
      "",
      "Pay: {{maksajuma_saite}} (the link is valid for 30 days)",
      "",
      "{{/maksajuma_saite}}",
      "If you have any questions, simply reply to this email or write to info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "If our work was useful to you, I would be grateful for a short Google review: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      emailSign("en"),
    ].join("\n"),
  },
  ru: {
    subject: "PROVIN · Отчёт готов · Официальные данные дилера{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Здравствуйте!",
      "",
      "Заказанные Вами официальные данные дилера{{#vin}} по автомобилю с VIN {{vin}}{{/vin}} готовы - PDF во вложении.",
      "",
      "{{#maksajuma_saite}}",
      "Данные дилера показывают только то, что зарегистрировано в официальных сервисах. Если Вы рассматриваете покупку этого автомобиля, рекомендуем полный PROVIN AUDIT. В рамках того же заказа мы добавим:",
      "- историю ДТП и пробега из нескольких европейских баз данных;",
      "- проверку аукционных архивов (фото, повреждения, цены);",
      "- анализ объявления и рисков - выявленные факты и рекомендации, в том числе для личного осмотра, чтобы Вы могли уверенно принять решение о покупке.",
      "",
      "Уже оплачено: {{jau_samaksats}}",
      "Доплата: {{piemaksa}}",
      "Итого: {{kopa}}",
      "",
      "Оплатить: {{maksajuma_saite}} (ссылка действительна 30 дней)",
      "",
      "{{/maksajuma_saite}}",
      "Если у Вас есть вопросы, просто ответьте на это письмо или напишите на info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "Если наша работа была Вам полезна, буду благодарен за короткий отзыв в Google: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      emailSign("ru"),
    ].join("\n"),
  },
  de: {
    subject: "PROVIN · Bericht fertig · Offizielle Händlerdaten{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Guten Tag,",
      "",
      "die von Ihnen bestellten offiziellen Händlerdaten{{#vin}} für das Fahrzeug mit der FIN {{vin}}{{/vin}} sind fertig - das PDF finden Sie im Anhang.",
      "",
      "{{#maksajuma_saite}}",
      "Händlerdaten zeigen nur, was in offiziellen Werkstätten erfasst wurde. Wenn Sie den Kauf dieses Fahrzeugs in Betracht ziehen, empfehlen wir das vollständige PROVIN AUDIT. Im Rahmen derselben Bestellung ergänzen wir:",
      "- die Unfall- und Kilometerstandshistorie aus mehreren europäischen Datenbanken;",
      "- eine Prüfung der Auktionsarchive (Fotos, Schäden, Preise);",
      "- eine Analyse des Inserats und der Risiken - festgestellte Fakten und Empfehlungen, auch für eine Besichtigung vor Ort, damit Sie Ihre Kaufentscheidung sicher treffen können.",
      "",
      "Bereits bezahlt: {{jau_samaksats}}",
      "Zuzahlung: {{piemaksa}}",
      "Gesamt: {{kopa}}",
      "",
      "Bezahlen: {{maksajuma_saite}} (der Link ist 30 Tage gültig)",
      "",
      "{{/maksajuma_saite}}",
      "Bei Fragen antworten Sie einfach auf diese E-Mail oder schreiben Sie an info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "Wenn Ihnen unsere Arbeit geholfen hat, würde ich mich über eine kurze Google-Bewertung freuen: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      emailSign("de"),
    ].join("\n"),
  },
};

const DEALER_READY_WA: Record<ForeignLang, LocalizedTemplate> = {
  en: {
    body: [
      "Hello,",
      "",
      "The official dealer data you ordered{{#vin}} for the vehicle with VIN {{vin}}{{/vin}} is ready - I am attaching the PDF below.",
      "",
      "{{#maksajuma_saite}}",
      "Dealer data only shows official service records. If you are considering the purchase, within the same order we can prepare the full PROVIN AUDIT - accident and mileage history, auction archives and an analysis of the listing and the risks with recommendations for an in-person inspection.",
      "",
      "Additional payment: {{piemaksa}} (total {{kopa}}, already paid {{jau_samaksats}})",
      "Pay: {{maksajuma_saite}}",
      "",
      "{{/maksajuma_saite}}",
      "If you have any questions, write here or to info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "If the data was useful, I would be grateful for a short Google review: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      WA_SIGN,
    ].join("\n"),
  },
  ru: {
    body: [
      "Здравствуйте!",
      "",
      "Заказанные Вами официальные данные дилера{{#vin}} по автомобилю с VIN {{vin}}{{/vin}} готовы - PDF прикладываю ниже.",
      "",
      "{{#maksajuma_saite}}",
      "Данные дилера показывают только записи официальных сервисов. Если Вы рассматриваете покупку, в рамках того же заказа мы можем подготовить полный PROVIN AUDIT - историю ДТП и пробега, аукционные архивы и анализ объявления и рисков с рекомендациями для личного осмотра.",
      "",
      "Доплата: {{piemaksa}} (итого {{kopa}}, уже оплачено {{jau_samaksats}})",
      "Оплатить: {{maksajuma_saite}}",
      "",
      "{{/maksajuma_saite}}",
      "Если у Вас есть вопросы, пишите сюда или на info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "Если данные были полезны, буду благодарен за короткий отзыв в Google: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      WA_SIGN,
    ].join("\n"),
  },
  de: {
    body: [
      "Guten Tag,",
      "",
      "die von Ihnen bestellten offiziellen Händlerdaten{{#vin}} für das Fahrzeug mit der FIN {{vin}}{{/vin}} sind fertig - das PDF sende ich Ihnen unten.",
      "",
      "{{#maksajuma_saite}}",
      "Händlerdaten zeigen nur die Einträge offizieller Werkstätten. Wenn Sie den Kauf in Betracht ziehen, können wir im Rahmen derselben Bestellung das vollständige PROVIN AUDIT erstellen - Unfall- und Kilometerstandshistorie, Auktionsarchive sowie eine Analyse des Inserats und der Risiken mit Empfehlungen für die Besichtigung vor Ort.",
      "",
      "Zuzahlung: {{piemaksa}} (gesamt {{kopa}}, bereits bezahlt {{jau_samaksats}})",
      "Bezahlen: {{maksajuma_saite}}",
      "",
      "{{/maksajuma_saite}}",
      "Bei Fragen schreiben Sie bitte hier oder an info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "Wenn Ihnen die Daten geholfen haben, würde ich mich über eine kurze Google-Bewertung freuen: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      WA_SIGN,
    ].join("\n"),
  },
};

/* ---------- Dīlera dati: datu nav (atmaksa) ---------- */

const REFUND_LINES: Record<ForeignLang, { card: string[]; balance: string }> = {
  en: {
    card: [
      "We have refunded {{summa}} in full to the card you paid with.",
      "Depending on your bank, the money usually appears in your account within 5-10 business days.",
      "On your bank statement the refund may appear not as a new payment but as a cancelled reserved amount.",
    ],
    balance: "We have returned {{summa}} to your PROVIN account balance.",
  },
  ru: {
    card: [
      "Мы вернули {{summa}} в полном объёме на карту, которой Вы оплатили.",
      "В зависимости от банка деньги обычно поступают на счёт в течение 5-10 рабочих дней.",
      "В банковской выписке возврат может отображаться не как новый платёж, а как отменённая зарезервированная сумма.",
    ],
    balance: "Сумму {{summa}} мы вернули на баланс Вашего счёта PROVIN.",
  },
  de: {
    card: [
      "Wir haben Ihnen {{summa}} vollständig auf die Karte erstattet, mit der Sie bezahlt haben.",
      "Je nach Bank erscheint das Geld in der Regel innerhalb von 5-10 Werktagen auf Ihrem Konto.",
      "Auf Ihrem Kontoauszug erscheint die Erstattung möglicherweise nicht als neue Zahlung, sondern als stornierter reservierter Betrag.",
    ],
    balance: "Den Betrag von {{summa}} haben wir Ihrem PROVIN-Kontoguthaben gutgeschrieben.",
  },
};

const NO_DATA_COPY: Record<
  ForeignLang,
  { subject: string; greeting: string; lead: string; audits: string; order: string; question: string; waAudits: string; waQuestion: string }
> = {
  en: {
    subject: "PROVIN · Dealer data not available, payment refunded{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Hello,",
    lead: "We have checked the vehicle{{#vin}} with VIN {{vin}}{{/vin}} - unfortunately, official dealer data is not available for this car.",
    audits:
      "If you are still planning to buy the car, we recommend the PROVIN AUDIT - accident and mileage history from several European databases, a check of auction archives and an analysis of the listing and the risks.",
    order: "Order: {{audits_saite}}",
    question: "If you have any questions, simply reply to this email or write to info@provin.lv.",
    waAudits: "If you are still planning to buy the car, we can prepare the full PROVIN AUDIT: {{audits_saite}}",
    waQuestion: "If you have any questions, write here or to info@provin.lv.",
  },
  ru: {
    subject: "PROVIN · Данные дилера недоступны, деньги возвращены{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Здравствуйте!",
    lead: "Мы проверили автомобиль{{#vin}} с VIN {{vin}}{{/vin}} - к сожалению, официальные данные дилера по этому автомобилю недоступны.",
    audits:
      "Если Вы ещё только планируете покупку, рекомендуем PROVIN AUDIT - историю ДТП и пробега из нескольких европейских баз данных, проверку аукционных архивов и анализ объявления и рисков.",
    order: "Заказать: {{audits_saite}}",
    question: "Если у Вас есть вопросы, просто ответьте на это письмо или напишите на info@provin.lv.",
    waAudits: "Если Вы ещё планируете покупку, мы можем подготовить полный PROVIN AUDIT: {{audits_saite}}",
    waQuestion: "Если у Вас есть вопросы, пишите сюда или на info@provin.lv.",
  },
  de: {
    subject: "PROVIN · Händlerdaten nicht verfügbar, Betrag erstattet{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Guten Tag,",
    lead: "wir haben das Fahrzeug{{#vin}} mit der FIN {{vin}}{{/vin}} geprüft - leider sind für dieses Fahrzeug keine offiziellen Händlerdaten verfügbar.",
    audits:
      "Wenn Sie den Kauf noch planen, empfehlen wir das PROVIN AUDIT - Unfall- und Kilometerstandshistorie aus mehreren europäischen Datenbanken, eine Prüfung der Auktionsarchive sowie eine Analyse des Inserats und der Risiken.",
    order: "Bestellen: {{audits_saite}}",
    question: "Bei Fragen antworten Sie einfach auf diese E-Mail oder schreiben Sie an info@provin.lv.",
    waAudits: "Wenn Sie den Kauf noch planen, können wir das vollständige PROVIN AUDIT erstellen: {{audits_saite}}",
    waQuestion: "Bei Fragen schreiben Sie bitte hier oder an info@provin.lv.",
  },
};

function dealerNoData(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = NO_DATA_COPY[lang];
  const r = REFUND_LINES[lang];
  const card = channel === "email" ? r.card : r.card.slice(0, 2);
  const body = [
    c.greeting,
    "",
    c.lead,
    "",
    "{{#karte}}",
    ...card,
    "{{/karte}}",
    "{{#atlikums}}",
    r.balance,
    "{{/atlikums}}",
    "",
    ...(channel === "email" ? [c.audits, "", c.order] : [c.waAudits]),
    "",
    channel === "email" ? c.question : c.waQuestion,
    "",
    channel === "email" ? emailSign(lang) : WA_SIGN,
  ].join("\n");
  return channel === "email" ? { subject: c.subject, body } : { body };
}

/* ---------- Dīlera dati: atcelts ---------- */

const CANCELLED_COPY: Record<
  ForeignLang,
  { subject: string; greeting: string; lead: string; card: string; balance: string; bank: string; again: string; waAgain: string }
> = {
  en: {
    subject: "PROVIN · Order cancelled, payment refunded{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Hello,",
    lead: "We have cancelled your order for official dealer data{{#vin}} for the vehicle with VIN {{vin}}{{/vin}}.",
    card: " We have refunded {{summa}} in full to the card you paid with.",
    balance: " We have returned {{summa}} to your PROVIN account balance.",
    bank: "Depending on your bank, the money usually appears in your account within 5-10 business days.",
    again: "If you would like to order again, simply reply to this email.",
    waAgain: "If you would like to order again, write here.",
  },
  ru: {
    subject: "PROVIN · Заказ отменён, деньги возвращены{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Здравствуйте!",
    lead: "Мы отменили Ваш заказ официальных данных дилера{{#vin}} по автомобилю с VIN {{vin}}{{/vin}}.",
    card: " Мы вернули {{summa}} в полном объёме на карту, которой Вы оплатили.",
    balance: " Сумму {{summa}} мы вернули на баланс Вашего счёта PROVIN.",
    bank: "В зависимости от банка деньги обычно поступают на счёт в течение 5-10 рабочих дней.",
    again: "Если Вы хотите заказать повторно, просто ответьте на это письмо.",
    waAgain: "Если Вы хотите заказать повторно, напишите сюда.",
  },
  de: {
    subject: "PROVIN · Bestellung storniert, Betrag erstattet{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Guten Tag,",
    lead: "wir haben Ihre Bestellung der offiziellen Händlerdaten{{#vin}} für das Fahrzeug mit der FIN {{vin}}{{/vin}} storniert.",
    card: " Wir haben Ihnen {{summa}} vollständig auf die Karte erstattet, mit der Sie bezahlt haben.",
    balance: " Den Betrag von {{summa}} haben wir Ihrem PROVIN-Kontoguthaben gutgeschrieben.",
    bank: "Je nach Bank erscheint das Geld in der Regel innerhalb von 5-10 Werktagen auf Ihrem Konto.",
    again: "Wenn Sie erneut bestellen möchten, antworten Sie einfach auf diese E-Mail.",
    waAgain: "Wenn Sie erneut bestellen möchten, schreiben Sie bitte hier.",
  },
};

function dealerCancelled(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = CANCELLED_COPY[lang];
  const body = [
    c.greeting,
    "",
    `${c.lead}{{#karte}}${c.card}{{/karte}}{{#atlikums}}${c.balance}{{/atlikums}}`,
    "",
    "{{#karte}}",
    c.bank,
    "{{/karte}}",
    "",
    channel === "email" ? c.again : c.waAgain,
    "",
    channel === "email" ? emailSign(lang) : WA_SIGN,
  ].join("\n");
  return channel === "email" ? { subject: c.subject, body } : { body };
}

/* ---------- Google atsauksmes lūgums ---------- */

const REVIEW_COPY: Record<ForeignLang, { subject: string; greeting: string; thanks: string; ask: string; helps: string }> = {
  en: {
    subject: "PROVIN · Thank you for your order{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Hello,",
    thanks: "Thank you for choosing PROVIN.LV to check the vehicle{{#vin}} with VIN {{vin}}{{/vin}}.",
    ask: "If our work was useful to you, I would be grateful for a short Google review: {{atsauksmes_saite}}",
    helps: "It also helps other buyers find a reliable vehicle check.",
  },
  ru: {
    subject: "PROVIN · Спасибо за заказ{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Здравствуйте!",
    thanks: "Спасибо, что для проверки автомобиля{{#vin}} с VIN {{vin}}{{/vin}} Вы выбрали PROVIN.LV.",
    ask: "Если наша работа была Вам полезна, буду благодарен за короткий отзыв в Google: {{atsauksmes_saite}}",
    helps: "Он также помогает другим покупателям найти надёжную проверку автомобиля.",
  },
  de: {
    subject: "PROVIN · Vielen Dank für Ihre Bestellung{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Guten Tag,",
    thanks: "vielen Dank, dass Sie sich für die Prüfung des Fahrzeugs{{#vin}} mit der FIN {{vin}}{{/vin}} für PROVIN.LV entschieden haben.",
    ask: "Wenn Ihnen unsere Arbeit geholfen hat, würde ich mich über eine kurze Google-Bewertung freuen: {{atsauksmes_saite}}",
    helps: "Sie hilft auch anderen Käufern, eine zuverlässige Fahrzeugprüfung zu finden.",
  },
};

function reviewRequest(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = REVIEW_COPY[lang];
  if (channel === "whatsapp") {
    return { body: [c.greeting, "", c.thanks, "", c.ask, "", "Nils, PROVIN.LV"].join("\n") };
  }
  return { subject: c.subject, body: [c.greeting, "", c.thanks, "", c.ask, "", c.helps, "", "{{paraksts}}"].join("\n") };
}

const FOREIGN: ForeignLang[] = ["en", "ru", "de"];

function perLang(fn: (lang: ForeignLang) => LocalizedTemplate): Record<ForeignLang, LocalizedTemplate> {
  return Object.fromEntries(FOREIGN.map((l) => [l, fn(l)])) as Record<ForeignLang, LocalizedTemplate>;
}

/** Šablona ID -> valoda -> teksts. */
export const LOCALIZED_TEMPLATES: Record<string, Record<ForeignLang, LocalizedTemplate>> = {
  "email.dealer_send.ready": DEALER_READY_EMAIL,
  "wa.dealer_send.ready": DEALER_READY_WA,
  "email.dealer_send.no_data": perLang((l) => dealerNoData(l, "email")),
  "wa.dealer_send.no_data": perLang((l) => dealerNoData(l, "whatsapp")),
  "email.dealer_send.cancelled": perLang((l) => dealerCancelled(l, "email")),
  "wa.dealer_send.cancelled": perLang((l) => dealerCancelled(l, "whatsapp")),
  "email.review_request": perLang((l) => reviewRequest(l, "email")),
  "wa.review_request": perLang((l) => reviewRequest(l, "whatsapp")),
};

export function localizedTemplate(id: string, lang: ClientReportLang | null | undefined): LocalizedTemplate | null {
  if (!lang || lang === "lv") return null;
  return LOCALIZED_TEMPLATES[id]?.[lang] ?? null;
}

/**
 * B2B paraksts (Nila likums 25.11): tikai «PROVIN» - bez «Nils», bez «IRISS», bez «.LV».
 * Darbojas arī ar admina LV pārrakstiem (Blob), kuros «Nils» ierakstīts tekstā.
 */
export function applyB2bSignature(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^\s*Nils(?:\s+Valainis)?\s*$/.test(line))
    .map((line) =>
      line
        .replace(/^(\s*)Nils(?:\s+Valainis)?\s*,\s*/, "$1")
        .replace(/\bIRISS\b/g, "PROVIN")
        .replace(/\bPROVIN\.LV\b/g, "PROVIN"),
    )
    .join("\n");
}
