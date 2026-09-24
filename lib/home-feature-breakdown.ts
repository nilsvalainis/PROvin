import type { Tp5DesktopHeroFeatureIcon } from "@/lib/test-pricing-5-desktop-hero-features";
import { TP5_KOREA_USA_PUBLIC } from "@/lib/test-pricing-5-mobile";
import {
  TP5_AUDITS_SAMPLE_REPORT_HREF,
  TP5_DEALER_SAMPLE_REPORT_HREF,
  TP5_MINI_SAMPLE_REPORT_HREF,
} from "@/lib/test-pricing-5-ui-copy";

/** Icons used on package breakdown cards (extends hero icon set). */
export type HomeFeatureBreakdownIcon =
  | Tp5DesktopHeroFeatureIcon
  | "odometer"
  | "brands"
  | "refund"
  | "auction"
  | "damage";

export type HomeFeatureBreakdownItem = {
  title: string;
  description: string;
  icon: HomeFeatureBreakdownIcon;
};

export type HomeFeatureBreakdownPackageId = "mini" | "audits" | "dealer" | "koreaUsa" | "partner";

export type HomeFeatureBreakdownPackage = {
  id: HomeFeatureBreakdownPackageId;
  title: string;
  goal: string;
  items: HomeFeatureBreakdownItem[];
  /** CTA label on the catalog card. */
  buttonText: string;
  /** Optional PDF sample under the CTA. */
  sampleReportHref?: string;
  /** Optional highlight badge (e.g. „Populārākā izvēle”). */
  badge?: string;
  /** Solid „Jaunums” chip above the tab / section title (same language as hero dealer tab). */
  newBadge?: boolean;
  /** Override checkout href (B2B login, not a priced plan). */
  ctaHref?: string;
};

const MINI_LV: HomeFeatureBreakdownPackage = {
  id: "mini",
  title: "PROVIN MINI",
  buttonText: "PASŪTĪT MINI AUDITU 39,99 €",
  sampleReportHref: TP5_MINI_SAMPLE_REPORT_HREF,
  goal:
    "Sludinājuma un tehnisko datu analīze automašīnām, kas jau tiek ekspluatētas Latvijā. Pārbaude fokusējas uz vietējo vēsturi, pēdējo tehnisko apskašu datiem un publisko reģistru izvērtējumu, nodrošinot uzticamības prognozi un iespējamo risku kopsavilkumu.",
  items: [
    {
      title: "Sludinājuma un tehnisko risku analīze",
      description:
        "Sludinājuma un agregātu izvērtējums. Uzticamības prognoze un ekspluatācijas riski.",
      icon: "listing-analysis",
    },
    {
      title: "Izcelsmes valsts reģistri & TA vēsture",
      description:
        "Detalizēta Latvijas un Eiropas publisko reģistru datu analīze, tostarp visu tehnisko apskašu vēsture.",
      icon: "eu-registry",
    },
    {
      title: "Ieteikumi klātienes apskatei",
      description:
        "Praktisks kontrolsaraksts un padomi, kam tieši pievērst uzmanību, dodoties skatīties konkrēto auto dzīvē.",
      icon: "inspection-tips",
    },
    {
      title: "Individuāla konsultācija",
      description:
        'Konsultācija pirms klātienes apskates, lai izrunātu visus "par" un "pret" konkrētā auto iegādei.',
      icon: "consultation",
    },
  ],
};

const AUDITS_LV: HomeFeatureBreakdownPackage = {
  id: "audits",
  title: "PROVIN AUDITS",
  badge: "Populārākā izvēle",
  buttonText: "PASŪTĪT PROVIN AUDITU 99,99 €",
  goal:
    "Maksimāla drošība un pilnīga izpēte no ārvalstīm ievestiem auto. Apvieno PROVIN MINI un starptautisko maksas datubāzu pārskatus, oficiālo dīleru sistēmu informāciju un izsoļu foto arhīvus, sniedzot padziļinātu vēstures, nobraukuma un risku analīzi.",
  items: [
    {
      title: "Starptautiska vēstures pārbaude",
      description: "Padziļināta iepriekšējo īpašnieku, reģistrāciju un juridisko statusu analīze.",
      icon: "international",
    },
    {
      title: "carVertical integrācija",
      description:
        "Lai nodrošinātu konkrētajam reģionam atbilstošākos datus, atskaite var tikt aizstāta ar CARFAX vai citu specializētu datubāzi.",
      icon: "carvertical",
    },
    {
      title: "autoDNA integrācija",
      description:
        "Lai nodrošinātu konkrētajam reģionam atbilstošākos datus, atskaite var tikt aizstāta ar CEBIA vai citu specializētu datubāzi.",
      icon: "autodna",
    },
    {
      title: "Oficiālo dīleru un izsoļu portālu arhīvs*",
      description:
        "Dati no autorizētajiem servisiem un vēsturisko izsoļu portālu arhīviem, ieskaitot sākotnējos bojājumu attēlus pirms auto remonta.",
      icon: "dealer-data",
    },
  ],
  sampleReportHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
};

const DEALER_LV: HomeFeatureBreakdownPackage = {
  id: "dealer",
  title: "DĪLERA DATI",
  buttonText: "PASŪTĪT DĪLERA DATUS 24,99 €",
  goal:
    "Oficiālās dīleru servisa vēstures un ražotāju datubāzu analīze automašīnām. Pārbaude fokusējas uz autorizēto servisu ierakstiem, hronoloģisko nobraukumu, veiktajām apkopēm un rūpnīcas atsaukumiem, nodrošinot maksimālu pārredzamību par auto reālo ekspluatāciju.",
  items: [
    {
      title: "Oficiālā servisa vēsture",
      description:
        "Padziļināta autorizēto servisu apmeklējumu, veikto remontu un apkopes darbu ierakstu analīze.",
      icon: "international",
    },
    {
      title: "Odometra & kampaņu pārbaude",
      description:
        "Nobraukuma hronoloģiskā izsekošana ražotāja sistēmā, kā arī aktīvo garantijas atsaukumu pārbaude.",
      icon: "odometer",
    },
    {
      title: "Atbalstīto ražotāju sistēmas",
      description:
        "Piekļuve Vācijas premium zīmoliem (BMW, Audi, MB), VAG grupas, VOLVO un citu ražotāju oficiālajiem datiem.",
      icon: "brands",
    },
    {
      title: "100% Naudas atmaksas garantija",
      description:
        "Ja konkrētajam VIN kodam ražotāja oficiālajā datubāzē nav ierakstu, veiksim pilnu pirkuma atmaksu.",
      icon: "refund",
    },
  ],
  sampleReportHref: TP5_DEALER_SAMPLE_REPORT_HREF,
};

const KOREA_USA_LV: HomeFeatureBreakdownPackage = {
  id: "koreaUsa",
  title: "ASV UN KOREJA",
  buttonText: "PASŪTĪT ASV UN KOREJA 19,99 €",
  goal:
    "Pilns auto pārbaudes komplekts ASV un Korejā ekspluatētiem vai no šīm valstīm importētiem transportlīdzekļiem. Pārbaude fokusējas uz oficiālo reģistru ierakstiem, izsoļu vēsturi un vizuālajiem bojājumiem, nodrošinot pilnīgu skaidrību par auto reālo stāvokli pirms tā iegādes vai reģistrācijas.",
  items: [
    {
      title: "Oficiālo reģistru vēsture",
      description:
        "Pieeja apvienotajām ASV un Korejas transportlīdzekļu datubāzēm, kā arī oficiālajiem reģistrācijas (Title) statusiem.",
      icon: "international",
    },
    {
      title: "Izsoļu arhīvs un foto",
      description:
        "ASV (Copart, IAAI) un Korejas izsoļu vēsture ar pievienotiem attēliem pirms auto remonta.",
      icon: "auction",
    },
    {
      title: "Bojājumu un nobraukuma analīze",
      description:
        "Apdrošināšanas gadījumu (salvage / junk ieraksti), avāriju, nobraukuma hronoloģijas un zādzību pārbaude.",
      icon: "damage",
    },
    {
      title: "100% Naudas atmaksas garantija",
      description:
        "Ja ASV un Korejas datubāzēs par konkrēto VIN kodu dati nav pieejami, veiksim pilnu pirkuma atmaksu.",
      icon: "refund",
    },
  ],
};

const MINI_EN: HomeFeatureBreakdownPackage = {
  id: "mini",
  title: "PROVIN MINI",
  buttonText: "ORDER MINI AUDIT €39.99",
  sampleReportHref: TP5_MINI_SAMPLE_REPORT_HREF,
  goal:
    "Listing, technical data and risk analysis for cars that have already spent a longer time on Latvian roads. The check focuses on an in-depth review of local usage, recent roadworthiness inspection history and public registry data. The service delivers a full assessment of the major components, a reliability outlook and a summary of potential running risks.",
  items: [
    {
      title: "Listing and technical risk analysis",
      description:
        "Assessment of the listing and major components. Reliability outlook and running risks.",
      icon: "listing-analysis",
    },
    {
      title: "Origin-country registers & inspection history",
      description:
        "Detailed analysis of Latvian and European public registry data, including the full roadworthiness inspection history.",
      icon: "eu-registry",
    },
    {
      title: "In-person inspection guidance",
      description:
        "A practical checklist and tips on exactly what to look out for when going to see the car in person.",
      icon: "inspection-tips",
    },
    {
      title: "Personal consultation",
      description:
        "A consultation before the in-person viewing to talk through all the pros and cons of buying the specific car.",
      icon: "consultation",
    },
  ],
};

const AUDITS_EN: HomeFeatureBreakdownPackage = {
  id: "audits",
  title: "PROVIN AUDITS",
  badge: "Most popular choice",
  buttonText: "ORDER PROVIN AUDITS €99.99",
  goal:
    "Maximum confidence and a complete investigation of cars imported from abroad. Combines PROVIN MINI with international paid database reports, official dealer system data and auction photo archives, delivering in-depth history, mileage and risk analysis.",
  items: [
    {
      title: "International history check",
      description: "In-depth analysis of previous owners, registrations and legal status.",
      icon: "international",
    },
    {
      title: "carVertical integration",
      description:
        "To ensure the most relevant data for the specific region, the report may be substituted with CARFAX or another specialised database.",
      icon: "carvertical",
    },
    {
      title: "autoDNA integration",
      description:
        "To ensure the most relevant data for the specific region, the report may be substituted with CEBIA or another specialised database.",
      icon: "autodna",
    },
    {
      title: "Official dealer & auction portal archive*",
      description:
        "Data from authorised service centres and historical auction portal archives, including original damage photos before repairs.",
      icon: "dealer-data",
    },
  ],
  sampleReportHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
};

const DEALER_EN: HomeFeatureBreakdownPackage = {
  id: "dealer",
  title: "DEALER DATA",
  buttonText: "ORDER DEALER DATA €24.99",
  goal:
    "Official dealer service history and manufacturer database analysis for vehicles. The check focuses on authorised service records, chronological mileage, completed maintenance and factory recalls, providing maximum transparency into the car’s real operating history.",
  items: [
    {
      title: "Official service history",
      description:
        "In-depth analysis of authorised service visits, repairs carried out and maintenance records.",
      icon: "international",
    },
    {
      title: "Odometer & campaign check",
      description:
        "Chronological mileage tracking in the manufacturer system, plus checks for active warranty recalls.",
      icon: "odometer",
    },
    {
      title: "Supported manufacturer systems",
      description:
        "Access to German premium brands (BMW, Audi, MB), the VAG group, VOLVO and other manufacturers’ official data.",
      icon: "brands",
    },
    {
      title: "100% money-back guarantee",
      description:
        "If the manufacturer’s official database has no records for the specific VIN, we will issue a full purchase refund.",
      icon: "refund",
    },
  ],
  sampleReportHref: TP5_DEALER_SAMPLE_REPORT_HREF,
};

const KOREA_USA_EN: HomeFeatureBreakdownPackage = {
  id: "koreaUsa",
  title: "USA & KOREA",
  buttonText: "ORDER USA & KOREA €19.99",
  goal:
    "A full vehicle check package for cars used in the USA and Korea or imported from these countries. The check focuses on official registry records, auction history and visual damage, giving complete clarity on the car’s real condition before purchase or registration.",
  items: [
    {
      title: "Official registry history",
      description:
        "Access to combined US and Korea vehicle databases, plus official registration (Title) statuses.",
      icon: "international",
    },
    {
      title: "Auction archive and photos",
      description:
        "US (Copart, IAAI) and Korea auction history with attached images from before repairs.",
      icon: "auction",
    },
    {
      title: "Damage and mileage analysis",
      description:
        "Insurance events (salvage / junk records), accidents, mileage chronology and theft checks.",
      icon: "damage",
    },
    {
      title: "100% money-back guarantee",
      description:
        "If no data is available for the specific VIN in US and Korea databases, we will issue a full purchase refund.",
      icon: "refund",
    },
  ],
};

const PARTNER_LV: HomeFeatureBreakdownPackage = {
  id: "partner",
  title: "PROVIN BUSINESS",
  newBadge: true,
  buttonText: "Partneriem",
  ctaHref: "/partneriem",
  goal:
    "Risinājums izstrādāts auto tirdzniecības uzņēmumiem, lai pirms auto iegādes, pieņemšanas komisijā vai maiņas darījumos pilnībā novērstu riskus, kas saistīti ar koriģētu nobraukumu, slēptiem negadījumiem un neatbilstoši ievērotiem apkopes intervāliem.\n\nAr PROVIN BUSINESS audita atskaiti jūs ne tikai aizsargājat uzņēmumu no zaudējumiem iepirkumos, bet arī pasargājat savu reputāciju. Bieži vien iepriekšējie tirgotāji auto vēsturei nav pievērsuši uzmanību, ir apzināti slēpuši defektus vai pat koriģējuši odometra rādījumus. Pieņemot tādu auto savā klāstā vai kā pirmo iemaksu, atbildība gala pircēja priekšā gulstas uz jūsu uzņēmuma pleciem. Veicot pārbaudi pirms katra darījuma, jūs nodrošināt, ka jūsu zīmols tiek saistīts tikai ar pārbaudītiem un uzticamiem auto.\n\nKlientiem šī atskaite sniedz nepārprotamus pierādījumus par auto faktisko vēsturi, un auto tirdzniecības nozarē tā kļūst par kvalitātes standartu, kas uzskatāmi demonstrē uzņēmuma atbildību un godprātību. Tas stiprina uzticēšanos, paaugstina jūsu piedāvājuma vērtību tirgū un atvieglo lēmuma pieņemšanu jebkurā darījuma veidā.",
  items: [
    {
      title: "Oficiālo dīleru dati",
      description: "Autorizēto servisu ieraksti, apkopes un ražotāja sistēmu dati.",
      icon: "dealer-data",
    },
    {
      title: "carVertical + AutoDNA",
      description: "Starptautiskās maksas datubāzes nobraukumam, negadījumiem un juridiskajam statusam.",
      icon: "carvertical",
    },
    {
      title: "Izcelsmes valsts reģistri",
      description: "Eiropas un ASV publisko reģistru dati, tostarp tehnisko apskašu vēsture.",
      icon: "eu-registry",
    },
    {
      title: "Izsoļu portālu arhīvs",
      description: "Vēsturisko izsoļu ieraksti un bojājumu attēli pirms remonta, kad pieejami.",
      icon: "auction",
    },
  ],
};

const PARTNER_EN: HomeFeatureBreakdownPackage = {
  id: "partner",
  title: "PROVIN BUSINESS",
  newBadge: true,
  buttonText: "For partners",
  ctaHref: "/partneriem",
  goal:
    "Built for used-car dealers, so that before a purchase, trade-in appraisal or exchange deal you fully remove the risks of rolled-back mileage, hidden accidents and service intervals that were not followed properly.\n\nWith a PROVIN BUSINESS audit report you not only protect your company from buying losses, you also protect your reputation. Previous sellers often paid no attention to the car's history, deliberately concealed defects, or even rolled back the odometer reading. When you add such a car to your stock or accept it as a trade-in, the responsibility to the final buyer falls on your company. By checking every deal before it closes, you make sure your brand is associated only with verified, trustworthy cars.\n\nFor customers, this report provides unambiguous proof of the car's actual history, and in the car trade it becomes a standard of quality that visibly demonstrates the company's responsibility and integrity. It strengthens trust, raises the value of your offer in the market and makes the decision easier in any type of deal.",
  items: [
    {
      title: "Official dealer data",
      description: "Authorised service records, maintenance and manufacturer-system data.",
      icon: "dealer-data",
    },
    {
      title: "carVertical + AutoDNA",
      description: "International paid databases for mileage, accidents and legal status.",
      icon: "carvertical",
    },
    {
      title: "Origin-country registers",
      description: "European and US public registry data, including roadworthiness history.",
      icon: "eu-registry",
    },
    {
      title: "Auction portal archive",
      description: "Historical auction records and pre-repair damage photos when available.",
      icon: "auction",
    },
  ],
};

/** Full catalog for `/pakalpojumi` (extensible to 4-6 services). */
export const HOME_FEATURE_BREAKDOWN_PACKAGES: HomeFeatureBreakdownPackage[] = [
  AUDITS_LV,
  MINI_LV,
  DEALER_LV,
  KOREA_USA_LV,
  PARTNER_LV,
];

const HOME_FEATURE_BREAKDOWN_PACKAGES_EN: HomeFeatureBreakdownPackage[] = [
  AUDITS_EN,
  MINI_EN,
  DEALER_EN,
  KOREA_USA_EN,
  PARTNER_EN,
];

const MINI_DE: HomeFeatureBreakdownPackage = {
  id: "mini",
  title: "PROVIN MINI",
  buttonText: "MINI-AUDIT BESTELLEN 39,99 €",
  sampleReportHref: TP5_MINI_SAMPLE_REPORT_HREF,
  goal:
    "Analyse von Inserat und technischen Daten für Autos, die schon länger in Lettland genutzt werden. Im Mittelpunkt stehen die lokale Historie, aktuelle technische Prüfungen und öffentliche Register. Sie erhalten eine Einschätzung der wichtigsten Baugruppen, eine Zuverlässigkeitsprognose und eine Zusammenfassung möglicher Betriebsrisiken.",
  items: [
    {
      title: "Analyse von Inserat und technischen Risiken",
      description: "Bewertung des Inserats und der zentralen Baugruppen. Zuverlässigkeit und Betriebsrisiken.",
      icon: "listing-analysis",
    },
    {
      title: "Register des Herkunftslandes und Prüfhistorie",
      description:
        "Ausführliche Analyse lettischer und europäischer öffentlicher Register, einschließlich der vollständigen Historie der technischen Prüfungen.",
      icon: "eu-registry",
    },
    {
      title: "Hinweise zur Besichtigung vor Ort",
      description: "Eine praktische Checkliste, worauf Sie beim Ansehen des konkreten Autos achten sollten.",
      icon: "inspection-tips",
    },
    {
      title: "Persönliche Beratung",
      description: "Beratung vor der Besichtigung, um alle Vor- und Nachteile des konkreten Kaufs durchzugehen.",
      icon: "consultation",
    },
  ],
};

const AUDITS_DE: HomeFeatureBreakdownPackage = {
  id: "audits",
  title: "PROVIN AUDITS",
  badge: "Beliebteste Wahl",
  buttonText: "PROVIN AUDITS BESTELLEN 99,99 €",
  goal:
    "Maximale Sicherheit und eine vollständige Prüfung für aus dem Ausland importierte Autos. Verbindet PROVIN MINI mit internationalen kostenpflichtigen Datenbanken, Daten offizieller Händlersysteme und Auktionsfotoarchiven und liefert eine vertiefte Analyse von Historie, Laufleistung und Risiken.",
  items: [
    {
      title: "Internationale Historienprüfung",
      description: "Vertiefte Analyse früherer Halter, Zulassungen und des rechtlichen Status.",
      icon: "international",
    },
    {
      title: "carVertical-Anbindung",
      description:
        "Damit die Daten zur Region passen, kann der Bericht durch CARFAX oder eine andere spezialisierte Datenbank ersetzt werden.",
      icon: "carvertical",
    },
    {
      title: "autoDNA-Anbindung",
      description:
        "Damit die Daten zur Region passen, kann der Bericht durch CEBIA oder eine andere spezialisierte Datenbank ersetzt werden.",
      icon: "autodna",
    },
    {
      title: "Archiv offizieller Händler und Auktionsportale*",
      description:
        "Daten autorisierter Werkstätten und historischer Auktionsportale, einschließlich der ursprünglichen Schadensfotos vor der Reparatur.",
      icon: "dealer-data",
    },
  ],
  sampleReportHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
};

const DEALER_DE: HomeFeatureBreakdownPackage = {
  id: "dealer",
  title: "HÄNDLERDATEN",
  buttonText: "HÄNDLERDATEN BESTELLEN 24,99 €",
  goal:
    "Analyse der offiziellen Händler-Servicehistorie und der Herstellerdatenbanken. Die Prüfung konzentriert sich auf autorisierte Serviceeinträge, den chronologischen Kilometerstand, durchgeführte Wartungen und Werksrückrufe und macht die reale Nutzung des Autos nachvollziehbar.",
  items: [
    {
      title: "Offizielle Servicehistorie",
      description: "Vertiefte Analyse autorisierter Werkstattbesuche, Reparaturen und Wartungseinträge.",
      icon: "international",
    },
    {
      title: "Kilometerstand und Rückrufaktionen",
      description: "Chronologische Laufleistung im Herstellersystem plus Prüfung aktiver Garantierückrufe.",
      icon: "odometer",
    },
    {
      title: "Unterstützte Herstellersysteme",
      description:
        "Zugang zu deutschen Premiummarken (BMW, Audi, MB), der VAG-Gruppe, VOLVO und den offiziellen Daten weiterer Hersteller.",
      icon: "brands",
    },
    {
      title: "100 % Geld-zurück-Garantie",
      description:
        "Wenn die offizielle Herstellerdatenbank zur konkreten VIN keine Einträge hat, erstatten wir den vollen Kaufpreis.",
      icon: "refund",
    },
  ],
  sampleReportHref: TP5_DEALER_SAMPLE_REPORT_HREF,
};

const KOREA_USA_DE: HomeFeatureBreakdownPackage = {
  id: "koreaUsa",
  title: "USA UND KOREA",
  buttonText: "USA UND KOREA BESTELLEN 19,99 €",
  goal:
    "Ein vollständiges Prüfpaket für Autos, die in den USA oder Korea genutzt oder von dort importiert wurden. Im Mittelpunkt stehen amtliche Register, die Auktionshistorie und sichtbare Schäden, damit der reale Zustand vor Kauf oder Zulassung klar ist.",
  items: [
    {
      title: "Historie der amtlichen Register",
      description: "Zugang zu kombinierten Fahrzeugdatenbanken der USA und Koreas sowie zu offiziellen Title-Status.",
      icon: "international",
    },
    {
      title: "Auktionsarchiv und Fotos",
      description: "Auktionshistorie aus den USA (Copart, IAAI) und Korea mit Bildern von vor der Reparatur.",
      icon: "auction",
    },
    {
      title: "Analyse von Schäden und Laufleistung",
      description: "Versicherungsfälle (Salvage / Junk), Unfälle, Kilometerchronologie und Diebstahlprüfung.",
      icon: "damage",
    },
    {
      title: "100 % Geld-zurück-Garantie",
      description: "Wenn zur konkreten VIN in den Datenbanken der USA und Koreas nichts vorliegt, erstatten wir den vollen Kaufpreis.",
      icon: "refund",
    },
  ],
};

const PARTNER_DE: HomeFeatureBreakdownPackage = {
  id: "partner",
  title: "PROVIN BUSINESS",
  newBadge: true,
  buttonText: "Für Händler",
  ctaHref: "/partneriem",
  goal:
    "Für Autohändler, damit Sie vor einem Ankauf, einer Inzahlungnahme oder einem Tausch die Risiken von manipuliertem Kilometerstand, verdeckten Unfällen und nicht eingehaltenen Wartungsintervallen ausschließen.\n\nMit einem PROVIN BUSINESS-Audit schützen Sie das Unternehmen vor Einkaufsverlusten und zugleich Ihren Ruf. Vorbesitzer haben die Historie oft ignoriert, Mängel bewusst verschwiegen oder den Kilometerstand zurückgedreht. Nehmen Sie ein solches Auto in den Bestand oder als Anzahlung, liegt die Verantwortung gegenüber dem Endkunden bei Ihrem Unternehmen. Eine Prüfung vor jedem Abschluss sorgt dafür, dass Ihre Marke nur mit geprüften, vertrauenswürdigen Autos verbunden wird.\n\nFür Kunden ist der Bericht ein klarer Nachweis der tatsächlichen Historie. Im Handel wird er zu einem Qualitätsstandard, der Verantwortung und Sorgfalt sichtbar macht. Das stärkt das Vertrauen, hebt den Wert Ihres Angebots und erleichtert die Entscheidung bei jeder Art von Geschäft.",
  items: [
    {
      title: "Daten offizieller Händler",
      description: "Einträge autorisierter Werkstätten, Wartungen und Herstellerdaten.",
      icon: "dealer-data",
    },
    {
      title: "carVertical + AutoDNA",
      description: "Internationale kostenpflichtige Datenbanken zu Laufleistung, Unfällen und rechtlichem Status.",
      icon: "carvertical",
    },
    {
      title: "Register des Herkunftslandes",
      description: "Öffentliche Register aus Europa und den USA, einschließlich der Historie technischer Prüfungen.",
      icon: "eu-registry",
    },
    {
      title: "Archiv der Auktionsportale",
      description: "Historische Auktionseinträge und Schadensfotos vor der Reparatur, soweit vorhanden.",
      icon: "auction",
    },
  ],
};

const MINI_RU: HomeFeatureBreakdownPackage = {
  id: "mini",
  title: "PROVIN MINI",
  buttonText: "ЗАКАЗАТЬ MINI-АУДИТ 39,99 €",
  sampleReportHref: TP5_MINI_SAMPLE_REPORT_HREF,
  goal:
    "Разбор объявления и технических данных для автомобилей, которые уже долго эксплуатируются в Латвии. В центре - местная история, свежие техосмотры и публичные реестры. Вы получаете оценку основных узлов, прогноз надёжности и сводку возможных рисков эксплуатации.",
  items: [
    {
      title: "Разбор объявления и технических рисков",
      description: "Оценка объявления и основных узлов. Прогноз надёжности и риски эксплуатации.",
      icon: "listing-analysis",
    },
    {
      title: "Реестры страны происхождения и история техосмотров",
      description: "Подробный разбор данных публичных реестров Латвии и Европы, включая всю историю техосмотров.",
      icon: "eu-registry",
    },
    {
      title: "Советы к осмотру на месте",
      description: "Практический список: на что смотреть, когда едете смотреть конкретный автомобиль.",
      icon: "inspection-tips",
    },
    {
      title: "Личная консультация",
      description: "Консультация перед осмотром, чтобы разобрать все плюсы и минусы конкретной покупки.",
      icon: "consultation",
    },
  ],
};

const AUDITS_RU: HomeFeatureBreakdownPackage = {
  id: "audits",
  title: "PROVIN AUDITS",
  badge: "Самый популярный выбор",
  buttonText: "ЗАКАЗАТЬ PROVIN AUDITS 99,99 €",
  goal:
    "Максимальная ясность и полное расследование для машин, ввезённых из-за рубежа. Соединяет PROVIN MINI с международными платными базами, данными официальных дилерских систем и фотоархивами аукционов и даёт глубокий разбор истории, пробега и рисков.",
  items: [
    {
      title: "Международная проверка истории",
      description: "Глубокий разбор предыдущих владельцев, регистраций и юридического статуса.",
      icon: "international",
    },
    {
      title: "Интеграция carVertical",
      description: "Чтобы данные соответствовали региону, отчёт может быть заменён на CARFAX или другую специализированную базу.",
      icon: "carvertical",
    },
    {
      title: "Интеграция autoDNA",
      description: "Чтобы данные соответствовали региону, отчёт может быть заменён на CEBIA или другую специализированную базу.",
      icon: "autodna",
    },
    {
      title: "Архив официальных дилеров и аукционных порталов*",
      description: "Данные авторизованных сервисов и исторических аукционов, включая исходные фото повреждений до ремонта.",
      icon: "dealer-data",
    },
  ],
  sampleReportHref: TP5_AUDITS_SAMPLE_REPORT_HREF,
};

const DEALER_RU: HomeFeatureBreakdownPackage = {
  id: "dealer",
  title: "ДАННЫЕ ДИЛЕРА",
  buttonText: "ЗАКАЗАТЬ ДАННЫЕ ДИЛЕРА 24,99 €",
  goal:
    "Анализ официальной дилерской сервисной истории и баз производителя. Проверка смотрит записи авторизованных сервисов, хронологию пробега, выполненные обслуживания и заводские отзывные кампании и показывает, как автомобиль реально эксплуатировали.",
  items: [
    {
      title: "Официальная сервисная история",
      description: "Глубокий разбор визитов в авторизованный сервис, ремонтов и записей об обслуживании.",
      icon: "international",
    },
    {
      title: "Одометр и отзывные кампании",
      description: "Хронология пробега в системе производителя и проверка действующих гарантийных отзывов.",
      icon: "odometer",
    },
    {
      title: "Системы поддерживаемых производителей",
      description: "Доступ к немецким премиум-маркам (BMW, Audi, MB), группе VAG, VOLVO и официальным данным других производителей.",
      icon: "brands",
    },
    {
      title: "Гарантия возврата 100 %",
      description: "Если в официальной базе производителя по этому VIN записей нет, вернём полную стоимость.",
      icon: "refund",
    },
  ],
  sampleReportHref: TP5_DEALER_SAMPLE_REPORT_HREF,
};

const KOREA_USA_RU: HomeFeatureBreakdownPackage = {
  id: "koreaUsa",
  title: "США И КОРЕЯ",
  buttonText: "ЗАКАЗАТЬ США И КОРЕЯ 19,99 €",
  goal:
    "Полный пакет проверки для автомобилей, которые эксплуатировались в США или Корее либо ввезены оттуда. В центре - официальные реестры, история аукционов и видимые повреждения, чтобы реальное состояние было ясно до покупки или регистрации.",
  items: [
    {
      title: "История официальных реестров",
      description: "Доступ к объединённым базам автомобилей США и Кореи и к официальным статусам Title.",
      icon: "international",
    },
    {
      title: "Архив аукционов и фото",
      description: "История аукционов США (Copart, IAAI) и Кореи с фотографиями до ремонта.",
      icon: "auction",
    },
    {
      title: "Анализ повреждений и пробега",
      description: "Страховые случаи (salvage / junk), ДТП, хронология пробега и проверка на угон.",
      icon: "damage",
    },
    {
      title: "Гарантия возврата 100 %",
      description: "Если по этому VIN в базах США и Кореи данных нет, вернём полную стоимость.",
      icon: "refund",
    },
  ],
};

const PARTNER_RU: HomeFeatureBreakdownPackage = {
  id: "partner",
  title: "PROVIN BUSINESS",
  newBadge: true,
  buttonText: "Для дилеров",
  ctaHref: "/partneriem",
  goal:
    "Решение для автодилеров: до покупки, приёма на комиссию или обмена убрать риски скрученного пробега, скрытых ДТП и несоблюдённых интервалов обслуживания.\n\nОтчёт PROVIN BUSINESS защищает компанию от убытков на закупке и одновременно бережёт репутацию. Прежние продавцы часто не смотрели историю, сознательно скрывали дефекты или даже откатывали одометр. Если такой автомобиль попадает в ваш склад или принимается в зачёт, ответственность перед конечным покупателем лежит на вашей компании. Проверка перед каждой сделкой связывает ваш бренд только с проверенными и надёжными машинами.\n\nДля клиента отчёт - ясное доказательство фактической истории. В торговле он становится стандартом качества и показывает ответственность компании. Это укрепляет доверие, повышает ценность предложения и упрощает решение в любой сделке.",
  items: [
    {
      title: "Данные официальных дилеров",
      description: "Записи авторизованных сервисов, обслуживания и данные систем производителя.",
      icon: "dealer-data",
    },
    {
      title: "carVertical + AutoDNA",
      description: "Международные платные базы по пробегу, ДТП и юридическому статусу.",
      icon: "carvertical",
    },
    {
      title: "Реестры страны происхождения",
      description: "Публичные реестры Европы и США, включая историю техосмотров.",
      icon: "eu-registry",
    },
    {
      title: "Архив аукционных порталов",
      description: "Исторические записи аукционов и фото повреждений до ремонта, когда они доступны.",
      icon: "auction",
    },
  ],
};

const HOME_FEATURE_BREAKDOWN_PACKAGES_DE: HomeFeatureBreakdownPackage[] = [
  AUDITS_DE,
  MINI_DE,
  DEALER_DE,
  KOREA_USA_DE,
  PARTNER_DE,
];

const HOME_FEATURE_BREAKDOWN_PACKAGES_RU: HomeFeatureBreakdownPackage[] = [
  AUDITS_RU,
  MINI_RU,
  DEALER_RU,
  KOREA_USA_RU,
  PARTNER_RU,
];

export function catalogPackageAnchorId(id: HomeFeatureBreakdownPackageId): string {
  return `pakalpojums-${id}`;
}

/** Locale-aware catalog packages. Unknown locales stay Latvian. */
export function getHomeFeatureBreakdownPackages(locale?: string): HomeFeatureBreakdownPackage[] {
  const all =
    locale === "en"
      ? HOME_FEATURE_BREAKDOWN_PACKAGES_EN
      : locale === "de"
        ? HOME_FEATURE_BREAKDOWN_PACKAGES_DE
        : locale === "ru"
          ? HOME_FEATURE_BREAKDOWN_PACKAGES_RU
          : HOME_FEATURE_BREAKDOWN_PACKAGES;
  return all.filter((pkg) => pkg.id !== "koreaUsa" || TP5_KOREA_USA_PUBLIC);
}

/** Alias for catalog page clarity. */
export function getCatalogFeatureBreakdownPackages(
  locale?: string,
): HomeFeatureBreakdownPackage[] {
  return getHomeFeatureBreakdownPackages(locale);
}
