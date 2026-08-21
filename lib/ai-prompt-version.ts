/**
 * Bump when field-agent / expert / polish system prompts change in a way that
 * affects client-facing copy. Logged with every admin AI call.
 *
 * CHANGELOG:
 * - 2026-08-19.4 — Aizliegts „vakuums” (→ trūkums / datu neesamība); vibrāciju /
 *   svārstību slāpētājs → kloķvārpstas skriemelis (demferis). Visi ✨ aģenti.
 * - 2026-08-19.3 — Reģionālā korozijas apskate: SUV/Crossover/SAV vai VW grupa/Volvo
 *   >10 gadi + ilgstoša LV/LT/EE, Skandināvija, Austrija, Polija. Obligāta zonu
 *   rindkopa 2. sadaļā (grīda, sliekšņi, durvis, rokturi, bagāžnieks, aizmugures aile).
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
export const PROVIN_AI_PROMPT_VERSION = "2026-08-19.4";
