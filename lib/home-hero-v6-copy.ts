import { isTp5PublicServiceId, type Tp5MobileServiceId } from "@/lib/test-pricing-5-mobile";

/** Sākumlapa K1 v6: hero, «Pilnīgākais pārklājums», «Ne tikai dati», atsauksmes (lv/en/ru/de). */
export type HomeV6HeroCopy = {
  leadFirst: string;
  leadRest: string;
  /** Hero ievads, kad izvēlēti dīlera dati (atsevišķa atskaite, nevis audits). */
  dealerLeadFirst: string;
  dealerLeadRest: string;
  guaranteeShort: string;
  samplePill: string;
  includedPill: string;
  readMore: string;
  rating: string;
  options: Partial<Record<Tp5MobileServiceId, { name: string; sub: string }>>;
  vinLabel: string;
  vinPlaceholder: string;
  listingLabel: string;
  listingPlaceholder: string;
  turnaround: string;
  turnaroundFast: string;
  urgent: string;
  urgentBody: string;
  call: string;
  close: string;
  waText: string;
  freeCheck: { title: string; question: string; lead: string; note: string; listing: string; button: string };
  coverage: {
    titleAccent: string;
    titleRest: string;
    lead: string;
    cards: { title: string; body: string }[];
    note: string;
  };
  promises: {
    kicker: string;
    title: string;
    items: { title: string; body: string }[];
  };
  reviews: {
    kicker: string;
    title: string;
    ratingNote: string;
    readAll: string;
    prev: string;
    next: string;
  };
};

const LV: HomeV6HeroCopy = {
  leadFirst: "Uzzini visu par savu nākamo auto.",
  leadRest:
    "Apvienojot plašāko auto vēstures pārklājumu Eiropā ar padziļinātu izpratni par marku specifiku, tirgus viltībām un pārdevēju paņēmieniem, mēs atklājam tehniskos un slēptos riskus, ko citi mēdz noklusēt.",
  dealerLeadFirst: "Ražotāja oficiālā servisa vēsture pēc VIN koda.",
  dealerLeadRest:
    "Apkopes, remonti un nobraukums no autorizēto servisu sistēmām vienā saprotamā atskaitē - kā standarta vēstures atskaite, tikai ar oficiālā dīlera datiem. Ja datu nav, atmaksājam pilnu summu.",
  guaranteeShort: "100% atmaksa, ja datu nav",
  samplePill: "Atskaites piemērs",
  includedPill: "Kas iekļauts",
  readMore: "Lasīt vairāk",
  rating: "Google",
  options: {
    audits: { name: "PROVIN audits", sub: "Visi avoti, analīze un konsultācija" },
    mini: { name: "PROVIN MINI", sub: "Latvijas reģistri un sludinājuma analīze" },
    dealer: { name: "Dīlera dati", sub: "Servisa vēsture un nobraukums" },
  },
  vinLabel: "VIN kods vai numurzīme",
  vinPlaceholder: "Piem. WVWZZZ3CZJE123456 vai AB1234",
  listingLabel: "Sludinājuma saite",
  listingPlaceholder: "Ielīmē saiti no ss.lv, mobile.de, autoplius...",
  turnaround: "Izpilde",
  turnaroundFast: "24 h",
  urgent: "Steidzami?",
  urgentBody: "Pamata datus un īsu komentāru varam sniegt dažu stundu laikā.",
  call: "Zvanīt",
  close: "Aizvērt",
  waText: "Sveiki! Vēlos steidzamu auditu.",
  freeCheck: {
    button: "Pārbaudīt bez maksas",
    title: "Bezmaksas VIN koda pārbaude",
    question: "Neesi pārliecināts, vai pasūtīt auditu?",
    lead: "Ievadi VIN un pievieno sludinājuma saiti - mēs novērtēsim, vai auto ir vērts pārbaudīt tālāk.",
    note: "Saņemsi īsu komentāru par auto un sludinājumu.",
    listing: "Iesūtīt sludinājumu",
  },
  coverage: {
    titleAccent: "Pilnīgākais",
    titleRest: "vēstures datu pārklājums Eiropā",
    lead: "Viss vienā vietā - mēs apkopojam vairākas maksas vēstures atskaites un papildinām tās ar pieredzi, kuru neatradīsi nevienā automātiskajā pārskatā.",
    cards: [
      { title: "Oficiālo dīleru servisa dati", body: "Detalizēti nobraukuma, apkopju intervālu un remontu dati." },
      { title: "Maksas vēstures atskaites", body: "carVertical, autoDNA u.c. vienā auditā - avoti papildina cits citu." },
      { title: "Oficiālie valstu reģistri", body: "Vēsturi pārbaudām arī ES valstu oficiālajos reģistros. Citi reģioni - pēc pieprasījuma." },
      { title: "Eiropas izsoļu portālu arhīvi", body: "Ieraksti un foto no brīža, kad auto bija bojāts vai pārdots izsolē." },
      { title: "Latvijas avoti", body: "Apdrošinātāju dati, sludinājuma un tehnisko apskašu vēsture." },
      { title: "Padziļināta analīze un riski", body: "Analizējam riskus, konsultējam un dodam norādes klātienes apskatei." },
    ],
    note: "* Dīleru un izsoļu dati pieejami noteiktiem ražotājiem un modeļiem.",
  },
  promises: {
    kicker: "Ko vēl saņem ar auditu",
    title: "Ne tikai dati - palīdzība izlemt",
    items: [
      { title: "Atskaite, kura nekad nebūs tukša", body: "Vienmēr vairāk nekā standarta maksas atskaitē: pārbaude dažādos avotos, riski un ieteikumi." },
      { title: "Konsultācija pa tālruni", body: "Pēc audita apspriežam datus un palīdzam izlemt par nākamo soli - pirkt, pārbaudīt vai atteikties." },
      { title: "Individuāla pieeja", body: "Sarežģītās situācijās personīgi sazināmies ar valstu reģistriem un iestādēm. To nedara neviena automātiska atskaite." },
    ],
  },
  reviews: {
    kicker: "Atsauksmes",
    title: "Ko saka pircēji",
    ratingNote: "Google · visas ar 5 zvaigznēm",
    readAll: "Lasīt visu",
    prev: "Iepriekšējā",
    next: "Nākamā",
  },
};

const EN: HomeV6HeroCopy = {
  leadFirst: "Find out everything about your next car.",
  leadRest:
    "By combining the widest car history coverage in Europe with in-depth knowledge of each make, market tricks and seller tactics, we uncover the technical and hidden risks that others tend to keep quiet about.",
  dealerLeadFirst: "The manufacturer's official service history by VIN.",
  dealerLeadRest:
    "Maintenance, repairs and mileage from authorised service systems in one clear report - like a standard history report, but with official dealer data only. If there is no data, we refund the full amount.",
  guaranteeShort: "100% refund if there is no data",
  samplePill: "Sample report",
  includedPill: "What's included",
  readMore: "Read more",
  rating: "Google",
  options: {
    audits: { name: "PROVIN audit", sub: "All sources, analysis and consultation" },
    mini: { name: "PROVIN MINI", sub: "Latvian registers and listing analysis" },
    dealer: { name: "Dealer data", sub: "Service history and mileage" },
  },
  vinLabel: "VIN or licence plate",
  vinPlaceholder: "E.g. WVWZZZ3CZJE123456 or AB1234",
  listingLabel: "Listing link",
  listingPlaceholder: "Paste a link from ss.lv, mobile.de, autoplius...",
  turnaround: "Delivery",
  turnaroundFast: "24 h",
  urgent: "Urgent?",
  urgentBody: "We can provide the basic data and a short comment within a few hours.",
  call: "Call",
  close: "Close",
  waText: "Hello! I would like an urgent audit.",
  freeCheck: {
    button: "Check for free",
    title: "Free VIN check",
    question: "Not sure whether to order an audit?",
    lead: "Enter the VIN and add the listing link - we will tell you whether the car is worth checking further.",
    note: "You will get a short comment on the car and the listing.",
    listing: "Send a listing",
  },
  coverage: {
    titleAccent: "The most complete",
    titleRest: "history data coverage in Europe",
    lead: "Everything in one place - we combine several paid history reports and add experience you will not find in any automated report.",
    cards: [
      { title: "Official dealer service data", body: "Detailed mileage, service interval and repair data." },
      { title: "Paid history reports", body: "carVertical, autoDNA and others in one audit - the sources complement each other." },
      { title: "Official national registers", body: "We also check the history in official EU national registers. Other regions on request." },
      { title: "European auction archives", body: "Records and photos from when the car was damaged or sold at auction." },
      { title: "Latvian sources", body: "Insurer data, listing history and roadworthiness test history." },
      { title: "In-depth analysis and risks", body: "We analyse the risks, consult you and give pointers for the in-person inspection." },
    ],
    note: "* Dealer and auction data are available for certain makes and models.",
  },
  promises: {
    kicker: "What else you get with the audit",
    title: "Not just data - help to decide",
    items: [
      { title: "A report that is never empty", body: "Always more than a standard paid report: checks across different sources, risks and recommendations." },
      { title: "Phone consultation", body: "After the audit we go through the data and help you decide the next step - buy, inspect or walk away." },
      { title: "Individual approach", body: "In complex cases we personally contact national registers and authorities. No automated report does that." },
    ],
  },
  reviews: {
    kicker: "Reviews",
    title: "What buyers say",
    ratingNote: "Google · all with 5 stars",
    readAll: "Read all",
    prev: "Previous",
    next: "Next",
  },
};

const RU: HomeV6HeroCopy = {
  leadFirst: "Узнайте всё о своём следующем авто.",
  leadRest:
    "Сочетая самый широкий охват истории авто в Европе с глубоким знанием особенностей марок, рыночных уловок и приёмов продавцов, мы выявляем технические и скрытые риски, о которых другие предпочитают молчать.",
  dealerLeadFirst: "Официальная сервисная история производителя по VIN.",
  dealerLeadRest:
    "ТО, ремонты и пробег из систем авторизованных сервисов в одном понятном отчёте - как стандартный отчёт об истории, но только с данными официального дилера. Если данных нет, вернём всю сумму.",
  guaranteeShort: "100% возврат, если данных нет",
  samplePill: "Пример отчёта",
  includedPill: "Что входит",
  readMore: "Читать далее",
  rating: "Google",
  options: {
    audits: { name: "Аудит PROVIN", sub: "Все источники, анализ и консультация" },
    mini: { name: "PROVIN MINI", sub: "Регистры Латвии и анализ объявления" },
    dealer: { name: "Данные дилера", sub: "Сервисная история и пробег" },
  },
  vinLabel: "VIN или номерной знак",
  vinPlaceholder: "Напр. WVWZZZ3CZJE123456 или AB1234",
  listingLabel: "Ссылка на объявление",
  listingPlaceholder: "Вставьте ссылку с ss.lv, mobile.de, autoplius...",
  turnaround: "Срок",
  turnaroundFast: "24 ч",
  urgent: "Срочно?",
  urgentBody: "Базовые данные и короткий комментарий можем дать в течение нескольких часов.",
  call: "Позвонить",
  close: "Закрыть",
  waText: "Здравствуйте! Хочу срочный аудит.",
  freeCheck: {
    button: "Проверить бесплатно",
    title: "Бесплатная проверка VIN",
    question: "Не уверены, заказывать ли аудит?",
    lead: "Введите VIN и добавьте ссылку на объявление - мы оценим, стоит ли проверять авто дальше.",
    note: "Вы получите короткий комментарий об авто и объявлении.",
    listing: "Отправить объявление",
  },
  coverage: {
    titleAccent: "Самый полный",
    titleRest: "охват данных об истории в Европе",
    lead: "Всё в одном месте - мы объединяем несколько платных отчётов об истории и дополняем их опытом, которого нет ни в одном автоматическом отчёте.",
    cards: [
      { title: "Сервисные данные официальных дилеров", body: "Подробные данные о пробеге, интервалах обслуживания и ремонтах." },
      { title: "Платные отчёты об истории", body: "carVertical, autoDNA и другие в одном аудите - источники дополняют друг друга." },
      { title: "Официальные государственные регистры", body: "Проверяем историю и в официальных регистрах стран ЕС. Другие регионы - по запросу." },
      { title: "Архивы европейских аукционов", body: "Записи и фото с того момента, когда авто было повреждено или продано на аукционе." },
      { title: "Источники Латвии", body: "Данные страховщиков, история объявлений и техосмотров." },
      { title: "Углублённый анализ и риски", body: "Анализируем риски, консультируем и даём подсказки для осмотра на месте." },
    ],
    note: "* Данные дилеров и аукционов доступны для определённых марок и моделей.",
  },
  promises: {
    kicker: "Что ещё вы получаете с аудитом",
    title: "Не только данные - помощь в решении",
    items: [
      { title: "Отчёт, который никогда не будет пустым", body: "Всегда больше, чем в стандартном платном отчёте: проверка в разных источниках, риски и рекомендации." },
      { title: "Консультация по телефону", body: "После аудита обсуждаем данные и помогаем решить, что дальше - покупать, проверять или отказаться." },
      { title: "Индивидуальный подход", body: "В сложных ситуациях лично связываемся с государственными регистрами и учреждениями. Этого не делает ни один автоматический отчёт." },
    ],
  },
  reviews: {
    kicker: "Отзывы",
    title: "Что говорят покупатели",
    ratingNote: "Google · все на 5 звёзд",
    readAll: "Читать полностью",
    prev: "Предыдущий",
    next: "Следующий",
  },
};

const DE: HomeV6HeroCopy = {
  leadFirst: "Erfahren Sie alles über Ihr nächstes Auto.",
  leadRest:
    "Wir verbinden die umfassendste Fahrzeughistorie in Europa mit fundiertem Wissen über Marken, Markttricks und Verkäufermethoden und decken so technische und versteckte Risiken auf, die andere gern verschweigen.",
  dealerLeadFirst: "Die offizielle Servicehistorie des Herstellers per FIN.",
  dealerLeadRest:
    "Wartungen, Reparaturen und Kilometerstände aus den Systemen autorisierter Werkstätten in einem klaren Bericht - wie ein Standard-Historienbericht, nur mit offiziellen Händlerdaten. Gibt es keine Daten, erstatten wir den vollen Betrag.",
  guaranteeShort: "100 % Erstattung ohne Daten",
  samplePill: "Beispielbericht",
  includedPill: "Was enthalten ist",
  readMore: "Weiterlesen",
  rating: "Google",
  options: {
    audits: { name: "PROVIN Audit", sub: "Alle Quellen, Analyse und Beratung" },
    mini: { name: "PROVIN MINI", sub: "Lettische Register und Inseratsanalyse" },
    dealer: { name: "Händlerdaten", sub: "Servicehistorie und Kilometerstand" },
  },
  vinLabel: "FIN oder Kennzeichen",
  vinPlaceholder: "Z. B. WVWZZZ3CZJE123456 oder AB1234",
  listingLabel: "Link zum Inserat",
  listingPlaceholder: "Link von ss.lv, mobile.de, autoplius... einfügen",
  turnaround: "Bearbeitung",
  turnaroundFast: "24 Std.",
  urgent: "Eilig?",
  urgentBody: "Grunddaten und einen kurzen Kommentar können wir innerhalb weniger Stunden liefern.",
  call: "Anrufen",
  close: "Schließen",
  waText: "Hallo! Ich möchte ein eiliges Audit.",
  freeCheck: {
    button: "Kostenlos prüfen",
    title: "Kostenlose FIN-Prüfung",
    question: "Unsicher, ob sich ein Audit lohnt?",
    lead: "Geben Sie die FIN ein und fügen Sie den Link zum Inserat hinzu - wir sagen Ihnen, ob sich eine weitere Prüfung lohnt.",
    note: "Sie erhalten einen kurzen Kommentar zum Auto und zum Inserat.",
    listing: "Inserat senden",
  },
  coverage: {
    titleAccent: "Die umfassendste",
    titleRest: "Abdeckung von Historiendaten in Europa",
    lead: "Alles an einem Ort - wir bündeln mehrere kostenpflichtige Historienberichte und ergänzen sie um Erfahrung, die Sie in keinem automatischen Bericht finden.",
    cards: [
      { title: "Offizielle Händler-Servicedaten", body: "Detaillierte Daten zu Kilometerstand, Wartungsintervallen und Reparaturen." },
      { title: "Kostenpflichtige Historienberichte", body: "carVertical, autoDNA u. a. in einem Audit - die Quellen ergänzen einander." },
      { title: "Offizielle nationale Register", body: "Wir prüfen die Historie auch in offiziellen Registern der EU-Staaten. Andere Regionen auf Anfrage." },
      { title: "Europäische Auktionsarchive", body: "Einträge und Fotos aus der Zeit, als das Auto beschädigt war oder versteigert wurde." },
      { title: "Lettische Quellen", body: "Versicherungsdaten, Inserats- und TÜV-Historie." },
      { title: "Vertiefte Analyse und Risiken", body: "Wir analysieren die Risiken, beraten und geben Hinweise für die Besichtigung vor Ort." },
    ],
    note: "* Händler- und Auktionsdaten sind für bestimmte Marken und Modelle verfügbar.",
  },
  promises: {
    kicker: "Was Sie zusätzlich mit dem Audit erhalten",
    title: "Nicht nur Daten - Hilfe bei der Entscheidung",
    items: [
      { title: "Ein Bericht, der nie leer ist", body: "Immer mehr als ein Standardbericht: Prüfung in verschiedenen Quellen, Risiken und Empfehlungen." },
      { title: "Telefonische Beratung", body: "Nach dem Audit besprechen wir die Daten und helfen beim nächsten Schritt - kaufen, prüfen oder absagen." },
      { title: "Individueller Ansatz", body: "In schwierigen Fällen kontaktieren wir persönlich nationale Register und Behörden. Das macht kein automatischer Bericht." },
    ],
  },
  reviews: {
    kicker: "Bewertungen",
    title: "Was Käufer sagen",
    ratingNote: "Google · alle mit 5 Sternen",
    readAll: "Ganz lesen",
    prev: "Vorherige",
    next: "Nächste",
  },
};

export function getHomeV6HeroCopy(locale?: string): HomeV6HeroCopy {
  if (locale === "en") return EN;
  if (locale === "ru") return RU;
  if (locale === "de") return DE;
  return LV;
}

/**
 * Hero rāda AUDITS un dīlera datus; MINI (vai cita publiska pakete) tikai, ja atnāk no /pakalpojumi
 * (`?plan=mini`) - un paliek sarakstā arī pēc pārslēgšanās (`keepId`).
 */
export function heroV6OptionIds(activeId: Tp5MobileServiceId, keepId?: Tp5MobileServiceId | null): Tp5MobileServiceId[] {
  const ids: Tp5MobileServiceId[] = ["audits", "dealer"];
  for (const id of [keepId, activeId]) {
    if (id && !ids.includes(id) && isTp5PublicServiceId(id)) ids.splice(1, 0, id);
  }
  return ids;
}
