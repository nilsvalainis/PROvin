/**
 * «Izsoļu arhīvs dīlera datu vietā» klienta ziņas EN / RU / DE (Nils 26.11): piedāvājums, atgādinājums,
 * gatavs - e-pasta teksts, WhatsApp, HTML kartītes etiķetes. LV paliek `auction-archive-email.ts`.
 * Paraksts «PROVIN.LV» (bez vārda, Nils 26.11) - B2B to pārvērš `applyB2bSignature` (tikai «PROVIN»).
 * Tīrs modulis (bez servera atkarībām).
 */
import type { ClientReportLang } from "@/lib/client-report-i18n";
import { ISO2_TO_LV_NAME } from "@/lib/country-names-lv";

export type AuctionArchiveForeignLang = Exclude<ClientReportLang, "lv">;

export function auctionArchiveForeignLang(lang: ClientReportLang | null | undefined): AuctionArchiveForeignLang | null {
  return lang === "en" || lang === "ru" || lang === "de" ? lang : null;
}

let LV_COUNTRY_ISO: Map<string, string> | null = null;
/** LV valsts nosaukums («Itālija») -> klienta valodā; nezināms paliek kā ir. */
export function auctionArchiveCountryInLang(lvName: string, lang: AuctionArchiveForeignLang): string {
  if (!LV_COUNTRY_ISO) LV_COUNTRY_ISO = new Map(Object.entries(ISO2_TO_LV_NAME).map(([iso, lv]) => [lv.toLocaleLowerCase("lv"), iso]));
  const iso = LV_COUNTRY_ISO.get(lvName.trim().toLocaleLowerCase("lv"));
  if (!iso) return lvName;
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(iso) ?? lvName;
  } catch {
    return lvName;
  }
}

function ruPlural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export type AuctionArchiveEmailCopy = {
  hello: string;
  regards: string;
  /** «2 auctions» */
  auctions: (n: number) => string;
  /** Kartītē (fakti) - vārds bez skaitļa. */
  auctionsWord: (n: number) => string;
  photosCount: (n: number) => string;
  /** «with 84 original auction photos[, prices] and mileage» */
  what: (photos: number, showPrices: boolean) => string;
  value: string;
  refundFallback: string;
  offerSubject: (car: string) => string;
  offerChecked: (vin: string) => string;
  offerFound: (auctions: string, where: string, what: string) => string;
  choose: string;
  chooseReminder: string;
  option1: string;
  option2: (refund: string) => string;
  untilChoose: string;
  waOffer: (car: string, parts: string) => string;
  waCar: (title: string, vin: string) => string;
  waYears: (years: string) => string;
  waPhotos: (n: number) => string;
  waTail: (showPrices: boolean) => string;
  waChoose: string;
  waOption1: string;
  waOption2: (refund: string) => string;
  waReply: string;
  reminderSubject: (car: string) => string;
  reminderLead: (vin: string, auctions: string, where: string, what: string) => string;
  waReminder: (vin: string, refund: string) => string;
  waReminderChoose: string;
  readySubject: (car: string) => string;
  readyLead: (vin: string, what: string, showPrices: boolean) => string;
  noSurcharge: string;
  waReady: (vin: string) => string;
  plainChoose: string;
  html: {
    archive: string;
    photosLabel: string;
    auctionsLabel: string;
    chooseHow: string;
    btnArchive: string;
    btnRefund: (refund: string) => string;
    btnRefundFallback: string;
    small: string;
    eyebrowOffer: string;
    eyebrowReminder: string;
    titleOffer: string;
    titleReminder: string;
    preheaderOffer: (auctions: string, photos: number) => string;
    contents: {
      photos: string;
      photosSub: (n: number) => string;
      photosSubNone: string;
      prices: string;
      pricesSub: (n: number) => string;
      pricesSubNone: string;
      km: string;
      kmSub: string;
      damage: string;
      damageSub: string;
      description: string;
      descriptionSub: string;
    };
    readyEyebrow: string;
    readyTitle: string;
    readyPreheader: string;
  };
};

const EN: AuctionArchiveEmailCopy = {
  hello: "Hello,",
  regards: "Best regards,",
  auctions: (n) => `${n} ${n === 1 ? "auction" : "auctions"}`,
  auctionsWord: (n) => (n === 1 ? "auction" : "auctions"),
  photosCount: (n) => `${n} ${n === 1 ? "photo" : "photos"}`,
  what: (photos, prices) => {
    const tail = prices ? "prices and mileage" : "mileage";
    return photos > 0 ? `with ${photos} original auction photos${prices ? ", " : " and "}${tail}` : `with ${tail}`;
  },
  value:
    "The photos show the car's condition before it was imported to Latvia - scratches, possible damage and other details that can no longer be seen after repair or cleaning.",
  refundFallback: "the amount paid",
  offerSubject: (car) => `No dealer data - we offer the auction archive with photos${car ? ` (${car})` : ""}`,
  offerChecked: (vin) => `We checked the car with VIN ${vin}. The official dealer service history is not available for this car.`,
  offerFound: (a, where, what) => `However, we found it in the European auction archive: ${a}${where ? ` (${where})` : ""} ${what}.`,
  choose: "You can choose:",
  chooseReminder: "Please choose:",
  option1: "1 - switch the dealer data to the auction archive (no extra charge)",
  option2: (r) => `2 - refund ${r} to your card`,
  untilChoose: "Until you choose, we will not send anything.",
  waOffer: (car, parts) => `Hello! We checked ${car} - there is no official dealer history for this car.\nBut we found it in the European auction archive: ${parts}.`,
  waCar: (title, vin) => (title ? `your ${title} (VIN ${vin})` : `the car with VIN ${vin}`),
  waYears: (y) => `in ${y}`,
  waPhotos: (n) => `${n} original photos`,
  waTail: (p) => (p ? "prices, mileage and damage by zone" : "mileage and damage by zone"),
  waChoose: "What do you choose?",
  waOption1: "1 - switch to the auction archive (no extra charge)",
  waOption2: (r) => `2 - refund ${r}`,
  waReply: "Reply with 1 or 2. Until you choose, we will not send anything.",
  reminderSubject: (car) => `Reminder: auction archive or refund${car ? ` (${car})` : ""}`,
  reminderLead: (vin, a, where, what) =>
    `A reminder about the car with VIN ${vin}: the official dealer service history is not available, but we found it in the European auction archive - ${a}${where ? ` (${where})` : ""} ${what}.`,
  waReminder: (vin, r) => `Hello! A reminder about the car with VIN ${vin} - the auction archive with photos (no extra charge) or a refund of ${r}?`,
  waReminderChoose: "Reply with 1 (archive) or 2 (refund), or choose here:",
  readySubject: (car) => `Auction archive${car ? ` - ${car}` : ""}`,
  readyLead: (vin, what, p) =>
    `Thank you for your choice. Attached is the auction archive for the car with VIN ${vin} (${what}) - photos with dates, ${p ? "prices, " : ""}mileage, damage by zone and the auction description.`,
  noSurcharge: "No extra payment is required.",
  waReady: (vin) => `Hello! Thank you for your choice - I am sending the auction archive for the car with VIN ${vin} (PDF). No extra payment is required.`,
  plainChoose: "Choose and confirm:",
  html: {
    archive: "auction archive",
    photosLabel: "auction photos",
    auctionsLabel: "auctions",
    chooseHow: "Choose how to continue:",
    btnArchive: "Yes, switch to the auction archive",
    btnRefund: (r) => `Refund ${r}`,
    btnRefundFallback: "Refund",
    small:
      "No extra charge for the switch, you will receive the PDF within 24 hours. Or simply reply to this email with «1» (archive) or «2» (refund). Until you choose, we will not send anything.",
    eyebrowOffer: "Official dealer data",
    eyebrowReminder: "Reminder",
    titleOffer: "No dealer data - but we found the auction history with photos",
    titleReminder: "Waiting for your choice - auction archive or refund",
    preheaderOffer: (a, p) => `${a}, ${p} photos - choose the archive or a refund`,
    contents: {
      photos: "All auction photos",
      photosSub: (n) => `${n}, with dates - condition before import to Latvia`,
      photosSubNone: "with dates",
      prices: "Auction prices",
      pricesSub: (n) => `in ${n} ${n === 1 ? "auction" : "auctions"}`,
      pricesSubNone: "if the auction shows them",
      km: "Mileage on the auction day",
      kmSub: "with an odometer photo, if available",
      damage: "Damage by zone",
      damageSub: "on the body diagram",
      description: "Auction description",
      descriptionSub: "original + translation",
    },
    readyEyebrow: "Auction archive",
    readyTitle: "Auction archive ready",
    readyPreheader: "Auction archive attached",
  },
};

const RU: AuctionArchiveEmailCopy = {
  hello: "Здравствуйте!",
  regards: "С уважением,",
  auctions: (n) => `${n} ${ruPlural(n, "аукцион", "аукциона", "аукционов")}`,
  auctionsWord: (n) => ruPlural(n, "аукцион", "аукциона", "аукционов"),
  photosCount: (n) => `${n} ${ruPlural(n, "фото", "фото", "фото")}`,
  what: (photos, prices) => {
    const tail = prices ? "ценами и пробегом" : "пробегом";
    return photos > 0 ? `с ${photos} оригинальными фото с аукциона${prices ? ", " : " и "}${tail}` : `с ${tail}`;
  },
  value:
    "На фото видно состояние автомобиля до его ввоза в Латвию - царапины, возможные повреждения и другие детали, которые после ремонта или чистки уже не видны.",
  refundFallback: "оплаченную сумму",
  offerSubject: (car) => `Данных дилера нет - предлагаем архив аукционов с фото${car ? ` (${car})` : ""}`,
  offerChecked: (vin) => `Мы проверили автомобиль с VIN ${vin}. История обслуживания у официального дилера для этого автомобиля недоступна.`,
  offerFound: (a, where, what) => `Однако мы нашли его в европейском архиве аукционов: ${a}${where ? ` (${where})` : ""} ${what}.`,
  choose: "Вы можете выбрать:",
  chooseReminder: "Пожалуйста, выберите:",
  option1: "1 - заменить данные дилера на архив аукционов (без доплаты)",
  option2: (r) => `2 - вернуть ${r} на карту`,
  untilChoose: "Пока вы не выберете, мы ничего не отправляем.",
  waOffer: (car, parts) => `Здравствуйте! Мы проверили ${car} - истории официального дилера для этого автомобиля нет.\nНо мы нашли его в европейском архиве аукционов: ${parts}.`,
  waCar: (title, vin) => (title ? `ваш ${title} (VIN ${vin})` : `автомобиль с VIN ${vin}`),
  waYears: (y) => `в ${y} г.`,
  waPhotos: (n) => `${n} оригинальных фото`,
  waTail: (p) => (p ? "цены, пробег и повреждения по зонам" : "пробег и повреждения по зонам"),
  waChoose: "Что вы выбираете?",
  waOption1: "1 - заменить на архив аукционов (без доплаты)",
  waOption2: (r) => `2 - вернуть ${r}`,
  waReply: "Ответьте 1 или 2. Пока вы не выберете, мы ничего не отправляем.",
  reminderSubject: (car) => `Напоминание: архив аукционов или возврат${car ? ` (${car})` : ""}`,
  reminderLead: (vin, a, where, what) =>
    `Напоминаем об автомобиле с VIN ${vin}: история обслуживания у официального дилера недоступна, но мы нашли его в европейском архиве аукционов - ${a}${where ? ` (${where})` : ""} ${what}.`,
  waReminder: (vin, r) => `Здравствуйте! Напоминаю об автомобиле с VIN ${vin} - архив аукционов с фото (без доплаты) или возврат ${r}?`,
  waReminderChoose: "Ответьте 1 (архив) или 2 (возврат), или выберите здесь:",
  readySubject: (car) => `Архив аукционов${car ? ` - ${car}` : ""}`,
  readyLead: (vin, what, p) =>
    `Спасибо за выбор. Во вложении архив аукционов для автомобиля с VIN ${vin} (${what}) - фото с датами, ${p ? "цены, " : ""}пробег, повреждения по зонам и описание аукциона.`,
  noSurcharge: "Доплата не требуется.",
  waReady: (vin) => `Здравствуйте! Спасибо за выбор - отправляю архив аукционов для автомобиля с VIN ${vin} (PDF). Доплата не требуется.`,
  plainChoose: "Выбрать и подтвердить:",
  html: {
    archive: "архив аукционов",
    photosLabel: "фото с аукционов",
    auctionsLabel: "аукционы",
    chooseHow: "Выберите, как продолжить:",
    btnArchive: "Да, заменить на архив аукционов",
    btnRefund: (r) => `Вернуть ${r}`,
    btnRefundFallback: "Вернуть деньги",
    small:
      "Замена без доплаты, PDF вы получите в течение 24 часов. Или просто ответьте на это письмо «1» (архив) или «2» (возврат). Пока вы не выберете, мы ничего не отправляем.",
    eyebrowOffer: "Данные официального дилера",
    eyebrowReminder: "Напоминание",
    titleOffer: "Данных дилера нет - но мы нашли историю аукционов с фото",
    titleReminder: "Ждём вашего выбора - архив аукционов или возврат",
    preheaderOffer: (a, p) => `${a}, ${p} фото - выберите архив или возврат`,
    contents: {
      photos: "Все фото с аукционов",
      photosSub: (n) => `${n}, с датами - состояние до ввоза в Латвию`,
      photosSubNone: "с датами",
      prices: "Цены аукционов",
      pricesSub: (n) => `в ${n} ${ruPlural(n, "аукционе", "аукционах", "аукционах")}`,
      pricesSubNone: "если аукцион их указывает",
      km: "Пробег в день аукциона",
      kmSub: "с фото одометра, если есть",
      damage: "Повреждения по зонам",
      damageSub: "на схеме кузова",
      description: "Описание аукциона",
      descriptionSub: "оригинал + перевод",
    },
    readyEyebrow: "Архив аукционов",
    readyTitle: "Архив аукционов готов",
    readyPreheader: "Архив аукционов во вложении",
  },
};

const DE: AuctionArchiveEmailCopy = {
  hello: "Guten Tag,",
  regards: "Mit freundlichen Grüßen",
  auctions: (n) => `${n} ${n === 1 ? "Auktion" : "Auktionen"}`,
  auctionsWord: (n) => (n === 1 ? "Auktion" : "Auktionen"),
  photosCount: (n) => `${n} ${n === 1 ? "Foto" : "Fotos"}`,
  what: (photos, prices) => {
    const tail = prices ? "Preisen und Kilometerstand" : "Kilometerstand";
    return photos > 0 ? `mit ${photos} originalen Auktionsfotos${prices ? ", " : " und "}${tail}` : `mit ${tail}`;
  },
  value:
    "Die Fotos zeigen den Zustand des Fahrzeugs vor dem Import nach Lettland - Kratzer, mögliche Schäden und andere Details, die nach einer Reparatur oder Aufbereitung nicht mehr zu sehen sind.",
  refundFallback: "den bezahlten Betrag",
  offerSubject: (car) => `Keine Händlerdaten - wir bieten das Auktionsarchiv mit Fotos an${car ? ` (${car})` : ""}`,
  offerChecked: (vin) => `Wir haben das Fahrzeug mit der VIN ${vin} geprüft. Die Servicehistorie des Vertragshändlers ist für dieses Fahrzeug nicht verfügbar.`,
  offerFound: (a, where, what) => `Wir haben es jedoch im europäischen Auktionsarchiv gefunden: ${a}${where ? ` (${where})` : ""} ${what}.`,
  choose: "Sie können wählen:",
  chooseReminder: "Bitte wählen Sie:",
  option1: "1 - Händlerdaten gegen das Auktionsarchiv tauschen (ohne Aufpreis)",
  option2: (r) => `2 - ${r} auf die Karte zurückerstatten`,
  untilChoose: "Solange Sie nicht gewählt haben, senden wir nichts.",
  waOffer: (car, parts) => `Guten Tag! Wir haben ${car} geprüft - für dieses Fahrzeug gibt es keine Historie des Vertragshändlers.\nWir haben es aber im europäischen Auktionsarchiv gefunden: ${parts}.`,
  waCar: (title, vin) => (title ? `Ihren ${title} (VIN ${vin})` : `das Fahrzeug mit der VIN ${vin}`),
  waYears: (y) => `im Jahr ${y}`,
  waPhotos: (n) => `${n} Originalfotos`,
  waTail: (p) => (p ? "Preise, Kilometerstand und Schäden nach Zonen" : "Kilometerstand und Schäden nach Zonen"),
  waChoose: "Was wählen Sie?",
  waOption1: "1 - gegen das Auktionsarchiv tauschen (ohne Aufpreis)",
  waOption2: (r) => `2 - ${r} zurückerstatten`,
  waReply: "Antworten Sie mit 1 oder 2. Solange Sie nicht gewählt haben, senden wir nichts.",
  reminderSubject: (car) => `Erinnerung: Auktionsarchiv oder Rückerstattung${car ? ` (${car})` : ""}`,
  reminderLead: (vin, a, where, what) =>
    `Wir erinnern an das Fahrzeug mit der VIN ${vin}: Die Servicehistorie des Vertragshändlers ist nicht verfügbar, wir haben es aber im europäischen Auktionsarchiv gefunden - ${a}${where ? ` (${where})` : ""} ${what}.`,
  waReminder: (vin, r) => `Guten Tag! Eine Erinnerung zum Fahrzeug mit der VIN ${vin} - Auktionsarchiv mit Fotos (ohne Aufpreis) oder Rückerstattung von ${r}?`,
  waReminderChoose: "Antworten Sie mit 1 (Archiv) oder 2 (Rückerstattung) oder wählen Sie hier:",
  readySubject: (car) => `Auktionsarchiv${car ? ` - ${car}` : ""}`,
  readyLead: (vin, what, p) =>
    `Vielen Dank für Ihre Wahl. Im Anhang finden Sie das Auktionsarchiv zum Fahrzeug mit der VIN ${vin} (${what}) - Fotos mit Datum, ${p ? "Preise, " : ""}Kilometerstand, Schäden nach Zonen und die Auktionsbeschreibung.`,
  noSurcharge: "Eine Zuzahlung ist nicht erforderlich.",
  waReady: (vin) => `Guten Tag! Vielen Dank für Ihre Wahl - ich sende das Auktionsarchiv zum Fahrzeug mit der VIN ${vin} (PDF). Eine Zuzahlung ist nicht erforderlich.`,
  plainChoose: "Auswählen und bestätigen:",
  html: {
    archive: "Auktionsarchiv",
    photosLabel: "Auktionsfotos",
    auctionsLabel: "Auktionen",
    chooseHow: "Wählen Sie, wie es weitergeht:",
    btnArchive: "Ja, gegen das Auktionsarchiv tauschen",
    btnRefund: (r) => `${r} zurückerstatten`,
    btnRefundFallback: "Geld zurückerstatten",
    small:
      "Der Tausch ist ohne Aufpreis, das PDF erhalten Sie innerhalb von 24 Stunden. Oder antworten Sie einfach auf diese E-Mail mit «1» (Archiv) oder «2» (Rückerstattung). Solange Sie nicht gewählt haben, senden wir nichts.",
    eyebrowOffer: "Offizielle Händlerdaten",
    eyebrowReminder: "Erinnerung",
    titleOffer: "Keine Händlerdaten - aber wir haben die Auktionshistorie mit Fotos gefunden",
    titleReminder: "Wir warten auf Ihre Wahl - Auktionsarchiv oder Rückerstattung",
    preheaderOffer: (a, p) => `${a}, ${p} Fotos - wählen Sie Archiv oder Rückerstattung`,
    contents: {
      photos: "Alle Auktionsfotos",
      photosSub: (n) => `${n}, mit Datum - Zustand vor dem Import nach Lettland`,
      photosSubNone: "mit Datum",
      prices: "Auktionspreise",
      pricesSub: (n) => `in ${n} ${n === 1 ? "Auktion" : "Auktionen"}`,
      pricesSubNone: "falls die Auktion sie angibt",
      km: "Kilometerstand am Auktionstag",
      kmSub: "mit Foto des Kilometerzählers, falls vorhanden",
      damage: "Schäden nach Zonen",
      damageSub: "auf dem Karosserieschema",
      description: "Auktionsbeschreibung",
      descriptionSub: "Original + Übersetzung",
    },
    readyEyebrow: "Auktionsarchiv",
    readyTitle: "Auktionsarchiv fertig",
    readyPreheader: "Auktionsarchiv im Anhang",
  },
};

export const AUCTION_ARCHIVE_EMAIL_I18N: Record<AuctionArchiveForeignLang, AuctionArchiveEmailCopy> = { en: EN, ru: RU, de: DE };
