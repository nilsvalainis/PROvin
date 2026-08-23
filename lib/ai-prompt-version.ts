/**
 * Bump when field-agent / expert / polish system prompts change in a way that
 * affects client-facing copy. Logged with every admin AI call.
 *
 * CHANGELOG:
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
export const PROVIN_AI_PROMPT_VERSION = "2026-08-23.6";
