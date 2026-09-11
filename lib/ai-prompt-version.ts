/**
 * Bump when field-agent / expert / polish system prompts change in a way that
 * affects client-facing copy. Logged with every admin AI call.
 *
 * CHANGELOG:
 * - 2026-09-11.3 - Agregātu pakas: OM642/OM651, N47/N57, EA888 gen1/2 vs gen3,
 *   EA189/EA288, PureTech/wet belt, Volvo Drive-E D4; kW+cm³+gads visiem.
 * - 2026-09-11.2 - Volvo D5: sadalīta viens-turbo (D5244T11 / ~136 kW) vs
 *   biturbo bloka-plaisu paka; kW+cm³+gads aizstājējs bez koda; tehnisko risku
 *   aizliegums sākt ar „aprīkota ar…” / „neatliekamu” siksnu no tukšiem dokumentiem.
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
export const PROVIN_AI_PROMPT_VERSION = "2026-09-11.3";
