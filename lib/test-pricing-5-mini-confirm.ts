import type { MiniCsddModalVariant } from "@/lib/mini-csdd-eligibility";

export type Tp5MiniConfirmCopy = {
  title: string;
  body: string;
  includesHeading: string;
  includesItem: string;
  excludesItem: string;
  continueMini: string;
  switchAudits: string;
  closeAria: string;
  warnTitle: string;
  warnBar: string;
  warnBody: string;
  emailLabel: string;
  emailError: string;
  emailContinue: string;
};

const LV: Tp5MiniConfirmCopy = {
  title: "Vai MINI ir piemērots šim auto?",
  body: "PROVIN MINI ir paredzēts auto, kas ilgstoši ekspluatēts Latvijā.",
  includesHeading: "Pakalpojumā ietverts:",
  includesItem: "Konsultācija un vietējo reģistru pārbaude",
  excludesItem: "Neietver: maksas datubāzes, dīleru un izsoļu datus",
  continueMini: "Turpināt ar MINI",
  switchAudits: "Pāriet uz AUDITS",
  closeAria: "Aizvērt",
  warnTitle: "Šim auto iesakām PROVIN AUDITS",
  warnBar: "⚠️ Auto Latvijā nav reģistrēts vai ir reģistrēts mazāk nekā 3 gadus.",
  warnBody:
    "Ārvalstu vēsturi (negadījumus, nobraukumu, dīlera datus) pārbauda tikai PROVIN AUDITS. MINI parāda tikai Latvijas datus un sniedz konsultāciju.",
  emailLabel: "E-pasts atskaites saņemšanai",
  emailError: "Ievadi derīgu e-pastu vai atstāj tukšu.",
  emailContinue: "Turpināt",
};

const EN: Tp5MiniConfirmCopy = {
  title: "Is MINI the right fit for this car?",
  body: "PROVIN MINI is intended for cars that have been used in Latvia for a longer time.",
  includesHeading: "Included in this service:",
  includesItem: "Consultation and a check of local registers",
  excludesItem: "Not included: paid databases, dealer and auction data",
  continueMini: "Continue with MINI",
  switchAudits: "Switch to AUDITS",
  closeAria: "Close",
  warnTitle: "For this car we recommend PROVIN AUDITS",
  warnBar: "⚠️ The car is not registered in Latvia, or has been registered for less than 3 years.",
  warnBody:
    "Foreign history (accidents, mileage, dealer data) is checked only by PROVIN AUDITS. MINI shows Latvian data only and provides a consultation.",
  emailLabel: "Email for the report",
  emailError: "Enter a valid email or leave the field empty.",
  emailContinue: "Continue",
};

const DE: Tp5MiniConfirmCopy = {
  title: "Passt MINI zu diesem Auto?",
  body: "PROVIN MINI ist für Autos gedacht, die länger in Lettland genutzt wurden.",
  includesHeading: "In der Leistung enthalten:",
  includesItem: "Beratung und Prüfung lokaler Register",
  excludesItem: "Nicht enthalten: kostenpflichtige Datenbanken, Händler- und Auktionsdaten",
  continueMini: "Mit MINI fortfahren",
  switchAudits: "Zu AUDITS wechseln",
  closeAria: "Schließen",
  warnTitle: "Für dieses Auto empfehlen wir PROVIN AUDITS",
  warnBar: "⚠️ Das Auto ist in Lettland nicht zugelassen oder weniger als 3 Jahre zugelassen.",
  warnBody:
    "Die ausländische Historie (Unfälle, Laufleistung, Händlerdaten) prüft nur PROVIN AUDITS. MINI zeigt nur lettische Daten und bietet eine Beratung.",
  emailLabel: "E-Mail für den Bericht",
  emailError: "Bitte eine gültige E-Mail eingeben oder das Feld leer lassen.",
  emailContinue: "Weiter",
};

const RU: Tp5MiniConfirmCopy = {
  title: "Подходит ли MINI для этого авто?",
  body: "PROVIN MINI предназначен для автомобилей, которые давно эксплуатируются в Латвии.",
  includesHeading: "В услугу входит:",
  includesItem: "Консультация и проверка местных реестров",
  excludesItem: "Не входит: платные базы, дилерские и аукционные данные",
  continueMini: "Продолжить с MINI",
  switchAudits: "Перейти на AUDITS",
  closeAria: "Закрыть",
  warnTitle: "Для этого авто рекомендуем PROVIN AUDITS",
  warnBar: "⚠️ Автомобиль не зарегистрирован в Латвии или зарегистрирован менее 3 лет.",
  warnBody:
    "Зарубежную историю (аварии, пробег, данные дилера) проверяет только PROVIN AUDITS. MINI показывает только латвийские данные и даёт консультацию.",
  emailLabel: "Эл. почта для отчёта",
  emailError: "Введите корректный адрес или оставьте поле пустым.",
  emailContinue: "Продолжить",
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
