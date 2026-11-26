import type { MessageTemplateDef, MessageTemplateVar } from "@/lib/messages/types";

/**
 * «Izsoļu arhīvs» kā atsevišķs pakalpojums - «Sūtīt klientam» logs (Nils 23.11): tie paši 3 gadījumi un
 * bloki kā dīlera datiem («Dati gatavi» / «Datu nav» / «Atcelts»), pielāgoti izsoļu arhīvam. Tikai LV.
 * {{apraksts}} - kas ir arhīvā (izsoles, bildes, nobraukums; cenas tikai ar «Rādīt izsoļu cenas»).
 */

const GROUP = "Izsoļu arhīvs - Sūtīt klientam";

const VIN: MessageTemplateVar = { key: "vin", label: "VIN", sample: "WAUZZZF43PA018831" };
const ZIMOLS: MessageTemplateVar = { key: "zimols", label: "Zīmols (PROVIN.LV / B2B: PROVIN)", sample: "PROVIN.LV", required: true };
const APRAKSTS: MessageTemplateVar = {
  key: "apraksts",
  label: "Arhīva saturs (izsoles, bildes)",
  sample:
    "Arhīvā: 2 izsoles (21.10.2026, Itālija), 84 oriģinālās izsoles bildes ar datumiem, nobraukums un bojājumi pa zonām. Bildēs redzams auto stāvoklis pirms tā ievešanas Latvijā - skrāpējumi, iespējamie bojājumi un citas detaļas, ko pēc remonta vai sakopšanas vairs neredz.",
};
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

const EMAIL_SIGN = ["Ar cieņu,", "{{zimols}}"].join("\n");
const WA_SIGN = "{{zimols}}";

const REFUND_EMAIL = [
  "{{#karte}}",
  "Atmaksājām {{summa}} pilnā apmērā uz karti, ar kuru maksājāt.",
  "Atkarībā no bankas nauda kontā parasti parādās 5-10 darba dienu laikā.",
  "Bankas izrakstā atmaksa var parādīties nevis kā jauns maksājums, bet kā atcelta rezervētā summa.",
  "{{/karte}}",
  "{{#atlikums}}",
  "Summu {{summa}} atgriezām Jūsu PROVIN konta atlikumā.",
  "{{/atlikums}}",
];

export const AUCTION_ARCHIVE_SEND_TEMPLATE_DEFS: MessageTemplateDef[] = [
  {
    id: "email.auction_archive_send.ready",
    channel: "email",
    group: GROUP,
    title: "E-pasts: izsoļu arhīvs gatavs (piedāvājums / atsauksme)",
    subject: "PROVIN · Atskaite gatava · Izsoļu arhīvs{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Labdien!",
      "",
      "Jūsu pasūtītais izsoļu arhīvs{{#vin}} auto VIN {{vin}}{{/vin}} ir gatavs - PDF pielikumā.",
      "",
      "{{#apraksts}}",
      "{{apraksts}}",
      "",
      "{{/apraksts}}",
      "{{#maksajuma_saite}}",
      "Izsoļu arhīvs rāda auto stāvokli izsoles dienā. Ja apsverat šī auto pirkšanu, iesakām pilno PROVIN AUDITU. Tajā pašā pasūtījumā papildināsim:",
      "- negadījumu un nobraukuma vēsturi no vairākām Eiropas datubāzēm;",
      "- oficiālā dīlera servisa vēsturi, ja tā pieejama;",
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
      "Ja mūsu darbs Jums noderēja, būšu pateicīgs par īsu atsauksmi Google: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      EMAIL_SIGN,
    ].join("\n"),
    vars: [VIN, APRAKSTS, ...OFFER_VARS, REVIEW, ZIMOLS],
    htmlKind: "dealer_operator",
  },
  {
    id: "wa.auction_archive_send.ready",
    channel: "whatsapp",
    group: GROUP,
    title: "WhatsApp: izsoļu arhīvs gatavs (piedāvājums / atsauksme)",
    body: [
      "Labdien!",
      "",
      "Jūsu pasūtītais izsoļu arhīvs{{#vin}} auto VIN {{vin}}{{/vin}} ir gatavs - PDF pievienoju zemāk.",
      "",
      "{{#apraksts}}",
      "{{apraksts}}",
      "",
      "{{/apraksts}}",
      "{{#maksajuma_saite}}",
      "Izsoļu arhīvs rāda auto stāvokli izsoles dienā. Ja apsverat pirkumu, tajā pašā pasūtījumā varam sagatavot pilno PROVIN AUDITU - negadījumu un nobraukuma vēsturi, dīlera servisa vēsturi un sludinājuma un risku analīzi ar ieteikumiem klātienes apskatei.",
      "",
      "Piemaksa: {{piemaksa}} (kopā {{kopa}}, jau samaksāts {{jau_samaksats}})",
      "Apmaksāt: {{maksajuma_saite}}",
      "",
      "{{/maksajuma_saite}}",
      "Ja ir jautājumi, rakstiet šeit vai uz info@provin.lv.",
      "",
      "{{#atsauksmes_saite}}",
      "Ja dati noderēja, būšu pateicīgs par īsu atsauksmi Google: {{atsauksmes_saite}}",
      "",
      "{{/atsauksmes_saite}}",
      WA_SIGN,
    ].join("\n"),
    vars: [VIN, APRAKSTS, ...OFFER_VARS, REVIEW, ZIMOLS],
  },
  {
    id: "email.auction_archive_send.no_data",
    channel: "email",
    group: GROUP,
    title: "E-pasts: izsoļu arhīvā datu nav (atmaksa)",
    subject: "PROVIN · Izsoļu arhīvā datu nav, nauda atgriezta{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Labdien!",
      "",
      "Pārbaudījām auto{{#vin}} VIN {{vin}}{{/vin}} - diemžēl Eiropas izsoļu arhīvā par šo auto ierakstu nav.",
      "",
      ...REFUND_EMAIL,
      "",
      "Ja auto vēl tikai plānojat pirkt, iesakām PROVIN AUDITU - negadījumu un nobraukuma vēsturi no vairākām Eiropas datubāzēm, dīlera servisa vēsturi un sludinājuma un risku analīzi.",
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
    id: "wa.auction_archive_send.no_data",
    channel: "whatsapp",
    group: GROUP,
    title: "WhatsApp: izsoļu arhīvā datu nav (atmaksa)",
    body: [
      "Labdien!",
      "",
      "Pārbaudījām auto{{#vin}} VIN {{vin}}{{/vin}} - diemžēl Eiropas izsoļu arhīvā par šo auto ierakstu nav.",
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
    id: "email.auction_archive_send.cancelled",
    channel: "email",
    group: GROUP,
    title: "E-pasts: izsoļu arhīva pasūtījums atcelts",
    subject: "PROVIN · Pasūtījums atcelts, nauda atgriezta{{#vin}} · {{vin}}{{/vin}}",
    body: [
      "Labdien!",
      "",
      "Atcēlām Jūsu izsoļu arhīva pasūtījumu{{#vin}} auto VIN {{vin}}{{/vin}}.{{#karte}} Atmaksājām {{summa}} pilnā apmērā uz karti, ar kuru maksājāt.{{/karte}}{{#atlikums}} Summu {{summa}} atgriezām Jūsu PROVIN konta atlikumā.{{/atlikums}}",
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
    id: "wa.auction_archive_send.cancelled",
    channel: "whatsapp",
    group: GROUP,
    title: "WhatsApp: izsoļu arhīva pasūtījums atcelts",
    body: [
      "Labdien!",
      "",
      "Atcēlām Jūsu izsoļu arhīva pasūtījumu{{#vin}} auto VIN {{vin}}{{/vin}}.{{#karte}} Atmaksājām {{summa}} pilnā apmērā uz karti, ar kuru maksājāt.{{/karte}}{{#atlikums}} Summu {{summa}} atgriezām Jūsu PROVIN konta atlikumā.{{/atlikums}}",
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
];
