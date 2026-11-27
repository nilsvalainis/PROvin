import type { MessageTemplateDef, MessageTemplateVar } from "@/lib/messages/types";

/**
 * AUDITS / BUSINESS «Sūtīt atskaiti» forma (Nila makets 27.11, «A A A»): 2 situācijas («Gatava», «Labota versija»)
 * privātam klientam (B2C) un B2B partnerim (diskrēts: tikai «PROVIN», virsraksts «Transportlīdzekļa pārbaude»,
 * bez mārketinga, bez partnera nosaukuma, bez auto nosaukuma). LV teksts labojams adminā «Šabloni»;
 * EN / RU / DE - `AUDITS_SEND_LOCALIZED` (ne-LV versijām LV pārrakstu neizmanto).
 * Paraksts bez vārda: {{zimols}} = «PROVIN.LV» (B2C) vai «PROVIN» (B2B). Nekāda «pirkt / nepirkt» verdikta.
 */

const GROUP = "AUDITS - Sūtīt atskaiti";

const VIN: MessageTemplateVar = { key: "vin", label: "VIN", sample: "WAUZZZ4G7FN012345" };
const AUTO: MessageTemplateVar = { key: "auto", label: "Auto (marka modelis; tukšs = bez)", sample: "Audi A6 Avant 3.0 TDI" };
const ZIMOLS: MessageTemplateVar = { key: "zimols", label: "Zīmols (PROVIN.LV / B2B: PROVIN)", sample: "PROVIN.LV", required: true };
const ZIMOLS_B2B: MessageTemplateVar = { key: "zimols", label: "Zīmols (B2B: PROVIN)", sample: "PROVIN", required: true };

export type AuditsSendTemplateKey = "ready" | "fixed" | "b2b_ready" | "b2b_fixed";

type Copy = {
  greeting: string;
  sign: string;
  ready: { subject: string; main: string; mainWa: string };
  fixed: { subject: string; main: string; mainWa: string };
  b2bReady: { subject: string; main: string; mainWa: string };
  b2bFixed: { subject: string; main: string; mainWa: string };
  questions: string;
  questionsWa: string;
  b2bQuestions: string;
  b2bQuestionsWa: string;
};

const CAR_VIN: Record<"lv" | "en" | "ru" | "de", string> = {
  lv: "{{#auto}} auto {{auto}}{{/auto}}{{#vin}} (VIN {{vin}}){{/vin}}",
  en: "{{#auto}} for {{auto}}{{/auto}}{{#vin}} (VIN {{vin}}){{/vin}}",
  ru: "{{#auto}} по автомобилю {{auto}}{{/auto}}{{#vin}} (VIN {{vin}}){{/vin}}",
  de: "{{#auto}} für {{auto}}{{/auto}}{{#vin}} (FIN {{vin}}){{/vin}}",
};
const ONLY_VIN: Record<"lv" | "en" | "ru" | "de", string> = {
  lv: "{{#vin}} (VIN {{vin}}){{/vin}}",
  en: "{{#vin}} (VIN {{vin}}){{/vin}}",
  ru: "{{#vin}} (VIN {{vin}}){{/vin}}",
  de: "{{#vin}} (FIN {{vin}}){{/vin}}",
};
const SUBJ_VIN = "{{#vin}} · {{vin}}{{/vin}}";

export const AUDITS_SEND_COPY: Record<"lv" | "en" | "ru" | "de", Copy> = {
  lv: {
    greeting: "Labdien!",
    sign: "Ar cieņu,",
    ready: {
      subject: `PROVIN.LV · AUDITS atskaite gatava${SUBJ_VIN}`,
      main: `Jūsu PROVIN AUDITS atskaite${CAR_VIN.lv} ir gatava - PDF un pielikumi šajā e-pastā.`,
      mainWa: `Jūsu PROVIN AUDITS atskaite${CAR_VIN.lv} ir gatava - PDF pievienojam zemāk.`,
    },
    fixed: {
      subject: `PROVIN.LV · AUDITS atskaite - labota versija${SUBJ_VIN}`,
      main: `Nosūtām Jūsu PROVIN AUDITS atskaites labotu versiju${CAR_VIN.lv}. Lūdzu, izmantojiet šo versiju - iepriekšējā vairs nav aktuāla.`,
      mainWa: `Nosūtām Jūsu PROVIN AUDITS atskaites labotu versiju${CAR_VIN.lv} - PDF pievienojam zemāk. Lūdzu, izmantojiet šo versiju - iepriekšējā vairs nav aktuāla.`,
    },
    b2bReady: {
      subject: `Transportlīdzekļa pārbaude${SUBJ_VIN}`,
      main: `Transportlīdzekļa pārbaudes atskaite${ONLY_VIN.lv} ir gatava - PDF pielikumā.`,
      mainWa: `Transportlīdzekļa pārbaudes atskaite${ONLY_VIN.lv} ir gatava - PDF pievienojam zemāk.`,
    },
    b2bFixed: {
      subject: `Transportlīdzekļa pārbaude · labota versija${SUBJ_VIN}`,
      main: `Nosūtām transportlīdzekļa pārbaudes atskaites labotu versiju${ONLY_VIN.lv}. Lūdzu, izmantojiet šo versiju.`,
      mainWa: `Nosūtām transportlīdzekļa pārbaudes atskaites labotu versiju${ONLY_VIN.lv} - PDF pievienojam zemāk. Lūdzu, izmantojiet šo versiju.`,
    },
    questions: "Ja ir jautājumi, vienkārši atbildiet uz šo e-pastu.",
    questionsWa: "Ja ir jautājumi, rakstiet šeit.",
    b2bQuestions: "Jautājumi - atbildiet uz šo e-pastu.",
    b2bQuestionsWa: "Jautājumi - rakstiet šeit.",
  },
  en: {
    greeting: "Hello!",
    sign: "Best regards,",
    ready: {
      subject: `PROVIN.LV · AUDITS report ready${SUBJ_VIN}`,
      main: `Your PROVIN AUDITS report${CAR_VIN.en} is ready - the PDF and attachments are in this email.`,
      mainWa: `Your PROVIN AUDITS report${CAR_VIN.en} is ready - the PDF follows below.`,
    },
    fixed: {
      subject: `PROVIN.LV · AUDITS report - corrected version${SUBJ_VIN}`,
      main: `We are sending a corrected version of your PROVIN AUDITS report${CAR_VIN.en}. Please use this version - the previous one is no longer valid.`,
      mainWa: `We are sending a corrected version of your PROVIN AUDITS report${CAR_VIN.en} - the PDF follows below. Please use this version - the previous one is no longer valid.`,
    },
    b2bReady: {
      subject: `Vehicle check${SUBJ_VIN}`,
      main: `The vehicle check report${ONLY_VIN.en} is ready - PDF attached.`,
      mainWa: `The vehicle check report${ONLY_VIN.en} is ready - the PDF follows below.`,
    },
    b2bFixed: {
      subject: `Vehicle check · corrected version${SUBJ_VIN}`,
      main: `We are sending a corrected version of the vehicle check report${ONLY_VIN.en}. Please use this version.`,
      mainWa: `We are sending a corrected version of the vehicle check report${ONLY_VIN.en} - the PDF follows below. Please use this version.`,
    },
    questions: "If you have any questions, simply reply to this email.",
    questionsWa: "If you have any questions, write here.",
    b2bQuestions: "Questions - reply to this email.",
    b2bQuestionsWa: "Questions - write here.",
  },
  ru: {
    greeting: "Здравствуйте!",
    sign: "С уважением,",
    ready: {
      subject: `PROVIN.LV · Отчёт AUDITS готов${SUBJ_VIN}`,
      main: `Ваш отчёт PROVIN AUDITS${CAR_VIN.ru} готов - PDF и вложения в этом письме.`,
      mainWa: `Ваш отчёт PROVIN AUDITS${CAR_VIN.ru} готов - PDF прикрепляем ниже.`,
    },
    fixed: {
      subject: `PROVIN.LV · Отчёт AUDITS - исправленная версия${SUBJ_VIN}`,
      main: `Отправляем исправленную версию Вашего отчёта PROVIN AUDITS${CAR_VIN.ru}. Пожалуйста, используйте эту версию - предыдущая больше не актуальна.`,
      mainWa: `Отправляем исправленную версию Вашего отчёта PROVIN AUDITS${CAR_VIN.ru} - PDF прикрепляем ниже. Пожалуйста, используйте эту версию - предыдущая больше не актуальна.`,
    },
    b2bReady: {
      subject: `Проверка транспортного средства${SUBJ_VIN}`,
      main: `Отчёт о проверке транспортного средства${ONLY_VIN.ru} готов - PDF во вложении.`,
      mainWa: `Отчёт о проверке транспортного средства${ONLY_VIN.ru} готов - PDF прикрепляем ниже.`,
    },
    b2bFixed: {
      subject: `Проверка транспортного средства · исправленная версия${SUBJ_VIN}`,
      main: `Отправляем исправленную версию отчёта о проверке${ONLY_VIN.ru}. Пожалуйста, используйте эту версию.`,
      mainWa: `Отправляем исправленную версию отчёта о проверке${ONLY_VIN.ru} - PDF прикрепляем ниже. Пожалуйста, используйте эту версию.`,
    },
    questions: "Если у Вас есть вопросы, просто ответьте на это письмо.",
    questionsWa: "Если у Вас есть вопросы, пишите здесь.",
    b2bQuestions: "Вопросы - ответьте на это письмо.",
    b2bQuestionsWa: "Вопросы - пишите здесь.",
  },
  de: {
    greeting: "Guten Tag,",
    sign: "Mit freundlichen Grüßen,",
    ready: {
      subject: `PROVIN.LV · AUDITS Bericht fertig${SUBJ_VIN}`,
      main: `Ihr PROVIN AUDITS Bericht${CAR_VIN.de} ist fertig - PDF und Anhänge finden Sie in dieser E-Mail.`,
      mainWa: `Ihr PROVIN AUDITS Bericht${CAR_VIN.de} ist fertig - das PDF folgt unten.`,
    },
    fixed: {
      subject: `PROVIN.LV · AUDITS Bericht - korrigierte Fassung${SUBJ_VIN}`,
      main: `Anbei die korrigierte Fassung Ihres PROVIN AUDITS Berichts${CAR_VIN.de}. Bitte verwenden Sie diese Fassung - die vorherige ist nicht mehr gültig.`,
      mainWa: `Anbei die korrigierte Fassung Ihres PROVIN AUDITS Berichts${CAR_VIN.de} - das PDF folgt unten. Bitte verwenden Sie diese Fassung - die vorherige ist nicht mehr gültig.`,
    },
    b2bReady: {
      subject: `Fahrzeugprüfung${SUBJ_VIN}`,
      main: `Der Bericht zur Fahrzeugprüfung${ONLY_VIN.de} ist fertig - PDF im Anhang.`,
      mainWa: `Der Bericht zur Fahrzeugprüfung${ONLY_VIN.de} ist fertig - das PDF folgt unten.`,
    },
    b2bFixed: {
      subject: `Fahrzeugprüfung · korrigierte Fassung${SUBJ_VIN}`,
      main: `Anbei die korrigierte Fassung des Prüfberichts${ONLY_VIN.de}. Bitte verwenden Sie diese Fassung.`,
      mainWa: `Anbei die korrigierte Fassung des Prüfberichts${ONLY_VIN.de} - das PDF folgt unten. Bitte verwenden Sie diese Fassung.`,
    },
    questions: "Bei Fragen antworten Sie einfach auf diese E-Mail.",
    questionsWa: "Bei Fragen schreiben Sie einfach hier.",
    b2bQuestions: "Fragen - antworten Sie einfach auf diese E-Mail.",
    b2bQuestionsWa: "Fragen - schreiben Sie einfach hier.",
  },
};

const KEY_COPY: Record<AuditsSendTemplateKey, "ready" | "fixed" | "b2bReady" | "b2bFixed"> = {
  ready: "ready",
  fixed: "fixed",
  b2b_ready: "b2bReady",
  b2b_fixed: "b2bFixed",
};

/** Viena šablona teksts dotajā valodā (LV - reģistram, EN/RU/DE - tulkojumiem). */
export function auditsSendTemplateText(
  lang: "lv" | "en" | "ru" | "de",
  key: AuditsSendTemplateKey,
  channel: "email" | "whatsapp",
): { subject?: string; body: string } {
  const c = AUDITS_SEND_COPY[lang];
  const part = c[KEY_COPY[key]];
  const b2b = key.startsWith("b2b_");
  const questions = channel === "email" ? (b2b ? c.b2bQuestions : c.questions) : b2b ? c.b2bQuestionsWa : c.questionsWa;
  const main = channel === "email" ? part.main : part.mainWa;
  const sign = channel === "email" ? [c.sign, "{{zimols}}"].join("\n") : "{{zimols}}";
  const body = [c.greeting, "", main, "", questions, "", sign].join("\n");
  return channel === "email" ? { subject: part.subject, body } : { body };
}

const KEYS: AuditsSendTemplateKey[] = ["ready", "fixed", "b2b_ready", "b2b_fixed"];

const TITLES: Record<AuditsSendTemplateKey, string> = {
  ready: "atskaite gatava (privāts klients)",
  fixed: "labota versija (privāts klients)",
  b2b_ready: "atskaite gatava (B2B, diskrēts)",
  b2b_fixed: "labota versija (B2B, diskrēts)",
};

export function auditsSendTemplateIdFor(channel: "email" | "whatsapp", key: AuditsSendTemplateKey): string {
  return `${channel === "email" ? "email" : "wa"}.audits_send.${key}`;
}

export const AUDITS_SEND_TEMPLATE_DEFS: MessageTemplateDef[] = KEYS.flatMap((key) =>
  (["email", "whatsapp"] as const).map((channel): MessageTemplateDef => {
    const t = auditsSendTemplateText("lv", key, channel);
    const b2b = key.startsWith("b2b_");
    return {
      id: auditsSendTemplateIdFor(channel, key),
      channel,
      group: GROUP,
      title: `${channel === "email" ? "E-pasts" : "WhatsApp"}: ${TITLES[key]}`,
      ...(t.subject ? { subject: t.subject } : {}),
      body: t.body,
      vars: b2b ? [VIN, ZIMOLS_B2B] : [VIN, AUTO, ZIMOLS],
      ...(channel === "email" ? { htmlKind: "dealer_operator" as const } : {}),
    };
  }),
);

/** EN / RU / DE tulkojumi visiem 8 šabloniem (`LOCALIZED_TEMPLATES`). */
export const AUDITS_SEND_LOCALIZED: Record<string, Record<"en" | "ru" | "de", { subject?: string; body: string }>> =
  Object.fromEntries(
    KEYS.flatMap((key) =>
      (["email", "whatsapp"] as const).map((channel) => [
        auditsSendTemplateIdFor(channel, key),
        {
          en: auditsSendTemplateText("en", key, channel),
          ru: auditsSendTemplateText("ru", key, channel),
          de: auditsSendTemplateText("de", key, channel),
        },
      ]),
    ),
  );
