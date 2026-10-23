/**
 * Vienotie klienta stila noteikumi (Nils 17.10.2026, bez A3).
 * Katru bloku promptā liek vienu reizi. Formāts (virsraksts + rindkopa) paliek kā ir.
 */
export const AI_TONE_PRINCIPLE_RULES = `TONE (mandatory, once): Īss, konsultatīvs tonis. Fakts, tad (ja vajag) viens ieteikums. Bez slavinājuma un bez dramatizēšanas. Vārdi „var norādīt”, „saskan ar”, „pretrunā ar”, „pēc pieejamajiem datiem” (ne vairāk kā vienreiz laukā). Nepārspīlē un nemīkstini. Aizliegto vārdu saraksts ir tikai BANNED VOCABULARY.`;

export const AI_NO_PRAISE_RULES = `NO PRAISE (mandatory, every field): Nevērtē auto vai vēsturi ar īpašības vārdiem (teicams, labs, kopts, caurskatāms, uzticams). Raksti faktu. Neapgalvo, ka auto ir tehniski perfekts, bez riskiem vai garantēti kārtībā.`;

export const AI_LENGTH_CEILING_RULES = `LENGTH CEILINGS (ceilings, not targets; FLASH MAX breadth and operator paste override):
- empty source (0 facts): 1 sentence (≤200 chars), or „Šajā avotā ierakstu nav.”
- thin (1-2 facts): 1 paragraph (≤450)
- medium: ≤800
- rich: ≤1 500 (dealer comments ≤2 500)
- technical risks: 1 200-2 500 chars, 4-7 sections
- summary: 500-900
- mileage ≤1 200, incidents ≤900, inspection ≤2 000
Do not pad thin data to look complete.`;

export const AI_THIN_DATA_NO_PADDING_RULES = `THIN DATA: Ja avotā ir 0-2 fakti: 1 teikums ar faktu (vai „Šajā avotā ierakstu nav.”), bez skaidrojuma, bez ieteikuma, bez atsauces uz citiem avotiem.`;

export const AI_FACTS_THREE_SOURCES_RULES = `FACT SOURCES (mandatory): Skaitļi, datumi, intervāli, ķēžu skaits, atsaukumu numuri, kodi un ražotāja dati tikai no: (1) šī pasūtījuma avotu datiem, (2) kanoniskās faktu lapas, (3) agregātu faktu bāzes ar statusu verified. Ja tur nav, neraksti. Atsaukuma numuru raksti tikai, ja tas ir dīlera datos vai faktu bāzē.`;

export const AI_EUR_CANON_RULES = `EUR (mandatory, once): Eiro drīkst rakstīt tikai kā avotā fiksētu apdrošināšanas vai zaudējumu summu (AutoDNA, CarVertical, LTAB) negadījumu laukā un tā avota komentārā, kā arī cenu laukā (sludinājums vai tirgus). Remonta, detaļu, apkopes un darba EUR nekad. Kopsavilkumā un tehniskajos riskos EUR nav.`;

export const AI_OWNER_COUNT_RULES = `OWNERS: N īpašnieki = N-1 maiņas. Skaitli ņem no kanoniskās faktu lapas, nepārrēķini.`;

export const AI_MILES_KM_RULES = `MILES/KM: Jūdzes (mi, miles, mph) PROVIN tekstā nelieto. Ja avots dod jūdzes, pārrēķini uz km (1 mi = 1.609344 km, noapaļo līdz veseliem km) un raksti tikai km; ātrumam km/h. Nekad nelasi jūdzes kā km. ASV un ES intervālus salīdzini tikai pēc pārrēķina uz km.`;

export const AI_NO_CROSS_SECTION_REFS_RULES = `NO CROSS-SECTION REFS: Neraksti „kā minēts nobraukuma komentārā”, „skat. sadaļu…”, „detalizēti … KOMENTĀRĀ”.`;

export const AI_ODOMETER_DROP_RULES = `ODOMETER DROP (KANONISKIE FAKTI „Kritums” ar avotu): Nobraukuma laukā un kopsavilkumā kritums vai CarVertical/AutoDNA brīdinājums ir pirmais teikums: abi rādījumi, datumi, avots, starpība km. Avota laukā tikai ŠĪ avota kritums, viens teikums; cita avota kritumu nepiedēvē. Nekad „neliela nobīde”, „svārstības”. Nolūku neapgalvo: „iespējama odometra korekcija vai datu ievades kļūda; jāpārbauda.” „Atsevišķs neatbilstošs rādījums” nav korekcija: tikai nobraukuma laukā viens neitrāls teikums („Viens {avots} rādījums ({datums}) neatbilst pārējai secībai un, visticamāk, ir ievades kļūda.”), citur nepiemin.`;

export const AI_HIDDEN_MAINTENANCE_MILEAGE_RULES = `HIDDEN MAINTENANCE (mileage and summary only): Ja starp pirmo reģistrāciju galamērķa valstī un pārdošanu ir vairāk par 3 nedēļām, nosauc abus datumus: „starp X un Y ir N nedēļas; iemesls datos nav redzams”. Spekulāciju par slēptu uzturēšanu avotu komentāros NERAKSTI.`;

export const AI_SOURCE_OFF_TOPIC_RULES = `SOURCE FIELD SCOPE: Apskates, tehnisko risku, rūsas, plēves un eļļas intervālu tēmas šeit neraksti.`;

export const AI_NO_AUDIT_WORD_RULES = `WORDING: Vārdu „audits” / „šajā auditā” klienta tekstā un šajā uzdevumā neizmanto. Vaicā: ko tieši šis avots fiksē?`;

export const AI_HUMAN_DASH_RULES = `DASHES (mandatory, once): Generated client text must use only the short ASCII hyphen "-". NEVER Unicode em dash (U+2014) or en dash (U+2013). Spaced pause: " - ". Ranges: 1500-3000, 2007-2015, 24-72h. Prefer a comma, colon, or a new sentence when a dash is not needed.`;

export const AI_INTERNAL_MARKERS_RULES = `INTERNAL MARKERS never in client text: D1-D99 / D<n>, „kartē / riska karte”, „paka / pakā”, „brīfs”, „AVOTU FAKTI”, „FLASH MAX”, „KB:”, „confidence”, „unknowns”, operators / operatora norādes / piezīmes, „šajā auditā”, „šajā atskaitē” as a cross-section pointer, Audi/VW PR-Nr., German headings (HECK, AGR-Kühler, Rückruf), English headings.`;

/** Vienreiz visos lauku promptos. Formāts (virsraksts + rindkopa) paliek lauka uzdevumā. */
export const AI_STYLE_CANON_SHARED = [
  AI_TONE_PRINCIPLE_RULES,
  AI_NO_PRAISE_RULES,
  AI_LENGTH_CEILING_RULES,
  AI_THIN_DATA_NO_PADDING_RULES,
  AI_FACTS_THREE_SOURCES_RULES,
  AI_EUR_CANON_RULES,
  AI_OWNER_COUNT_RULES,
  AI_MILES_KM_RULES,
  AI_NO_CROSS_SECTION_REFS_RULES,
  AI_ODOMETER_DROP_RULES,
  AI_INTERNAL_MARKERS_RULES,
  AI_NO_AUDIT_WORD_RULES,
  AI_HUMAN_DASH_RULES,
].join("\n\n");
