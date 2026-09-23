/**
 * Bump when field-agent / expert / polish system prompts change in a way that
 * affects client-facing copy. Logged with every admin AI call.
 *
 * CHANGELOG:
 * - 2026-09-23.6 - Finnik TAXI: statuss „tikai juridiski”; vājām
 *   pazīmēm noslēgums „neizskatās pēc klasiska taksometra”.
 * - 2026-09-23.5 - Finnik TAXI: varbūtības forma; vājš nobraukums
 *   nav klasisks taksometrs, intensīvs km/APK var saskanēt ar pārvadājumiem.
 * - 2026-09-23.4 - Finnik TAXI: klientam „Nīderlandes oficiālie reģistri”;
 *   BPM atlaide līdz 2020. gadam benzīnam/dīzelim, elektroauto neatvieglo.
 * - 2026-09-23.3 - Finnik TAXI: virsraksts nav „taksometrs”; paskaidro,
 *   ka NL reģistra vārds ir plašāks par klasisku taksometru.
 * - 2026-09-23.2 - Finnik TAXI rindkopa īsāka: ielas taksometrs, platforma
 *   ar atļauju, pielāgots līgumpārvadājums, līzings šim darbam.
 * - 2026-09-23.1 - Finnik TAXI „Ja”: viena rindkopa tikai šajā avotā.
 *   Atzīme nav līzinga sinonīms; scenāriju šķiro pēc km/gadā un APK ritma.
 * - 2026-09-20.2 - Avotu komentārs: 1 rindkopa, ja pietiek; griesti 2-3
 *   (350-800 ir griesti, ne kvota). Ziemas sāls: bagāžnieka vāks / numura
 *   zīmes apgaismojums tikai ja vāks ir tērauds; plastmasa, stiklašķiedra,
 *   kompozīts, alumīnijs vai nezināms materiāls - šablonu neraksta.
 * - 2026-09-20.1 - Avotu komentāri = tikai fiksētais fakts. Teikuma paplašinājumi
 *   („Datu specifika”, „ierakstu trūkums neizslēdz…”, krāsas biezuma mērītājs)
 *   atļauti tikai kopsavilkuma sadaļās / 2. Ieteikumos. HYBRID vairs neprasa
 *   interpretēt pircējam; drošības tīkls stripSourceFieldExpansions +
 *   source_field_expansion self-correction.
 * - 2026-09-19.2 - Dīlera "Komentārs" (AI_DEALER_COMMENT_CONSTRUCTION_RULES),
 *   balstīts uz 96 reālu komentāru analīzi: aizliegts sākt ar "Oficiālā dīlera
 *   dati sniedz/apstiprina..." (bija ~40% gadījumu); kanoniska 3-lomu struktūra
 *   (agregātu identifikācija / servisa vēsture / nobraukuma saskaņa), katra
 *   loma tikai ja datos ir pamats; garuma disciplīna ~600-1000 rakstzīmes
 *   (bija izkliede 73-3654); viens <br> stils visam laukam.
 * - 2026-09-19.1 - Avotu lauki = fakti tikai (AI_SOURCE_FIELDS_FACTS_ONLY_RULES):
 *   vispārīgs "obligāti pilna diagnostika" ieteikums tikai Kopsavilkumā +
 *   nobraukuma/negadījumu kopsavilkumos; "galvenais pirkuma risks" aizliegts;
 *   "bufer(is/a/i)" → "bamperis/bampera/bamperi" (banned vocab + few-shot fix);
 *   zaudējumu summas interpretācija (AI_DAMAGE_CLAIM_CONTEXT_RULES) tikai
 *   negadījumu kopsavilkumā/Kopsavilkumā, avotu laukos tikai fakts; cieto
 *   daļiņu skaitlisks references (100k/1M) pret izdomātu "palielināts" pie
 *   triviāliem skaitļiem; "mūža eļļa ... nenodrošina" šablona teikums aizliegts;
 *   nobraukuma komentārs: straujš (>50%) pēdējo 2 gadu tempa kritums pirms
 *   importa - konteksta piezīme, ne apgalvojums; dīlera "Komentārs" vairs
 *   nedublē Eļļas maiņas intervālu matemātiku, aizliegts meta-komentārs par
 *   formatēšanu; Kopsavilkums (3.) pārstrukturēts uz divām daļām - "Kopējā
 *   aina" (viena plūstoša rindkopa) + "Rekomendācija" (īsa).
 * - 2026-09-15.1 - ASV avota komentārs: NMVTIS/salvage/foto, bez VIN Audit/Carfax
 *   zīmola klienta tekstā; Lite vs Full seguma godīgums.
 * - 2026-09-14.1 - Nobraukuma forenzikas brīfi (temps, avotu neatkarība,
 *   odometra robežas) kodā; FLASH MAX vispirms raksta avotu salīdzinājumu
 *   kā lietas kopskatu (Sonnet); too_long labo ar Gemini Flash.
 * - 2026-09-12.1 - Ātrie vērtējumi: jaunas sagataves, multi-select sadaļās,
 *   oficiālā dīlera sadaļa; closer bez em dash.
 * - 2026-09-11.4 - CRITICAL: D5244T11 = ~158 kW two-stage biturbo (ne viens
 *   turbo); pakas ir prior, kas JĀPĀRBAUDA pret šī auto kW/kodu pirms rakstīšanas.
 * - 2026-09-11.3 - Agregātu pakas: OM642/OM651, N47/N57, EA888 gen1/2 vs gen3,
 *   EA189/EA288, PureTech/wet belt, Volvo Drive-E D4; kW+cm³+gads visiem.
 * - 2026-09-11.2 - Volvo D5: sadalīta viens-turbo vs biturbo; kW+cm³+gads
 *   aizstājējs; tehnisko risku aizliegums sākt ar „aprīkota ar…”.
 * - 2026-09-11.1 - Klienta valoda: bez AI-šablona („tuvākā laika ieguldījums”,
 *   „Kas NAV dārgs”, „divējādu ainu”, „dokumentāri pierādījumi”); kopsavilkums
 *   1–2 rindkopas ar skaidru rekomendāciju; portfeļa lasīšana pirms interpretācijas;
 *   krāsas biezums ne avotu komentāros; apkopes robs >30k km/24 mēn. = ārpus dīlera
 *   iespēja; OM654 paka + ENGINE|kods mācījumi ar lielāku budžetu.
 * - 2026-09-07.3 - Agregāti VISIEM ražotājiem: vispirms dzinēja kods, tad
 *   meklēšana šim kodam, tad komentārs. Pakas un ķēde/zobsiksna nav Audi-only.
 * - 2026-09-07.2 - Klienta valoda: bez „labvēlīgs signāls”; pārdevēja portrets
 *   = fakti no sudzibas.lv/Google, paaugstināts risks tikai pie sistemātiskām
 *   sūdzībām; eļļas robs ≠ risks; zobsiksna/ķēde tikai pēc šī motora; dīlera
 *   Veiktie darbi uzvar „jāmaina”; pakas tikai sakrītošam kodam; ziemas sāls
 *   tikai pēc reālas LV/LT/EE; krāsa 100-150 / 50-150 µm; FLASH MAX piezīme
 *   paliek tajā avotā, uz kuru attiecas.
 * - 2026-09-07.1 - „kontūrā” aizliegts klienta tekstā: virsbūvē (krāsa) vai
 *   sistēmā (elektronika / programmatūra).
 * - 2026-09-04.1 - Gara domuzīme "—" un en dash "–" aizliegtas visā klienta
 *   tekstā (mājas lapa, B2B, e-pasti, atskaites). Vietā: komats, kols, jauns
 *   teikums vai īsā ASCII "-" (24-72h, 2007-2015).
 * - 2026-08-29.1 — Ātrie vērtējumi: sagataves turpina to pašu rindkopu
 *   (punkts + viena atstarpe), bez 1. 2. 3. saraksta.
 * - 2026-08-26.1 — Ieteikumi: katram auto viena virsbūves/krāsas-biezuma
 *   sadaļa (mērītājs, 100-150 µm / nobīde 50-150, iekšējās ailes).
 *   Tipiskais garums 6-12, lai šī sadaļa neizstumtu citus soļus.
 * - 2026-08-25.4 — Dānija: līzings + privāta reģistrācija = 2 īpašnieki
 *   (līgumu ķēde nav jauni īpašnieki; ārvalstu pirmā reģistrācija nav DK).
 * - 2026-08-25.3 — DĀNIJAS REĢISTRI: īpašnieku skaits tikai Dānijā
 *   (ārvalstu pirmā reģistrācija nav Dānijas īpašnieks).
 * - 2026-08-25.2 — Dānijas īpašnieku skaits tikai no reģistrācijas darbībām
 *   (ne OCTA polišu maiņām).
 * - 2026-08-25.1 — Dānijas īpašnieku skaits: OCTA kompāniju maiņu aplēse
 *   (nav oficiāls DMR saraksts); PDF avota virsraksts DĀNIJAS REĢISTRI.
 * - 2026-08-24.3 — Citu auditu atmiņa: tikai stils/vārdi/pieredze; sveša auto
 *   fakti (plēve u.c.) tiek izņemti no injekcijas un izejā noķerti.
 * - 2026-08-24.2 — Plēve tikai ja ŠĪ auto datos ir aplīmēšana; uzdevuma
 *   rindas un citu auditu fragmenti vairs neuzspiež plēvi katram auto.
 * - 2026-08-24.1 — Ziemas sāls / rūsa: ja auto gadiem Latvijā / Lietuvā /
 *   Igaunijā (īpaši SUV), riskos un ieteikumos obligāti tipiskās vietas
 *   (arkas, sliekšņi, bagāžnieka vāks). Cinkojums un svaiga TA neatceļ.
 * - 2026-08-23.6 — Sarunvaloda: „uzturēšanas punkts” → „tuvākā laika
 *   ieguldījums”; „integritāte” → „stāvoklis”.
 * - 2026-08-23.5 — Fotogrāfiju analīze: ģenerē arī bez pievienotām bildēm
 *   (no sludinājuma teksta / pasūtījuma datiem; neizdomā vizuālas detales).
 * - 2026-08-23.4 — Oficiālā dīlera lauks „Eļļas maiņas intervāli”: īsa
 *   intervālu matemātika no visiem avotiem; pārējie aģenti neraksta šo eseju.
 * - 2026-08-23.3 — Plēves atjaunošanas formulējums: divi teikumi (ražotājs
 *   nezināms → sarežģīta detaļu atjaunošana; tona maiņa → atjaunotā detaļa
 *   var būtiski atšķirties), ne viens semikola teikums.
 * - 2026-08-23.2 — Aplīmēšana ar plēvi: ja minēta jebkurā laukā, jāpiemin
 *   riskos un kopsavilkumā kā neredzamā krāsojuma risks (ne kā pierādīts defekts).
 * - 2026-08-23.1 — Visiem aģentiem: CSDD TA nosegums (svaiga ≤3 mēn. / spēkā /
 *   beigusies), nezināmais nav risks, nosacīta risku kvota, riski ≠ apskate,
 *   sarunvalodas termini ar self-correction, stila korpuss (adaptē, nekopē).
 * - 2026-08-22.1 — Ātrie vērtējumi: jaunās operatora sagataves, closer
 *   pēc noklusējuma, sagatavju frāzes drīkst ņemt vārds vārdā.
 * - 2026-08-19.2 — Klienta komentāros nav * / **. Virsraksts savā rindā,
 *   tad rindkopa. Nenoslēgtus Gemini „** ” prefiksus noņem pēcapstrāde.
 * - 2026-08-19.1 — Tehnisko risku analīze: pirmā rindkopa ir riska fakts,
 *   ne auto/agregāta prezentācija. Identifikācija paliek iekšēja.
 * - 2026-08-18.6 — Vienotais avots (lib/provin-banned-vocabulary.ts) aizliegtajam
 *   vārdu krājumam: prompts (PROVIN_REPORT_COPY_VOCABULARY) un eval
 *   (comment-quality.ts) tagad lasa TO PAŠU sarakstu. Self-correction retry:
 *   admin-ai-dispatch.ts pēc ģenerēšanas palaiž evaluateExpertCommentQuality()
 *   un pie kritiska pārkāpuma (aizliegts vārds, izdomāta EUR summa) automātiski
 *   pieprasa VIENU korekcijas mēģinājumu tam pašam modelim. Pievienots
 *   `npm run eval:prod-sample` — CLI izlases pārbaude reāliem melnrakstiem.
 * - 2026-08-18.5 — izņemts vārds "saime" (agregāts/konstrukcija/paaudze), "Baltija"
 *   sadalīts pa valstīm (Latvija/Lietuva/Igaunija), "injektori" → "iesmidzinātāji
 *   (sprauslas)", "vidējs uzturēšanas risks" → "ierasta uzturēšanas izmaksa",
 *   "kontrolpunkts klātienē" → "jāpārbauda klātienē". EUR drošības tīkls
 *   (stripUnauthorizedEuroAmounts) pievienots tehnisko risku, apskates un
 *   kopsavilkuma laukiem. VW 3.0 V6 TDI protokols papildināts (kW varianti,
 *   pārnesumkārbas, Quattro piedziņas komponentes).
 */
export const PROVIN_AI_PROMPT_VERSION = "2026-09-23.6";
