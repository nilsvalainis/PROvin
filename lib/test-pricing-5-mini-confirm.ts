import type { MiniCsddModalVariant } from "@/lib/mini-csdd-eligibility";

export type Tp5MiniConfirmCopy = {
  title: string;
  body: string;
  continueMini: string;
  switchAudits: string;
  closeAria: string;
  warnTitle: string;
  warnBar: string;
  warnBody: string;
};

const LV: Tp5MiniConfirmCopy = {
  title: "Vai MINI ir piemērots šim auto?",
  body: "PROVIN MINI ir paredzēts auto, kas ilgstoši ekspluatēts Latvijā.\n\nIetver konsultāciju un vietējo reģistru pārbaudi.\n\nNeietver maksas datubāzes, dīleru un izsoļu datus.",
  continueMini: "Jā, turpināt ar MINI",
  switchAudits: "Pāriet uz AUDITS",
  closeAria: "Aizvērt",
  warnTitle: "Šim auto iesakām PROVIN AUDITS",
  warnBar: "⚠ Pēc CSDD datiem auto Latvijā reģistrēts mazāk nekā 3 gadus vai nav reģistrēts.",
  warnBody:
    "Ārvalstu vēsturi (negadījumi, nobraukums, dīlera dati) pārbauda tikai PROVIN AUDITS. MINI joprojām var pasūtīt, bet tā ārvalstu vēsturi neaptvers.",
};

const EN: Tp5MiniConfirmCopy = {
  title: "Is MINI the right fit for this car?",
  body: "PROVIN MINI is intended for cars that have been used in Latvia for a longer time.\n\nIt includes a consultation and a check of local registers.\n\nIt does not include paid databases, dealer or auction data.",
  continueMini: "Yes, continue with MINI",
  switchAudits: "Switch to AUDITS",
  closeAria: "Close",
  warnTitle: "For this car we recommend PROVIN AUDITS",
  warnBar:
    "⚠ CSDD data shows the car has been registered in Latvia for less than 3 years, or is not registered.",
  warnBody:
    "Foreign history (accidents, mileage, dealer data) is checked only by PROVIN AUDITS. You can still order MINI, but it will not cover foreign history.",
};

const DE: Tp5MiniConfirmCopy = {
  title: "Passt MINI zu diesem Auto?",
  body: "PROVIN MINI ist für Autos gedacht, die länger in Lettland genutzt wurden.\n\nEnthalten sind eine Beratung und die Prüfung lokaler Register.\n\nNicht enthalten sind kostenpflichtige Datenbanken sowie Händler- und Auktionsdaten.",
  continueMini: "Ja, mit MINI fortfahren",
  switchAudits: "Zu AUDITS wechseln",
  closeAria: "Schließen",
  warnTitle: "Für dieses Auto empfehlen wir PROVIN AUDITS",
  warnBar:
    "⚠ Laut CSDD ist das Auto in Lettland weniger als 3 Jahre zugelassen oder nicht zugelassen.",
  warnBody:
    "Die ausländische Historie (Unfälle, Laufleistung, Händlerdaten) prüft nur PROVIN AUDITS. MINI können Sie weiterhin bestellen, aber die ausländische Historie ist darin nicht enthalten.",
};

const RU: Tp5MiniConfirmCopy = {
  title: "Подходит ли MINI для этого авто?",
  body: "PROVIN MINI предназначен для автомобилей, которые давно эксплуатируются в Латвии.\n\nВходит консультация и проверка местных реестров.\n\nНе входят платные базы, дилерские и аукционные данные.",
  continueMini: "Да, продолжить с MINI",
  switchAudits: "Перейти на AUDITS",
  closeAria: "Закрыть",
  warnTitle: "Для этого авто рекомендуем PROVIN AUDITS",
  warnBar:
    "⚠ По данным CSDD автомобиль зарегистрирован в Латвии менее 3 лет или не зарегистрирован.",
  warnBody:
    "Зарубежную историю (аварии, пробег, данные дилера) проверяет только PROVIN AUDITS. MINI по-прежнему можно заказать, но зарубежную историю он не охватит.",
};

export function getTp5MiniConfirmCopy(locale?: string): Tp5MiniConfirmCopy {
  if (locale === "en") return EN;
  if (locale === "de") return DE;
  if (locale === "ru") return RU;
  return LV;
}

export function miniConfirmTitle(
  copy: Tp5MiniConfirmCopy,
  variant: MiniCsddModalVariant,
): string {
  return variant === "warning" ? copy.warnTitle : copy.title;
}

export function miniConfirmBody(
  copy: Tp5MiniConfirmCopy,
  variant: MiniCsddModalVariant,
): string {
  return variant === "warning" ? copy.warnBody : copy.body;
}
