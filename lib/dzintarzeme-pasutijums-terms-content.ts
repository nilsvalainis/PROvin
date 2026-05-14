/**
 * Dzintarzeme Auto pasūtījuma PDF — 2. lapa: pakalpojuma nosacījumi (LV, koriģēts drukai).
 */
export type DzPasutijumsTermBlock =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "b"; items: string[] };

export const DZ_PASUTIJUMS_TERMS_BLOCKS: readonly DzPasutijumsTermBlock[] = [
  {
    kind: "p",
    text: "Paldies par izrādīto interesi iegādāties automašīnu ar Dzintarzeme Auto starpniecību.",
  },
  { kind: "h", text: "PAKALPOJUMA NOSACĪJUMI UN IZMAKSAS" },
  { kind: "h", text: "1. Komisijas maksa" },
  {
    kind: "p",
    text: "A variants — 100% priekšapmaksa: fiksēta komisijas maksa 1190,00 EUR.",
  },
  {
    kind: "p",
    text: "B variants (daļēja priekšapmaksa): 990,00 EUR + 3,5 % no atlikušās iegādes summas + PVN.",
  },
  {
    kind: "p",
    text: "Šis sadarbības modelis paredz, ka Klients veic obligātu minimālo priekšapmaksu vismaz 20 % apmērā no izvēlētās automašīnas iegādes vērtības.",
  },
  {
    kind: "p",
    text: "Atlikušās automašīnas iegādes summas apmaksa tiek veikta Klienta vai viņa izvēlēta finanšu pakalpojumu sniedzēja (bankas, līzinga vai cita kreditēšanas pakalpojuma sniedzēja) starpniecībā, un Pakalpojuma sniedzējs šajā procesā neveic kreditēšanu un neuzņemas finanšu saistības Klienta vietā.",
  },
  { kind: "p", text: "Komisijas maksā ir iekļauts:" },
  {
    kind: "b",
    items: [
      "automašīnas klātienes apskate Vācijā (noteiktos reģionos);",
      "komunikācija ar pārdevēju;",
      "dokumentu un servisa vēstures pārbaude;",
      "formalitāšu kārtošana Vācijā;",
      "VIN un dokumentācijas pārbaude Latvijā (CSDD).",
    ],
  },
  { kind: "p", text: "Papildu izmaksas:" },
  {
    kind: "b",
    items: [
      "transportēšana uz Latviju (no 800,00 EUR);",
      "reģistrācija un tehniskā apskate CSDD;",
      "sezonai atbilstošas riepas;",
      "servisa vai remonta darbi pēc nepieciešamības.",
    ],
  },
  { kind: "h", text: "2. Sadarbības uzsākšana" },
  {
    kind: "p",
    text: "Lai uzsāktu automašīnas meklēšanu, tiek veikta depozīta iemaksa 200,00 EUR apmērā.",
  },
  { kind: "p", text: "Depozīts nodrošina:" },
  {
    kind: "b",
    items: [
      "individuālu automašīnas meklēšanu;",
      "komunikāciju ar pārdevējiem;",
      "rezervācijas procesa organizēšanu;",
      "vienu klienta kritērijiem atbilstošas automašīnas klātienes apskati Vācijā.",
    ],
  },
  { kind: "h", text: "Operatīvā saziņa" },
  {
    kind: "p",
    text: "Kvalitatīvi automobiļi par konkurētspējīgu cenu Vācijas tirgū bieži tiek pārdoti ļoti īsā laikā, tādēļ pēc atbilstoša piedāvājuma saņemšanas aicinām klientu sniegt atbildi iespējami operatīvi.",
  },
  {
    kind: "p",
    text: "Lai nodrošinātu iespēju savlaicīgi rezervēt un pārbaudīt izvēlēto automašīnu, Dzintarzeme Auto apņemas informēt klientu par plānoto klātienes apskati un aptuveno laiku vismaz 24 stundas iepriekš, izņemot gadījumus, kad tirgus situācija prasa tūlītēju rīcību.",
  },
  {
    kind: "p",
    text: "Gadījumos, kad mūsu speciālists atrodas klātienē pie automašīnas, klients apņemas būt sasniedzams operatīvai saziņai. Pēc pilnas informācijas saņemšanas lēmumu vēlams pieņemt 1 stundas laikā, bet ne vēlāk kā 2 stundu laikā no informācijas saņemšanas brīža.",
  },
  {
    kind: "p",
    text: "Ja klients nav sasniedzams vai nesniedz atbildi noteiktajā termiņā, Dzintarzeme Auto nevar garantēt konkrētās automašīnas pieejamību vai rezervācijas iespējas. Gadījumā, ja speciālists ir ieradies uz klātienes apskati un atbilde netiek saņemta 2 stundu laikā pēc pilnas informācijas nodošanas klientam, Dzintarzeme Auto ir tiesības apskati uzskatīt par pabeigtu, un attiecīgās izmaksas tiek segtas no iemaksātā depozīta.",
  },
  {
    kind: "p",
    text: "Depozīts ietver vienu klātienes automašīnas apskati Vācijā.",
  },
  {
    kind: "p",
    text: "Gadījumos, kad pēc klātienes apskates tiek pieņemts lēmums turpināt meklēšanu un organizēt papildu automašīnu apskates, atkārtoti izbraukumi var tikt piemēroti kā atsevišķs maksas pakalpojums (no 200,00 EUR atkarībā no lokācijas).",
  },
  {
    kind: "p",
    text: "Mūsu komanda vienmēr ir ieinteresēta atrast klientam piemērotāko automašīnu pēc iespējas efektīvāk, tādēļ pirms katras klātienes apskates tiek veikta attālināta automašīnas un pārdevēja sākotnējā izvērtēšana.",
  },
  { kind: "h", text: "Depozīta termiņš" },
  { kind: "p", text: "2 mēneši no apmaksas dienas." },
  { kind: "h", text: "Depozīta atmaksa" },
  {
    kind: "p",
    text: "Ja 2 mēnešu laikā netiek atrasta klienta kritērijiem atbilstoša automašīna, depozīts tiek atmaksāts pilnā apmērā.",
  },
  { kind: "p", text: "Depozīts netiek atmaksāts gadījumos, ja:" },
  {
    kind: "b",
    items: [
      "netiek sniegta savlaicīga atbilde rezervācijas vai klātienes apskates veikšanai;",
      "klients pārtrauc sadarbību pēc aktīva meklēšanas procesa uzsākšanas.",
    ],
  },
  { kind: "h", text: "3. Norēķinu kārtība" },
  {
    kind: "p",
    text: "Automašīnas iegāde tiek veikta tikai pēc klienta apstiprinājuma un nepieciešamās priekšapmaksas saņemšanas.",
  },
  {
    kind: "p",
    text: "Rēķini par automašīnas iegādi jāapmaksā 24 stundu laikā, ja nav noteikts citādi.",
  },
  { kind: "h", text: "4. Atbildība" },
  {
    kind: "p",
    text: "Dzintarzeme Auto veic automašīnas vizuālo un dokumentālo pārbaudi, tomēr nevar uzņemties atbildību par slēptiem defektiem vai bojājumiem, kurus nav iespējams konstatēt standarta apskates laikā bez specializētas diagnostikas vai detaļu izjaukšanas.",
  },
  {
    kind: "p",
    text: "Ja Jums rodas papildu jautājumi par procesu, izmaksām vai transportēšanas iespējām, droši sazinieties ar mums — labprāt palīdzēsim.",
  },
  { kind: "p", text: "Visas cenas norādītas bez PVN (21 %)." },
];
