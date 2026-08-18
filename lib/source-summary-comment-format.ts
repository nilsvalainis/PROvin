/**
 * Īsi, faktiski avota komentāri (PDF imports, AI Plan B, ✨ avota komentāri).
 * Hibrīds: objektīvs konteksts + skaidri atzīmētas datu neatbilstības.
 */
import type { LtabIncidentRow } from "@/lib/admin-source-blocks";
import {
  autoRecordsRowHasData,
  formatAutoRecordsDateForOutput,
  sortAutoRecordsDescending,
  type AutoRecordsServiceRow,
} from "@/lib/auto-records-paste-parse";

export const SOURCE_COMMENT_NO_ISSUES_LV = "Problēmas nav konstatētas.";

/** Klientam redzams neitrāls apzīmējums datu nesakritībai (agrāk „ANOMĀLIJA: ”). */
export const SOURCE_COMMENT_ANOMALY_PREFIX = "NEATBILSTĪBA: ";

const SOURCE_COMMENT_ANOMALY_PREFIX_RE = /^(?:ANOMĀLIJA|NEATBILSTĪBA):\s*/i;

/** Obligātā vārdu krājuma un rindkopu disciplīna — visi ✨ eksperta komentāri. */
export const PROVIN_REPORT_COPY_VOCABULARY = `LATVIAN VOCABULARY & PHRASING (mandatory):
- Use "automašīna" (or "auto", "šī automašīna") when referring to the vehicle in buyer-facing prose — NEVER "automobīlis".
- "transportlīdzeklis" is allowed only when citing official CSDD/registry wording verbatim; otherwise prefer "automašīna".
- HUMAN DASHES (anti-AI tell): in ALL client-facing Latvian text use only the short ASCII hyphen "-". Ranges: 2007-2015, 1-2. NEVER Unicode em dash "—" or en dash "–" (mid-sentence or in ranges). NEVER start a paragraph or standalone sentence with "- " or "– ".
- NEVER „Baltija” / „Baltijas” / „Baltijā”. Say **Latvija** (Latvijas ziemas, Latvijas ceļi, Latvijā ekspluatēts). If origin is Lithuania or Estonia, name **Lietuva** or **Igaunija** — never the umbrella „Baltija”.
- NEVER „saime” (dzinēja saime, saimes līmenī, šai saimei). Say **šis dzinējs**, **šī paaudze**, **šis agregāts**, or **pēc pieejamajiem datiem, bez precīza koda**.
- Quattro: say **Quattro**, never „Quattro trakts”. Kardāna šarnīri: **kardāna krustiņi**, never „kardāna krusteniskie”. Center support bearing: **karājošais gultnis**, never „centra gultnis”. NEVER „vidējs uzturēšanas risks” (nor zems/augsts) — say whether the item **ir / nav populāra problēma** at this mileage.
- LIGHT LATVIAN (mandatory — Gemini already writes this way; Claude must too): short spoken workshop Latvian a Riga mechanic would say to a buyer. NEVER paper-calques: „atteice”, „kontrolpunkts” / „kontrolpunkts klātienē”, „sviedru sajūgs”, „tuvākā laika izdevums” / „tuvākā laika rēķins”, „vecuma logs” / „tuvākais logs”, „vecuma kaprīze” / „paaudzes kaprīze” / „ilgtermiņa kaprīze”, „izmaksu draiveris”. Say instead: **bojājums / defekts** (not atteice); **jāpārbauda klātienē** (not kontrolpunkts); **mitrā sajūga / sausā sajūga** (not sviedru sajūgs); **drīzumā gaidāms darbs** (not tuvākā laika izdevums); **šajā vecumā / šajā posmā** (not vecuma logs); **šajā vecumā tipiska parādība / paaudzes īpatnība** (not kaprīze); **galvenais tuvākajā laikā** (not izmaksu draiveris).
- NEVER invent or name approximate repair/service prices in comments: no „orientējoši 300-600 €”, no parenthetical € bands, no „Baltijas servisa līmenis”. EUR is allowed ONLY for (1) recorded insurance/claim amounts from sources and (2) listing/market prices in „Cenas vērtējums”. Technical risks describe popularity and likelihood of a fault — never a euro quote.
- EPISTEMIC HEDGING (digital audit — not a physical inspection): prefer „teorētiski”, „visticamāk”, „ļoti iespējams”, „augsta/vidēja/zema varbūtība”, „pēc pieejamajiem datiem”, „salīdzinoši labs”, „labvēlīgs signāls datos”, „tipiski šim agregātam”, „ja apkope bijusi atbilstoša”, „neizslēdz”, „var norādīt”, „liecina”. Avoid absolute claims that the car is „tehniski perfekts”, „bez riskiem”, or „garantēti kārtībā” without physical inspection.
- WORKSHOP LATVIAN (same for Gemini and Claude): write as a Riga independent-workshop expert briefing a buyer — short native sentences, not English translated into Latvian. Prefer: **iesmidzinātājs (sprausla)** not bare „injektors”; **ātrumkārba / pārnesumkārba** not „transmisija”; **sadales ķēde / zobsiksna**; **hidromufte**; **divmasu spararats**; **mehatronika**. Keep brand names (Quattro, DSG, xDrive) but do not invent Latvian calques around them.`;

/**
 * Claude (Opus/Sonnet/Haiku) bieži tulko no angļu iekšējās valodas. Gemini 3 Flash
 * to dara mazāk — tāpēc šis bloks tiek pielikts Claude sistēmas prompta BEIGĀS
 * (recency), nevis kā atsevišķa „Gemini-only” mācība. Saturs = tas pats vārdu krājums.
 */
export const PROVIN_CLAUDE_LV_SURFACE = `LATVIAN SURFACE (Claude — last instruction, overrides English calques):
You are writing the final client text in Latvian. Do not translate English drafts. Think in workshop Latvian the way Gemini Flash already does — light, spoken, no academic nouns.
Banned (Gemini already avoids these — you must too): „automobīlis”, „saime”, „Baltija/Baltijas/Baltijā”, „Quattro trakts”, „kardāna krusteniskie”, „centra gultnis”, „vidējs/zems/augsts uzturēšanas risks”, „orientējoši … €”, „transmisija” as the gearbox name, bare „injektors” without iesmidzinātājs, em dash "—" / en dash "–", „atteice”, „kontrolpunkts”, „kontrolpunkts klātienē”, „sviedru sajūgs”, „tuvākā laika izdevums”, „tuvākā laika rēķins”, „vecuma logs”, „tuvākais logs”, „vecuma kaprīze”, „paaudzes kaprīze”, „ilgtermiņa kaprīze”, „izmaksu draiveris”.
Use: automašīna; Latvija (or Lietuva/Igaunija); šis dzinējs / šī paaudze; Quattro; kardāna krustiņi; karājošais gultnis; ir/nav populāra problēma; iesmidzinātājs (sprausla); ātrumkārba; bojājums/defekts; jāpārbauda klātienē; mitrā sajūga; drīzumā gaidāms darbs; šajā vecumā / šajā posmā; paaudzes īpatnība; ASCII hyphen "-".
If a sentence sounds like translated English or like a technical paper, rewrite it as a short native Latvian sentence before output.`;

/** Atturīgs eksperta tonis — bez pārspīlējumiem un bez 100 % apgalvojumiem. */
export const PROVIN_RESTRAINED_TONE_RULES = `RESTRAINED EXPERT VOICE (mandatory — PROVIN gives a documentary opinion, not a verdict):
- BANNED WORDS in client-facing Latvian text: „kritisks” / „kritiski” / „kritiska”, „anomālija”, „katastrofāls”, „šokējošs”, „drastisks”, „briesmīgs”, „milzīgs”, „bīstams”, „skandalozs”, „krāpšana”, „mahinācija”, „absolūti”, „nepārprotami”, „acīmredzami”, „100 %”, „pierāda”, „garantēti”. No exclamation marks, no ALL-CAPS emphasis, no stacked dramatic adjectives.
- Neutral replacements: „neatbilstība”, „nesakritība”, „pretruna starp avotiem”, „iztrūkstoši dati”, „būtisks”, „paaugstināts risks”, „jāņem vērā”, „jāpārbauda klātienē”, „dati to neapstiprina”, „dati to neizslēdz”.
- Digital registry data can be incomplete, delayed, or entered with errors. State what the records show („ierakstos fiksēts”, „pēc pieejamajiem datiem”, „avotos nav fiksēts”) — never as proven physical condition and never as proven intent (odometer manipulation, fraud, concealment).
- Missing records do not prove a clean car; an existing record does not prove severity. Make clear which of the two the data supports.
- One calibrated sentence outweighs three emphatic ones: never repeat the same warning inside one field and never add a dramatic closing paragraph.
- The client should feel he is reading a calm senior expert opinion — informative, not pushy, no sales pressure and no scare tactics.`;

/** Īsi, koncentrēti lauki — apkopojumi un salīdzinājumi tikai kopsavilkumā. */
export const PROVIN_COMMENT_BREVITY_RULES = `BREVITY & FOCUS (mandatory for every ✨ field):
- Each comment answers ONE question: what does THIS source / THIS field add to the audit? Say it in the first paragraph.
- DEFAULT LENGTH: 2–4 paragraphs, 2–3 sentences each (≈350–800 characters). Thin data → shorter. Only OPERATORA KOMANDAS may extend this. (Length exceptions for flagship fields live only in those fields' task blocks — do not copy 8–12 paragraphs into source/seller/summary.)
- Cross-source comparison is NOT this field's job: at most ONE short sentence, and only when a conflict changes the conclusion. The aggregate picture, source-by-source comparison, and the purchase verdict belong to „3. Kopsavilkums”.
- Never retell a fact the client already reads in another section or source comment. If this source only confirms it: one sentence („Saskan ar …”) and move on.
- Cut: greetings, restating the section title, „kopumā var secināt”, „svarīgi atzīmēt”, generic „jāpārbauda klātienē” without naming the component, closing paragraphs that repeat earlier content.
- No paragraph without new information. When there is nothing left to add, end the comment — a short, precise comment is the goal, not filling space.`;

/** Unicode em/en dashes look like AI; client copy uses ASCII hyphen. */
export function applyProvinHumanDashes(text: string): string {
  return text.replace(/[\u2012\u2013\u2014\u2015\u2212]/g, "-");
}

/** Aptuvenās remonta/apkopes cenas komentārā — aizliegts; avota zaudējumu un sludinājuma cenas paliek. */
function stripApproximateRepairPrices(text: string): string {
  return text
    .replace(
      /\s*\(?orientējoši\s+\*?\*?[\d\s.]+\s*(?:-\s*[\d\s.]+\s*)?€\*?\*?(?:\s+un\s+\*?\*?[\d\s.]+\s*(?:-\s*[\d\s.]+\s*)?€\*?\*?)?\)?/gi,
      "",
    )
    .replace(/\s*\(\s*\*?\*?[\d\s.]{1,8}\s*-\s*[\d\s.]{1,8}\s*€\*?\*?(?:\s+joslā)?\s*\)/gi, "")
    .replace(/\s*aptuveni\s+\*?\*?[\d\s.]+\s*(?:-\s*[\d\s.]+\s*)?€\*?\*?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;:])/g, "$1");
}

export function applyProvinReportCopyVocabulary(text: string): string {
  let out = applyProvinHumanDashes(text);
  const replacements: Array<[RegExp, string]> = [
    [/\bAutomobīļiem\b/g, "Automašīnām"],
    [/\bautomobīļiem\b/g, "automašīnām"],
    [/\bAutomobīļu\b/g, "Automašīnu"],
    [/\bautomobīļu\b/g, "automašīnu"],
    [/\bAutomobīlim\b/g, "Automašīnai"],
    [/\bautomobīlim\b/g, "automašīnai"],
    [/\bAutomobīļa\b/g, "Automašīnas"],
    [/\bautomobīļa\b/g, "automašīnas"],
    [/\bAutomobīlis\b/g, "Automašīna"],
    [/\bautomobīlis\b/g, "automašīna"],
    [/\bQuattro\s+trakts\b/gi, "Quattro"],
    [/\bkardāna\s+krusteniskie\b/gi, "kardāna krustiņi"],
    [/\bKardāna\s+krusteniskie\b/g, "Kardāna krustiņi"],
    [/\bcentra\s+gultņi\b/gi, "karājošie gultņi"],
    [/\bCentra\s+gultņi\b/g, "Karājošie gultņi"],
    [/\bcentra\s+gultnis\b/gi, "karājošais gultnis"],
    [/\bCentra\s+gultnis\b/g, "Karājošais gultnis"],
    [/\bBaltijas\b/g, "Latvijas"],
    [/\bbaltijas\b/g, "latvijas"],
    [/\bBaltijā/g, "Latvijā"],
    [/\bbaltijā/g, "latvijā"],
    [/\bBaltiju\b/g, "Latviju"],
    [/\bbaltiju\b/g, "latviju"],
    [/\bBaltija\b/g, "Latvija"],
    [/\bbaltija\b/g, "latvija"],
    [/\bdzinēja saimei\b/gi, "šim dzinējam"],
    [/\bdzinēja saimi\b/gi, "dzinēja tipu"],
    [/\bdzinēja saime\b/gi, "dzinēja tips"],
    [/\bdīzeļa saimi\b/gi, "dīzeļa tipu"],
    [/\bdīzeļa saime\b/gi, "dīzeļa tips"],
    [/\bsaimes līmenī/gi, "pēc pieejamajiem datiem, bez precīza koda"],
    [/\bšai saimei\b/gi, "šai paaudzei"],
    [/\bšo saimi\b/gi, "šo paaudzi"],
    [/\bšīs saimes\b/gi, "šīs paaudzes"],
    [/\bdažas saimes\b/gi, "dažus agregātus"],
    [/\bsaime, kurai\b/gi, "dzinējs, kuram"],
    [/\bsaimei\b/gi, "paaudzei"],
    [/\bsaimes\b/gi, "paaudzes"],
    [/\bsaimi\b/gi, "paaudzi"],
    [/\bsaime\b/gi, "paaudze"],
    [/\baugsts uzturēšanas risks\b/gi, "ir populāra problēma"],
    [/\bliels uzturēšanas risks\b/gi, "ir populāra problēma"],
    [/\bzems uzturēšanas risks\b/gi, "nav populāra problēma"],
    [/\bmazs uzturēšanas risks\b/gi, "nav populāra problēma"],
    [/\bpaliek vidējs uzturēšanas risks\b/gi, "nav populāra problēma"],
    [/\bir vidējs uzturēšanas risks\b/gi, "nav populāra problēma"],
    [/\bvidējs uzturēšanas risks\b/gi, "nav populāra problēma"],
    [/\buzturēšanas risks\b/gi, "jāņem vērā, vai tā ir populāra problēma"],
    [/\bsviedru sajūgi\b/gi, "mitrās sajūgas"],
    [/\bsviedru sajūgs\b/gi, "mitrā sajūga"],
    [/\bsviedru sajūga\b/gi, "mitrā sajūga"],
    [/\bTuvākā laika izdevumi\b/g, "Drīzumā gaidāmi darbi"],
    [/\btuvākā laika izdevumi\b/gi, "drīzumā gaidāmi darbi"],
    [/\bTuvākā laika izdevums\b/g, "Drīzumā gaidāms darbs"],
    [/\btuvākā laika izdevums\b/gi, "drīzumā gaidāms darbs"],
    [/\bTuvākā laika rēķins\b/g, "Drīzumā gaidāms darbs"],
    [/\btuvākā laika rēķins\b/gi, "drīzumā gaidāms darbs"],
    [/\btuvākā laika punkts\b/gi, "galvenais tuvākajā laikā"],
    [/\bTuvākais izmaksu draiveris\b/g, "Galvenais tuvākajā laikā gaidāmais darbs"],
    [/\btuvākais izmaksu draiveris\b/gi, "galvenais tuvākajā laikā gaidāmais darbs"],
    [/\btuvāko izmaksu draiveris\b/gi, "galvenais tuvākajā laikā gaidāmais darbs"],
    [/\bizmaksu draiveris\b/gi, "galvenais tuvākajā laikā gaidāmais darbs"],
    [/\bšajā vecuma logā/gi, "šajā vecumā"],
    [/\bvecuma logā/gi, "šajā vecumā"],
    [/\bvecuma logs\b/gi, "šis vecums"],
    [/\bvecuma logu\b/gi, "šo vecumu"],
    [/\btuvākais logs\b/gi, "tuvākais posms"],
    [/\bvecuma kaprīzes\b/gi, "šajā vecumā tipiskas parādības"],
    [/\bvecuma kaprīze\b/gi, "šajā vecumā tipiska parādība"],
    [/\bpaaudzes kaprīzes\b/gi, "šīs paaudzes īpatnības"],
    [/\bpaaudzes kaprīze\b/gi, "šīs paaudzes īpatnība"],
    [/\bilgtermiņa kaprīzes\b/gi, "ilgtermiņa īpatnības"],
    [/\bilgtermiņa kaprīzi\b/gi, "ilgtermiņa īpatnības"],
    [/\bilgtermiņa kaprīze\b/gi, "ilgtermiņa īpatnība"],
    [/\bkaprīzēm\b/gi, "īpatnībām"],
    [/\bkaprīzes\b/gi, "īpatnības"],
    [/\bkaprīzi\b/gi, "īpatnības"],
    [/\bkaprīzē/gi, "sāk rādīt kļūdas"],
    [/\bkaprīze\b/gi, "īpatnība"],
    [/\bpaliek kontrolpunkts klātienē/gi, "jāpārbauda klātienē"],
    [/\bir kontrolpunkts klātienē/gi, "jāpārbauda klātienē"],
    [/\bpaliek tālāks kontrolpunkts\b/gi, "tālāk jāpārbauda klātienē"],
    [/\btālāks kontrolpunkts\b/gi, "tālāk jāpārbauda klātienē"],
    [/\bkontrolpunkts klātienē/gi, "jāpārbauda klātienē"],
    [/\bpaliek kontrolpunkts\b/gi, "jāpārbauda klātienē"],
    [/\bir kontrolpunkts\b/gi, "jāpārbauda klātienē"],
    [/\btikai kontrolpunkts\b/gi, "jāpārbauda klātienē"],
    [/\bkontrolpunktu\b/gi, "klātienes pārbaudi"],
    [/\bkontrolpunkti\b/gi, "klātienes pārbaudes"],
    [/\bkontrolpunkts\b/gi, "jāpārbauda klātienē"],
    [/\bpaliek jāpārbauda klātienē/gi, "jāpārbauda klātienē"],
    [/\batteices\b/gi, "bojājumi"],
    [/\batteici\b/gi, "bojājumu"],
    [/\batteicē/gi, "bojājumā"],
    [/\batteice\b/gi, "bojājums"],
  ];
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  return stripApproximateRepairPrices(out);
}

function formatExpertParagraphs(t: string): string[] {
  return t
    .split(/\n\n+/)
    .map((p) =>
      p
        .trim()
        .replace(/\s+/g, " ")
        .replace(/^\s*[-•*–]\s+/gm, "")
        .replace(/^\s*\d+[\.)]\s+/gm, ""),
    )
    .filter(Boolean);
}

/**
 * Eksperta komentāra forma (vārdu krājums, rindkopas) — bez garuma nogriešanas.
 * Nogriezts teksts pēc ģenerēšanas nozīmē, ka apmaksātais saturs tiek izmests.
 */
export function normalizeProvinExpertAiComment(raw: string | undefined | null): string {
  const t = applyProvinReportCopyVocabulary((raw ?? "").trim());
  if (!t) return t;
  return formatExpertParagraphs(t).join("\n\n");
}

/** Gatavo PROVIN audita atskaišu komentāru paraugi — few-shot stils ✨ ģeneratoram. */
export const PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES = `FEW-SHOT STYLE EXAMPLES (match this paragraph structure, bold hooks, restrained tone — and this LENGTH: these are complete comments, not excerpts):

Example 1 (CSDD — avota fokuss, nevis pilna nobraukuma eseja):
"**Pirmā reģistrācija Latvijā.** CSDD datos automašīna Latvijā reģistrēta **2016. gada 22. janvārī**, kā izcelsmes valsti norādot Vāciju; īpašnieku maiņu ķēde pēc importa ir īsa, bez ierobežojumu atzīmēm.

**Tehnisko apskašu tendence.** Pamata pārbaudi ar pirmo reizi nav izgājusi **sešas reizes**; atkārtojas korozija, eļļas noplūdes un priekšējā tilta brīvkustības. Šo atkārtoto defektu sēriju pārējie avoti nefiksē — tas ir CSDD ieguldījums šajā auditā."

Example 2 (CSDD tehniskā apskate — atturīgs formulējums skaitļiem):
"**Tehnisko apskašu vēsture.** Pamatpārbaudi ar pirmo reizi automašīna nav izgājusi **sešas reizes**, pēdējo reizi novērtējumu '2' saņemot **2025. gada 16. decembrī**. Atkārtojas vieni un tie paši defekti: nesošo elementu korozija, eļļas noplūdes un brīvkustības priekšējā tilta svirās.

**Dūmainības rādītāji.** Atgāzu mērījumi ir bijuši nevienmērīgi — iepriekšējos gados dūmainības koeficients sasniedzis **2.32** un **2.95**, pēdējā apskatē fiksēts **0.58**. Tas var norādīt uz dzinēja un degvielas sistēmas nolietojumu, tomēr viens mērījums ir situatīvs un jāpārbauda klātienē."

Example 3 (negadījumi — kontekstuāla summas interpretācija):
"**Apdrošināšanas ieraksts.** CarVertical fiksē **2019. gada jūlijā** Vācijā reģistrētu negadījumu ar zaudējumu diapazonu **5 001-10 000 €**; LTAB un AutoDNA šim periodam summu neuzrāda. Automašīna tobrīd bija **~8 gadus** vecs vidējā segmenta universālis, tāpēc šāda summa drīzāk liecina par **būtisku**, ne tikai kosmētisku remontu.

**Nozīme pircējam.** Ieraksts jāsasaista ar virsbūves stāvokli klātienē — krāsas biezums, šuvju platums un paneļu simetrija. Bez fiziskas pārbaudes strukturālu remontu izslēgt nevar."

Example 3b (augsta summa, bet ierobežots smagums premium klasē):
"**Zaudējumu apjoms kontekstā.** AutoDNA fiksē **2022. gada februārī** Vācijā apdrošināšanas izmaksu **6 840 €** ar bojātu priekšējo buferi un labo priekšējo lukturi. Automašīnai tobrīd bija **~1 gads**, tā ir premium klase ar adaptīvo apgaismojumu un sensoriem, tāpēc šāda summa bieži atspoguļo dārgas OEM detaļas un dīlera darbu, ne obligāti nesošo elementu bojājumu.

**Ko pārbaudīt klātienē.** Virsbūves pārbaude joprojām nepieciešama (šuvju platums, radars un kamera aiz bufera), taču pēc summas vien smagu negadījumu secināt nevar — jāvērtē kopā ar bojājumu zonām, vecumu un klasi."

Example 4 (cena / tirgus):
"**Cenas pozīcija Latvijas tirgū.** Sludinājuma cena **14 900 €** atbilst vidējam ss.lv līmenim šim modeļa gadam un dzinējam, tomēr **nobraukums 218 000 km** un ierobežota servisa dokumentācija samazina vērtību pret līdzīgiem auto ar pilnu vēsturi.

**Importa konteksts.** IRISS dati rāda līdzīgus eksemplārus Vācijas wholesale segmentā **11 500-12 800 €** apmērā; pēc loģiskā uzcenojuma un reģistrācijas izmaksām telpa cenas sarunām ir ierobežota."

Example 5 (AutoDNA — bojājumi; viens teikums salīdzinājumam):
"**Zaudējumu ieraksts.** AutoDNA fiksē **2018. gada martā** Vācijā reģistrētu negadījumu ar zaudējumu **2 930 €**, bojājot priekšējo labo sānu un priekšējo kreiso durvi; salīdzinājumā ar CarVertical datums sakrīt, bet šis avots dod precīzāku summu un bojājumu zonas.

**Ko tas nozīmē.** CSDD un LTAB šim periodam izmaksu neuzrāda, tāpēc virsbūves remonta kvalitāte jāvērtē klātienē ar krāsas mērītāju."

Example 6 (AUTO RECORDS / dīlera dati):
"**Dīlera serviss un ekspluatācijas veids.** Dīlera datos automašīnai norādīts tipa kods, kas atbilst taksometra vai komerciālai ekspluatācijai (**937**), un servisa žurnālā redzamas apkopes ik **15 000-18 000 km** Vācijā pirms ievešanas. Šo signālu CSDD un AutoDNA tabulas nesniedz.

**Km atskaites punkts.** Pēdējais dīlera fiksējums (**198 420 km**, **2023. gada augusts**) sakrīt ar pārējo avotu līkni; detalizētā nobraukuma analīze ir „NOBRAUKUMA VĒSTURES KOMENTĀRĀ”."

Example 7 (NOBRAUKUMA VĒSTURES KOMENTĀRS — vienīgā vieta pilnai apkopošanai):
"**Hronoloģija un lineārums.** Pieejamajos avotos nobraukuma līkne ir lineāra ar vidēji **22 000-24 000 km gadā** pēc pirmās reģistrācijas Vācijā **2014. gadā**; izteikti kritumi nav fiksēti. Ieraksti atbilst drīzāk šosejas režīmam ar zemāku motorstundu slodzi nekā tipiskam pilsētas auto.

**Datu blīvums un iztrūkstošie periodi.** Ieraksti ir regulāri (reizi 6–12 mēnešos), tomēr pirms ievešanas Latvijā ir **astoņu gadu periods bez datiem** (2007-2015). Kopā ar dīlera **kodu 937** tas pieļauj, ka faktiskais Eiropas nobraukums bijis augstāks, taču pieejamie ieraksti to neapstiprina."`;

const PDF_HYBRID_COMMENT_RULES = `COMMENTARY (mandatory) — hybrid "Factual Context + Anomalies":
1. NEVER suppress normal context: damage zones, body sides, dealer/service milestones, registration facts, policy periods, Status Center notes, historical remarks — always extract as objective Latvian facts.
2. Ultra-concise bullet list (- prefix per line), zero conversational fluff, max 4 bullets, max ~350 characters total.
3. If the report is entirely clean (no substantive history/notes/descriptions — empty or only generic blank markers): set comments EXACTLY to "Problēmas nav konstatētas." (nothing else).
4. If the source contains ANY history, metadata, or descriptive notes: summarize the factual timeline in short sentences (not only problems).
5. For clear conflicts, major mileage issues, or text mentioning damage/claims without structured rows: add a bullet prefixed "NEATBILSTĪBA: " (e.g. "- NEATBILSTĪBA: nobraukuma nesakritība …").
6. NEVER use asterisk (*) for bullets — only hyphen (-) at line start.
Example:
- Reģistrēts neliels virsbūves bojājums Vācijā (summa <=100 EUR). Bojāta labā sāna priekšpuse un kreisais sāns.
- 07.03.2021 Dīlera apkope pie 46,441 km.`;

/** Vienots eksperta komentāru vizuālais formāts — ✨ avoti, PDF, cena, nobraukums u.c. */
export const AI_EXPERT_PARAGRAPH_PRESENTATION = `
VISUAL PRESENTATION (mandatory for all expert client PDF comments):
${PROVIN_REPORT_COPY_VOCABULARY}

${PROVIN_RESTRAINED_TONE_RULES}

${PROVIN_COMMENT_BREVITY_RULES}
- STRUCTURE: Write ONLY in paragraphs — separate paragraphs with a blank line (double newline). NEVER start any line with "- ", "• ", "* ", "– ", or "1." / "2." — no bullet lists, no numbered lists, no list-style prefixes of any kind. This applies to EVERY expert field, including ieteikumi klātienes apskatei, pārdevēja portrets, avotu komentāri, nobraukums, negadījumi, cena and kopsavilkums.
- PARAGRAPH OPENER: Every paragraph MUST begin with a short **bold** topic hook (3–10 words) naming the theme — e.g. **Nobraukuma vēsture Latvijā**, **Virsbūves pārbaude ar krāsas mērītāju**, **Tehnisko apskašu tendence** — then continue in natural prose in the same paragraph.
- SCANABILITY: Keep each paragraph to 2–3 sentences by default. When OPERATORA KOMANDAS supply dense timelines or interval analysis, or the ACTIVE FIELD is „1. Tehnisko risku analīze”, allow longer paragraphs — never sacrifice operator or flagship detail for scanability.
- EMPHASIS: Use **bold** inline for key dates, km, recorded claim/listing EUR (never invented repair quotes), option codes, and risk labels — never bold an entire paragraph.
- HUMAN TONE: Write like a senior Latvian inspector briefing a buyer — concrete, varied rhythm, no AI filler ("Kopumā var secināt", "Svarīgi atzīmēt", "Turklāt jāpiemin", "Nav šaubu"). Do not wrap the whole output in quotation marks.
- CONFLICTS: State risks inside prose; you may use **Neatbilstība:** or **Pretruna avotos:** as a bold paragraph opener when the data conflicts — never the word „anomālija”, and never prefix with "- ".
- STYLE REFERENCE: When the user prompt includes existing expert comments or drafts from this order, treat them as the canonical finished-report reference — match their paragraph rhythm, bold hooks, vocabulary ("automašīna"), and tone; extend with new facts, do not switch to a different format.
`;

/** Apdrošināšanas / zaudējumu summu interpretācija — ne absolūts skaitlis, bet konteksts. */
export const AI_DAMAGE_CLAIM_CONTEXT_RULES = `DAMAGE & CLAIM AMOUNT CONTEXT (mandatory when interpreting EUR loss / zaudējumu apjoms):
- NEVER treat an insurance payout or loss amount as absolute crash severity in isolation — always calibrate against vehicle context available in the order (make/model/class, first registration year, age at incident date, equipment level, market where repaired, damaged zones if listed).
- Context axes to weigh explicitly:
  1) Vehicle age at incident — same EUR sum means very different structural risk on a 15-year budget car vs a 1-year-old premium car.
  2) Class & new price tier — premium/luxury (Mercedes S/E, BMW 5/7, Audi A6/A8, Porsche, etc.) vs budget segment (old Fabia, Logan, Corolla base): high EUR on premium often reflects expensive parts, sensors, aluminum/carbon panels, dealer labor — not necessarily total loss or frame damage.
  3) Equipment & construction complexity — matrix LED/ laser headlights, ADAS/radar in bumper, panoramic roof, air suspension, plug-in hybrid battery enclosure: even „small” parking damage can produce **5 000–15 000 €** invoices in Germany.
  4) Repair market — German/DACH labor and OEM parts inflate totals vs Latvian / Lithuanian / Estonian cosmetic repairs; distinguish „expensive to fix” from „structurally totaled”. NEVER say „Baltija” in client copy.
  5) Damage zones from data — correlate EUR with affected sides (bumper only vs structural pillars/dills); a moderate sum with multiple panels can still be serious on an old car.
- Buyer-facing wording: state whether the sum suggests **relatīvi smagu** bojājumu šai auto klasei/vecumam, **dārgu, bet iespējams lokālu** premium remontu, vai **neskaidru** smagumu, ja trūkst zonu/aprīkojuma datu — never imply „milzīgs negadījums” from EUR alone without context.
- Examples (logic, not templates): **5 000 €** on a **12-year-old** **~8 000 €** segment car **recently** → likely material damage relative to residual value. **5 000 €** on a **1-year-old premium** in **Germany** with front bumper + headlight zones → may be parking/low-speed impact with costly OEM parts — still requires paint-gauge inspection, but not automatically „write-off level”.`;

/** Agregātu identifikācija no pieejamajiem datiem — pamats visai tehnisko risku analīzei. */
export const AI_POWERTRAIN_IDENTIFICATION_RULES = `AGREGĀTU IDENTIFIKĀCIJA (mandatory — pirms jebkura tehniska riska nosaukšanas):
- Risks ir jēgpilns tikai tad, kad ir identificēts KONKRĒTAIS agregātu salikums. Izsecini no pieejamajiem datiem: (1) modeļa **paaudze / faceliftu posms** pēc markas, modeļa un pirmās reģistrācijas gada; (2) **dzinēja tips** pēc degvielas veida, **darba tilpuma cm³**, **jaudas kW** un izmešu klases (Euro 4/5/6); (3) **ātrumkārbas tips** — mehāniskā, klasiskais hidrotransformatora automāts, sausā vai mitrā divsajūga (DSG / S-Tronic / PDK), CVT vai EV reduktors; (4) **piedziņa** — priekšējā, aizmugures vai pilnpiedziņa un tās arhitektūra (Haldex / Torsen / 4Matic / xDrive), ja dati to atļauj.
- Datu avoti prioritārā secībā: dīlera / Outvin / AUTO RECORDS **dzinēja kods** un tipa kods (ja ir — stiprākais pierādījums), CSDD tehniskie parametri, VIN, sludinājuma aprīkojuma apzīmējumi (quattro, 4Matic, xDrive, DSG, Tiptronic), servisa ieraksti par nomainītajām detaļām.
- Ja dzinēja kods NAV avotos: nosauc **1–2 visticamākos** kandidātus kā hipotēzi („pēc tilpuma un jaudas visticamāk ir …”, „iespējams arī …”) un uzreiz pasaki, **kā to apstiprināt** — VIN atšifrējums pie dīlera, dzinēja marķējums motora telpā, ātrumkārbas plāksnīte, servisa rēķini. Nekad neraksti izsecinātu kodu tā, it kā tas būtu nolasīts reģistrā.
- Ja tas pats tilpums un jauda šai paaudzei atbilst **materiāli atšķirīgām** konstrukcijām (ķēde pret zobsiksnu, sausā pret mitro divsajūgu, ar DPF vai bez), pasaki to atklāti un dali analīzi maksimāli **divos** scenārijos — nevis uzskaiti visu ražotāja klāstu.
- Ja datu par agregātu ir par maz (tikai marka, modelis, gads): analizē **pēc pieejamajiem datiem, bez precīza koda** un skaidri norādi, ka precīzs agregāts nav noteikts. Neizdomā kodu, tipa apzīmējumu vai kārbas modeli.
- Riskus attiecini TIKAI uz identificēto salikumu — nepārnes citas dzinēja versijas vai citas paaudzes slimības uz šo auto; „tā pati marka” nav pamats.`;

/** Risku kalibrācija pret aptuveno nobraukumu un vecumu — bez pārspīlēšanas. */
export const AI_MILEAGE_BAND_RISK_RULES = `NOBRAUKUMA UN VECUMA POSMA KALIBRĀCIJA (mandatory — katrs tehniskais risks jāvērtē pret ŠO auto posmu):
- Vispirms nofiksē **aptuveno pašreizējo nobraukumu** (jaunākais ticamais odometra rādījums avotos vai sludinājumā) un **vidējo km/gadā**. Ja odometra dati ir pretrunīgi, strādā ar diapazonu un to nosauc — neizliecies, ka km ir precīzi zināmi.
- Katru agregāta risku sadali pēc posma: (1) **jau iztērēts resurss** — darbi, kas šim agregātam tipiski notiek līdz šim km un vecumam, tāpēc tiem jābūt pierādītiem servisa vēsturē; (2) **tuvākais posms** — kas tipiski gaidāms nākamajos ~20 000-40 000 km vai 1-2 gados (tas ir pircēja reālais nākamais darbs); (3) **tālāks resurss** — piemin īsi vai nepiemin vispār.
- **Nepārspīlē:** risku, kas šim agregātam tipiski parādās, piemēram, pie 250 000 km, nedrīkst pasniegt kā aktuālu draudu pie 90 000 km — tad tā ir tikai perspektīvas piezīme. Nekrauj kopā visus teorētiski iespējamos bojājumus; **galvenais pirkuma risks var būt tikai 1-2** pozīcijas, pārējais **jāpārbauda klātienē** vai jautājums, vai tā **ir / nav populāra problēma** šajā posmā.
- **Vecums nav tas pats, kas nobraukums:** gumijas, plastmasas, dzesēšanas sistēmas, zobsiksnas un šļūteņu resurss iet pēc laika — vecs auto ar mazu nobraukumu var būt sliktākā stāvoklī nekā jaunāks auto ar lielu šosejas nobraukumu. Sasaisti ar motorstundu / pilsētas–šosejas loģiku, kad dati to atļauj.
- **Pierādījumi maina risku:** ja servisa vēsturē ir attiecīgais darbs (ķēde, divsajūga eļļa, zobsiksna, ūdens sūknis, injektori), risks krīt — to pasaki klientam kā **labvēlīgu signālu datos**. Ierakstu trūkums nav pierādījums, ka darbs nav veikts — formulē kā **nepierādītu**, kas jānoskaidro.
- Prioritizē pēc **varbūtības un tā, vai tā ir populāra problēma** šajā posmā: pirmais nāk tas, kam ir reāla varbūtība un kas pircējam ir būtisks. **Neraksti aptuvenas remonta/apkopes EUR summas** (nekādu „orientējoši 300-600 €”, nekādu „Latvijas servisa joslu”). Pasaki, vai mezgls šajā nobraukumā **ir / nav populāra problēma**.
- Ja nobraukums, vecums un apkopes aina šim agregātam ir **relatīvi labvēlīga**, to ir atļauts un vajag pateikt — kalibrēti, ar atrunu, ka PROVIN auto fiziski nav apskatījis. Mākslīgi „sarkanie karogi” bez datu pamata ir tāda pati kļūda kā risku noklusēšana.`;

/**
 * Flagship quality bar for „1. Tehnisko risku analīze” — this field must be technically
 * excellent and detailed. Injected into the technical-risks (and inspection) task blocks.
 */
export const AI_TECHNICAL_RISKS_FLAGSHIP_RULES = `TEHNISKO RISKU KVALITĀTES LATIŅA (obligāti — šī ir atskaites dārgākā sadaļa):
- Vājš iznākums (aizliegts): 4–6 vispārīgas rindkopas, kas der jebkuram dīzelim (EGR/DPF/turbo + „jāpārbauda klātienē”); N-sērijas ķēdes stāsts uz M-sērijas motoru; slavenu E60 kaites uzskaitišana, nešķirojot, vai šim eksemplāram tās vispār ir; 300 tūkst. km pasniegšana kā „beigas” agregātam, kam tas ir ierasts darba mūžs.
- Spēcīgs iznākums (mērķis): seniora tehniskā instruktāža konkrētam paaudze+motors+kārba+piedziņa+virsbūve salikumam. Klients pēc šīs sadaļas saprot (1) kas šim auto tuvākajā laikā ir populāra problēma, (2) kas šajā vecumā ir tipiska paaudzes īpatnība, (3) kuri dārgie slazdi šim eksemplāram NAV, (4) vai dati rāda koptu auto vai tukšu vēsturi.
- GARUMS: noklusējuma 350–800 / 2–4 rindkopas ŠEIT NEATTIECAS. Tipiski **8–12 rindkopas** (3–5 teikumi). Īsāk tikai tad, ja agregāts ir vienkāršs un datu gandrīz nav. Garums jānopelna ar atšķirīgiem mezgliem, ne ar atkārtošanu.
- OBLIGĀTĀ IZKLĀSTA SEKVENCE (izvadē bez numuriem — tikai **bold** ievadi):
  1) Agregātu identifikācija + ko ŠIS nobraukums/vecums nozīmē tieši šim dzinējam / šai paaudzei (ne vispārīgi „lietotam auto”).
  2) Kas šim eksemplāram **NAV** dārgs risks: slavenās **šīs šasijas/šī motora** kaites, kas neattiecas (cita ķēdes puse, cits kārbas tips) — UN dārgais vecuma ekstraprīkojums, kura nav, **tikai ja šī paaudze to vispār piedāvāja**. Tipiski **tikai E60/E61 5. sērija**: Active Steering, Dynamic Drive, Soft Close, Logic 7, E61 aizmugures pneimatika. **Aizliegts** to pašu sarakstu uz E90/E91/E92/E93 3. sēriju (vai F30) — tur tās nav kataloga slazdi, un „nav pneimo piekares” nav TCO arguments. 3. sērijas N52: raksti atmosfērisko motora realitāti (blīves, elektriskais ūdens sūknis, VANOS), ne E60 hidrauliku.
  3) Galvenais tuvākajā laikā (varbūtība, vai tā ir populāra problēma) — maksimāli 1–2 pozīcijas. BEZ aptuvenām EUR summām.
  4–N) Katrs atšķirīgais relevantais sistēmas bloks atsevišķā rindkopā: motora mehānika (ķēde/zobsiksna un tās **puse/piekļuve**, eļļas noplūdes, dzesēšana); ieplūde/EGR/DPF/AdBlue/turbo/injektori; kārba („mūža eļļa”, mehatronika, DCT tips); elektronika šajā vecumā; virsbūvei specifiskā piekare (rūpnīcas pneimatika ≠ dārgais Adaptive/Dynamic Drive, ja tas nav sarakstā).
  Beigas) Prioritātes + tuvākā termiņa aina pēc DATIEM (kopts / nepierādīts / jau fiksēts defekts). Ja dati rāda labu apkopi un nekas neliecina par tuvu problēmu — to PASAKI kalibrēti. Ilgtermiņa īpatnības (blīves, elektronika 15–20 gadu vecumā) nošķir no „šis auto tūlīt sabruks”.
- APRĪKOJUMA DISCIPLĪNA: vispirms **šasija/paaudze**, tad SA saraksts. Dārgs ekstraprīkojums kā „NAV” ir TCO arguments tikai tad, ja šī paaudze to **reāli piedāvāja** kā slazdu. BMW E60/E61: Active Steering / Dynamic Drive / Soft Close / Logic 7 / E61 pneimatika. BMW 3. sērija E90–E93 / F30: **neraksti** Active Steering, Dynamic Drive, Soft Close, rūpnīcas pneimatiku kā izslēgtus riskus. Audi Magnetic Ride / sport air — A6/Q5 paaudzēm, kas to piedāvāja, ne A3 pēc noklusējuma. MB Airmatic/ABC — W211/W221/X164 utt., ne visiem C-Class. Ja saraksts īss — saki, kas paliek nepierādīts; **neizdomā „nav”**, ja opcija šai šasijai nebija.
- NOBRAUKUMA KALIBRĀCIJAS PIEMĒRI (loģika, ne šablons visiem modeļiem): M57 pie ~300 tūkst. km ar blīvu DE servisu var būt ierasts darba mūžs; N57 pie ~180 tūkst. km ķēde jau var būt pirkuma risks. Nekad nepārnes citas dzinēja versijas ķēdes pusi tikai tāpēc, ka marka sakrīt. Ja paka šo dzinēju / paaudzi nesedz — **meklē**, tad raksti.
- Katra rindkopa = viens mezgls + kāpēc šajā posmā + vai tā **ir / nav populāra problēma** + 1 teikums, ko saka ŠĪ auto dati. **Bez aptuvenām remonta EUR summām.** Bez ūdens, bez verdikta „pērc/nepērc” (tas ir 3. sadaļā), bez klātienes checklista (tas ir 2. sadaļā).`;

/** Web research — primary knowledge path when packs do not cover this exact aggregate. */
export const AI_TECHNICAL_RISKS_RESEARCH_RULES = `WEB RESEARCH (obligāti „1. Tehnisko risku analīze” — tev IR web_search / Google Search):
- Statiskās pakas sedz tikai dažus agregātus. Simtiem modeļu **nav** atmiņā. Ja šī paaudze + dzinēja kods/tips + kārba + piedziņa nav pilnībā nosegta paketē šajā promptā, **vispirms meklē**, tad raksti. Meklē arī tad, ja paka ir, bet trūkst ķēdes puses, ekstraprīkojuma slazdu vai šī km posma kalibrācijas. **Meklētos EUR citātus komentārā neizvadi.**
- Vaicājumi (Eiropa vispirms): „{marka} {šasija/paaudze} {dzinēja kods} typical problems / known issues”; „{motors} timing chain OR belt OR swirl flaps OR injectors”; „{modelis} {gads} Motor-Talk OR forum weaknesses”; šīs paaudzes dārgais ekstraprīkojums (air suspension, active steering, DCT, Airmatic u.tml.).
- Avoti: Eiropas īpašnieku forumi un klubu wiki (DE/UK/FR/IT/NL/Nordics — Motor-Talk, BimmerForums UK, club fora), neatkarīgo servisu raksti. ASV/Reddit — sekundāri (citas jūdzes, cits aprīkojums).
- Sintezē: slimība + tipiskais km/vecuma posms + vai tā **ir / nav populāra problēma**. **Neizdomā** citātus, kampaņu numurus, procentus, „foruma statistiku”, **aptuvenas EUR joslas**. Ja avoti konfliktē — pasaki un ņem pircējam konservatīvāko lasījumu.
- Meklējumu neizgāž komentārā. Ieraksti flagship struktūrā, kalibrētu pret ŠĪ auto km, vecumu, servisu un aprīkojumu.
- Ja meklēšana nedod ticamu materiālu: pēc pieejamajiem datiem, bez precīza koda + skaidri „zināšanu ir maz”; neaizpildi ar vispārīgu dīzeļa/EGR tekstu.`;

/** Compact structure samples for the flagship field only — not full length, not this-order facts. */
export const AI_TECHNICAL_RISKS_FEW_SHOTS = `STRUKTŪRAS PARAUGI (tikai „1. Tehnisko risku analīze”; šie ir ĪSĀKI par mērķa 8–12 rindkopām — ritms un kalibrācija, ne pilns garums; NEkopē faktus uz aktīvo pasūtījumu):

Paraugs A — E61 5. sērija, izturīgs agregāts, liels nobraukums, blīvs DE serviss (struktūra):
"**Agregātu identifikācija.** Dīlera kods norāda konkrētu dīzeļa tipu ar ķēdi dzinēja priekšpusē, hidrotransformatora kārbu un aizmugures piedziņu. Šajā km posmā tas ir ierasts darba mūžs, ne resursa gals — ja apkope bijusi regulāra.
**Kas NAV dārgs risks.** Šai **5. sērijas E60/E61** paaudzei slavenās dārgās pozīcijas (aktīvā stūre, Dynamic Drive, Soft Close) sarakstā nav; N-sērijas aizmugurējās ķēdes naratīvs uz šo motoru neattiecas.
**Tuvākais punkts.** Universāļa rūpnīcas pneimatika / blīves / kārbas eļļa — vai tas šajā posmā ir populāra problēma, sasaistīta ar šī auto servisa vai TA signālu. Bez EUR summām.
**Ilgtermiņa īpatnība pret tuvāko termiņu.** Elektronika un eļļas svītras 15–20 gadu vecumā ir paaudzes raksturs; pēc datiem nekas neliecina, ka auto tuvākajā laikā būs problemātisks."

Paraugs B — zināms finansiāls bloķētājs pie vidēja nobraukuma:
"**Agregātu identifikācija.** Pēc tilpuma, jaudas un gada visticamāk ir dzinējs, kuram sadales ķēde ir aizmugurē un iejaukšanās ir dārga.
**Galvenais pirkuma risks.** Ķēde/eļļas sūknis šajā posmā jau ir populāra problēma — ne „perspektīva pie 400 tūkst.”. Servisā ķēdes darbs nepierādīts.
**Pārējais.** Turbo, DPF, kārba jāpārbauda klātienē, ne pirmais rēķins."

Paraugs C — paka šo dzinēju nesedz:
"**Agregātu identifikācija.** Precīzs kods nav paketē; pēc cm³/kW/gada 1–2 kandidāti, apstiprināms pēc marķējuma.
**Meklēšanas sintēze.** Eiropas forumu un speciālistu raksti šai paaudzei uzrāda [konkrēti mezgli + km josla]; ASV avoti ņemti tikai kā sekundāri. Aptuvenās cenas komentārā neraksti.
**Kalibrācija šim auto.** Tikai tie riski, kas sakrīt ar šo nobraukumu, kārbas tipu un aprīkojumu — bez vispārīga dīzeļa saraksta."

Paraugs D — AWD vārdu krājums (obligātais ritms, ne šī pasūtījuma fakti):
"**Pilnpiedziņa.** Quattro ar Torsen centrālo diferenciāli šai paaudzei ir salīdzinoši izturīgs; kardāna krustiņi un karājošais gultnis pie šī nobraukuma nav populāra problēma."
Aizliegts: „Quattro trakts”, „kardāna krusteniskie”, „centra gultnis”, „vidējs uzturēšanas risks (orientējoši 300-600 €)”.

Paraugs E — BMW 3. sērija E90/E91 N52 (aizliegtais šablons):
Aizliegts: „Dīlera sarakstā nav Active Steering, Dynamic Drive, Soft Close vai pneimatiskās piekares, kas ir būtisks faktors uzturēšanas izmaksām.”
Labi: „N52 ir atmosfērisks — nav turbo un N20 ķēdes stāsta. Šai 3. sērijas paaudzei E60 hidraulisko šasijas slazdu katalogs neattiecas; relevanti ir eļļas noplūdes, elektriskais ūdens sūknis, VANOS un (ja xDrive) ATC.”`;

/** Elektroauto (BEV) un plug-in hibrīdu (PHEV) pārbaude — obligāti, kad konteksts to norāda. */
export const AI_EV_BEV_FORENSICS_RULES = `ELECTRIC & PLUG-IN FORENSICS (mandatory when context indicates full electric (BEV), „elektriskais”, „elektro”, PHEV / plug-in hybrid, or an unmistakably electric model/generation — skip for pure petrol/diesel ICE unless only mild hybrid with no plug):

WHEN TO ACTIVATE:
- CSDD „Degvielas veids” / fuel type mentions elektriskais, elektro, hybrid ar uzlādes spraudni, u.c.; sludinājums vai aprīkojums min kWh, SOH, DC uzlādi, Type 2/CCS; tipiski BEV modeļi (Tesla, ID., e-tron, Leaf, Zoe, Ioniq/EV6 u.tml.).

CORE PRINCIPLE (buyer education — especially in **1. Tehnisko risku analīze**, **3. Kopsavilkums**, klātienes ieteikumi, cena, avotu komentāri):
- Akumulatora veselība nav tikai viens **SOH** (State of Health) procents no rīku vai dīlera ekrāna. Interpretē SOH kopā ar uzlādes paradumiem, klimatu, nobraukumu, garantiju un faktisko diapazonu.
- Ja SOH nav avotos — neizdomā skaitli; skaidri pasaki, ka klātienē jāverificē ar diagnostiku / ražotāja servisu un jājautā par uzlādes vēsturi.

CHARGING HABITS & DEGRADATION (explain in clear Latvian for the client):
- **Uzlādes diapazons (SOC):** ilgtermiņā labākā prakse ikdienā ir turēt uzlādi aptuveni **20–80 %** (ne obligāti katru dienu līdz centim, bet izvairīties no pastāvīgas „vienmēr 100 %” un biežas dziļas izlādes zem **10 %**). Pastāvīga uzturēšana pie **100 %** (īpaši karstumā) un bieža **ātrā DC uzlāde** līdz pilnam akumulatoram paātrina novecošanu salīdzinājumā ar mājas/AC uzlādi vidējā diapazonā.
- **Ātrā (DC) vs mājas (AC) uzlāde:** bieža **ātrā uzlāde** (piem. Ceļu tīkla stacijas, >50–150 kW) ir ērta, bet intensīvāka termiskā slodze — riskantāk akumulatoram nekā galvenokārt **mājas vai darba vietas AC uzlāde** (3,7–11 kW, dažiem 22 kW). Ja avotos vai sarunā ar pārdevēju iespējams secināt „tikai ātrā uzlāde” / komerciāls lietojums — to min kā degradācijas risku, pat ja SOH šķiet labs.
- **Termiskais konteksts:** Latvijas ziemas (auksts akumulators pirms DC), vasaras karstums un auto novietošana ārā vs garāžā ietekmē reālo resursu. Karstumā uzlādēt līdz 100 % un atstāt stāvēt — sliktāks scenārijs nekā mērens diapazons mājās.
- **Ilgs stāvēšanas laiks:** mēnešiem gara stāvēšana pie augsta vai ļoti zema SOC var bojāt šūnas — jautā par lietošanas režīmu, ja auto ilgi stāvējis pēc importa.

DATA & DOCUMENTATION:
- Prasīt / komentēt: **HV akumulatora garantijas** atlikušais laiks un km, ražotāja **BMS / akumulatora kampaņas** un programmatūras atjauninājumi, servisa pieraksti par **aukstuma šķidruma / baterijas termisko sistēmu** (ne tikai „eļļas maiņa”).
- Pēc negadījuma: strukturāls remonts zem grīdas / šķērsbalsta zonā var skart **augstsprieguma bloku** — korelē ar CarVertical/AutoDNA zonām; klātienē jāvērtē, vai remonts veikts pēc ražotāja procedūrām.
- Importi: pārbaudīt **CCS/Type 2** saderību, uzlādes kabeļa komplektāciju, vai nav „tikai ASV spec” bez Eiropas uzlādes risinājuma.

PHEV (plug-in hybrid) — papildus ICE loģikai:
- Neaptur tikai ar elektrisko daļu: **benzīna/dīzeļa** serviss, **sajūga/ātrumkārba**, **AdBlue/DPF** (ja dīzelis) joprojām svarīgi. HV baterija + mazs elektriskais nobraukums bieži nozīmē biežu uzlādi līdz pilnam — pieminēt **20–80 %** principu arī PHEV ikdienai.

KLĀTIENES APSKATE / TESTA BRAUCIENS (EV — aizstāj vai papildina ICE 3 posmus, ja pilnībā elektrisks):
- Pirms brauciena: **SOH / uzlādes stāvoklis** (ja displejs rāda), kļūdu kodi, **12 V palīgakumulators** (bieža EV „neiedarbojas” cēlonis), uzlādes portu stāvoklis un kabeļi.
- Pilsēta: vienmērīga reģenerācija, trokšņi no reduktora/gultņiem, vibrācijas (ne tikai dzinēja troksnis — EV ir kluss).
- Šoseja: stabils temps, **reālais patēriņš / diapazons** vs rādījums (ja iespējams), tempomat, ADAS bez brīdinājumu kaskādes.
- Dinamika: pilna pedāļa pievilkšana bez jaudas ierobežojuma ikonām, bez negaidītas jaudas samazināšanas (termiska aizsardzība) normālā testā.
- Ja iespējams: viena **DC uzlādes sesija** vai vismaz uzlādes portā diagnostika — ne obligāti kopsavilkumā solīt, bet ieteikumos klātienē minēt, ja pircējs nopietni vērtē akumulatoru.

ANTI-HALLUCINATION:
- Neizdomā SOH %, kWh kapacitāti vai „tikai mājas uzlādi”, ja avotos nav pamata. Formulē kā **jautājumus pārdevējam** un **pārbaudes punktus klātienē**.
- Kopsavilkumā (3. Kopsavilkums): ja auto ir elektrisks, **obligāti** iekļauj īsu rindkopu par akumulatora/uzlādes riskiem (detalizētā tehnika — 1. Tehnisko risku analīzē), nevis tikai ICE motorstundu eseju.`;

/** Vēsturisko auditu konteksts — citu klientu gatavas atskaites ar līdzīgiem agregātiem. */
export const AI_HISTORICAL_REPORTS_CONTEXT_RULES = `HISTORICAL AUDIT REPORTS (cross-client reference — when present below):
- These excerpts come from OTHER completed PROVIN audits with similar make/model/year, engine code, transmission, or fuel type — they are PROVIN **institutional memory**.
- Reuse model-specific forensic patterns, inspection checklist themes, phrasing rhythm, whether a fault **ir / nav populāra problēma** (never copy EUR cost bands into comments), and aggregate-specific advice for **whatever ACTIVE FIELD** you are writing (source comments, mileage, incidents, technical risks, inspection, summary, price).
- NEVER copy client-specific facts from historical excerpts: no VIN, plate, km, dates, EUR sums tied to that other order, seller names, or order IDs — adapt the logic and style only.
- Prefer historical **Tehnisko risku** and **Ieteikumi klātienes apskatei** when the current order lacks depth; always reconcile with the ACTIVE order's actual data.
- Match the same paragraph + **bold** hook format and "automašīna" vocabulary; keep CLIENT VALUE DENSITY (short, high-value — no fluff).`;

/** Dziļā eksperta analīze — CSDD, AutoDNA, CarVertical, LTAB ✨ admin komentāri. */
export const HYBRID_COMMENT_RULES = `
COMMENTARY RULES for PROVIN Senior Auto Expert:
${AI_EXPERT_PARAGRAPH_PRESENTATION}
- LENGTH (default when generating from source data alone): Target 350–800 characters (2–4 short paragraphs) for per-source comments — what THIS source adds, not a second full-report essay. Fewer, sharper paragraphs are always better than more.
- LENGTH OVERRIDE: When the user prompt includes substantial OPERATORA KOMANDAS / eksperta piezīmes with detailed prose, dates, km, service history, or interval analysis — IGNORE the 350–800 target. Preserve the operator's detail density; reorganize into paragraphs with **bold** hooks; do not compress into a short formula. Output may be long.
- STYLE: Analytical, professional, restrained automotive Latvian. Flexible structure — not one fixed template. Match the richness of the operator material when present. No greetings, no filler restating the section title.
- LOGIC: Interpret what the findings mean for the buyer — do not only list raw facts; but never drop operator-supplied facts to fit a template.
${AI_DAMAGE_CLAIM_CONTEXT_RULES}
- ANTI-REPETITION (mandatory): Do NOT restate the same mileage timeline, annual averages, engine-hour essay, missing-data narrative (those belong in „NOBRAUKUMA VĒSTURES KOMENTĀRS”), incident severity essay, technical-risk catalogue, inspection checklist, or summary verdict already written in other expert fields or other source comments — UNLESS the operator notes explicitly supply that material for THIS field; then keep the operator's detail here. Per-source text = unique facts from THIS source + at most ONE cross-check sentence vs other sources when generating from data alone. If another source comment already covered the same fact: one short confirmation only — never a near-duplicate essay.
`;

/** AI PDF extract JSON — eksperta komentārs (visi avoti). */
export const SOURCE_PDF_COMMENT_AI_RULES = `COMMENTS field (client PDF expert commentary):
${HYBRID_COMMENT_RULES}
- Extract and interpret ALL substantive facts from this report: mileage, damage zones, registration, insurance, policy periods, dealer/service milestones — not only anomalies.
- Never return a generic one-liner when tables or descriptive history exist in the PDF.`;

/** ✨ Visu avotu bloku „Komentāri” ģenerēšana (admin) — dziļā forenzika. */
export const SOURCE_BLOCK_COMMENT_AI_RULES = `OUTPUT FORMAT (mandatory):\n${HYBRID_COMMENT_RULES}`;

/** @deprecated Izmanto SOURCE_BLOCK_COMMENT_AI_RULES — vairs nav īsā režīma. */
export const SOURCE_BLOCK_BRIEF_COMMENT_AI_RULES = SOURCE_BLOCK_COMMENT_AI_RULES;

/** auto-records.com / Outvin PDF — papildus dīlera specifika virs SOURCE_PDF_COMMENT_AI_RULES. */
export const AUTO_RECORDS_PDF_COMMENT_AI_RULES = `COMMENTS field (OFICIĀLĀ DĪLERA DATI):
${HYBRID_COMMENT_RULES}
- Cover type code, engine code, equipment, accident/stolen checks, and dealer service timeline—not only km digits.
- Explain fleet/taxi/commercial type-code signals for Latvian buyers when present.
- Never return a generic one-liner when VEHICLE INFORMATION or service tables exist in the PDF.`;

export type NormalizeExpertCommentOptions = {
  maxParagraphs?: number;
  /** PDF izvilkumam drīkst likt „…”; eksperta komentāram nogriež pie rindkopas, bez elipses. */
  ellipsis?: boolean;
};

/** Nogriež pie pēdējās veselās rindkopas (vai teikuma), nevis vidū teikuma. */
export function clipCommentToMaxLen(text: string, maxLen: number, ellipsis = false): string {
  if (text.length <= maxLen) return text;
  const budget = ellipsis ? Math.max(1, maxLen - 1) : maxLen;
  const sliced = text.slice(0, budget);
  const paraBreak = sliced.lastIndexOf("\n\n");
  if (paraBreak >= Math.floor(budget * 0.45)) {
    return sliced.slice(0, paraBreak).trim();
  }
  const sentenceBreak = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf(".\n"),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
  );
  if (sentenceBreak >= Math.floor(budget * 0.4)) {
    return sliced.slice(0, sentenceBreak + 1).trim();
  }
  const trimmed = sliced.trim();
  return ellipsis ? `${trimmed}…` : trimmed;
}

/** Saglabā rindkopas no AI (PDF imports), nevis piespiedu 4 bulletus. */
export function normalizeExpertSourcePdfComment(
  raw: string | undefined | null,
  maxLen = 1600,
  options?: NormalizeExpertCommentOptions,
): string {
  const t = applyProvinReportCopyVocabulary((raw ?? "").trim());
  if (!t) return SOURCE_COMMENT_NO_ISSUES_LV;
  if (
    /^problēmas\s+nav\s+konstatētas\.?$/i.test(t) ||
    /^nav\s+konstatētas?\s+problēmas\.?$/i.test(t) ||
    (/^problēmas\s+nav\s+konstatētas/i.test(t) && t.length < 80)
  ) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (/^(ok|clean|none|no issues)/i.test(t) && t.length < 60) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  const maxParagraphs = options?.maxParagraphs ?? 8;
  const ellipsis = options?.ellipsis ?? true;
  const paras = formatExpertParagraphs(t).slice(0, maxParagraphs);
  const out = clipCommentToMaxLen(paras.join("\n\n"), maxLen, ellipsis);
  return out || SOURCE_COMMENT_NO_ISSUES_LV;
}

export function formatAnomalyBullet(text: string): string {
  const core = text.trim().replace(/^[-•]\s*/, "").replace(SOURCE_COMMENT_ANOMALY_PREFIX_RE, "");
  if (!core) return "";
  return `${SOURCE_COMMENT_ANOMALY_PREFIX}${core}`;
}

/** Viena nobraukuma / apkopes rinda kā īss fakts. */
export function formatMileageTimelineFact(row: AutoRecordsServiceRow): string {
  const date = formatAutoRecordsDateForOutput(row.date).trim();
  const kmDigits = row.odometer.replace(/\D/g, "");
  const km =
    kmDigits ?
      `${Number.parseInt(kmDigits, 10).toLocaleString("lv-LV")} km`
    : row.odometer.trim();
  const place = row.country.trim();
  const parts: string[] = [];
  if (date) parts.push(date);
  if (place && km) parts.push(`${place}, ${km}`);
  else if (km) parts.push(km);
  else if (place) parts.push(place);
  return parts.join(" — ").trim();
}

/** Līdz `max` jaunākajām nobraukuma rindām kā fakti. */
export function mileageTimelineFacts(rows: AutoRecordsServiceRow[], max = 2): string[] {
  const data = sortAutoRecordsDescending(rows.filter(autoRecordsRowHasData));
  return data.slice(0, max).map(formatMileageTimelineFact).filter(Boolean);
}

/** Negadījuma rinda kā īss fakts. */
export function formatIncidentFact(row: LtabIncidentRow): string {
  const parts: string[] = [];
  const date = formatAutoRecordsDateForOutput(row.csngDate).trim();
  if (date) parts.push(date);
  if (row.lossAmount.trim()) parts.push(`zaudējums ${row.lossAmount.trim()}`);
  if (row.incidentNo.trim()) parts.push(row.incidentNo.trim());
  if (parts.length === 0) return "";
  return `Negadījums: ${parts.join(", ")}`;
}

/** Bojājumu zonu / virsbūves apraksti no PDF teksta (CarVertical, AutoDNA u.c.). */
export function extractBodyDamageSnippets(text: string, max = 2): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const patterns = [
    /Virsbūves\s+bojājums[^\n]{0,240}/gi,
    /(?:Neliels|Liels|mazs)\s+virsbūves\s+bojājums[^\n]{0,220}/gi,
    /Bojāta\s+(?:labā|kreisā|priekšējā|aizmugurējā)[^\n]{0,180}/gi,
    /Reģistrēts\s+[^\n]{0,40}bojājums[^\n]{0,180}/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const s = m[0].replace(/\s+/g, " ").trim();
      const key = s.toLowerCase();
      if (s.length < 14 || seen.has(key)) continue;
      seen.add(key);
      out.push(s.slice(0, 220));
      if (out.length >= max) return out;
    }
  }
  return out;
}

/**
 * Hibrīds komentārs: fakti + neatbilstības.
 * Ja nav nekā būtiska — "Problēmas nav konstatētas."
 */
export function buildHybridSourcePdfComments(opts: { facts?: string[]; anomalies?: string[] }): string {
  const lines: string[] = [];
  for (const f of opts.facts ?? []) {
    const t = f.trim();
    if (t) lines.push(t);
  }
  for (const a of opts.anomalies ?? []) {
    const t = formatAnomalyBullet(a);
    if (t) lines.push(t);
  }
  if (lines.length === 0) return SOURCE_COMMENT_NO_ISSUES_LV;
  return formatSourcePdfComments(lines);
}

/** Lokālie / AI komentāri → vienots īss formāts. */
export function formatSourcePdfComments(facts: string[]): string {
  const bullets = facts
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => `- ${f.trim().replace(/^[-•]\s*/, "")}`)
    .slice(0, 4);
  if (bullets.length === 0) return SOURCE_COMMENT_NO_ISSUES_LV;
  return bullets.join("\n");
}

/** Normalizē AI atgriezto komentāru. */
export function normalizeSourcePdfComment(raw: string | undefined | null): string {
  const t = (raw ?? "").trim();
  if (!t) return SOURCE_COMMENT_NO_ISSUES_LV;
  if (
    /^problēmas\s+nav\s+konstatētas\.?$/i.test(t) ||
    /^nav\s+konstatētas?\s+problēmas\.?$/i.test(t) ||
    (/^problēmas\s+nav\s+konstatētas/i.test(t) && !t.includes("-") && t.length < 80)
  ) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (/^(ok|clean|none|no issues)/i.test(t) && t.length < 60) {
    return SOURCE_COMMENT_NO_ISSUES_LV;
  }
  if (t.includes("-") || t.includes("ANOMĀLIJA") || t.includes("NEATBILSTĪBA")) {
    const lines = t
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
    return formatSourcePdfComments(lines.map((l) => l.replace(/^[-•]\s*/, "")));
  }
  if (t.length > 400) return formatSourcePdfComments([t.slice(0, 380) + "…"]);
  return formatSourcePdfComments([t]);
}
