import type { MessageTemplateDef, MessageTemplateVar } from "@/lib/messages/types";

/**
 * Dīlera dati «Sūtīt klientam» logs (Nila apstiprinātais makets 19.11.2026) un atsauksmes lūgums.
 * Neobligātie bloki: {{#x}}…{{/x}} - rāda tikai, ja x nav tukšs.
 * {{#karte}} - B2C (atmaksa uz karti), {{#atlikums}} - B2B (atgriezts PROVIN konta atlikumā).
 * {{zimols}}: «PROVIN.LV» privātam klientam, «PROVIN» B2B partnerim.
 * Teksts nesola «pirkt / nepirkt» ieteikumu.
 */

const GROUP = "Dīlera dati - Sūtīt klientam";

const VIN: MessageTemplateVar = { key: "vin", label: "VIN", sample: "WVWZZZ1KZAW000123" };
const ZIMOLS: MessageTemplateVar = { key: "zimols", label: "Zīmols (PROVIN.LV / B2B: PROVIN)", sample: "PROVIN.LV", required: true };
const SUMMA: MessageTemplateVar = { key: "summa", label: "Atgrieztā summa", sample: "24,99 €" };
const KARTE: MessageTemplateVar = { key: "karte", label: "Privāts klients (atmaksa uz karti)", sample: "1" };
const ATLIKUMS: MessageTemplateVar = { key: "atlikums", label: "B2B (atgriezts konta atlikumā)", sample: "" };
const AUDITS_SAITE: MessageTemplateVar = {
  key: "audits_saite",
  label: "AUDITS pasūtīšanas saite",
  sample: "https://www.provin.lv/lv?plan=audits",
  required: true,
};
const OFFER_VARS: MessageTemplateVar[] = [
  { key: "jau_samaksats", label: "Jau samaksāts", sample: "24,99 €" },
  { key: "piemaksa", label: "Piemaksa", sample: "75,00 €" },
  { key: "kopa", label: "Kopā", sample: "99,99 €" },
  { key: "maksajuma_saite", label: "Piedāvājuma saite (tukša = bez piedāvājuma)", sample: "https://www.provin.lv/lv/papildinajums/…" },
];
const REVIEW: MessageTemplateVar = {
  key: "atsauksmes_saite",
  label: "Google atsauksmes saite (tukša = bez lūguma)",
  sample: "https://g.page/r/…/review",
};

const AUTO: MessageTemplateVar = { key: "auto", label: "Auto (marka modelis vai «Jūsu auto (VIN …1234)»)", sample: "VW Golf", required: true };

const EMAIL_SIGN = ["Ar cieņu,", "{{zimols}}"].join("\n");
const WA_SIGN = "{{zimols}}";

export const DEALER_SEND_TEMPLATE_DEFS: MessageTemplateDef[] = [
  {
    id: "email.dealer_send.ready",
    channel: "email",
    group: GROUP,
    title: "E-pasts: dati gatavi (piedāvājums / atsauksme)",
    subject: "PROVIN · Atskaite gatava · Oficiālā dīlera dati{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Labdien!",
      "",
      "Jūsu pasūtītie oficiālā dīlera dati{{#vin}} auto VIN {{vin}}{{/vin}} ir gatavi - PDF pielikumā.",
      "",
      "{{#maksajuma_saite}}",
      "Dīlera dati parāda tikai to, kas reģistrēts oficiālajos servisos. Ja apsverat šī auto pirkšanu, iesakām pilno PROVIN AUDITU. Tajā pašā pasūtījumā papildināsim:",
      "- negadījumu un nobraukuma vēsturi no vairākām Eiropas datubāzēm;",
      "- pārbaudi izsoļu arhīvos (bildes, bojājumi, cenas);",
      "- sludinājuma un risku analīzi - konstatētos faktus un ieteikumus, arī klātienes apskatei, lai lēmumu par pirkumu varat pieņemt droši.",
      "",
      "Jau samaksāts: {{jau_samaksats}}",
      "Piemaksa: {{piemaksa}}",
      "Kopā: {{kopa}}",
      "",
      "Apmaksāt: {{maksajuma_saite}} (saite derīga 30 dienas)",
      "",
      "{{/maksajuma_saite}}",
      "Ja ir jautājumi, atbildiet uz šo ziņu vai rakstiet uz info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "Ja mūsu darbs Jums noderēja, būsim pateicīgi par īsu atsauksmi Google: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      EMAIL_SIGN,
    ].join("\n"),
    vars: [VIN, ...OFFER_VARS, REVIEW, ZIMOLS],
    htmlKind: "dealer_operator",
  },
  {
    id: "wa.dealer_send.ready",
    channel: "whatsapp",
    group: GROUP,
    title: "WhatsApp: dati gatavi (piedāvājums / atsauksme)",
    body: [
      "Labdien!",
      "",
      "Jūsu pasūtītie oficiālā dīlera dati{{#vin}} auto VIN {{vin}}{{/vin}} ir gatavi - PDF pievienojam zemāk.",
      "",
      "{{#maksajuma_saite}}",
      "Dīlera dati rāda tikai oficiālo servisu ierakstus. Ja apsverat pirkumu, tajā pašā pasūtījumā varam sagatavot pilno PROVIN AUDITU - negadījumu un nobraukuma vēsturi, izsoļu arhīvus un sludinājuma un risku analīzi ar ieteikumiem klātienes apskatei.",
      "",
      "Piemaksa: {{piemaksa}} (kopā {{kopa}}, jau samaksāts {{jau_samaksats}})",
      "Apmaksāt: {{maksajuma_saite}}",
      "",
      "{{/maksajuma_saite}}",
      "Ja ir jautājumi, rakstiet šeit vai uz info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "Ja dati noderēja, būsim pateicīgi par īsu atsauksmi Google: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      WA_SIGN,
    ].join("\n"),
    vars: [VIN, ...OFFER_VARS, REVIEW, ZIMOLS],
  },
  {
    id: "email.dealer_send.no_data",
    channel: "email",
    group: GROUP,
    title: "E-pasts: datu nav (atmaksa)",
    subject: "PROVIN · Dīlera dati nav pieejami, nauda atgriezta{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Labdien!",
      "",
      "Pārbaudījām auto{{#vin}} VIN {{vin}}{{/vin}} - diemžēl oficiālā dīlera dati šim auto nav pieejami.",
      "",
      "{{#karte}}",
      "Atmaksājām {{summa}} pilnā apmērā uz karti, ar kuru maksājāt.",
      "Atkarībā no bankas nauda kontā parasti parādās 5-10 darba dienu laikā.",
      "Bankas izrakstā atmaksa var parādīties nevis kā jauns maksājums, bet kā atcelta rezervētā summa.",
      "{{/karte}}",
      "{{#atlikums}}",
      "Summu {{summa}} atgriezām Jūsu PROVIN konta atlikumā.",
      "{{/atlikums}}",
      "",
      "Ja auto vēl tikai plānojat pirkt, iesakām PROVIN AUDITU - negadījumu un nobraukuma vēsturi no vairākām Eiropas datubāzēm, izsoļu arhīvu pārbaudi un sludinājuma un risku analīzi.",
      "",
      "Pasūtīt: {{audits_saite}}",
      "",
      "Ja ir jautājumi, atbildiet uz šo ziņu vai rakstiet uz info@provin.lv.",
      "",
      EMAIL_SIGN,
    ].join("\n"),
    vars: [VIN, SUMMA, KARTE, ATLIKUMS, AUDITS_SAITE, ZIMOLS],
    htmlKind: "dealer_operator",
  },
  {
    id: "wa.dealer_send.no_data",
    channel: "whatsapp",
    group: GROUP,
    title: "WhatsApp: datu nav (atmaksa)",
    body: [
      "Labdien!",
      "",
      "Pārbaudījām auto{{#vin}} VIN {{vin}}{{/vin}} - diemžēl oficiālā dīlera dati šim auto nav pieejami.",
      "",
      "{{#karte}}",
      "Atmaksājām {{summa}} pilnā apmērā uz karti, ar kuru maksājāt.",
      "Atkarībā no bankas nauda kontā parasti parādās 5-10 darba dienu laikā.",
      "{{/karte}}",
      "{{#atlikums}}",
      "Summu {{summa}} atgriezām Jūsu PROVIN konta atlikumā.",
      "{{/atlikums}}",
      "",
      "Ja auto vēl plānojat pirkt, varam sagatavot pilno PROVIN AUDITU: {{audits_saite}}",
      "",
      "Ja ir jautājumi, rakstiet šeit vai uz info@provin.lv.",
      "",
      WA_SIGN,
    ].join("\n"),
    vars: [VIN, SUMMA, KARTE, ATLIKUMS, AUDITS_SAITE, ZIMOLS],
  },
  {
    id: "email.dealer_send.cancelled",
    channel: "email",
    group: GROUP,
    title: "E-pasts: pasūtījums atcelts",
    subject: "PROVIN · Pasūtījums atcelts, nauda atgriezta{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Labdien!",
      "",
      "Atcēlām Jūsu oficiālā dīlera datu pasūtījumu{{#vin}} auto VIN {{vin}}{{/vin}}.{{#karte}} Atmaksājām {{summa}} pilnā apmērā uz karti, ar kuru maksājāt.{{/karte}}{{#atlikums}} Summu {{summa}} atgriezām Jūsu PROVIN konta atlikumā.{{/atlikums}}",
      "",
      "{{#karte}}",
      "Atkarībā no bankas nauda kontā parasti parādās 5-10 darba dienu laikā.",
      "{{/karte}}",
      "",
      "Ja vēlaties pasūtīt atkārtoti, atbildiet uz šo ziņu.",
      "",
      EMAIL_SIGN,
    ].join("\n"),
    vars: [VIN, SUMMA, KARTE, ATLIKUMS, ZIMOLS],
    htmlKind: "dealer_operator",
  },
  {
    id: "wa.dealer_send.cancelled",
    channel: "whatsapp",
    group: GROUP,
    title: "WhatsApp: pasūtījums atcelts",
    body: [
      "Labdien!",
      "",
      "Atcēlām Jūsu oficiālā dīlera datu pasūtījumu{{#vin}} auto VIN {{vin}}{{/vin}}.{{#karte}} Atmaksājām {{summa}} pilnā apmērā uz karti, ar kuru maksājāt.{{/karte}}{{#atlikums}} Summu {{summa}} atgriezām Jūsu PROVIN konta atlikumā.{{/atlikums}}",
      "",
      "{{#karte}}",
      "Atkarībā no bankas nauda kontā parasti parādās 5-10 darba dienu laikā.",
      "{{/karte}}",
      "",
      "Ja vēlaties pasūtīt atkārtoti, rakstiet šeit.",
      "",
      WA_SIGN,
    ].join("\n"),
    vars: [VIN, SUMMA, KARTE, ATLIKUMS, ZIMOLS],
  },
  {
    // Teksts = `lib/review-ask.ts` (LV). Faktisko e-pastu ar pogu «Novērtēt Google» veido kods (cron / admina poga).
    id: "email.review_request",
    channel: "email",
    group: GROUP,
    title: "E-pasts: Google atsauksmes lūgums",
    description: "Sūta automātiski nākamajā darba dienā pēc atskaites. {{auto}} - «VW Golf» vai «Jūsu auto (VIN …1234)».",
    subject: "Kā Jums noderēja atskaite par {{auto}}?",
    body: [
      "Labdien!",
      "",
      "Pirms dažām dienām nosūtījām Jums PROVIN atskaiti par {{auto}}. Būsim pateicīgi, ja veltīsiet minūti un novērtēsiet mūsu darbu Google - Jūsu godīgais viedoklis palīdz citiem auto pircējiem.",
      "",
      "Novērtēt Google: {{atsauksmes_saite}}",
      "",
      "Jautājumi par atskaiti? Atbildiet uz šo e-pastu.",
      "",
      "{{paraksts}}",
    ].join("\n"),
    vars: [AUTO, VIN, { ...REVIEW, required: true }, { key: "paraksts", label: "Paraksts", sample: "Ar cieņu,\nPROVIN.LV", required: true }],
    htmlKind: "dealer_operator",
  },
  {
    id: "wa.review_request",
    channel: "whatsapp",
    group: GROUP,
    title: "WhatsApp: Google atsauksmes lūgums",
    description: "Atsevišķa īsa ziņa - sūta Nils ar pogu pasūtījumā. Saite atsevišķā rindā.",
    body: [
      "Labdien!",
      "",
      "Ceram, ka PROVIN atskaite par {{auto}} noderēja. Būsim pateicīgi, ja veltīsiet minūti un novērtēsiet mūsu darbu Google:",
      "{{atsauksmes_saite}}",
      "",
      "Paldies!",
      "PROVIN.LV",
    ].join("\n"),
    vars: [AUTO, VIN, { ...REVIEW, required: true }],
  },
];
