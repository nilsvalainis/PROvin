/**
 * Klienta apmaksas saite (/s/[token]) klienta valodā (Nils 26.11): saites lapa, WhatsApp teksts,
 * Stripe apraksts. E-pasta teksts nāk no `email.client_link` veidnes (localized-templates.ts).
 * Tīrs modulis - drošs gan serverī, gan klientā.
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";

export const CLIENT_LINK_LANGS: readonly ClientReportLang[] = ["lv", "en", "ru", "de"];

export const CLIENT_LINK_LANG_LABEL: Record<ClientReportLang, string> = { lv: "LV", en: "EN", ru: "RU", de: "DE" };

/** Nezināma / tukša vērtība = LV. */
export function normalizeClientLinkLang(raw: unknown): ClientReportLang {
  const t = typeof raw === "string" ? raw.trim().toLowerCase().slice(0, 2) : "";
  return t === "en" || t === "ru" || t === "de" ? t : "lv";
}

export type ClientLinkCopy = {
  intro: string;
  yourData: string;
  email: string;
  emailPlaceholder: string;
  vin: string;
  vinHint: (n: number) => string;
  listing: string;
  phone: string;
  payment: string;
  total: string;
  /** Apstiprinājuma teksts: [pirms, noteikumi, starp, privātums, pēc]. */
  consent: [string, string, string, string, string];
  submit: string;
  submitting: string;
  secure: string;
  validUntil: (until: string) => string;
  afterPay: string;
  errors: Record<
    | "email"
    | "vin"
    | "vin_length"
    | "listing"
    | "phone"
    | "consent"
    | "rate_limited"
    | "not_found"
    | "stripe_config"
    | "session_failed"
    | "network",
    string
  >;
  invalidTitle: string;
  invalidBody: string;
  waHello: string;
  waLine: (product: string, vin: string, amount: string, until: string) => string;
  waTail: string;
  stripeDescription: string;
};

const LV: ClientLinkCopy = {
  intro: "Ievadiet savus datus un auto informāciju. Pasūtījums tiks izveidots pēc apmaksas.",
  yourData: "Jūsu dati",
  email: "E-pasts",
  emailPlaceholder: "epasts@piemers.lv",
  vin: "VIN kods",
  vinHint: (n) => `17 zīmes · ${n}/17`,
  listing: "Sludinājuma saite",
  phone: "Tālrunis",
  payment: "Apmaksa",
  total: "Kopā apmaksai",
  consent: [
    "Apstiprinu, ka esmu iepazinies ar ",
    "Lietošanas noteikumiem",
    " un ",
    "Privātuma politiku",
    ", pilnvaroju PROVIN iegūt transportlīdzekļa datus manā vārdā, piekrītu digitālā pakalpojuma tūlītējai izpildei un apzinos, ka zaudēju atteikuma tiesības, kad izpilde ir sākusies.",
  ],
  submit: "Iesniegt un maksāt",
  submitting: "Sagatavo…",
  secure: "Droša apmaksa ar Stripe",
  validUntil: (u) => `Saite ir personīga un vienreizēja un derīga līdz ${u}.`,
  afterPay: "Pēc apmaksas tā vairs nebūs aktīva.",
  errors: {
    email: "Lauks nav aizpildīts pareizi.",
    vin: "Lūdzu, ievadiet derīgu VIN kodu (17 zīmes) vai valsts numurzīmi (3-6 zīmes).",
    vin_length: "VIN jābūt 17 zīmēm, pārbaudiet VIN numuru",
    listing: "Lūdzu, ievadiet derīgu saiti uz sludinājumu.",
    phone: "Lūdzu, ievadiet tālruņa numuru ar vismaz 8 cipariem.",
    consent: "Lai turpinātu uz apmaksu, atzīmējiet apstiprinājumu (noteikumi, privātuma politika, pilnvarojums un atteikuma tiesības).",
    rate_limited: "Pārāk daudz pieprasījumu. Uzgaidiet īsu brīdi un mēģiniet vēlreiz.",
    not_found: "Saite nav derīga.",
    stripe_config: "Apmaksa šobrīd nav pieejama. Mēģiniet vēlāk.",
    session_failed: "Neizdevās sagatavot apmaksu. Mēģiniet vēlreiz.",
    network: "Tīkla kļūda. Mēģiniet vēlreiz.",
  },
  invalidTitle: "Saite nav derīga",
  invalidBody: "Šī saite nav pieejama. Ja nepieciešams jauns piedāvājums, sazinieties ar PROVIN.",
  waHello: "Sveiki!",
  waLine: (p, vin, amount, until) => `Jūsu personīgā ${p} saite${vin ? ` (VIN ${vin})` : ""} - ${amount}, derīga līdz ${until}:`,
  waTail: "Ievadiet datus un veiciet apmaksu. Pasūtījums tiks izveidots pēc apmaksas.",
  stripeDescription: "Pasūtījums tiks izveidots pēc apmaksas.",
};

const EN: ClientLinkCopy = {
  intro: "Enter your details and the car information. The order is created after payment.",
  yourData: "Your details",
  email: "Email",
  emailPlaceholder: "email@example.com",
  vin: "VIN",
  vinHint: (n) => `17 characters · ${n}/17`,
  listing: "Listing link",
  phone: "Phone",
  payment: "Payment",
  total: "Total to pay",
  consent: [
    "I confirm that I have read the ",
    "Terms of Service",
    " and ",
    "Privacy Policy",
    ", authorize PROVIN to obtain vehicle data on my behalf, agree to immediate performance of the digital service, and acknowledge that I lose the right of withdrawal once performance starts.",
  ],
  submit: "Submit and pay",
  submitting: "Preparing…",
  secure: "Secure payment with Stripe",
  validUntil: (u) => `This link is personal, single-use and valid until ${u}.`,
  afterPay: "It will no longer be active after payment.",
  errors: {
    email: "This field is not filled in correctly.",
    vin: "Please enter a valid VIN (17 characters) or licence plate number (3-6 characters).",
    vin_length: "The VIN must be 17 characters long. Please check it.",
    listing: "Please enter a valid listing URL.",
    phone: "Please enter a phone number with at least 8 digits.",
    consent: "To continue to payment, please tick the confirmation (terms, privacy policy, authorisation and right of withdrawal).",
    rate_limited: "Too many requests. Please wait a moment and try again.",
    not_found: "This link is not valid.",
    stripe_config: "Payment is not available right now. Please try later.",
    session_failed: "Could not prepare the payment. Please try again.",
    network: "Network error. Please try again.",
  },
  invalidTitle: "Link not valid",
  invalidBody: "This link is not available. If you need a new offer, please contact PROVIN.",
  waHello: "Hello!",
  waLine: (p, vin, amount, until) => `Your personal ${p} link${vin ? ` (VIN ${vin})` : ""} - ${amount}, valid until ${until}:`,
  waTail: "Enter your details and pay. The order is created after payment.",
  stripeDescription: "The order is created after payment.",
};

const RU: ClientLinkCopy = {
  intro: "Введите свои данные и информацию об автомобиле. Заказ будет создан после оплаты.",
  yourData: "Ваши данные",
  email: "E-mail",
  emailPlaceholder: "email@example.com",
  vin: "VIN-код",
  vinHint: (n) => `17 символов · ${n}/17`,
  listing: "Ссылка на объявление",
  phone: "Телефон",
  payment: "Оплата",
  total: "Итого к оплате",
  consent: [
    "Подтверждаю, что ознакомился с ",
    "Условиями использования",
    " и ",
    "Политикой конфиденциальности",
    ", уполномочиваю PROVIN получать данные об автомобиле от моего имени, даю согласие на немедленное начало оказания цифровой услуги и понимаю, что после начала исполнения утрачиваю право на отказ от договора.",
  ],
  submit: "Отправить и оплатить",
  submitting: "Подготовка…",
  secure: "Безопасная оплата через Stripe",
  validUntil: (u) => `Ссылка персональная, одноразовая и действительна до ${u}.`,
  afterPay: "После оплаты она станет неактивной.",
  errors: {
    email: "Поле заполнено неверно.",
    vin: "Введите корректный VIN (17 символов) или госномер (3-6 символов).",
    vin_length: "VIN должен содержать 17 символов. Проверьте VIN.",
    listing: "Введите корректную ссылку на объявление.",
    phone: "Введите номер телефона не короче 8 цифр.",
    consent: "Чтобы перейти к оплате, отметьте подтверждение (условия, конфиденциальность, полномочие и право на отказ).",
    rate_limited: "Слишком много запросов. Подождите немного и попробуйте снова.",
    not_found: "Ссылка недействительна.",
    stripe_config: "Оплата сейчас недоступна. Попробуйте позже.",
    session_failed: "Не удалось подготовить оплату. Попробуйте снова.",
    network: "Ошибка сети. Попробуйте снова.",
  },
  invalidTitle: "Ссылка недействительна",
  invalidBody: "Эта ссылка недоступна. Если нужно новое предложение, свяжитесь с PROVIN.",
  waHello: "Здравствуйте!",
  waLine: (p, vin, amount, until) => `Ваша персональная ссылка ${p}${vin ? ` (VIN ${vin})` : ""} - ${amount}, действительна до ${until}:`,
  waTail: "Введите данные и оплатите. Заказ будет создан после оплаты.",
  stripeDescription: "Заказ будет создан после оплаты.",
};

const DE: ClientLinkCopy = {
  intro: "Geben Sie Ihre Daten und die Fahrzeugangaben ein. Die Bestellung wird nach der Zahlung erstellt.",
  yourData: "Ihre Daten",
  email: "E-Mail",
  emailPlaceholder: "email@beispiel.de",
  vin: "FIN (VIN)",
  vinHint: (n) => `17 Zeichen · ${n}/17`,
  listing: "Link zum Inserat",
  phone: "Telefon",
  payment: "Zahlung",
  total: "Gesamtbetrag",
  consent: [
    "Ich bestätige, dass ich die ",
    "Nutzungsbedingungen",
    " und die ",
    "Datenschutzerklärung",
    " zur Kenntnis genommen habe, bevollmächtige PROVIN, Fahrzeugdaten in meinem Namen einzuholen, stimme der sofortigen Ausführung der digitalen Leistung zu und nehme zur Kenntnis, dass ich mein Widerrufsrecht verliere, sobald mit der Ausführung begonnen wurde.",
  ],
  submit: "Absenden und bezahlen",
  submitting: "Wird vorbereitet…",
  secure: "Sichere Zahlung mit Stripe",
  validUntil: (u) => `Der Link ist persönlich, einmalig und gültig bis ${u}.`,
  afterPay: "Nach der Zahlung ist er nicht mehr aktiv.",
  errors: {
    email: "Das Feld ist nicht korrekt ausgefüllt.",
    vin: "Bitte geben Sie eine gültige VIN (17 Zeichen) oder ein Kennzeichen (3-6 Zeichen) ein.",
    vin_length: "Die VIN muss 17 Zeichen lang sein. Bitte prüfen Sie die VIN.",
    listing: "Bitte geben Sie eine gültige Inserat-URL ein.",
    phone: "Bitte geben Sie eine Telefonnummer mit mindestens 8 Ziffern ein.",
    consent: "Bitte setzen Sie das Häkchen bei der Bestätigung (Bedingungen, Datenschutzerklärung, Bevollmächtigung und Widerrufsrecht), um zur Zahlung fortzufahren.",
    rate_limited: "Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.",
    not_found: "Der Link ist ungültig.",
    stripe_config: "Die Zahlung ist derzeit nicht verfügbar. Bitte versuchen Sie es später.",
    session_failed: "Die Zahlung konnte nicht vorbereitet werden. Bitte versuchen Sie es erneut.",
    network: "Netzwerkfehler. Bitte versuchen Sie es erneut.",
  },
  invalidTitle: "Link ungültig",
  invalidBody: "Dieser Link ist nicht verfügbar. Wenn Sie ein neues Angebot benötigen, kontaktieren Sie PROVIN.",
  waHello: "Guten Tag!",
  waLine: (p, vin, amount, until) => `Ihr persönlicher ${p}-Link${vin ? ` (VIN ${vin})` : ""} - ${amount}, gültig bis ${until}:`,
  waTail: "Geben Sie Ihre Daten ein und bezahlen Sie. Die Bestellung wird nach der Zahlung erstellt.",
  stripeDescription: "Die Bestellung wird nach der Zahlung erstellt.",
};

const COPY: Record<ClientReportLang, ClientLinkCopy> = { lv: LV, en: EN, ru: RU, de: DE };

export function clientLinkCopy(lang: unknown): ClientLinkCopy {
  return COPY[normalizeClientLinkLang(lang)];
}

/** Juridisko lapu saites klienta valodā (vietnē ir /lv /en /ru /de). */
export function clientLinkLegalHrefs(lang: unknown): { terms: string; privacy: string } {
  const l = normalizeClientLinkLang(lang);
  return { terms: `/${l}/lietosanas-noteikumi`, privacy: `/${l}/privatuma-politika` };
}
