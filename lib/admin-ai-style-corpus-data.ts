/**
 * Kurēti, anonimizēti stila paraugi no gatavām PROVIN atskaitēm.
 * Fakti (VIN, km, datumi, EUR, īpašvārdi) ir izņemti — paliek tikai ritms un termini.
 * Atsvaidzina: npm run style:corpus:mine
 */
export type StyleCorpusField =
  | "source"
  | "technical_risks"
  | "inspection"
  | "mileage"
  | "incidents"
  | "summary";

export type StyleCorpusSample = {
  field: StyleCorpusField;
  text: string;
};

export const PROVIN_STYLE_CORPUS_SAMPLES: readonly StyleCorpusSample[] = [
  {
    field: "source",
    text: "Tehnisko apskašu tendence\nAutomašīna vairākas reizes nav izgājusi pamatpārbaudi ar pirmo reizi; hroniski atkārtojas korozija. Vienreizējas eļļas noplūdes, kuras nākamā apskate vairs nerāda, ir vēsture, ne klātienes medību saraksts.\n\nKo šis avots pievieno\nCSDD fiksē apskašu datumu un novērtējumu; detalizēto nobraukuma forenziku atstāj nobraukuma komentāram.",
  },
  {
    field: "source",
    text: "Ko avots pievieno\nAutoDNA uzrāda zaudējumu ierakstu, kura nav CSDD. CarVertical to pašu periodu papildina ar valsti, bet summu nenosaka.\n\nSalīdzinājums\nSaskan ar dīlera servisa rindu pēc datuma; LTAB šim periodam izmaksu neuzrāda.",
  },
  {
    field: "technical_risks",
    text: "Kas NAV dārgs risks\nŠīs paaudzes slavenā aizmugurējās ķēdes kaite uz šo motoru neattiecas. Aprīkojuma sarakstā nav aktīvās stūres un hidraulisko stabilizatoru.\n\nTuvākais izmaksu punkts\nRūpnīcas aizmugures pneimatika šajā vecumā ir galvenais rēķins: spilveni un kompresors. Sviras un bukses paliek ierasta uzturēšanas izmaksa, ne pirkuma risks, ja pēdējā apskate tās nav aizrādījusi.",
  },
  {
    field: "technical_risks",
    text: "Kārba un divmasu spararats\nHidrotransformators šim agregātam ir uzticamāks par divsajūgu, bet „mūža eļļa” paliek nepierādīta. Divmasu spararats ir dārgs mezgls tikai tad, ja parādās raksturīgas vibrācijas - to vērtē klātienē, ne kā jau fiksētu defektu.\n\nIeplūde\nIeplūdes kolektors un EGR paliek ierasta uzturēšanas izmaksa; zema dūmainība ir labs fona signāls datos, ne garantija.",
  },
  {
    field: "inspection",
    text: "Auksts starts\nIeteicams klausīties ķēdi pirmajās sekundēs un rūpīgi jāapskata eļļas filtra korpuss pret tecējumiem.\n\nTesta brauciens\nIeteicams 20-30 min klusais brauciens pilsētā, šosejā 90-110 km/h un viens kick-down bez kļūdu lampiņām.",
  },
  {
    field: "inspection",
    text: "Virsbūve\nRūpīgi jāapskata arkas un sliekšņi ar krāsas mērītāju zonās, kur avotos ir zaudējums. Rūsa paliek uzmanības punkts arī tad, ja vēlākā apskate ir tīra.\n\nKo vaicāt\nJālūdz dokumenti par kārbas eļļu un pneimatikas remontu - trūkstošu ierakstu formulē kā nepierādītu, ne kā neizdarītu.",
  },
  {
    field: "mileage",
    text: "Hronoloģija un lineārums\nVisos avotos nobraukuma līkne ir lineāra; izteikti kritumi nav fiksēti.\n\nDatu blīvums\nIeraksti ir regulāri, kas ļauj runāt par šosejas profilu ar zemāku motorstundu slodzi.",
  },
  {
    field: "incidents",
    text: "Zaudējumu apjoms kontekstā\nFiksētā summa premium klasē bieži atspoguļo dārgas OEM detaļas, ne obligāti konstrukcijas zaudējumu.\n\nAvotu asinhronija\nViens avots periodu uzrāda, otrs - nē; krāsas mērījums klātienē paliek nākamais solis.",
  },
  {
    field: "summary",
    text: "Kopējā aina\nPēc pieejamajiem datiem automašīna izskatās koptāka nekā tipisks imports šajā vecumā, ar atrunu ka PROVIN to fiziski nav apskatījis.\n\nRekomendācija\nIeteicams turpināt pēc klātienes pārbaudes; tuvākais izmaksu punkts ir agregāta īpatnība, ne ikdienas nodilums.",
  },
];
