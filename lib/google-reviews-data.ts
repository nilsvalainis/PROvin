/**
 * Kurētas Google Business atsauksmes — statisks, bezmaksas variants (bez API / widget).
 * Atjaunini šeit, kad parādās jaunas atsauksmes Google profilā.
 */

export type GoogleReviewEntry = {
  id: string;
  author: string;
  rating: 5;
  /** Relatīvais laiks kā Google (LV). */
  relativeDateLv: string;
  text: string;
};

const DEFAULT_GOOGLE_REVIEWS_PROFILE_URL = "https://share.google/NZamMCLrvxOPi9sy9";

export const GOOGLE_REVIEWS_AGGREGATE_RATING = 5;

export const GOOGLE_REVIEWS: GoogleReviewEntry[] = [
  {
    id: "aigars-smiltnieks",
    author: "Aigars Smiltnieks",
    rating: 5,
    relativeDateLv: "pirms mēneša",
    text: `Ļoti profesionāla un kvalitatīva pieeja auto pārbaudei. Pasūtīju PROVIN auditu, un saņemtā atskaite pārspēja gaidīto — ļoti detalizēta, padziļināta un ar daudz vērtīgu informāciju, ko standarta pārbaudēs nemaz nevar ieraudzīt.

Pateicoties šim auditam, varēju daudz drošāk izvērtēt auto stāvokli un pieņemt informētu lēmumu. Īpaši novērtēju ieguldīto darbu, uzmanību detaļām un atsaucīgo komunikāciju visa procesa laikā.

Noteikti iesaku ikvienam, kurš vēlas saprast patieso automašīnas stāvokli pirms iegādes un izvairīties no nepatīkamiem pārsteigumiem nākotnē. Paldies par lielisko darbu!`,
  },
  {
    id: "edgars-sulcs",
    author: "Edgars Šulcs",
    rating: 5,
    relativeDateLv: "pirms 19 stundām",
    text: "Lieliska pieredze ar Provin! Pirms auto iegādes nolēmu pārbaudīt tā vēsturi un biju patīkami pārsteigts par atskaites kvalitāti un apjomu. Salīdzinot ar citiem populārajiem servisiem, Provin piedāvā krietni detalizētāku, dziļāku un nopietnāku informāciju. Dati ir precīzi un ļoti izsmeļoši, tas palīdzēja pieņemt drošu lēmumu par auto iegādi. Noteikti iesaku visiem!",
  },
  {
    id: "dzintars-jaunzems",
    author: "Dzintars Jaunzems",
    rating: 5,
    relativeDateLv: "pirms 5 dienām",
    text: 'Paldies! Ļoti noderīgs atbalsts, ja plānojat pirkt auto un gribat "ieberziena" risku samazināt līdz minimumam!',
  },
  {
    id: "andris-ever",
    author: "Andris Ever",
    rating: 5,
    relativeDateLv: "pirms 6 dienām",
    text: "Ļoti vērtīga atskaite, sīki un detalizēti, rūpīgi izpētīts no visiem aspektiem. Paldies, pie auto apskates, jau zināju auto vājās vietas, kur skatīties, kam pievērst īpašu uzmanību tieši konkrētajam modelim. Auto nopirku, arī pirms pirkšanas sazvanījos un izrunājām manus novērojumus.",
  },
  {
    id: "ralph-lv",
    author: "Ralph_LV",
    rating: 5,
    relativeDateLv: "pirms nedēļas",
    text: "Vēlos pateikt lielu paldies Provin.lv komandai! Pēc atskaites saņemšanas sazvanījāmies, un šī saruna man tiešām palīdzēja. Ne tikai izskaidroja visu saprotamā valodā, bet arī deva vērtīgus padomus, kam pievērst uzmanību – iespējamām krāsotām detaļām, salona nolietojumam un citām niansēm, ko pats, visticamāk, nebūtu pamanījis. Visvairāk novērtēju to, ka neviens neko neuzspieda, bet ieteica, ko vēl pārbaudīt, pirms tērēt naudu remontiem, un palīdzēja pieņemt pārdomātu lēmumu. Pēc sarunas galva bija daudz skaidrāka, pazuda steiga un emocijas, un uz automašīnu paskatījos pavisam citādi. Ja meklējat godīgu un profesionālu palīdzību pirms auto iegādes, Provin.lv noteikti ir īstā vieta. Paldies par jūsu laiku, zināšanām un cilvēcīgo attieksmi!",
  },
];

export function getGoogleReviewsProfileUrl(): string {
  return process.env.NEXT_PUBLIC_GOOGLE_REVIEWS_URL?.trim() || DEFAULT_GOOGLE_REVIEWS_PROFILE_URL;
}
