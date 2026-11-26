import type { ClientReportLang } from "@/lib/client-report-i18n";

/**
 * Klientu e-pastu / WhatsApp šablonu tulkojumi EN / RU / DE (Nils 25.11: «nav tulkojumi, pārbaudi visas valodas»).
 * LV teksts paliek reģistrā (labojams adminā «Šabloni»); šeit - tie paši bloki un mainīgie citās valodās.
 * Ne-LV versijām admina LV pārrakstu NEizmanto (citādi latviešu teksts aizietu vācu klientam).
 *
 * Paraksts (Nils 26.11): bez vārda - privātklientiem «PROVIN.LV», B2B `applyB2bSignature` atstāj tikai «PROVIN».
 */

export type ForeignLang = Exclude<ClientReportLang, "lv">;
export type LocalizedTemplate = { subject?: string; body: string };

const SIGN_GREETING: Record<ForeignLang, string> = {
  en: "Best regards,",
  ru: "С уважением,",
  de: "Mit freundlichen Grüßen,",
};

const emailSign = (lang: ForeignLang) => [SIGN_GREETING[lang], "{{zimols}}"].join("\n");
const WA_SIGN = "{{zimols}}";

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
      "If our work was useful to you, we would be grateful for a short Google review: {{atsauksmes_saite}}",
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
      "Если наша работа была Вам полезна, будем благодарны за короткий отзыв в Google: {{atsauksmes_saite}}",
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
      "Wenn Ihnen unsere Arbeit geholfen hat, wären wir für eine kurze Google-Bewertung dankbar: {{atsauksmes_saite}}",
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
      "The official dealer data you ordered{{#vin}} for the vehicle with VIN {{vin}}{{/vin}} is ready - we are attaching the PDF below.",
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
      "If the data was useful, we would be grateful for a short Google review: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      WA_SIGN,
    ].join("\n"),
  },
  ru: {
    body: [
      "Здравствуйте!",
      "",
      "Заказанные Вами официальные данные дилера{{#vin}} по автомобилю с VIN {{vin}}{{/vin}} готовы - PDF прикладываем ниже.",
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
      "Если данные были полезны, будем благодарны за короткий отзыв в Google: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      WA_SIGN,
    ].join("\n"),
  },
  de: {
    body: [
      "Guten Tag,",
      "",
      "die von Ihnen bestellten offiziellen Händlerdaten{{#vin}} für das Fahrzeug mit der FIN {{vin}}{{/vin}} sind fertig - das PDF senden wir Ihnen unten.",
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
      "Wenn Ihnen die Daten geholfen haben, wären wir für eine kurze Google-Bewertung dankbar: {{atsauksmes_saite}}",
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
    ask: "If our work was useful to you, we would be grateful for a short Google review: {{atsauksmes_saite}}",
    helps: "It also helps other buyers find a reliable vehicle check.",
  },
  ru: {
    subject: "PROVIN · Спасибо за заказ{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Здравствуйте!",
    thanks: "Спасибо, что для проверки автомобиля{{#vin}} с VIN {{vin}}{{/vin}} Вы выбрали PROVIN.LV.",
    ask: "Если наша работа была Вам полезна, будем благодарны за короткий отзыв в Google: {{atsauksmes_saite}}",
    helps: "Он также помогает другим покупателям найти надёжную проверку автомобиля.",
  },
  de: {
    subject: "PROVIN · Vielen Dank für Ihre Bestellung{{#vin}} · {{vin}}{{/vin}}",
    greeting: "Guten Tag,",
    thanks: "vielen Dank, dass Sie sich für die Prüfung des Fahrzeugs{{#vin}} mit der FIN {{vin}}{{/vin}} für PROVIN.LV entschieden haben.",
    ask: "Wenn Ihnen unsere Arbeit geholfen hat, wären wir für eine kurze Google-Bewertung dankbar: {{atsauksmes_saite}}",
    helps: "Sie hilft auch anderen Käufern, eine zuverlässige Fahrzeugprüfung zu finden.",
  },
};

function reviewRequest(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = REVIEW_COPY[lang];
  if (channel === "whatsapp") {
    return { body: [c.greeting, "", c.thanks, "", c.ask, "", "PROVIN.LV"].join("\n") };
  }
  return { subject: c.subject, body: [c.greeting, "", c.thanks, "", c.ask, "", c.helps, "", "{{paraksts}}"].join("\n") };
}

/* ---------- Neapmaksāta pasūtījuma atgādinājums (valoda - Stripe session.locale) ---------- */

const UNPAID_REMINDER: Record<ForeignLang, LocalizedTemplate> = {
  en: {
    subject: "PROVIN · Your order is awaiting payment · {{vin}}",
    body: [
      "Hello,",
      "",
      "We noticed that you recently started ordering a vehicle history check{{#vin}} (VIN {{vin}}){{/vin}}, but the order was not completed. If anything is unclear or you would like to ask us something first, simply reply to this email.",
      "",
      "If the check is still relevant, you can complete the payment here:",
      "{{maksājuma_saite}}",
      "",
      "Thank you for choosing PROVIN.LV, and good luck with your car search!",
      "",
      "Best regards,",
      "PROVIN.LV",
    ].join("\n"),
  },
  ru: {
    subject: "PROVIN · Заказ ожидает оплаты · {{vin}}",
    body: [
      "Здравствуйте!",
      "",
      "Мы заметили, что недавно Вы начали заказывать проверку истории автомобиля{{#vin}} (VIN {{vin}}){{/vin}}, но заказ не был завершён. Если что-то непонятно или Вы хотите сначала посоветоваться, просто ответьте на это письмо.",
      "",
      "Если проверка всё ещё актуальна, оплату можно завершить здесь:",
      "{{maksājuma_saite}}",
      "",
      "Спасибо, что выбрали PROVIN.LV, и удачи в выборе автомобиля!",
      "",
      "С уважением,",
      "PROVIN.LV",
    ].join("\n"),
  },
  de: {
    subject: "PROVIN · Ihre Bestellung wartet auf Zahlung · {{vin}}",
    body: [
      "Guten Tag,",
      "",
      "wir haben gesehen, dass Sie vor Kurzem eine Fahrzeughistorie-Prüfung{{#vin}} (FIN {{vin}}){{/vin}} bestellen wollten, die Bestellung aber nicht abgeschlossen wurde. Wenn etwas unklar ist oder Sie sich zuerst beraten lassen möchten, antworten Sie einfach auf diese E-Mail.",
      "",
      "Wenn die Prüfung noch aktuell ist, können Sie die Zahlung hier abschließen:",
      "{{maksājuma_saite}}",
      "",
      "Vielen Dank, dass Sie sich für PROVIN.LV entschieden haben, und viel Erfolg bei der Fahrzeugwahl!",
      "",
      "Mit freundlichen Grüßen",
      "PROVIN.LV",
    ].join("\n"),
  },
};

/* ---------- Personīgā apmaksas saite ---------- */

const CLIENT_LINK: Record<ForeignLang, LocalizedTemplate> = {
  en: {
    subject: "PROVIN · Payment link · {{produkts}}{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Hello,",
      "",
      "Here is your personal payment link.",
      "",
      "Product: {{produkts}}",
      "{{#vin}}VIN: {{vin}}\n{{/vin}}Amount: {{summa}}",
      "Link valid until: {{derigs_lidz}}",
      "",
      "We will create your order as soon as we receive the payment.",
      "",
      "Pay: {{maksajuma_saite}}",
    ].join("\n"),
  },
  ru: {
    subject: "PROVIN · Ссылка на оплату · {{produkts}}{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Здравствуйте!",
      "",
      "Направляем Вашу персональную ссылку на оплату.",
      "",
      "Продукт: {{produkts}}",
      "{{#vin}}VIN: {{vin}}\n{{/vin}}Сумма: {{summa}}",
      "Ссылка действительна до: {{derigs_lidz}}",
      "",
      "Заказ будет создан сразу после получения оплаты.",
      "",
      "Оплатить: {{maksajuma_saite}}",
    ].join("\n"),
  },
  de: {
    subject: "PROVIN · Zahlungslink · {{produkts}}{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Guten Tag,",
      "",
      "anbei Ihr persönlicher Zahlungslink.",
      "",
      "Produkt: {{produkts}}",
      "{{#vin}}FIN: {{vin}}\n{{/vin}}Betrag: {{summa}}",
      "Link gültig bis: {{derigs_lidz}}",
      "",
      "Wir legen Ihre Bestellung an, sobald die Zahlung eingegangen ist.",
      "",
      "Bezahlen: {{maksajuma_saite}}",
    ].join("\n"),
  },
};

/* ---------- Piedāvājumi (upsell) ---------- */

const UPSELL_SIGN_EMAIL = (lang: ForeignLang) => [SIGN_GREETING[lang], "PROVIN.LV"].join("\n");
const UPSELL_SIGN_WA = "PROVIN.LV";

type UpsellCopy = {
  greeting: string;
  pay: string;
  ttl: string;
  miniToDealerSubject: string;
  miniToDealerLead: string;
  miniToDealerPrice: string;
  miniToDealerKeep: string;
  miniToDealerWaLead: string;
  miniToDealerWaKeep: string;
  dealerToAuditSubject: string;
  dealerToAuditLead: string;
  dealerToAuditWaLead: string;
  paid: string;
  extra: string;
  total: string;
  dealerToAuditKeep: string;
  dealerToAuditWaKeep: string;
  miniToAuditSubject: string;
  miniToAudit: string[];
};

const UPSELL: Record<ForeignLang, UpsellCopy> = {
  en: {
    greeting: "Hello,",
    pay: "Pay: {{maksajuma_saite}}",
    ttl: "The link is valid for 30 days.",
    miniToDealerSubject: "PROVIN · Offer: official dealer data{{#vin}} · {{vin}}{{/vin}}",
    miniToDealerLead:
      "We can add official dealer data to your PROVIN MINI order{{#vin}} (VIN {{vin}}){{/vin}}. It shows the car's visits to official dealer service centres, with the mileage wherever the dealer recorded it.",
    miniToDealerPrice: "Your price: {{papildus_cena}} (when ordered separately: {{kataloga_cena}}).",
    miniToDealerKeep: "We will add the data to your existing order. The information you have already entered stays.",
    miniToDealerWaLead: "We can add official dealer data to your PROVIN MINI order{{#vin}} (VIN {{vin}}){{/vin}} for {{papildus_cena}}.",
    miniToDealerWaKeep: "The data will be added to your existing order.",
    dealerToAuditSubject: "PROVIN · Offer: PROVIN AUDIT{{#vin}} · {{vin}}{{/vin}}",
    dealerToAuditLead:
      "We can upgrade your order{{#vin}} (VIN {{vin}}){{/vin}} to a full PROVIN AUDIT. You will then see the car's whole history, not only the dealer records.",
    dealerToAuditWaLead: "We can prepare the full PROVIN AUDIT within your official dealer data order{{#vin}} (VIN {{vin}}){{/vin}}.",
    paid: "Already paid: {{jau_samaksats}}",
    extra: "Additional payment: {{papildus_cena}}",
    total: "Total: {{kopa}}",
    dealerToAuditKeep:
      "The data you have already entered stays. We will add what is still missing: accident history, auction photos, and an analysis of the listing and the risks.",
    dealerToAuditWaKeep: "The data you have already entered stays.",
    miniToAuditSubject: "PROVIN · Recommendation: PROVIN AUDIT{{#auto}} · {{auto}}{{/auto}}{{#vin}} · {{vin}}{{/vin}}",
    miniToAudit: [
      "Hello{{#vards}} {{vards}}{{/vards}},",
      "",
      "Thank you for your PROVIN MINI order{{#auto}} ({{auto}}){{/auto}}{{#vin}}, VIN {{vin}}{{/vin}}.",
      "",
      "Having reviewed the data, we see that PROVIN AUDIT is a better fit for this car. To make your decision easier, here is the difference in short.",
      "",
      "PROVIN MINI includes:",
      "✓ A consultation and recommendations for the in-person inspection",
      "✓ MTPL accidents and technical inspection history",
      "✓ An analysis of the listing, the seller and the technical risks",
      "",
      "Only PROVIN AUDIT includes:",
      "✓ carVertical, AutoDNA and country-of-origin registry data",
      "✓ Official dealer data and auction archives",
      "",
      "It is PROVIN AUDIT that shows the accident history, the mileage abroad and the official dealer data. For an imported car, these are the most important data.",
      "",
      "We recommend PROVIN AUDIT. You can pay the difference ({{starpiba}} €) here:",
      "{{maksajuma_saite}}",
      "",
      "If you do not need the additional data, we will continue with PROVIN MINI.",
    ],
  },
  ru: {
    greeting: "Здравствуйте!",
    pay: "Оплатить: {{maksajuma_saite}}",
    ttl: "Ссылка действительна 30 дней.",
    miniToDealerSubject: "PROVIN · Предложение: официальные данные дилера{{#vin}} · {{vin}}{{/vin}}",
    miniToDealerLead:
      "К Вашему заказу PROVIN MINI{{#vin}} (VIN {{vin}}){{/vin}} мы можем добавить официальные данные дилера. В них видны посещения официального дилерского сервиса с пробегом, если дилер его зафиксировал.",
    miniToDealerPrice: "Ваша цена: {{papildus_cena}} (при отдельном заказе: {{kataloga_cena}}).",
    miniToDealerKeep: "Данные мы добавим к существующему заказу. Уже введённая информация сохранится.",
    miniToDealerWaLead: "К Вашему заказу PROVIN MINI{{#vin}} (VIN {{vin}}){{/vin}} мы можем добавить официальные данные дилера за {{papildus_cena}}.",
    miniToDealerWaKeep: "Данные дополнят существующий заказ.",
    dealerToAuditSubject: "PROVIN · Предложение: PROVIN AUDIT{{#vin}} · {{vin}}{{/vin}}",
    dealerToAuditLead:
      "Ваш заказ{{#vin}} (VIN {{vin}}){{/vin}} можно дополнить до полной проверки PROVIN AUDIT. Тогда Вы увидите всю историю автомобиля, а не только записи дилера.",
    dealerToAuditWaLead: "В рамках Вашего заказа официальных данных дилера{{#vin}} (VIN {{vin}}){{/vin}} мы можем подготовить полный PROVIN AUDIT.",
    paid: "Уже оплачено: {{jau_samaksats}}",
    extra: "Доплата: {{papildus_cena}}",
    total: "Итого: {{kopa}}",
    dealerToAuditKeep:
      "Уже введённые данные сохранятся. Мы добавим то, чего ещё не хватает: историю ДТП, фото с аукционов, анализ объявления и рисков.",
    dealerToAuditWaKeep: "Уже введённые данные сохранятся.",
    miniToAuditSubject: "PROVIN · Рекомендация: PROVIN AUDIT{{#auto}} · {{auto}}{{/auto}}{{#vin}} · {{vin}}{{/vin}}",
    miniToAudit: [
      "Здравствуйте{{#vards}}, {{vards}}{{/vards}}!",
      "",
      "Спасибо за заказ PROVIN MINI{{#auto}} ({{auto}}){{/auto}}{{#vin}}, VIN {{vin}}{{/vin}}.",
      "",
      "Изучив данные, мы видим, что этому автомобилю больше подходит PROVIN AUDIT. Чтобы Вам было проще решить, коротко о разнице.",
      "",
      "PROVIN MINI включает:",
      "✓ Консультацию и рекомендации для личного осмотра",
      "✓ ДТП по ОСАГО и историю техосмотров",
      "✓ Анализ объявления, продавца и технических рисков",
      "",
      "Только PROVIN AUDIT включает:",
      "✓ Данные carVertical, AutoDNA и реестров страны происхождения",
      "✓ Официальные данные дилера и аукционные архивы",
      "",
      "Именно PROVIN AUDIT показывает историю ДТП, пробег за границей и официальные данные дилера. Для ввезённого автомобиля это самые важные данные.",
      "",
      "Мы рекомендуем PROVIN AUDIT. Разницу ({{starpiba}} €) можно оплатить здесь:",
      "{{maksajuma_saite}}",
      "",
      "Если дополнительные данные не нужны, продолжим с PROVIN MINI.",
    ],
  },
  de: {
    greeting: "Guten Tag,",
    pay: "Bezahlen: {{maksajuma_saite}}",
    ttl: "Der Link ist 30 Tage gültig.",
    miniToDealerSubject: "PROVIN · Angebot: offizielle Händlerdaten{{#vin}} · {{vin}}{{/vin}}",
    miniToDealerLead:
      "zu Ihrer PROVIN MINI Bestellung{{#vin}} (FIN {{vin}}){{/vin}} können wir die offiziellen Händlerdaten hinzufügen. Darin sind die Werkstattbesuche beim offiziellen Händler mit dem Kilometerstand zu sehen, sofern der Händler ihn erfasst hat.",
    miniToDealerPrice: "Ihr Preis: {{papildus_cena}} (bei separater Bestellung: {{kataloga_cena}}).",
    miniToDealerKeep: "Wir ergänzen die Daten in Ihrer bestehenden Bestellung. Bereits eingegebene Angaben bleiben erhalten.",
    miniToDealerWaLead: "zu Ihrer PROVIN MINI Bestellung{{#vin}} (FIN {{vin}}){{/vin}} können wir die offiziellen Händlerdaten für {{papildus_cena}} hinzufügen.",
    miniToDealerWaKeep: "Die Daten ergänzen Ihre bestehende Bestellung.",
    dealerToAuditSubject: "PROVIN · Angebot: PROVIN AUDIT{{#vin}} · {{vin}}{{/vin}}",
    dealerToAuditLead:
      "Ihre Bestellung{{#vin}} (FIN {{vin}}){{/vin}} können wir zu einem vollständigen PROVIN AUDIT erweitern. Dann sehen Sie die gesamte Fahrzeughistorie, nicht nur die Händlereinträge.",
    dealerToAuditWaLead: "im Rahmen Ihrer Bestellung der offiziellen Händlerdaten{{#vin}} (FIN {{vin}}){{/vin}} können wir das vollständige PROVIN AUDIT erstellen.",
    paid: "Bereits bezahlt: {{jau_samaksats}}",
    extra: "Zuzahlung: {{papildus_cena}}",
    total: "Gesamt: {{kopa}}",
    dealerToAuditKeep:
      "Bereits eingegebene Daten bleiben erhalten. Wir ergänzen, was noch fehlt: Unfallhistorie, Auktionsfotos sowie eine Analyse des Inserats und der Risiken.",
    dealerToAuditWaKeep: "Bereits eingegebene Daten bleiben erhalten.",
    miniToAuditSubject: "PROVIN · Empfehlung: PROVIN AUDIT{{#auto}} · {{auto}}{{/auto}}{{#vin}} · {{vin}}{{/vin}}",
    miniToAudit: [
      "Guten Tag{{#vards}} {{vards}}{{/vards}},",
      "",
      "vielen Dank für Ihre PROVIN MINI Bestellung{{#auto}} ({{auto}}){{/auto}}{{#vin}}, FIN {{vin}}{{/vin}}.",
      "",
      "Nach Prüfung der Daten sehen wir, dass für dieses Fahrzeug das PROVIN AUDIT besser passt. Damit Ihnen die Entscheidung leichter fällt, kurz zum Unterschied.",
      "",
      "PROVIN MINI umfasst:",
      "✓ Beratung und Empfehlungen für die Besichtigung vor Ort",
      "✓ Haftpflichtschäden und die Historie der technischen Untersuchungen",
      "✓ Eine Analyse des Inserats, des Verkäufers und der technischen Risiken",
      "",
      "Nur PROVIN AUDIT umfasst:",
      "✓ Daten von carVertical, AutoDNA und aus den Registern des Herkunftslandes",
      "✓ Offizielle Händlerdaten und Auktionsarchive",
      "",
      "Gerade das PROVIN AUDIT zeigt die Unfallhistorie, die Laufleistung im Ausland und die offiziellen Händlerdaten. Für ein importiertes Fahrzeug sind das die wichtigsten Daten.",
      "",
      "Wir empfehlen das PROVIN AUDIT. Die Differenz ({{starpiba}} €) können Sie hier bezahlen:",
      "{{maksajuma_saite}}",
      "",
      "Wenn Sie die zusätzlichen Daten nicht benötigen, fahren wir mit PROVIN MINI fort.",
    ],
  },
};

function upsellMiniToDealer(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = UPSELL[lang];
  if (channel === "whatsapp") {
    return { body: [c.greeting, "", c.miniToDealerWaLead, "", c.miniToDealerWaKeep, "", c.pay, "", UPSELL_SIGN_WA].join("\n") };
  }
  return {
    subject: c.miniToDealerSubject,
    body: [c.greeting, "", c.miniToDealerLead, "", c.miniToDealerPrice, "", c.miniToDealerKeep, "", c.pay, "", c.ttl, "", UPSELL_SIGN_EMAIL(lang)].join("\n"),
  };
}

function upsellDealerToAudit(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = UPSELL[lang];
  if (channel === "whatsapp") {
    return {
      body: [c.greeting, "", c.dealerToAuditWaLead, "", c.paid, c.extra, c.total, "", c.dealerToAuditWaKeep, "", c.pay, "", UPSELL_SIGN_WA].join("\n"),
    };
  }
  return {
    subject: c.dealerToAuditSubject,
    body: [c.greeting, "", c.dealerToAuditLead, "", c.paid, c.extra, c.total, "", c.dealerToAuditKeep, "", c.pay, "", c.ttl, "", UPSELL_SIGN_EMAIL(lang)].join("\n"),
  };
}

function upsellMiniToAudit(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = UPSELL[lang];
  const sign = channel === "email" ? UPSELL_SIGN_EMAIL(lang) : UPSELL_SIGN_WA;
  const body = [...c.miniToAudit, "", sign].join("\n");
  return channel === "email" ? { subject: c.miniToAuditSubject, body } : { body };
}

/* ---------- Izsoļu arhīvs - «Sūtīt klientam» (atsevišķs pakalpojums) ---------- */

type ArchiveCopy = {
  greeting: string;
  readySubject: string;
  ready: string;
  readyWa: string;
  offerLead: string[];
  offerWa: string;
  paid: string;
  extra: string;
  total: string;
  pay: string;
  payWa: string;
  questions: string;
  questionsWa: string;
  review: string;
  reviewWa: string;
  noDataSubject: string;
  noData: string;
  refundCard: string[];
  refundCardWa: string[];
  refundBalance: string;
  auditsTip: string;
  order: string;
  auditsTipWa: string;
  cancelledSubject: string;
  cancelled: string;
  cancelledCardDays: string;
  again: string;
  againWa: string;
};

const ARCHIVE: Record<ForeignLang, ArchiveCopy> = {
  en: {
    greeting: "Hello,",
    readySubject: "PROVIN · Report ready · Auction archive{{#vin}} · {{vin}}{{/vin}}",
    ready: "The auction archive you ordered{{#vin}} for the vehicle with VIN {{vin}}{{/vin}} is ready - the PDF is attached.",
    readyWa: "The auction archive you ordered{{#vin}} for the vehicle with VIN {{vin}}{{/vin}} is ready - we are attaching the PDF below.",
    offerLead: [
      "The auction archive shows the car's condition on the day of the auction. If you are considering buying this car, we recommend the full PROVIN AUDIT. Within the same order we will add:",
      "- accident and mileage history from several European databases;",
      "- the official dealer service history, if available;",
      "- an analysis of the listing and the risks - the facts we found and recommendations, including for an in-person inspection, so that you can make your purchase decision with confidence.",
    ],
    offerWa:
      "The auction archive shows the car's condition on the day of the auction. If you are considering the purchase, within the same order we can prepare the full PROVIN AUDIT - accident and mileage history, dealer service history and an analysis of the listing and the risks with recommendations for an in-person inspection.",
    paid: "Already paid: {{jau_samaksats}}",
    extra: "Additional payment: {{piemaksa}}",
    total: "Total: {{kopa}}",
    pay: "Pay: {{maksajuma_saite}} (the link is valid for 30 days)",
    payWa: "Additional payment: {{piemaksa}} (total {{kopa}}, already paid {{jau_samaksats}})\nPay: {{maksajuma_saite}}",
    questions: "If you have any questions, simply reply to this message or write to info@provin.lv.",
    questionsWa: "If you have any questions, write here or to info@provin.lv.",
    review: "If our work was useful to you, we would be grateful for a short Google review: {{atsauksmes_saite}}",
    reviewWa: "If the data was useful, we would be grateful for a short Google review: {{atsauksmes_saite}}",
    noDataSubject: "PROVIN · No data in the auction archive, money refunded{{#vin}} · {{vin}}{{/vin}}",
    noData: "We checked the vehicle{{#vin}} with VIN {{vin}}{{/vin}} - unfortunately, the European auction archive has no records for this car.",
    refundCard: [
      "We have refunded {{summa}} in full to the card you paid with.",
      "Depending on your bank, the money usually appears in your account within 5-10 business days.",
      "On your bank statement the refund may appear not as a new payment but as a cancelled reserved amount.",
    ],
    refundCardWa: [
      "We have refunded {{summa}} in full to the card you paid with.",
      "Depending on your bank, the money usually appears in your account within 5-10 business days.",
    ],
    refundBalance: "We have returned {{summa}} to your PROVIN account balance.",
    auditsTip:
      "If you are still planning to buy the car, we recommend PROVIN AUDIT - accident and mileage history from several European databases, dealer service history and an analysis of the listing and the risks.",
    order: "Order: {{audits_saite}}",
    auditsTipWa: "If you are still planning to buy the car, we can prepare the full PROVIN AUDIT: {{audits_saite}}",
    cancelledSubject: "PROVIN · Order cancelled, money refunded{{#vin}} · {{vin}}{{/vin}}",
    cancelled:
      "We have cancelled your auction archive order{{#vin}} for the vehicle with VIN {{vin}}{{/vin}}.{{#karte}} We have refunded {{summa}} in full to the card you paid with.{{/karte}}{{#atlikums}} We have returned {{summa}} to your PROVIN account balance.{{/atlikums}}",
    cancelledCardDays: "Depending on your bank, the money usually appears in your account within 5-10 business days.",
    again: "If you would like to order again, simply reply to this message.",
    againWa: "If you would like to order again, write here.",
  },
  ru: {
    greeting: "Здравствуйте!",
    readySubject: "PROVIN · Отчёт готов · Архив аукционов{{#vin}} · {{vin}}{{/vin}}",
    ready: "Заказанный Вами архив аукционов{{#vin}} по автомобилю с VIN {{vin}}{{/vin}} готов - PDF во вложении.",
    readyWa: "Заказанный Вами архив аукционов{{#vin}} по автомобилю с VIN {{vin}}{{/vin}} готов - прикладываем PDF ниже.",
    offerLead: [
      "Архив аукционов показывает состояние автомобиля в день аукциона. Если Вы рассматриваете покупку этого автомобиля, рекомендуем полный PROVIN AUDIT. В рамках того же заказа мы добавим:",
      "- историю ДТП и пробега из нескольких европейских баз данных;",
      "- историю обслуживания у официального дилера, если она доступна;",
      "- анализ объявления и рисков - выявленные факты и рекомендации, в том числе для личного осмотра, чтобы Вы могли уверенно принять решение о покупке.",
    ],
    offerWa:
      "Архив аукционов показывает состояние автомобиля в день аукциона. Если Вы рассматриваете покупку, в рамках того же заказа мы можем подготовить полный PROVIN AUDIT - историю ДТП и пробега, историю обслуживания у дилера, анализ объявления и рисков с рекомендациями для личного осмотра.",
    paid: "Уже оплачено: {{jau_samaksats}}",
    extra: "Доплата: {{piemaksa}}",
    total: "Итого: {{kopa}}",
    pay: "Оплатить: {{maksajuma_saite}} (ссылка действительна 30 дней)",
    payWa: "Доплата: {{piemaksa}} (итого {{kopa}}, уже оплачено {{jau_samaksats}})\nОплатить: {{maksajuma_saite}}",
    questions: "Если у Вас есть вопросы, просто ответьте на это сообщение или напишите на info@provin.lv.",
    questionsWa: "Если есть вопросы, пишите здесь или на info@provin.lv.",
    review: "Если наша работа была Вам полезна, будем благодарны за короткий отзыв в Google: {{atsauksmes_saite}}",
    reviewWa: "Если данные были полезны, будем благодарны за короткий отзыв в Google: {{atsauksmes_saite}}",
    noDataSubject: "PROVIN · В архиве аукционов нет данных, деньги возвращены{{#vin}} · {{vin}}{{/vin}}",
    noData: "Мы проверили автомобиль{{#vin}} с VIN {{vin}}{{/vin}} - к сожалению, в европейском архиве аукционов записей об этом автомобиле нет.",
    refundCard: [
      "Мы вернули {{summa}} в полном объёме на карту, которой Вы платили.",
      "В зависимости от банка деньги обычно поступают на счёт в течение 5-10 рабочих дней.",
      "В выписке банка возврат может отображаться не как новый платёж, а как отмена зарезервированной суммы.",
    ],
    refundCardWa: [
      "Мы вернули {{summa}} в полном объёме на карту, которой Вы платили.",
      "В зависимости от банка деньги обычно поступают на счёт в течение 5-10 рабочих дней.",
    ],
    refundBalance: "Сумму {{summa}} мы вернули на баланс Вашего счёта PROVIN.",
    auditsTip:
      "Если Вы ещё только планируете покупку, рекомендуем PROVIN AUDIT - историю ДТП и пробега из нескольких европейских баз данных, историю обслуживания у дилера и анализ объявления и рисков.",
    order: "Заказать: {{audits_saite}}",
    auditsTipWa: "Если Вы ещё планируете покупку, мы можем подготовить полный PROVIN AUDIT: {{audits_saite}}",
    cancelledSubject: "PROVIN · Заказ отменён, деньги возвращены{{#vin}} · {{vin}}{{/vin}}",
    cancelled:
      "Мы отменили Ваш заказ архива аукционов{{#vin}} по автомобилю с VIN {{vin}}{{/vin}}.{{#karte}} Мы вернули {{summa}} в полном объёме на карту, которой Вы платили.{{/karte}}{{#atlikums}} Сумму {{summa}} мы вернули на баланс Вашего счёта PROVIN.{{/atlikums}}",
    cancelledCardDays: "В зависимости от банка деньги обычно поступают на счёт в течение 5-10 рабочих дней.",
    again: "Если хотите заказать повторно, просто ответьте на это сообщение.",
    againWa: "Если хотите заказать повторно, напишите здесь.",
  },
  de: {
    greeting: "Guten Tag,",
    readySubject: "PROVIN · Bericht fertig · Auktionsarchiv{{#vin}} · {{vin}}{{/vin}}",
    ready: "das von Ihnen bestellte Auktionsarchiv{{#vin}} für das Fahrzeug mit der FIN {{vin}}{{/vin}} ist fertig - das PDF finden Sie im Anhang.",
    readyWa: "das von Ihnen bestellte Auktionsarchiv{{#vin}} für das Fahrzeug mit der FIN {{vin}}{{/vin}} ist fertig - das PDF fügen wir unten bei.",
    offerLead: [
      "Das Auktionsarchiv zeigt den Zustand des Fahrzeugs am Auktionstag. Wenn Sie den Kauf dieses Fahrzeugs in Betracht ziehen, empfehlen wir das vollständige PROVIN AUDIT. Im Rahmen derselben Bestellung ergänzen wir:",
      "- die Unfall- und Kilometerstandshistorie aus mehreren europäischen Datenbanken;",
      "- die Servicehistorie beim offiziellen Händler, sofern verfügbar;",
      "- eine Analyse des Inserats und der Risiken - festgestellte Fakten und Empfehlungen, auch für eine Besichtigung vor Ort, damit Sie Ihre Kaufentscheidung sicher treffen können.",
    ],
    offerWa:
      "Das Auktionsarchiv zeigt den Zustand des Fahrzeugs am Auktionstag. Wenn Sie den Kauf in Betracht ziehen, können wir im Rahmen derselben Bestellung das vollständige PROVIN AUDIT erstellen - Unfall- und Kilometerstandshistorie, Händler-Servicehistorie sowie eine Analyse des Inserats und der Risiken mit Empfehlungen für die Besichtigung vor Ort.",
    paid: "Bereits bezahlt: {{jau_samaksats}}",
    extra: "Zuzahlung: {{piemaksa}}",
    total: "Gesamt: {{kopa}}",
    pay: "Bezahlen: {{maksajuma_saite}} (der Link ist 30 Tage gültig)",
    payWa: "Zuzahlung: {{piemaksa}} (gesamt {{kopa}}, bereits bezahlt {{jau_samaksats}})\nBezahlen: {{maksajuma_saite}}",
    questions: "Bei Fragen antworten Sie einfach auf diese Nachricht oder schreiben Sie an info@provin.lv.",
    questionsWa: "Bei Fragen schreiben Sie hier oder an info@provin.lv.",
    review: "Wenn Ihnen unsere Arbeit geholfen hat, wären wir für eine kurze Google-Bewertung dankbar: {{atsauksmes_saite}}",
    reviewWa: "Wenn Ihnen die Daten geholfen haben, wären wir für eine kurze Google-Bewertung dankbar: {{atsauksmes_saite}}",
    noDataSubject: "PROVIN · Keine Daten im Auktionsarchiv, Geld erstattet{{#vin}} · {{vin}}{{/vin}}",
    noData: "wir haben das Fahrzeug{{#vin}} mit der FIN {{vin}}{{/vin}} geprüft - leider enthält das europäische Auktionsarchiv keine Einträge zu diesem Fahrzeug.",
    refundCard: [
      "Wir haben {{summa}} vollständig auf die Karte erstattet, mit der Sie bezahlt haben.",
      "Je nach Bank erscheint das Geld in der Regel innerhalb von 5-10 Werktagen auf Ihrem Konto.",
      "Auf dem Kontoauszug erscheint die Erstattung möglicherweise nicht als neue Zahlung, sondern als aufgehobene Reservierung.",
    ],
    refundCardWa: [
      "Wir haben {{summa}} vollständig auf die Karte erstattet, mit der Sie bezahlt haben.",
      "Je nach Bank erscheint das Geld in der Regel innerhalb von 5-10 Werktagen auf Ihrem Konto.",
    ],
    refundBalance: "Den Betrag von {{summa}} haben wir Ihrem PROVIN Kontoguthaben gutgeschrieben.",
    auditsTip:
      "Wenn Sie den Kauf noch planen, empfehlen wir das PROVIN AUDIT - Unfall- und Kilometerstandshistorie aus mehreren europäischen Datenbanken, Händler-Servicehistorie sowie eine Analyse des Inserats und der Risiken.",
    order: "Bestellen: {{audits_saite}}",
    auditsTipWa: "Wenn Sie den Kauf noch planen, können wir das vollständige PROVIN AUDIT erstellen: {{audits_saite}}",
    cancelledSubject: "PROVIN · Bestellung storniert, Geld erstattet{{#vin}} · {{vin}}{{/vin}}",
    cancelled:
      "wir haben Ihre Bestellung des Auktionsarchivs{{#vin}} für das Fahrzeug mit der FIN {{vin}}{{/vin}} storniert.{{#karte}} Wir haben {{summa}} vollständig auf die Karte erstattet, mit der Sie bezahlt haben.{{/karte}}{{#atlikums}} Den Betrag von {{summa}} haben wir Ihrem PROVIN Kontoguthaben gutgeschrieben.{{/atlikums}}",
    cancelledCardDays: "Je nach Bank erscheint das Geld in der Regel innerhalb von 5-10 Werktagen auf Ihrem Konto.",
    again: "Wenn Sie erneut bestellen möchten, antworten Sie einfach auf diese Nachricht.",
    againWa: "Wenn Sie erneut bestellen möchten, schreiben Sie hier.",
  },
};

function archiveReady(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = ARCHIVE[lang];
  const apraksts = ["{{#apraksts}}", "{{apraksts}}", "", "{{/apraksts}}"];
  if (channel === "whatsapp") {
    return {
      body: [
        c.greeting, "", c.readyWa, "", ...apraksts,
        "{{#maksajuma_saite}}", c.offerWa, "", c.payWa, "", "{{/maksajuma_saite}}",
        c.questionsWa, "", "{{#atsauksmes_saite}}", c.reviewWa, "", "{{/atsauksmes_saite}}", WA_SIGN,
      ].join("\n"),
    };
  }
  return {
    subject: c.readySubject,
    body: [
      c.greeting, "", c.ready, "", ...apraksts,
      "{{#maksajuma_saite}}", ...c.offerLead, "", c.paid, c.extra, c.total, "", c.pay, "", "{{/maksajuma_saite}}",
      c.questions, "", "{{#atsauksmes_saite}}", c.review, "", "{{/atsauksmes_saite}}", emailSign(lang),
    ].join("\n"),
  };
}

function archiveNoData(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = ARCHIVE[lang];
  const card = channel === "email" ? c.refundCard : c.refundCardWa;
  const refund = ["{{#karte}}", ...card, "{{/karte}}", "{{#atlikums}}", c.refundBalance, "{{/atlikums}}"];
  if (channel === "whatsapp") {
    return { body: [c.greeting, "", c.noData, "", ...refund, "", c.auditsTipWa, "", c.questionsWa, "", WA_SIGN].join("\n") };
  }
  return {
    subject: c.noDataSubject,
    body: [c.greeting, "", c.noData, "", ...refund, "", c.auditsTip, "", c.order, "", c.questions, "", emailSign(lang)].join("\n"),
  };
}

function archiveCancelled(lang: ForeignLang, channel: "email" | "whatsapp"): LocalizedTemplate {
  const c = ARCHIVE[lang];
  const body = [
    c.greeting, "", c.cancelled, "", "{{#karte}}", c.cancelledCardDays, "{{/karte}}", "",
    channel === "email" ? c.again : c.againWa, "", channel === "email" ? emailSign(lang) : WA_SIGN,
  ].join("\n");
  return channel === "email" ? { subject: c.cancelledSubject, body } : { body };
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
  "email.unpaid_reminder": UNPAID_REMINDER,
  "email.client_link": CLIENT_LINK,
  "email.upsell.mini_to_dealer": perLang((l) => upsellMiniToDealer(l, "email")),
  "wa.upsell.mini_to_dealer": perLang((l) => upsellMiniToDealer(l, "whatsapp")),
  "email.upsell.dealer_to_audit": perLang((l) => upsellDealerToAudit(l, "email")),
  "wa.upsell.dealer_to_audit": perLang((l) => upsellDealerToAudit(l, "whatsapp")),
  "email.upsell.mini_to_audit": perLang((l) => upsellMiniToAudit(l, "email")),
  "wa.upsell.mini_to_audit": perLang((l) => upsellMiniToAudit(l, "whatsapp")),
  "email.auction_archive_send.ready": perLang((l) => archiveReady(l, "email")),
  "wa.auction_archive_send.ready": perLang((l) => archiveReady(l, "whatsapp")),
  "email.auction_archive_send.no_data": perLang((l) => archiveNoData(l, "email")),
  "wa.auction_archive_send.no_data": perLang((l) => archiveNoData(l, "whatsapp")),
  "email.auction_archive_send.cancelled": perLang((l) => archiveCancelled(l, "email")),
  "wa.auction_archive_send.cancelled": perLang((l) => archiveCancelled(l, "whatsapp")),
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
