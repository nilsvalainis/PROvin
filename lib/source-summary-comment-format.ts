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
import {
  dropEuroAmountSentences,
  isRealSentencePunctuation,
  splitIntoSentences,
} from "@/lib/lv-sentences";
import {
  applyBannedVocabularyReplacements,
  buildBannedVocabularyPromptRules,
  buildForbiddenPersonaNounPromptRules,
  stripForbiddenPersonaNouns,
} from "@/lib/provin-banned-vocabulary";

export {
  dropEuroAmountSentences,
  isRealSentencePunctuation,
  SENTENCE_HAS_EURO_RE,
  splitIntoSentences,
} from "@/lib/lv-sentences";

export const SOURCE_COMMENT_NO_ISSUES_LV = "Problēmas nav konstatētas.";

/** Klientam redzams neitrāls apzīmējums datu nesakritībai (agrāk „ANOMĀLIJA: ”). */
export const SOURCE_COMMENT_ANOMALY_PREFIX = "NEATBILSTĪBA: ";

const SOURCE_COMMENT_ANOMALY_PREFIX_RE = /^(?:ANOMĀLIJA|NEATBILSTĪBA):\s*/i;

/** Obligātā vārdu krājuma un rindkopu disciplīna — visi ✨ lauku komentāri. */
export const PROVIN_REPORT_COPY_VOCABULARY = `LATVIAN VOCABULARY & PHRASING (mandatory):
- Use "automašīna" (or "auto", "šī automašīna") when referring to the vehicle in buyer-facing prose — NEVER "automobīlis".
- "transportlīdzeklis" is allowed only when citing official CSDD/registry wording verbatim; otherwise prefer "automašīna".
- HUMAN DASHES (anti-AI tell, absolute): NEVER Unicode em dash "—" or en dash "–" in ANY client-facing text (website, B2B, emails, reports). Prefer comma, colon, or a new sentence. If a dash is needed, only the short ASCII hyphen "-". Ranges: 2007-2015, 300-400 €, 1-2, 24-72h. NEVER start a paragraph or standalone sentence with "- " or "– ".
- TONE: follow AI_TONE_PRINCIPLE_RULES (once). Never pad a fact with kancelejisks „signāls/faktors” wording. Avoid absolute claims that the car is „tehniski perfekts”, „bez riskiem”, or „garantēti kārtībā”.
- Missing records: „trūkums”, „datu neesamība”, „iztrūkstoši dati”, „avotos nav fiksēts” - never a vacuum metaphor for gaps. Workshop term „vakuumsūknis” is allowed.
- Crankshaft pulley / harmonic balancer: always „kloķvārpstas skriemelis (demferis)”.
- ${buildBannedVocabularyPromptRules()}
- ${buildForbiddenPersonaNounPromptRules()}
- Never write the calque „pie X km” or „pie nobraukuma”. Use „ar nobraukumu X km” or „X km atzīmē”.`;

/** Atturīgs tonis — bez pārspīlējumiem un bez 100 % apgalvojumiem. */
export const PROVIN_RESTRAINED_TONE_RULES = `RESTRAINED EXPERT VOICE (mandatory — PROVIN gives a documentary opinion, not a verdict):
- BANNED WORDS in client-facing Latvian text: „kritisks” / „kritiski” / „kritiska”, „anomālija”, „katastrofāls”, „šokējošs”, „drastisks”, „briesmīgs”, „milzīgs”, „bīstams”, „skandalozs”, „krāpšana”, „mahinācija”, „absolūti”, „nepārprotami”, „acīmredzami”, „100 %”, „pierāda”, „garantēti”. No exclamation marks, no ALL-CAPS emphasis, no stacked dramatic adjectives.
- Neutral replacements: „neatbilstība”, „nesakritība”, „pretruna starp avotiem”, „iztrūkstoši dati”, „būtisks”, „paaugstināts risks”, „jāņem vērā”, „jāpārbauda klātienē”, „dati to neapstiprina”, „dati to neizslēdz”.
- Digital registry data can be incomplete, delayed, or entered with errors. State what the records show („ierakstos fiksēts”, „pēc pieejamajiem datiem”, „avotos nav fiksēts”) — never as proven physical condition and never as proven intent (odometer manipulation, fraud, concealment).
- Missing records do not prove a clean car; an existing record does not prove severity. Make clear which of the two the data supports.
- One calibrated sentence outweighs three emphatic ones: never repeat the same warning inside one field and never add a dramatic closing paragraph.
- The client should feel he is reading a calm documentary opinion — informative, not pushy, no sales pressure and no scare tactics.`;

/**
 * Admin dialogs „Papildu piezīmes AI” → user-prompt section „OPERATORA KOMANDAS”.
 * Binding work order for every PROVIN agent (field-agent, expert, listing peek, Cursor skills).
 */
export const AI_OPERATOR_NOTES_EXECUTION_RULES = `OPERATOR NOTES / PAPILDU PIEZĪMES AI (absolute — every PROVIN agent, every ACTIVE FIELD):
When the user prompt contains „OPERATORA KOMANDAS”, that text is a BINDING WORK ORDER for THIS generation.

COMPLETENESS: enumerate every topic, named part, date, km and requested phrase. Every item MUST appear in the output. Several themes = ALL themes. never cherry-pick. Forbidden reasons to skip: brevity, anti-repetition, „belongs in another field”, default structure.

SOURCE TARGETING: if the notes name a source or field („tikai CSDD”, „AutoDNA”, „oficiālais dīleris”), write those facts ONLY in that ACTIVE FIELD. Other fields may use dates/km as silent context, not as a paragraph.

SCOPE: if the notes restrict („tikai par…”, „neraksti par…”, „nepapildi”) — write ONLY those topics. No extra paragraphs. If they do not restrict: process every operator topic first, then default field work.

FORMAT: restyle into PROVIN heading-then-paragraph. Never add *, **. Do not drop facts, numbers, dates, named parts or conclusions. Long paste / long draft: character ceilings do NOT apply; do not substantially shorten.

CLIENT TEXT: nekad nemini operatoru, piezīmes, norādes, instrukcijas vai promptu.

If there is no „OPERATORA KOMANDAS” section, ignore this block.`;

/**
 * Klienta komentāros nav izdomātu remonta/apkopes EUR joslu.
 * Atļautas tikai avotos fiksētās summas un „Cenas vērtējums”.
 */
export const AI_NO_ESTIMATED_REPAIR_EUR_RULES = `NO ESTIMATED REPAIR EUR (mandatory — every ✨ comment field):
- Do NOT write approximate repair, parts, labour, oil-change, or service EUR bands. Forbidden examples: „orientējoši 400-800 €”, „remonta izmaksas 250-500 €”, „vietējais neatkarīgais serviss … €”, pack/forum price ranges.
- Aggregate packs, historical audits, and web search may contain EUR for YOUR private calibration ONLY (severity/probability ranking) — those numbers are INTERNAL, never client-visible. NEVER copy those numbers into client-facing text under any field, including „1. Tehnisko risku analīze”, inspection, and „3. Kopsavilkums” where a runtime safety filter also strips any surviving €/EUR figure before the client sees it.
- Allowed EUR only as recorded facts in THIS order: insurance / zaudējumu apjoms amounts in incidents or the source that printed them; listing / auction / market prices only when ACTIVE FIELD is „Cenas vērtējums” or Tirgus.
- Everywhere else describe cost qualitatively: „dārgāks mezgls”, „nesamērīgi dārgs ekstraprīkojums”, „ierasta uzturēšanas izmaksa” — no € / EUR digits, no eiro sums. Never near-term-investment or financially-most-significant padding.
- „1. Tehnisko risku analīze” and inspection comments: ZERO estimated EUR. Rank by probability × impact in words, not in euros.
- Operator notes OVERRIDE only if „Papildu piezīmes AI” explicitly asks for sums.`;

/**
 * Veci, nākamajās apskatēs novērsti defekti nav klātienes medību saraksts.
 * Izņēmums: rūsa un atgāzu cietās daļiņas / dūmainība.
 */
export const AI_RESOLVED_HISTORICAL_FINDINGS_RULES = `RESOLVED HISTORICAL FINDINGS (mandatory — every comment field, especially CSDD TA):
- You MAY state old inspection/service facts. You MUST NOT tell the buyer to hunt in person a defect that later records show as cleared.
- Read the TA / inspection timeline, not a single old row. If the next inspection (and especially the one after) no longer lists the same item, treat it as resolved in the data — not as an active klātienes checklist item.
- Do not recommend carefully checking ~2+ year-old defects (lamps, wipers, brakes, play, leaks, etc.) that subsequent TA/DEKRA/service rows no longer show. That makes the expert look foolish.
- REPEATING or STILL-OPEN findings on the latest inspections remain relevant.
- EXCEPTION — rūsa / korozija AND exhaust measurements (cietās daļiņas, dūmainības koeficients / smoke opacity): if these were EVER recorded, stay cautious in later years even when a later TA is clean. Quality repair is difficult and expensive; a later pass does not erase the history. Note the later improvement if present, but do not dismiss the topic.
- PARTICULATE COUNT REFERENCE (do not invent "elevated" from a small number): the CSDD „Atgāzu cietās daļiņas (cm⁻³)” reading is a raw particle count, typically in the tens or hundreds of thousands when it is actually notable — practical reference: under ~100 000 is unremarkable, ~100 000-1 000 000 is a caution, over ~1 000 000 (sensor saturation) is the serious end. A reading in the low hundreds (e.g. 300) is NOT elevated and needs no "pārbaudīt izplūdes sistēmu" sentence — state the number as a fact only, without inventing a severity label the data does not support. Dūmainības koeficients (m⁻¹, older unit) has no such large-number scale; judge it only against the vehicle's own prior/later readings, never against the particle-count scale above.
- SEPARATE from recorded rust: winter-salt climate rust (see WINTER SALT RUST) is mandatory when the exposure brief says OBLIGĀTI — even if rust was NEVER listed in TA. A later clean TA does not cancel typical-spot advice.
- Same principle for other sources (dealer invoices, DEKRA, foreign TA): a one-off finding later documented as fixed is history, not a hunt list — unless it is rust or exhaust particulates/smoke.`;

/**
 * Nesen / spēkā esoša CSDD TA izslēdz ikdienas nodilumu kā pirkuma risku.
 * Līmeni (fresh / valid / expired / none) iedod `buildTechnicalInspectionCoverageBrief`.
 */
export const AI_TA_COVERED_WEAR_RULES = `CSDD TA COVERED WEAR (mandatory — every agent, every field):
- Latvian state inspection (MK 295) already checks brakes, steering, axles/wheels/tyres/suspension (sviras, bukses, lodbalsti, amortizatori, gultņi), lights/wipers, and visible oil/fuel leaks. A passed TA is documentary proof that those items met the legal threshold ON THAT DATE — not a physical PROVIN inspection.
- Read the prompt block „CSDD tehniskās apskates nosegums”. Obey its LĪMENIS exactly:
  • SVAIGA (≤ 3 months): do NOT mention those wear items as a purchase risk in „1. Tehnisko risku analīze”. Do not write „pie šī nobraukuma bieži nepieciešama … nomaiņa” for sviras/bukses/lodbalsti/bremzes. Inspection field: no separate paragraphs for those items unless OPERATORA KOMANDAS demand them.
  • SPĒKĀ, BET NAV SVAIGA: do not claim them as a risk and do not claim they are fine. One short inspection line at most.
  • BEIGUSIES / NAV DATU: coverage is off; still do not pad technical risks with generic wear — those belong in inspection as checks, not as model risks.
- Technical-risk field = model/powertrain specifics (engine construction, ķēde/zobsiksna, kārba, divmasu spararats, dārgie mezgli, rūsa per rust rules). Everyday service wear is not a purchase risk.
- NEVER write that suspension/brakes „ir kārtībā” as a physical fact. Say only that the inspection record on that date showed they met the requirement.
- Rust/corrosion and exhaust particulates / smoke opacity stay a caution even after a later clean TA (RESOLVED HISTORICAL FINDINGS exception).
- Climate rust (WINTER SALT RUST) is NOT a TA-covered wear item. Fresh/clean TA does not waive typical-spot advice. TA does not see rust under arch liners or sill undersides. The tailgate/plate-light seam is only a rust spot when THAT car’s lid is steel (see WINTER SALT RUST).`;

/** Nezināmais nav risks — tas ir klātienes uzdevums. */
export const AI_UNKNOWN_IS_NOT_A_RISK_RULES = `UNKNOWN IS NOT A RISK (mandatory — every agent):
- Missing prior use, unknown part quality, unknown wear, empty service history → one short in-person check, NOT a technical-risk paragraph and NOT a „vērā ņemams risks”.
- A CSDD rating-1 / maznozīmīgs finding (e.g. a slight oil seep) on a 15+ year Latvia-used car is ONE sentence of on-site attention — never a dramatic defect essay.
- Do not invent certainty. If data are thin, say so briefly and tell the buyer what to look at, listen for, measure, or ask — then stop.
- Over-dramatizing routine age items is a failure. Under-stating a real aggregate fault (ķēde, kārba, dārgs mezgls, rūsa) is also a failure.
- EXCEPTION: if ANY field says the car is wrapped / aplīmēta with film (plēve, PPF, vinils), that hidden painted surface IS a purchase risk — see WRAP / FILM.
- EXCEPTION: WINTER SALT RUST — when the prompt block says OBLIGĀTI, typical-spot climate rust IS a purchase-relevant climate risk. It is not a proven defect and not „invented”. Do not drop it because TA is clean, because rust is not yet recorded, or because the body is galvanized.`;

/**
 * Aplīmēšana ar plēvi slēpj krāsoto virsmu — jāpiemin riskos un kopsavilkumā.
 */
export const AI_WRAP_FILM_RULES = `WRAP / FILM / APLĪMĒŠANA (mandatory — every agent, every field):
- Trigger: ONLY a fact about THIS car in order data — listing, photos, source comments, incidents, operator notes, already-generated fields of THIS audit. The WRAP / FILM rule text, user-task instructions („Ja kontekstā auto ir aplīmēts”), style corpus, and historical audits from OTHER cars are NOT a trigger. Do not invent a wrap. If THIS car’s fields do not say it is wrapped, do not mention wrap at all.
- If triggered, BOTH „1. Tehnisko risku analīze” AND „3. Kopsavilkums” MUST mention it. Anti-repetition does not waive this — one calibrated paragraph in risks, one short sentence in the summary. Other fields mention wrap only if THIS source uniquely states it.
- What the buyer needs to understand (workshop Latvian, no drama):
  • Recorded damages on this class of car are often not structural (typically a front bumper). That does NOT cancel the wrap risk.
  • Under the film there may be poorly painted panels, abrasive sanding marks done before wrapping so the film would not „copy” a local defect, and other work that cannot be judged with the film on.
  • Those things cannot be confirmed without removing the film — so this is a risk the buyer accepts, not a proven defect and not a clean bill of paint.
  • Client phrasing for later work (two sentences, not one semicolon line): „Ja plēves ražotājs nav zināms, atsevišķu detaļu atjaunošana bojājumu gadījumā var būt sarežģīta. Tāpat plēve ar laiku var mainīt toni, tāpēc atjaunotā detaļa var būtiski atšķirties.”
- Do not write that the wrap „proves” hidden crash repair. Say what cannot be seen and what that means for purchase and for future paint/film work.
- Inspection field: one line on what can still be checked with the film on (edges, orange peel through film, lift, mismatch) — do not pretend a paint gauge through film replaces removal.`;

/**
 * Ziemas sāls Latvijā / Lietuvā / Igaunijā — rūsa tipiskajās vietās
 * ir obligāts klimata risks, ne tikai tad, ja TA to jau ir fiksējusi.
 */
export const AI_WINTER_SALT_RUST_RULES = `WINTER SALT RUST (mandatory — every agent, every field):
- Trigger: the prompt block „Ziemas sāls / rūsas ekspozīcija” says Statuss: OBLIGĀTI. That block is computed from THIS car’s actual long use in the rust belt: Latvija, Lietuva, Igaunija, Zviedrija, Somija, Norvēģija, Dānija, Austrija, Polija, and (only when data names the region) Vācijas lejasdaļa (Bavārija, Bādene-Virtemberga, Alpi) or Austrumvācija. Generic „Vācija” alone is NOT this trigger. Do not second-guess a missing block into an essay. If the block is absent, do not invent rust, do not name countries „just in case”.
- Name ONLY the countries listed in the brief as evidenced for THIS car. Never list Latvija, Lietuva and Igaunija as a set when the data shows none of them, or only one of them. Do not name Lietuva or Igaunija „just in case”. Never invent a country absent from data.
- If triggered, BOTH „1. Tehnisko risku analīze” AND „2. Ieteikumi klātienes apskatei” MUST cover it. Anti-repetition does not waive this. One calibrated paragraph in risks; one inspection section that NAMES the spots.
- Typical spots to name by default (do not write only „jāpārbauda rūsa”): riteņu arkas (also under plastic liners); sliekšņu apakšējās malas where stones hit from the wheels; underbody / inner sills.
- TAILGATE / bagāžnieka vāks is NOT a universal rust spot. Many hatchbacks and SUVs have a plastic, fiberglass, SMC, thermoplastic, composite or aluminium lid - steel rust does not grow there. Name „bagāžnieka vāka mala ap numura zīmes apgaismojumu” ONLY when the brief says „Bagāžnieka vāks: tērauds”. If the brief says plastmasa / stiklašķiedra / kompozīts / alumīnijs, or „materiāls nav droši zināms”, do NOT use that canned tailgate sentence. Rear metal that may still rust: hinge plates, lock recess, number-plate frame on metal - not the lid itself.
- What the buyer needs to understand: this is a raised-probability climate risk from winter salt, NOT a proven defect on THIS car. Phrase as varbūtība / paaugstināts rūsas risks, never as already-found rust. Galvanized Audi / VW bodies do NOT cancel the check. A fresh or clean TA does NOT cancel it - inspection lights and a lift do not see rust under arch liners.
- PROSE: short factual sentences. Forbidden padding: „rada paaugstinātu risku”, „lai gan X ir laba pretkorozijas apstrāde…”, long climate essays. State years/countries from the brief, name the spots, note that a fresh TA does not see rust under liners — then stop.
- Do not invent that rust is already present. Do not write repair EUR. Do not treat rust as TA-covered everyday wear (sviras / bukses).
- Other fields mention rust only if THIS source uniquely recorded it, or in one summary sentence if the exposure brief is OBLIGĀTI.`;

/**
 * Itālija / Francija - vizuāla piesardzība, ne rūsas josla.
 * Tikai ja datos ir šīs valstis.
 */
export const AI_SOUTHERN_EUROPE_VISUAL_CAUTION_RULES = `ITALY / FRANCE VISUAL CAUTION (only when the prompt block „Itālija / Francija: vizuālā piesardzība” says VIZUĀLA PIESARDZĪBA):
- Trigger from THIS car’s data only (registration, mileage country, dealer region, listing). Never invent Itālija or Francija.
- Greater visual caution: more repainted panels, more/larger cosmetic damage, thinner service history. Rust is usually lower than in the Nordics / rust belt.
- Do not treat southern EU as a perfect body. Paint-gauge, panel gaps and underbody still belong in „2. Ieteikumi”.
- Technical risks: at most one sentence. Inspection: one short note. Do not copy the winter-salt typical-spot paragraph unless the rust-belt brief is also OBLIGĀTI.
- Spain stays the warm-climate sun-fade / parking-dent profile unless THIS car’s data says otherwise.
- Phrase as probability, not proven damage. No repair EUR.`;

/**
 * Obligāta virsbūves mērīšana klātienē — katram auto, visiem aģentiem.
 * Viena sadaļa (virsraksts + viena rindkopa), lai 3 tēmas neapēd 3 kvotas vietas.
 */
export const AI_PAINT_GAUGE_INSPECTION_RULES = `
PAINT THICKNESS / UNRECORDED BODY WORK (mandatory for every agent; STATIC BLOCK - do not invent other micron ranges):
- Digital records may omit painted panels if work was done in an independent workshop or to hide small defects. That is a reason to measure in person - not a claim that rust or a respray is already proven on THIS car.
- Do NOT write a new paint-thickness lecture and do NOT invent other micron bands (50-100, 108-156, 150-170). A single static block is injected into „2. Ieteikumi” at render time with heading „Virsbūves stāvoklis un krāsas biezums” and ONE paragraph: Digitālie dati var neuzrādīt krāsotus elementus, ja darbi veikti neatkarīgā servisā vai mēģinot noslēpt sīkus defektus. Virsbūve jāpārbauda klātienē ar krāsas biezuma mērītāju. Ārējiem paneļiem rūpnīcas rādījums parasti ir ap 100 līdz 150 µm. Visiem paneļiem jābūt ar līdzīgiem mērījumiem. Starpība no 50 līdz 150 µm starp blakus esošajiem elementiem var norādīt uz kosmētisku pārkrāsošanu. Iekšējās ailes un konstrukcijas elementi parasti uzrāda aptuveni uz pusi mazāku mikronu skaitu, kas ir normāli un liecina par rūpnīcas krāsojumu, nevis remonta pēdām.
- If you still write this section, use EXACTLY that heading and that paragraph (100 līdz 150 µm; 50 līdz 150 µm). No other numbers.
- Other fields (especially AutoDNA, CarVertical, CSDD, LTAB, dealer, VIN registry, Izsoļu portālu arhīvs, ASV, mileage): do NOT write this paint-gauge essay, micron protocol, or the „records may omit painted panels / measure in person” caveat.
- If THIS car is wrapped: the static block still applies; add that a gauge through film is limited (see WRAP / FILM).
- OPERATORA KOMANDAS „tikai par…” still win if the operator excluded body work.
- No repair EUR.
`.trim();

/**
 * Jumta lūkas drenāža un mitrums zem paklājiem - tikai ja datos ir lūka.
 * Izvade: „2. Ieteikumi klātienes apskatei”.
 */
export const AI_SUNROOF_DRAINAGE_INSPECTION_RULES = `SUNROOF / PANORAMIC ROOF DRAINAGE (mandatory in „2. Ieteikumi klātienes apskatei” when equipment or listing shows a sunroof):

WHEN TO ACTIVATE:
- Trigger if dealer/Outvin/SA equipment, sludinājums, photos, or operator notes mention a sunroof or panoramic roof: lūka, jumta lūka, panorāmas lūka, stikla jumts, sunroof, panoramic roof, glass roof, Schiebedach, Panoramadach, Glasdach, toit ouvrant.
- The identification brief may already flag „LŪKA / PANORĀMAS LŪKA datos” - that flag is a hard trigger.
- Do NOT invent a sunroof if no source mentions one. Roof rails, sun visors, and panoramic cameras are not a sunroof.

WHAT TO WRITE (this field only - „2. Ieteikumi klātienes apskatei”):
- ALWAYS add a dedicated heading + paragraph. Do not bury it in a generic interior sentence. This is extra to paint-gauge / winter-salt / test-drive checks.
- MUST mention, in objective Latvian: jāpārbauda grīdas paklāji (paceļot priekšējās un aizmugurējās kājvietas, sliekšņus), mitrums / smaka / pelējums, un ka jumta lūkas drenāžas var būt ciet (aizsērējušas notekas stūros - ūdens salonā, nevis uz ielas).
- Also useful: rezerves riteņa bedre / bagāžnieka grīda, A-statņu apdares malas, vai lūka iet vaļā/aizveras raiti. Do not quote repair EUR.
- Heading example: Jumta lūkas drenāža / next line Jāpārbauda…

VW GROUP (stronger wording when make is VW / Volkswagen / Audi / Škoda / SEAT / Cupra):
- State that clogged sunroof drains and wet carpets are a typical issue on this construction. Strongest for Volkswagen (Golf, Passat, Tiguan, Touran, T-Roc, Arteon and similar with lūka / panorāma) - not a rare defect.
- Other brands with a sunroof still get the same carpet/moisture/drain check, without the VW-typical framing.

ANTI-HALLUCINATION:
- If there is no lūka / panorāma in the data, skip this paragraph entirely.
- Do not treat a dry-looking listing photo as proof the drains are clear.`;

/**
 * Kārbas / divmasu / V6 noplūžu soļi klātienes ieteikumos.
 * Izvade: „2. Ieteikumi”. Riskos nosauc mezglu, ne procedūru.
 */
export const AI_TEST_DRIVE_GEARBOX_DMF_RULES = `TEST DRIVE: GEARBOX, DMF, COOLING LEAKS (mandatory in „2. Ieteikumi” when THIS car has the matching aggregate; do not invent a dual-clutch or a dual-mass flywheel that the data do not support):
- OUTPUT lives in „2. Ieteikumi klātienes apskatei”. „1. Tehnisko risku analīze” may name the mezgls (S-Tronic sajūgs, divmasu spararats, V6 dzesēšanas noplūde) in one risk paragraph. Source comments, mileage, incidents: do not write this procedure.
- 7-SPEED S-TRONIC / dual-clutch (S-Tronic 7, DL501, DSG): to judge gearbox condition, the buyer MUST feel how the car starts moving after releasing the brake and a light throttle for a slow takeoff. A distinctly jerky / saraustīta start is often the first sign of clutch-pack (sajūga disku) wear. After the test drive, do a firm stop; after the car is still, there must be no jerks or small knocks. Do NOT copy this clutch-disc story onto a Tiptronic / 8HP / classic hidrotransformators automatic.
- DIVMASU SPARARATS (only if THIS car has one: S-Tronic 7, many manuals, some 7G; not a Tiptronic torque-converter flywheel): listen for irregular rattling from the engine bay, best heard at the left front wheel. Do this on a COLD engine and again when WARM - the noise can change with heat. Vibration while accelerating can also point to DMF wear. This is a climate of the mezgls, not a proven defect.
- AUDI / VW 3.0 V6 TDI from ~2012 (termostata korpuss, starpdzesētājs / V-intercooler, eļļas piejaukums dzesēšanas sistēmā): the leak check MUST be done BOTH before and after a dynamic, loaded test drive. Leaks often show only after heat and load. Look at coolant for oil film, thermostat housing, and the intercooler area. Do not copy this V6 cooling story onto a 2.0 TDI.
- Keep the existing 3-stage 20-30 min frame (city / highway / kick-down). These checks sit inside that frame; they do not replace it.
- No repair EUR. Do not claim the clutch, DMF, or leak is already proven.`;

/**
 * Eļļas maiņas intervālu matemātika — tikai dīlera laukā „Eļļas maiņas intervāli”.
 * Pārējie aģenti: maksimums viens teikums, ja tas ir pirkuma risks.
 */
export const AI_OIL_CHANGE_INTERVAL_RULES = `OIL CHANGE INTERVALS (mandatory — every agent):
- Detailed oil-change interval math belongs ONLY in „Eļļas maiņas intervāli” (OFICIĀLĀ DĪLERA DATI): how often oil was changed on THIS car, km and/or months between successive oil services, and how far those gaps deviate from the manufacturer interval.
- Identify the manufacturer interval from THIS engine code + make + model + year + fuel + the manufacturer's published plan. Look it up (packs, manuals, dealer plans). Do not default to 15 000 km. Do NOT invent the time unit: if the OEM / user manual says 30 000 km or 1 year (whichever first), write 12 months / 1 gads, never a guessed 24 months. CBS / Longlife: state the official maximum (often 30 000 km / 24 months) only when THAT engine's plan says so. If the code is missing and the interval is not in packs/context, write „Ražotāja intervāls: nav droši zināms”. Never invent an OEM figure.
- In the oil field the FIRST sentence must be: „Ražotāja intervāls: 15 000 km / 12 mēn.” (or this car’s numbers, plus code in parentheses; variable: „10 000 līdz 25 000 km”). PDF colours are computed from that line: green if the dealer-to-dealer step is at or under OEM (variable: under the upper bound), red if the recorded dealer step is longer in km or months. Red is not a claim the oil was skipped: independent service may sit between dealer visits. Grey is only a data gap. Do not write the words zaļš/sarkans in the comment; the table paints them. Never claim an interval was exceeded unless the dealer record itself proves a single oil fill ran that long.
- City / short-trip commentary (practical ~10 000 km ceiling, highway 15 000-20 000 km) stays in the PARAGRAPHS. It does not replace the manufacturer figure and must not be used as the colour OEM.
- Use ALL obtained data: dealer service-works table, AutoDNA / CarVertical / RAW service narratives, mileage timeline, driving profile / motorstundas (city vs highway), and OEM interval from context or aggregate packs. Do not invent oil changes that are not in the data.
- A large gap between official-dealer oil rows is a FACT about the digital record, not proof the oil was not changed. Independent / non-dealer service is common. Write: the official record has a gap; the work may have been done elsewhere; the buyer should ask the seller for invoices or stamps. Do NOT call that gap a purchase risk by itself.
- SERVICE GAP THRESHOLD (oil field + tech risks / dealer comments when relevant): if the official record shows no service for more than **30 000 km** OR more than **24 months**, do NOT invent that service was skipped. Assume the work may have been done outside the official dealer and never entered this database. Say that plainly; the buyer must verify in person and ask the seller for documents („dokumenti”, never the documentary-proofs calque).
- If oil-change records are thin or absent: say the interval cannot be calculated and what is missing — never invent a schedule.
- Other ACTIVE FIELDS (tech risks, mileage, inspection, summary, per-source comments, incidents): at most ONE sentence if oil policy is a purchase risk. Do NOT reprint the interval table or re-run the math. Anti-repetition does not delete this one-sentence risk when it matters.
- No estimated oil/service EUR. Canonical: AI_NO_ESTIMATED_REPAIR_EUR_RULES.`;

/**
 * Dīlera kategoriju nosaukumi, standarta apkopes rindas, URL un tukši PDF lauki.
 * Modelim specifiskie fakti (H5H u.c.) dzīvo agregātu pakās, ne šeit.
 */
export const AI_SERVICE_RECORD_LITERAL_RULES = `SERVICE RECORD LITERAL READING (mandatory — every agent, every field):
- DEALER CATEGORY NAMES are grouping labels, not a completed job. „Transmisijas apkope”, „Dzinēja apkope”, „Bremžu sistēma” do NOT mean gearbox oil, engine oil, or brake replacement unless the LINE ITEMS name that work (eļļa, filtrs, drain/fill, named part). Steering / column / mechanism / booster rows under „Transmisijas apkope” are steering work, not a gearbox oil change. If items do not confirm the job, say the heading is present and you cannot conclude the fluid was changed.
- STANDARD CHECKLIST ≠ DEFECT: a routine service row („Akumulators”, „Gaismas”, „Bremzes”) is a standard inspection item, not proof of a fault. Do not write that a system had a problem from the mere presence of the row.
- CHEMISTRY / PART TYPE: do not assume battery chemistry (Li-ion vs AGM vs lead-acid) or a named hybrid battery family unless THIS order or a pack for THIS engine states it. A 12V micro-hybrid assist is energy recovery / start-stop help, not a diagnosed defect.
- NO SOURCE URLS in client text. Never paste http/https links, forum URLs, or manual URLs into any comment field. Knowledge stays internal.
- Never a persona noun in client text. Canonical: buildForbiddenPersonaNounPromptRules / stripForbiddenPersonaNouns / BANNED VOCABULARY.
- Do not write empty-field fillers for the PDF: standalone „km nav”, „Nav ierakstu”, „nav datu”. If a field has no fact, omit the sentence. Empty PDF rows are hidden in rendering; do not invent placeholders to fill them.
`;

/**
 * Dīlera „Veiktie darbi” / komentāri uzvar tipisko slimību sarakstu.
 */
export const AI_DOCUMENTED_SERVICE_WORK_RULES = `DOCUMENTED SERVICE WORK (mandatory — EVERY manufacturer, tech risks, inspection, oil field, dealer comments):
- Before writing that a job is due, still open, or a near-term cost, READ THIS order: OFICIĀLĀ DĪLERA DATI tables „Veiktie darbi”, „Servisa vēsture”, dealer „Komentāri”, AutoDNA/CarVertical/RAW service lines. Same rule for VW, Audi, BMW, Mercedes, Volvo, PSA, Toyota, Ford, Hyundai/Kia, Renault, and every other make.
- If the same job is already recorded with date and km (zobsiksna, ūdenssūknis, kārbas eļļa, ķēde, DPF, iesmidzinātāji): do NOT recommend replacing it again. State that the records already show the work. The buyer may ask for the paper invoice to verify - that is a check, not a claim the work was not done.
- Missing proof ≠ overdue mandatory job: if zobsiksna / water pump / tensioner is NOT in the dealer tables, write nepierādīts and ask the seller for documents. Do NOT write that the job is neatliekama un obligāta or already overdue solely because mileage exceeds the OEM interval. If the gap is >30 000 km or >24 months with no official row, assume work may have been done outside the dealer.
- Timing belt vs chain is a construction fact for THIS engine code, not a brand vibe. A recorded zobsiksna maiņa is evidence THIS engine uses a belt. Never write a timing-chain paragraph for that same engine. Never write both ķēde and zobsiksna as facts for one engine. If construction is unclear, say so and keep two short hypotheses - or search THIS engine code - rather than picking one.
- Apply the same discipline to every source comment window, not only the dealer field.`;

/**
 * Noteikumi un pakas ir filtri šim auto, ne šablons visiem.
 */
export const AI_THIS_CAR_ONLY_LOGIC_RULES = `THIS CAR ONLY (mandatory — every agent, EVERY manufacturer): Read the order, then the rule. Do not apply a rule block, pack, or typical-fault list when THIS car’s data does not fit it.
- Sequence for every make (VW, Audi, BMW, Mercedes, Volvo, PSA, Toyota, Ford, Hyundai/Kia, Renault, and others): (1) identify THIS engine code and gearbox from dealer / CSDD / VIN; if code missing, use same-make **kW + cm³ + fuel + year band** as candidate proxy; (2) look up construction and typical faults for THAT code/candidate; (3) only then write. Brand match is not enough.
- **PACK RECONCILE (critical):** packs and prior audits are guidelines. Before writing a pack claim, check it against THIS car’s **kW + cm³ + year + code**. If they conflict (example: a pack or memory says „single turbo / no block cracks” but THIS car is D5244T11 at ~158 kW biturbo), discard the mismatched claim, web-search THIS code/kW, and write the corrected risk. Never publish „šai konstrukcijai nav X” from a pack without that check.
- Do not name a country, system, or fault that this dataset does not support. Do not mention Lietuva or Igaunija if the car has no link to them. Do not copy another engine’s story onto this one just because the badge matches (examples of the failure, not an Audi-only rule: V6 thermostat on a 2.0 TDI; N57 chain on an M57; OM642 intake on an OM651; wet-belt PSA story on a chain Toyota; Volvo single-turbo praise on a T11 biturbo).
- Manufacturer packs are priors ONLY for the MATCHING engine code / displacement / **kW band** / gearbox. If the pack is for another construction, ignore that paragraph. If the code is known, web-search THAT code before writing the fault - even when a same-brand pack is in the prompt.
- Instruction text is not a fact about the car. Winter-salt, wrap, and typical-weakness lines fire only when THIS order’s data (or the computed brief) triggers them.`;

/** Sarunvalodas termini — labie vārdi; sliktie ir BANNED VOCABULARY. */
export const AI_PLAIN_LANGUAGE_TERMS = `PLAIN LATVIAN WORKSHOP TERMS (mandatory — every agent, especially Flash):
Write parts the way a Latvian workshop and a buyer actually say them, not as calqued textbook compounds. Preferred: divmasu spararats, ieplūdes kolektors, hidrotransformators, turbīna, sadales ķēde, zobsiksna, iesmidzinātājs (sprausla), eļļas vāks, EGR, DPF, savienojumu / šļūteņu stāvoklis. A flex joint or hose is stāvoklis, never a translated integrity word. Prefer „dokumenti” over the documentary-proofs calque. If a term sounds translated, replace it with the short workshop word. Banned calques are listed in BANNED VOCABULARY and must never appear.`;

/**
 * Īsi fakti, bez AI-šablona paplašinājumiem (attiecas uz visu klientu tekstu, ne tikai rūsu).
 */
export const AI_PLAIN_FACT_PROSE_RULES = `PLAIN FACT PROSE (mandatory — every agent, every field):
- Prefer short factual Latvian. After the fact, stop. Do not pad with „rada paaugstinātu risku”, „īpaša uzmanība jāpievērš…”, „lai gan X…”, „uzrada-divejadu-ainu”, „pozitiva-puse-ir…”, „tehniski veiksmīgs agregātu salikums”.
- Ask the seller for „dokumenti”, never the documentary-proofs calque.
- Open with what the data shows. Never open with a marketing dualism (good side / bad side), a dual-history verdict, on-one-hand / on-the-other framing, or a brand praise paragraph before the facts.
- Do not invent severity or atmosphere around a clean fact.`;

/**
 * Aizliegti AI-šablona izmaksu / riska frāžu paplašinājumi.
 */
export const AI_NO_AI_COST_FRAMING_RULES = `NO AI COST FRAMING (mandatory — every agent):
- Do NOT write near-term-investment/risk/bill padding, financially-most-significant framing, future-risk padding, or the Kas-NAV-dargs-risks template opener.
- State the component and what THIS car’s data shows. If a famous fault or expensive option is not on THIS car, omit it. Do not write a denial paragraph (uz-so-motoru-neattiecas, saraksta-nav-ekstraprikojums).
- No EUR repair bands. Canonical: AI_NO_ESTIMATED_REPAIR_EUR_RULES.`;

/**
 * Pirms interpretācijas — viss portfelis; konkrētais avota fakts uzvar „tipiski”.
 */
export const AI_CROSS_FIELD_PORTFOLIO_RULES = `CROSS-FIELD PORTFOLIO (mandatory — every agent before interpreting damage, service, or risk):
- Before writing, READ the full order context you were given: tables (AutoDNA, CarVertical, LTAB, CSDD, dealer), ALL already-generated expert comments in other fields, and listing / Fotogrāfiju analīze. Do not pretend a field is isolated when those blocks are in the prompt.
- A concrete named fact in a source (e.g. „aizmugurējais bamperis”, specific panel, specific work) BEATS a generic „tipiski šādiem negadījumiem” example. If the source names the bumper, write bumper replacement/paint — do not invent „piemēram, bampera pārkrāsošanu” as a free hypothesis when the zone is already named. The Latvian word for a car bumper is always „bamperis” (bampera/bamperi) — see BANNED VOCABULARY for the wrong calque some models default to.
- Incidents summary MUST reconcile claim tables with photo-analysis / other comments about the same damage. Tech risks and summary MUST use source comments already written, not only raw tables.
- DEALER ↔ INCIDENTS: official dealer comments and the incidents summary MUST read each other. A dated glass / body / panel / bumper / paint job in OFICIĀLĀ DĪLERA DATI is not a separate story from a claim on a nearby date. If the prompt has „Dīlera remonta un negadījumu sasaiste”, follow that brief: SASAISTĪTS = one event naming both sides; DĪLERIS BEZ NEGADĪJUMA IERAKSTA = dealer fact, do not invent a crash; NEGADĪJUMS BEZ DĪLERA REMONTA = claim without a matching dealer body/glass row. „Tikai šī avota fakti” does not cancel a date-matched pair.
- Anti-repetition still applies: do not rewrite another field’s essay; use it as silent context and add only THIS field’s job.`;

/**
 * Avotu lauki (CSDD, AutoDNA, CarVertical, LTAB, dīlera dati u.c.) konstatē faktus.
 * Interpretācija un ieteikumi pieder tikai norādītajiem laukiem.
 */
export const AI_SOURCE_FIELDS_FACTS_ONLY_RULES = `SOURCE FIELDS = FACTS ONLY (mandatory — every per-source comment window: CSDD, AutoDNA, CarVertical, LTAB, AUTO RECORDS / dealer, VIN registry / Dānijas reģistri, Izsoļu portālu arhīvs, ASV, seller portrait, photos, listing photo analysis):
- State ONLY what THIS source recorded (date, km, amount, zone, code, name, status). After the fact, STOP. Do not add a second sentence that explains, hedges, or expands the fact.
- FORBIDDEN in source fields (these are sentence expansions, not facts): „ierakstu trūkums neizslēdz…”, „varētu būt novērsti bez apdrošinātāju starpniecības”, „notikuši pirms importa”, „Digitālie dati var neuzrādīt krāsotus elementus”, krāsas biezuma mērītājs / mikroni / „virsbūves stāvokļa pārbaude klātienē”, invented headings such as „Datu specifika”. That material belongs ONLY in summary fields.
- EXPANSIONS AND ADDED SENTENCES are allowed ONLY in summary sections: „3. Kopsavilkums”, „NOBRAUKUMA VĒSTURES KOMENTĀRS”, „NEGADĪJUMU VĒSTURES KOPSAVILKUMS”. „1. Tehnisko risku analīze” analyses THIS car’s aggregates; „2. Ieteikumi” is the inspection checklist (including paint gauge). Neither of those jobs may be copied into a source comment.
- No risk label, severity verdict, or recommendation after the fact. No „kas prasa detalizētu izvērtējumu”, „kas ir svarīgi noskaidrot”, „signāls, kas jāpārbauda”, no „galvenais pirkuma risks” bolted onto a plain registry row.
- GENERIC INSPECTION ADVICE („obligāti jāveic pilna diagnostika”, „jāpārbauda ar krāsas biezuma mērītāju”) is NEVER a source-comment sentence.
- If there is nothing beyond the bare fact, stop. A short fact is better than a rounded-off paragraph.
- LENGTH: one paragraph when that covers the unique facts. If THIS source has many facts, write more paragraphs. Ceiling 2–3 applies only to thin source-only generation. Operator paste / long existing draft: no ceiling. Do not invent a heading such as „Datu specifika” or a second section to hit a 2–4 / 350–800 quota.`;

/**
 * Balstīts uz 96 reālu dīlera komentāru izlases analīzi (2026-09-19 backup). Konstatētās problēmas:
 * ~40% komentāru sāk ar identisku frāzi "Oficiālā dīlera dati sniedz/apstiprina..."; garums svārstās
 * no 73 līdz 3654 rakstzīmēm (bez disciplīnas); 14 no 96 nemaz nelieto <strong> virsrakstu struktūru,
 * kamēr vairums lieto tieši 3 virsrakstus. Šis bloks fiksē novēroto labo struktūru kā standartu.
 */
export const AI_DEALER_COMMENT_CONSTRUCTION_RULES = `DĪLERA / AUTO RECORDS „Komentārs” LAUKA UZBŪVE (mandatory — AUTO RECORDS / dealer „Komentārs” field only):
- NO GENERIC OPENER: never start the field with "Oficiālā dīlera dati sniedz...", "Oficiālā dīlera dati apstiprina...", "Dīlera dati precizē..." or any variant that names the SOURCE before the FACT. Start the first sentence with the concrete fact itself (engine code, gearbox, dated service entry, equipment code). The reader already knows this is dealer data from the field's own heading; repeating that as a sentence-opener is filler, not information.
- CANONICAL 3-ROLE STRUCTURE (use only the roles THIS order's data actually supports; skip a role entirely rather than padding it):
  1) Agregātu / aprīkojuma identifikācija: what THIS source uniquely confirms about the exact car (engine code, gearbox code, factory equipment, color code, type/fleet code) — the identification facts other sources usually cannot give.
  2) Servisa / remontu vēsture: concrete dated service or repair events (date + km + work). Never compute or list oil-change km/month gaps here; that math lives only in „Eļļas maiņas intervāli” (see AI_OIL_CHANGE_INTERVAL_RULES) — mention THAT service happened, not the gap arithmetic.
  3) Nobraukuma / datu saskaņa: one short cross-check sentence on whether the dealer's km points line up with CSDD/AutoDNA/CarVertical. This is a one-line confirmation, not a mileage-forensics essay — that belongs to the mileage comment / summary.
- A 4th role, „Eļļas maiņas intervāli”, is used ONLY when the calling instructions explicitly ask this field to fold in the oil-interval math (automatic post-ingest generation replacing the separate field). Do not add it otherwise; outside that explicit instruction the OIL-INTERVAL EXCLUSION rule below still applies.
- Each role gets its own „<strong>Virsraksts</strong><br>” heading (3-6 words, no trailing period) followed by the paragraph. Use the SAME heading-then-paragraph shape for every role present; never leave one role as a bare paragraph with only inline **bold** while the others use headings.
- HARD LINE BREAKS (mandatory): each role heading MUST sit on its own line, then a blank line, then that role's paragraph. NEVER glue the next heading onto the previous sentence (forbidden: "tiltā. Servisa un remontu vēsture Digitālajā"). If you emit HTML, put "<br /><br />" between roles. If you emit plain text, emit heading, blank line, paragraph, blank line, next heading.
- LENGTH DISCIPLINE: no fixed character or role-count ceiling for this field — explain every distinct fact-cluster the dealer data actually contains. A long, valuable service/repair history (many dated events) deserves a fully explained paragraph, not a compressed one-liner; split into multiple sentences or, if genuinely distinct, an extra role rather than dropping facts. If the source data is thin, write less — do not stretch a one-fact source into padded paragraphs just to look complete. A short, honest fact is always better than an invented sentence.
- Sentence job inside each paragraph: state every concrete fact (date, km, work, code) this order's data actually has for that role; add a short "why it matters for THIS car" clause only when it genuinely adds something (confirms/contradicts another source, fills a gap) — never a filler sentence like "šī informācija ir vērtīga pircējam" that restates the fact without adding content, and never omit a documented repair/service just to stay short.
- INCIDENT JOIN (role 2): if the prompt marks a glass / body / panel / bumper / paint job as SASAISTĪTS with a claim, name that claim (date, source, amount if present) in the same repair paragraph. Do not leave the dealer work and the accident as two unread stories.
- <br> vs <br /> — pick one style for the whole field and keep it consistent within this field.`;

/**
 * FLASH MAX vispirms raksta iekšējo avotu salīdzinājumu. Pārējie lauki to lasa kā kopskatu.
 */
export const AI_SOURCES_COMPARISON_OVERVIEW_RULES = `CASE OVERVIEW / AVOTU SALĪDZINĀJUMS (mandatory when the user prompt contains that block or a mileage-forensics brief):
- The „AVOTU SALĪDZINĀJUMS” block is the case overview for THIS order. Other fields take facts from it; they do not rewrite the whole overview.
- Keep the split: recorded facts stay facts; interpretations stay interpretations (several scenarios allowed); what the overview marks unknown MUST stay unknown.
- Forbidden: upgrading „nezinām” / „nav līdz galam izskaidrojams” into „ļoti iespējams, ka odometrs koriģēts”, proven manipulation, or a single chosen story.
- Deterministic mileage briefs (temps, avotu neatkarība, odometra robežas) are calculated numbers. Copy the figures. Do not re-divide km by days. Do not treat an arithmetic ceiling as a claim that the car was driven that far.
- If two sources share the same readings (constant km offset), they are NOT independent confirmation.
- Anti-repetition still applies: do not paste the overview into every source comment.`;

/** Īsi, koncentrēti lauki — apkopojumi un salīdzinājumi tikai kopsavilkumā. */
export const PROVIN_COMMENT_BREVITY_RULES = `BREVITY & FOCUS (mandatory for every ✨ field):
- OPERATOR NOTES OVERRIDE: if „OPERATORA KOMANDAS” or a long „Esošais melnraksts” are present, completeness and scope beat this brevity block. Do not drop operator topics to stay short; do not pad when the operator limited the job. Long operator paste / long draft: character and paragraph ceilings do NOT apply.
- Each comment answers ONE question: what does THIS source / THIS field add to the audit? Say it in the first paragraph.
- DEFAULT LENGTH follows LENGTH CEILINGS (ceilings, not targets). Thin data → short (often 1 sentence or 1 paragraph). Rich data → longer, several paragraphs. Flagship fields live only in those fields' task blocks - do not copy 4-7 technical-risk sections into a thin source comment.
- SOURCE COMMENTS: follow LENGTH CEILINGS. Thin data stays short. Rich data may use more paragraphs. Merge related facts. If the operator pasted a long comment, keep that density.
- Cross-source comparison is NOT this field's job: at most ONE short sentence, and only when a conflict changes the conclusion. Discussed facts and, if needed, a workshop-check conclusion belong to „3. Kopsavilkums”.
- Never retell a fact the client already reads in another section or source comment. If this source only confirms it: one sentence („Saskan ar …”) and move on.
- Cut: greetings, restating the section title, „kopumā var secināt”, „svarīgi atzīmēt”, „ko tas nozīmē šim darījumam”, „tomēr līdzās šim atrodama arī”, generic „jāpārbauda klātienē” without naming the component, closing paragraphs that repeat earlier content.
- Write facts, then the buyer’s next step. Do not stretch a fact into a second sentence of atmosphere. A short, precise comment is the goal, not filling space.`;

const UNICODE_DASH_CHAR_RE = /[\u2012\u2013\u2014\u2015\u2212]/g;

/** Unicode em/en dashes look like AI; client copy uses ASCII hyphen. */
export function applyProvinHumanDashes(text: string): string {
  if (!text) return text;
  return text.replace(UNICODE_DASH_CHAR_RE, (_ch, offset: number) => {
    const prev = offset > 0 ? text[offset - 1] ?? "" : "";
    const next = offset + 1 < text.length ? text[offset + 1] ?? "" : "";
    if (/\d/.test(prev) && /\d/.test(next)) return "-";
    if (/\s/.test(prev) && /\s/.test(next)) return "-";
    if (/\p{L}/u.test(prev) && /\p{L}/u.test(next)) return " - ";
    return "-";
  });
}

/**
 * Drošības tīkls priekš "1. Tehnisko risku analīze", apskates ieteikumiem un kopsavilkuma —
 * šiem laukiem AI_NO_ESTIMATED_REPAIR_EUR_RULES aizliedz PILNĪGI visas € / EUR summas, arī
 * tās, kas modelis var "nokopēt" no agregātu pakām (tur EUR ir tikai iekšējai kalibrācijai).
 * Prompta instrukcija ir pirmā aizsardzības līnija; šī funkcija ir pēdējā — izmet teikumu,
 * kurā parādās € vai EUR, nevis mēģina "labot" skaitli (drošāk par pusuztaisītu teikumu).
 */
const SOURCE_FIELD_EXPANSION_HEADING_RE = /^\s*datu specifika\s*$/i;
const SOURCE_FIELD_EXPANSION_SENTENCE_RE =
  /krāsas (?:biezuma )?mērītāj|digitālie dati var neuzrādīt|neizslēdz iespējam|varētu būt novērsti|bez apdrošinātāju starpniec|pārliecinātos par remonta|virsbūves stāvokļa pārbaude klātien|nefiksētu (?:negadījumu|bojājum)|kosmētisku krāsojumu|\b(?:µm|μm|mikron)/i;

/**
 * Avotu komentāru drošības tīkls: izmet teikumus, kas paplašina faktu
 * (mērītājs, „neizslēdz iespējamus”, „Datu specifika”). Promptam jāstrādā vispirms.
 */
export function stripSourceFieldExpansions(text: string): string {
  if (!text) return text;
  return text
    .split(/\n\n+/)
    .map((para) => {
      const lines = para.split("\n").filter((line) => !SOURCE_FIELD_EXPANSION_HEADING_RE.test(line.trim()));
      const kept = lines
        .map((line) =>
          splitIntoSentences(line)
            .filter((s) => !SOURCE_FIELD_EXPANSION_SENTENCE_RE.test(s))
            .join("")
            .trim(),
        )
        .filter(Boolean);
      return kept.join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function stripUnauthorizedEuroAmounts(text: string): string {
  if (!text) return text;
  return text
    .split(/\n\n+/)
    .map((para) => {
      const lines = para.split("\n");
      const kept = lines.map((line) =>
        dropEuroAmountSentences(splitIntoSentences(line)).join("").trim(),
      );
      // Rindkopa bez satura zem virsraksta vairs neko nedod — met ārā visu.
      if (lines.length > 1 && !kept.slice(1).some(Boolean)) return "";
      return kept.filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Iekšējās noplūdes (QA instrukcija, D1–D25, kartē, PR kodi, HECK/AGR-Kühler,
 * „Dzinēja kods noteikts pēc jaudas…”). Klienta tekstā paliek latvisks fakts.
 */
export function stripInternalClientLeaks(text: string): string {
  if (!text) return text;
  let out = text;
  out = out.replace(/Atzīmē teikumus[^.!\n]*kartē[^.!\n]*[.!]?/gi, "");
  out = out.replace(/Pārraksti tikai tos\.?/gi, "");
  out = out.replace(
    /Dzinēja kods noteikts pēc jaudas(?: un tilpuma)?(?:; to apstiprina marķējums uz bloka)?\.?/gi,
    "",
  );
  out = out.replace(/\(D(?:[1-9]|[1-9]\d)(?:\s[^)]*)?\)/g, "");
  out = out.replace(/\bD(?:[1-9]|[1-9]\d)(?=\s+\d{1,2}[./]|\s+\d{4}|\s*:)/g, "");
  out = out.replace(/\bHECK\b(?:\s*\(\s*aizmugures piedziņa\s*\))?/g, "aizmugurējā piedziņa");
  out = out.replace(/\bALLR\b/g, "pilnpiedziņa");
  out = out.replace(/\bStūre\s+LL\b/g, "Stūre: kreisā stūre");
  out = out.replace(/\bVirsbūve\s+TOU\b/g, "Virsbūve: universālis");
  out = out.replace(/\bVirsbūve\s+SAV\b/g, "Virsbūve: apvidus");
  out = out.replace(/AGR[-\s]?K(?:ü|ue|u)hler/gi, "EGR dzesētājs");
  out = out.replace(/\bPR[-/\s][A-Z0-9]{2,4}\b/g, "");
  out = out.replace(/\bSA\s?\d{3,4}[A-Z]?\b/g, "");
  out = out.replace(/\bS\d{3,4}[A-Z]\b/g, "");
  out = out.replace(/nav kartē/gi, "nav datos");
  out = out.replace(/ja kartē/gi, "ja datos");
  out = out.replace(/avoti kartē/gi, "avoti datos");
  out = out.replace(/ieliec kartē/gi, "iekļauj datos");
  out = out.replace(/\s*šajā auditā/gi, "");
  out = out.replace(/\s*šajā atskaitē/gi, "");
  out = out.replace(/operatora norād\w*/gi, "");
  out = out.replace(/saskaņā ar (?:operatora )?norādēm/gi, "");
  out = out.replace(/FLASH\s+MAX/g, "");
  out = out.replace(/\bKB:/g, "");
  out = out.replace(/\bšim automašīn/gi, "šai automašīn");
  out = out.replace(/[ \t]{2,}/g, " ");
  out = out.replace(/\n{3,}/g, "\n\n");
  out = out.replace(/^[.,;:\t ]+/gm, "");
  return out.trim();
}

export function applyProvinReportCopyVocabulary(text: string): string {
  let out = applyBannedVocabularyReplacements(applyProvinHumanDashes(text));
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
    [/\bAutomobiļiem\b/g, "Automašīnām"],
    [/\bautomobiļiem\b/g, "automašīnām"],
    [/\bAutomobiļu\b/g, "Automašīnu"],
    [/\bautomobiļu\b/g, "automašīnu"],
    [/\bAutomobilim\b/g, "Automašīnai"],
    [/\bautomobilim\b/g, "automašīnai"],
    [/\bAutomobiļa\b/g, "Automašīnas"],
    [/\bautomobiļa\b/g, "automašīnas"],
    [/\bAutomobilis\b/g, "Automašīna"],
    [/\bautomobilis\b/g, "automašīna"],
    [/labvēlīg\w*\s+signāl\w*(?:\s+datos)?/gi, "labs rādījums datos"],
    [/labvēlīg\w*\s+faktor\w*/gi, "tas palīdz"],
    [/dokumentār\w*\s+pierādījum\w*/gi, "dokumenti"],
    [/tuvāk(?:ā|a)\s+laika\s+(?:ieguldījum\w*|rēķin\w*|risk\w*|izmaks\w*|profilaks\w*|naudas\s+punkt\w*|punkt\w*)/gi, "aktuālais mezgls"],
    [/finansiāli\s+nozīmīgāk\w*/gi, "būtisks"],
    [/nākotnes\s+risk\w*/gi, "risks"],
    [/uzrāda\s+divējād\w*\s+ain\w*/gi, "datos redzama šāda aina"],
    [/Pozitīvā\s+puse\s+ir/gi, "Datos"],
    [/pozitīvā\s+puse\s+ir/gi, "datos"],
    [/Dzinēja\s+identifikācija/g, "Dzinēja kods"],
    [/dzinēja\s+identifikācija/g, "dzinēja kods"],
    [/datu\s+vakuum\w*/gi, "datu neesamība"],
    [/informācijas\s+vakuum\w*/gi, "datu neesamība"],
    [/\bVakuums(?!ūkn)/g, "Trūkums"],
    [/\bvakuums(?!ūkn)/g, "trūkums"],
    [/\bpie\s+šī\s+nobraukuma\b/gi, "ar šo nobraukumu"],
    [/\bpie\s+nobraukuma\b/gi, "ar nobraukumu"],
    [/\bStatuss\s+unpaid\b/gi, "Statuss: nav apmaksāts"],
    [/\bStatuss\s+paid\b/gi, "Statuss: apmaksāts"],
  ];
  for (const [re, rep] of replacements) out = out.replace(re, rep);
  out = out.replace(/\bpie\s+(\d[\d\s.]*)\s*km\b/gi, "ar nobraukumu $1 km");
  out = out.replace(/riska\s+kartē/gi, (match, offset: number, full: string) => {
    const before = full.slice(Math.max(0, offset - 2), offset);
    return offset === 0 || /[\n.!?]\s*$/.test(before) ? "Datos" : "datos";
  });
  out = replaceCrankshaftDamperWording(out);
  out = stripInternalClientLeaks(out);
  return stripForbiddenPersonaNouns(out);
}

const DAMPER_CANON = "kloķvārpstas skriemelis (demferis)";
const DAMPER_SRC_RE =
  /(?:kloķvārpstas\s+)?(?:vibrācij[au]|svārstību)\s+slāpētāj\w*(?:\s*\(\s*(?:skriemelis|demferis)\s*\))?/gi;
const DAMPER_DOUBLE_RE = /(?:kloķvārpstas\s+skriemelis\s*\(\s*demferis\s*\)\s*){2,}/gi;

/** Idempotents: jau kanoniskais „demferis” paliek viens. */
export function replaceCrankshaftDamperWording(text: string): string {
  if (!text) return text;
  return text.replace(DAMPER_SRC_RE, DAMPER_CANON).replace(DAMPER_DOUBLE_RE, DAMPER_CANON);
}

function stripClientMarkdownMarkers(text: string): string {
  let t = text.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/\*/g, "");
  return t;
}

/** LV kārtas skaitļi („2019. gada”, „13. novembrī”) — punkts nav teikuma beigas. */
const LV_ORDINAL_DOT_RE = /\b(\d{1,4})\./g;
const LV_DATE_OPENER_RE =
  /^\s*(?:\d{4}\.\s*gad|\d{1,2}\.\s*(?:janvār|februār|mart|aprīl|maij|jūnij|jūlij|august|septembr|oktobr|novembr|decembr))/i;

function maskLatvianOrdinalDots(text: string): string {
  return text.replace(LV_ORDINAL_DOT_RE, "$1");
}

function looksLikeLatvianDateOpener(line: string): boolean {
  return LV_DATE_OPENER_RE.test(line);
}

/** Pirmais teikuma punkts, kas nav LV kārtas skaitlis pirms mazā burta (2019. / 13.). */
function firstRealSentenceEnd(text: string): number {
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;
    if (!isRealSentencePunctuation(text, i)) continue;
    if (/^\s+\S/.test(text.slice(i + 1))) return i;
  }
  return -1;
}

/** Dīlera „Komentārs” lomu virsraksti - garākie pirmie, lai neiegrieztu īsāku formu. */
export const DEALER_COMMENT_ROLE_HEADINGS = [
  "Agregātu un aprīkojuma identifikācija",
  "Agregātu / aprīkojuma identifikācija",
  "Agregātu identifikācija",
  "Servisa un remontu vēsture",
  "Servisa / remontu vēsture",
  "Nobraukuma un datu saskaņa",
  "Nobraukuma / datu saskaņa",
  "Eļļas maiņas intervāli",
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Gemini Flash bieži salīmē nākamo lomu virsrakstu pie iepriekšējā teikuma.
 * Iesprauž tukšu rindu pirms zināma virsraksta un pašu virsrakstu savā rindā.
 */
export function splitDealerCommentRoleHeadings(raw: string): string {
  let t = (raw ?? "").replace(/\r\n/g, "\n");
  if (!t.trim()) return t;
  t = t.replace(/<\/?strong>/gi, "");
  t = t.replace(/<br\s*\/?>/gi, "\n");
  const headings = [...DEALER_COMMENT_ROLE_HEADINGS].sort((a, b) => b.length - a.length);
  for (const heading of headings) {
    const re = new RegExp(
      `(?:^|(?<=[.!?:]\\s)|(?<=\\n))${escapeRegExp(heading)}(?![\\p{L}])[ \\t]*`,
      "gu",
    );
    t = t.replace(re, (match, offset: number, full: string) => {
      const before = offset > 0 ? full[offset - 1]! : "";
      const after = full[offset + match.length] ?? "";
      let prefix = "";
      if (offset > 0) {
        const prev2 = full.slice(Math.max(0, offset - 2), offset);
        if (prev2 === "\n\n") prefix = "";
        else if (before === "\n") prefix = "\n";
        else prefix = "\n\n";
      }
      // Mazais burts aiz virsraksta = garāka virsraksta turpinājums („… intervāli un faktiskā vēsture”).
      if (/^\p{Ll}/u.test(after)) return `${prefix}${match}`;
      const suffix = after === "\n" || after === "" ? "" : "\n";
      return `${prefix}${heading}${suffix}`;
    });
  }
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

function looksLikeHeadingLine(line: string): boolean {
  const t = line.trim();
  if (!t || t.length > 90) return false;
  if (/[.!?].+/.test(maskLatvianOrdinalDots(t))) return false;
  return true;
}

function lineToHeadingBody(line: string): string {
  const t = line.trim();
  const wrapped = t.match(/^\*{1,2}\s*([^*\n]+?)\s*\*{1,2}\.?\s*(.*)$/);
  if (wrapped) {
    const heading = wrapped[1]!.replace(/\.\s*$/, "").trim();
    const rest = wrapped[2]!.trim();
    return rest ? `${heading}\n${rest}` : heading;
  }
  const orphan = t.match(/^\*{1,2}\s+(.*)$/);
  const plain = orphan ? orphan[1]!.trim() : t;
  if (looksLikeLatvianDateOpener(plain) || /^\d{4}\.\s/.test(plain)) {
    return plain;
  }
  const end = firstRealSentenceEnd(plain);
  if (end >= 3 && end <= 80) {
    const heading = plain.slice(0, end).replace(/[.!?]\s*$/, "").trim();
    const rest = plain.slice(end + 1).trim();
    const wordCount = heading.split(/\s+/).filter(Boolean).length;
    if (rest && wordCount >= 2 && wordCount <= 12 && !/^\d/.test(heading)) {
      return `${heading}\n${rest}`;
    }
  }
  return plain;
}

function stripListPrefix(line: string): string {
  if (looksLikeLatvianDateOpener(line) || /^\s*\d{4}\.\s/.test(line)) return line;
  return line.replace(/^\s*[-•*–]\s+/, "").replace(/^\s*\d{1,2}[\.)]\s+/, "");
}

function convertExpertBlockToHeadingBody(block: string): string {
  let p = block.trim();
  if (!p) return "";
  p = p
    .split("\n")
    .map(stripListPrefix)
    .join("\n");
  const lines = p
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  if (lines.length >= 2 && looksLikeHeadingLine(lines[0]!)) {
    let headingLines = 1;
    // Virsraksts pārnests divās rindās: 2. rinda bez punkta un sākas ar mazo burtu.
    if (lines.length >= 3 && /^\p{Ll}/u.test(lines[1]!) && looksLikeHeadingLine(lines[1]!)) {
      const joined = `${lines[0]} ${lines[1]}`;
      if (joined.length <= 90 && !/[.!?]/.test(maskLatvianOrdinalDots(lines[1]!))) headingLines = 2;
    }
    const heading = lines.slice(0, headingLines).join(" ").replace(/[.!?]\s*$/, "");
    return `${heading}\n${lines.slice(headingLines).join(" ")}`;
  }

  return lines.map(lineToHeadingBody).join("\n\n");
}

export type ExpertCommentNormalizeOpts = {
  /** Dīlera lomu virsraksti. Tehnisko risku laukam - false. */
  splitDealerRoleHeadings?: boolean;
};

/**
 * Klienta komentārs: virsraksts savā rindā, tad rindkopa. Bez *, ** un citiem Markdown.
 * Veco „**Ievads.** teksts” formu pārveido; nenoslēgtus Gemini `** ` prefiksus noņem.
 */
export function toExpertHeadingBodyPlain(raw: string, opts?: ExpertCommentNormalizeOpts): string {
  const source = (raw ?? "").replace(/\r\n/g, "\n");
  const t = opts?.splitDealerRoleHeadings === false ? source : splitDealerCommentRoleHeadings(source);
  if (!t) return t;
  const blocks = t
    .split(/\n\n+/)
    .map(convertExpertBlockToHeadingBody)
    .filter(Boolean)
    .join("\n\n");
  return stripClientMarkdownMarkers(blocks);
}

function formatExpertParagraphs(t: string, opts?: ExpertCommentNormalizeOpts): string[] {
  const plain = toExpertHeadingBodyPlain(t, opts);
  return plain.split(/\n\n+/).filter(Boolean);
}

/**
 * Komentāra forma (vārdu krājums, rindkopas) - bez garuma nogriešanas.
 * Nogriezts teksts pēc ģenerēšanas nozīmē, ka apmaksātais saturs tiek izmests.
 */
export function normalizeProvinExpertAiComment(
  raw: string | undefined | null,
  opts?: ExpertCommentNormalizeOpts,
): string {
  const t = applyProvinReportCopyVocabulary((raw ?? "").trim());
  if (!t) return t;
  return formatExpertParagraphs(t, opts).join("\n\n");
}

const TECH_RISK_SECTION_TITLE_RE = /^(?:1\.\s*)?Tehnisko risku analīze\.?$/i;

/** Noņem pirmo rindu, ja tā ir sadaļas nosaukums (ne mezgla virsraksts). */
export function dropTechnicalRisksSectionTitle(text: string): string {
  const t = (text ?? "").replace(/\r\n/g, "\n");
  if (!t.trim()) return t;
  const lines = t.split("\n");
  if (!TECH_RISK_SECTION_TITLE_RE.test((lines[0] ?? "").trim())) return t;
  return lines.slice(1).join("\n").replace(/^\n+/, "");
}

/**
 * Gemini dažkārt izejā ieliek angļu iekšējo plānu (identifikācija, meklējumi,
 * self-correction), nevis tikai klienta latviešu komentāru. Thought daļas
 * filtrs to neredz, jo tas ir parasts teksts.
 */
export const AI_PLANNING_LEAK_RE =
  /I have analyzed|Internal Analysis|Risk Prioritization|Structure of the Output|Web Search\s*[&+]?\s*Knowledge|This plan ensures|I will now generate|Aggregate Identification\s*:|Final Review\s*:|Search results confirm/i;

const PLANNING_HEADING_LINE_RE =
  /^(?:Internal Analysis|Risk Prioritization|Structure of the Output|Web Search|Final Review|Aggregate Identification|#\d+\s)/i;

function hasLatvianClientProse(text: string): boolean {
  return (
    /[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/.test(text) &&
    /automašīn|jāpārbaud|nobraukum|tehnisk|dzinēj|eļļas|koroz|piekare|apskate|sliekš|riteņu ark/i.test(
      text,
    )
  );
}

function looksLikeLatvianClientHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 90) return false;
  if (AI_PLANNING_LEAK_RE.test(t) || PLANNING_HEADING_LINE_RE.test(t)) return false;
  return /[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/.test(t);
}

export function looksLikeLeakedAiPlanning(raw: string | undefined | null): boolean {
  return AI_PLANNING_LEAK_RE.test(raw ?? "");
}

/** Noņem angļu plāna preambulu; ja latviešu komentāra nav, atstāj samaksāto tekstu. */
export function stripLeakedAiPlanningPreamble(raw: string | undefined | null): string {
  const source = (raw ?? "").trim();
  if (!source || !looksLikeLeakedAiPlanning(source)) return source;

  const lines = source.split("\n");
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (looksLikeLatvianClientHeading(line) && hasLatvianClientProse(lines.slice(i + 1).join("\n"))) {
      return source.slice(offset).trim();
    }
    offset += line.length + 1;
  }

  const glued = /[.!?]([A-ZĀČĒĢĪĶĻŅŠŪŽ][^\n]{6,80})\n/.exec(source);
  if (glued?.[1] && looksLikeLatvianClientHeading(glued[1])) {
    const start = glued.index + 1;
    const cut = source.slice(start).trim();
    if (hasLatvianClientProse(cut)) return cut;
  }

  return source;
}

/**
 * Pēcapstrāde nedrīkst iztukšot jau samaksātu atbildi (piem. tikai `*` / Markdown).
 * Ja normalizācija izmet visu, paliek vārdu krājuma versija.
 */
export function finalizeProvinExpertAiComment(raw: string | undefined | null): string {
  const source = stripLeakedAiPlanningPreamble(raw ?? "");
  if (!source) return "";
  const normalized = normalizeProvinExpertAiComment(source);
  return normalized.trim() || applyProvinReportCopyVocabulary(source);
}

/**
 * Avotu drošības tīkls nedrīkst atdot tukšu lauku, ja Gemini uzrakstīja tikai
 * „Datu specifika” / mērītāja eseju. Labāk atstāt samaksāto tekstu.
 */
export function keepSourceCommentAfterExpansionStrip(generated: string): string {
  const source = generated.trim();
  if (!source) return "";
  return stripSourceFieldExpansions(source).trim() || source;
}

/** Gatavo PROVIN audita atskaišu komentāru paraugi — few-shot stils ✨ ģeneratoram. */
export const PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES = `FEW-SHOT STYLE EXAMPLES (match this heading-then-paragraph structure, restrained tone - and this LENGTH: these are complete comments, not excerpts). NEVER copy *, ** into the output.

Example 1 (CSDD - avota fokuss, nevis pilna nobraukuma eseja):
"Pirmā reģistrācija Latvijā
CSDD datos automašīna Latvijā reģistrēta 2016. gada 22. janvārī, kā izcelsmes valsti norādot Vāciju; īpašnieku maiņu ķēde pēc importa ir īsa, bez ierobežojumu atzīmēm.

Tehnisko apskašu tendence
Pamata pārbaudi ar pirmo reizi nav izgājusi sešas reizes; atkārtojas korozija, eļļas noplūdes un priekšējā tilta brīvkustības. Šo atkārtoto defektu sēriju pārējie avoti nefiksē."

Example 2 (CSDD - novērsti veci defekti vs rūsa/atgāzes):
"Tehnisko apskašu vēsture
2023. gada apskatē fiksēta priekšējā tilta brīvkustība un nefunkcionējošs gabarītlukturis. Nākamajā un aiznākamajā apskatē šie punkti vairs nav atzīmēti.

Rūsa un atgāzes
Ja TA kādreiz fiksējusi nesošo elementu koroziju vai paaugstinātas cietās daļiņas / dūmainību, tas paliek uzmanības punkts arī vēlākos gados: kvalitatīvi novērst ir sarežģīti un dārgi, pat ja nākamā apskate ir tīra. Vēsturiski augsti dūmainības rādītāji (2.32, 2.95) pret pēdējo 0.58 paliek uzmanības punkts: tas nav pierādījums, ka DPF vai degvielas sistēma ir bez riska. Šie punkti datos jau novērstus defektus (tilta brīvkustība, lukturis) neatceļ."

Example 3 (negadījumi - kontekstuāla summas interpretācija):
"Apdrošināšanas ieraksts
CarVertical fiksē 2019. gada jūlijā Vācijā reģistrētu negadījumu ar zaudējumu diapazonu 5 001-10 000 €; LTAB un AutoDNA šim periodam summu neuzrāda. Automašīna tobrīd bija ~8 gadus vecs vidējā segmenta universālis, tāpēc šāda summa drīzāk liecina par būtisku, ne tikai kosmētisku remontu.

Avotu sakritība
LTAB un AutoDNA šim periodam summu neuzrāda. CarVertical nosauc datumu, valsti un zaudējumu diapazonu."

Example 3b (KOPSAVILKUMAM / negadījumu kopsavilkumam - kontekstuāla interpretācija; AVOTA laukā, piem. AutoDNA komentārā, raksti TIKAI faktu daļu bez „tāpēc…” teikuma):
"Zaudējumu apjoms kontekstā
AutoDNA fiksē 2022. gada februārī Vācijā apdrošināšanas izmaksu 6 840 € ar bojātu priekšējo bamperi un labo priekšējo lukturi. Automašīnai tobrīd bija ~1 gads, tā ir premium klase ar adaptīvo apgaismojumu un sensoriem, tāpēc šāda summa bieži atspoguļo dārgas OEM detaļas un dīlera darbu, ne obligāti nesošo elementu bojājumu.

Ko pārbaudīt klātienē
Virsbūves pārbaude joprojām nepieciešama (šuvju platums, radars un kamera aiz bampera), taču pēc summas vien smagu negadījumu secināt nevar - jāvērtē kopā ar bojājumu zonām, vecumu un klasi."

Example 4 (cena / tirgus):
"Cenas pozīcija Latvijas tirgū
Sludinājuma cena 14 900 € atbilst vidējam ss.lv līmenim šim modeļa gadam un dzinējam, tomēr nobraukums 218 000 km un ierobežota servisa dokumentācija samazina vērtību pret līdzīgiem auto ar pilnu vēsturi.

Importa konteksts
IRISS dati rāda līdzīgus eksemplārus Vācijas wholesale segmentā 11 500-12 800 € apmērā; pēc loģiskā uzcenojuma un reģistrācijas izmaksām telpa cenas sarunām ir ierobežota."

Example 5 (AutoDNA - bojājumi; viens teikums salīdzinājumam):
"Zaudējumu ieraksts
AutoDNA fiksē 2018. gada martā Vācijā reģistrētu negadījumu ar zaudējumu 2 930 €, bojājot priekšējo labo sānu un priekšējo kreiso durvi; salīdzinājumā ar CarVertical datums sakrīt, bet šis avots dod precīzāku summu un bojājumu zonas.

Avotu salīdzinājums
CSDD un LTAB šim periodam izmaksu neuzrāda."

Example 6 (AUTO RECORDS / dīlera dati):
"Dīlera serviss un ekspluatācijas veids
Dīlera datos automašīnai norādīts tipa kods, kas atbilst taksometra vai komerciālai ekspluatācijai (937), un servisa žurnālā redzamas apkopes ik 15 000-18 000 km Vācijā pirms ievešanas. Šo signālu CSDD un AutoDNA tabulas nesniedz.

Km atskaites punkts
Pēdējais dīlera fiksējums (198 420 km, 2023. gada augusts) sakrīt ar pārējo avotu līkni."

Example 7 (NOBRAUKUMA VĒSTURES KOMENTĀRS - vienīgā vieta pilnai apkopošanai):
"Hronoloģija un lineārums
Pieejamajos avotos nobraukuma līkne ir lineāra ar vidēji 22 000-24 000 km gadā pēc pirmās reģistrācijas Vācijā 2014. gadā; izteikti kritumi nav fiksēti. Ieraksti atbilst drīzāk šosejas režīmam ar zemāku motorstundu slodzi nekā tipiskam pilsētas auto.

Datu blīvums un iztrūkstošie periodi
Ieraksti ir regulāri (reizi 6-12 mēnešos), tomēr pirms ievešanas Latvijā ir astoņu gadu periods bez datiem (2007-2015). Kopā ar dīlera kodu 937 tas pieļauj, ka faktiskais Eiropas nobraukums bijis augstāks, taču pieejamie ieraksti to neapstiprina."`;

/** Vienots komentāru vizuālais formāts — ✨ avoti, PDF, cena, nobraukums u.c. */
export const AI_EXPERT_PARAGRAPH_PRESENTATION = `
VISUAL PRESENTATION (mandatory for all expert client PDF comments):
${PROVIN_REPORT_COPY_VOCABULARY}

${PROVIN_RESTRAINED_TONE_RULES}

${PROVIN_COMMENT_BREVITY_RULES}
- STRUCTURE: Write sections separated by a blank line. NEVER start any line with "- ", "• ", "* ", "– ", or "1." / "2." — no bullet lists, no numbered lists. This applies to EVERY expert field, including ieteikumi klātienes apskatei, pārdevēja portrets, avotu komentāri, nobraukums, negadījumi, cena and kopsavilkums.
- NO MARKDOWN SYMBOLS: NEVER output *, **, __ , \` or other formatting markers. Not as bullets, not as bold, not as leftover „** ” at line start. Dates, km, EUR and option codes stay plain text.
- SECTION SHAPE: Each section = a short heading on its OWN line (3-10 words, no period needed) then the paragraph on the next line. Example:
Nobraukuma vēsture Latvijā
CSDD datos automašīna Latvijā reģistrēta 2016. gada 22. janvārī.
- SCANABILITY: Keep each paragraph to 2-4 sentences except per-source comments (1-2 sentences; do not invent a second heading to fill a quota). When OPERATORA KOMANDAS supply dense timelines, or the ACTIVE FIELD is „1. Tehnisko risku analīze”, allow the flagship section count — never pad with filler.
- HUMAN TONE: Write like a senior Latvian inspector briefing a buyer — concrete, varied rhythm, no AI filler ("Kopumā var secināt", "Svarīgi atzīmēt", "Turklāt jāpiemin", "Nav šaubu"). Do not wrap the whole output in quotation marks.
- CONFLICTS: State risks inside prose; heading „Neatbilstība” or „Pretruna avotos” when the data conflicts — never the word „anomālija”, and never prefix with "- ".
- STYLE REFERENCE: When the user prompt includes existing expert comments from this order, match their heading-then-paragraph rhythm, vocabulary ("automašīna"), and tone; extend with new facts, do not switch to a different format.
`;

/** Apdrošināšanas / zaudējumu summu interpretācija — ne absolūts skaitlis, bet konteksts. */
export const AI_DAMAGE_CLAIM_CONTEXT_RULES = `DAMAGE & CLAIM AMOUNT CONTEXT (mandatory when interpreting EUR loss / zaudējumu apjoms):
- NEVER treat an insurance payout or loss amount as absolute crash severity in isolation — always calibrate against vehicle context available in the order (make/model/class, first registration year, age at incident date, equipment level, market where repaired, damaged zones if listed).
- Context axes to weigh explicitly:
  1) Vehicle age at incident — same EUR sum means very different structural risk on a 15-year budget car vs a 1-year-old premium car.
  2) Class & new price tier — premium/luxury (Mercedes S/E, BMW 5/7, Audi A6/A8, Porsche, etc.) vs budget segment (old Fabia, Logan, Corolla base): high EUR on premium often reflects expensive parts, sensors, aluminum/carbon panels, dealer labor — not necessarily total loss or frame damage.
  3) Equipment & construction complexity - matrix LED / laser headlights, ADAS/radar in bumper, panoramic roof, air suspension, plug-in hybrid battery enclosure: even small parking damage can produce a costly OEM invoice in Germany (do not invent a repair EUR band).
  4) Repair market — German/DACH labor and OEM parts inflate totals vs Baltic cosmetic repairs; distinguish „expensive to fix” from „structurally totaled”.
  5) Damage zones from data — correlate EUR with affected sides (bumper only vs structural pillars/dills); a moderate sum with multiple panels can still be serious on an old car.
- Buyer-facing wording: state whether the sum suggests **relatīvi smagu** bojājumu šai auto klasei/vecumam, **dārgu, bet iespējams lokālu** premium remontu, vai **neskaidru** smagumu, ja trūkst zonu/aprīkojuma datu — never imply „milzīgs negadījums” from EUR alone without context.
- Examples (logic, not templates): a recorded insurance sum on a 12-year-old budget car recently is often material relative to residual value. The same recorded sum on a 1-year-old premium in Germany with bumper + headlight zones may be parking impact with costly OEM parts, not automatically write-off level. Paint-gauge inspection still belongs in „2. Ieteikumi”, not in the source comment.
- FIELD SCOPE (mandatory): the axes above are YOUR internal reasoning, not a template for every field. In a PER-SOURCE comment (AutoDNA, CarVertical, LTAB, dealer/AUTO RECORDS „Komentārs”), state only the facts — date, country, EUR amount, damaged zones, class/age if it disambiguates which source added what. Do NOT write the interpretive sentence ("šāda summa liecina par…", "visbiežāk norāda uz…") there — that sentence belongs ONLY in „negadījumu kopsavilkums” (incidents summary) and „3. Kopsavilkums”. Repeating the same interpretation in every source field is redundant and unprofessional (client reads it 3-4 times).`;

/** Agregātu identifikācija no pieejamajiem datiem — pamats visai tehnisko risku analīzei. */
export const AI_POWERTRAIN_IDENTIFICATION_RULES = `AGREGĀTU IDENTIFIKĀCIJA (mandatory — pirms jebkura tehniska riska nosaukšanas; VISI ražotāji):
- DARBA SECĪBA (neizlaist): (1) nosaki ŠĪ auto **dzinēja kodu** un kārbu no dīlera / Outvin / CSDD / VIN; (2) **atrod** šī koda konstrukciju un tipiskās kaites (paka TIKAI ja nosauc to pašu kodu; citādi web meklēšana šim kodam); (3) tikai tad raksti klienta komentāru, kalibrētu pret šī auto km un fiksētajiem darbiem. Marka viena pati nav identifikācija.
- Risks ir jēgpilns tikai tad, kad ir identificēts KONKRĒTAIS agregātu salikums. Izsecini no pieejamajiem datiem: (1) modeļa **paaudze / faceliftu posms** pēc markas, modeļa un pirmās reģistrācijas gada; (2) **dzinēja konstrukcija** pēc **dzinēja koda**, degvielas veida, **darba tilpuma cm³**, **jaudas kW** un izmešu klases (Euro 4/5/6); (3) **ātrumkārbas tips** — mehāniskā, klasiskais hidrotransformatora automāts, sausā vai mitrā divsajūga (DSG / S-Tronic / PDK), CVT vai EV reduktors; (4) **piedziņa** — priekšējā, aizmugures vai pilnpiedziņa un tās arhitektūra (Haldex / Torsen / 4Matic / xDrive), ja dati to atļauj.
- Datu avoti prioritārā secībā: dīlera / Outvin / AUTO RECORDS **dzinēja kods** un tipa kods (ja ir — stiprākais pierādījums), CSDD tehniskie parametri, VIN, sludinājuma aprīkojuma apzīmējumi (quattro, 4Matic, xDrive, DSG, Tiptronic), servisa ieraksti par nomainītajām detaļām (zobsiksna pret ķēdi ir konstrukcijas pierādījums).
- **kW / VECUMA AIZSTĀJĒJS (kad koda NAV vai tas ir nepilnīgs):** tajā pašā markā un līdzīgā gadu joslā (±3–5 gadi) salīdzini **jaudu kW + tilpumu cm³ + degvielu**. Modeļi var atšķirties (V70 vs XC70 vs S80) — ja kW un tilpums sakrīt ar zināmu kodu joslu, iekšēji ņem to kodu kā 1. kandidātu un **meklē to**, nevis raksti vispārīgu „Volvo dīzelis”. Piemēri: Volvo ~136 kW + ~2400 cm³ → D5244T5/T8/T14 **viena** turbo klase; Volvo **D5244T11 / ~158 kW** + ~2400 cm³ → **two-stage biturbo** (bloka plaisas risks), NE „viens turbo bez bloka plaisām”; Volvo ~140 kW + ~1969 cm³ ~2015+ → D4204 Drive-E, NE D5; BMW ~145 kW + ~2993 cm³ dīzelis līdz ~2010 → M57, ne N57; BMW ~190 kW + ~2993 ~2011+ → N57; BMW ~120 kW + ~1995 → N47/B47; MB ~125 kW + ~2143 → OM651; MB ~165–195 kW + ~2987 → OM642; MB ~143 kW + ~1950 ~2016+ → OM654; VAG ~150 kW + ~1968 TDI → EA288 klase, ne 3.0 V6.
- Ja dzinēja kods NAV avotos: nosauc **1–2 visticamākos** kandidātus kā hipotēzi („pēc tilpuma un jaudas visticamāk ir …”, „iespējams arī …”) un uzreiz pasaki, **kā to apstiprināt** — VIN atšifrējums pie dīlera, dzinēja marķējums motora telpā, ātrumkārbas plāksnīte, servisa rēķini. Nekad neraksti izsecinātu kodu tā, it kā tas būtu nolasīts reģistrā. Meklēšanu tad dari pēc šiem kandidātiem, ne pēc markas vispār.
- **Kods pret kW konflikts:** ja kods un kW josla konfliktē ar pakas stāstu, uzticies **šo auto izmērītajai jaudai + meklēšanai šim kodam**, ne pakas atmiņai. Kritiska kļūda: apgalvot, ka D5244T11 ir viens turbo bez bloka plaisām.
- Ķēde pret zobsiksnu (katrs ražotājs): ja servisa rindās jau ir zobsiksnas maiņa, TAS ir šī dzinēja fakts — neraksti ķēdi. Ja kods ir zināms, pirms apgalvojuma **meklē šo kodu**. Kļūdains ķēdes/siksnas apgalvojums ir kritiska kļūda jebkurai markai.
- Ja tas pats tilpums un jauda šai paaudzei atbilst **materiāli atšķirīgām** konstrukcijām (ķēde pret zobsiksnu, sausā pret mitro divsajūgu, ar DPF vai bez), pasaki to atklāti un dali analīzi maksimāli **divos** scenārijos — nevis uzskaiti visu ražotāja klāstu.
- Ja datu par agregātu ir par maz (tikai marka, modelis, gads): analizē **vispārīgā, modeļa līmenī** un skaidri norādi, ka precīzs agregāts nav noteikts. Neizdomā kodu, tipa apzīmējumu vai kārbas modeli.
- Riskus attiecini TIKAI uz identificēto salikumu — nepārnes citas dzinēja versijas vai citas paaudzes slimības uz šo auto; „tā pati marka” nav pamats.`;

/** Risku kalibrācija pret aptuveno nobraukumu un vecumu — bez pārspīlēšanas. */
export const AI_MILEAGE_BAND_RISK_RULES = `NOBRAUKUMA UN VECUMA POSMA KALIBRĀCIJA (mandatory — katrs tehniskais risks jāvērtē pret ŠO auto posmu):
- Vispirms nofiksē **aptuveno pašreizējo nobraukumu** (jaunākais ticamais odometra rādījums avotos vai sludinājumā) un **vidējo km/gadā**. Ja odometra dati ir pretrunīgi, strādā ar diapazonu un to nosauc — neizliecies, ka km ir precīzi zināmi.
- Katru agregāta risku sadali pēc posma: (1) **jau iztērēts resurss** — darbi, kas šim agregātam tipiski notiek līdz šim km un vecumam, tāpēc tiem jābūt pierādītiem servisa vēsturē; (2) **tuvākais logs** — kas tipiski gaidāms nākamajos ~20 000–40 000 km vai 1–2 gados (tas ir pircēja reālais izdevums); (3) **tālāks resurss** — piemin īsi vai nepiemin vispār.
- **Nepārspīlē:** risku, kas šim agregātam tipiski parādās, piemēram, pie 250 000 km, nedrīkst pasniegt kā aktuālu draudu pie 90 000 km — tad tā ir tikai perspektīvas piezīme. Nekrauj kopā visus teorētiski iespējamos bojājumus; **galvenais pirkuma risks var būt tikai 1–2** pozīcijas, pārējais ir ierasta uzturēšanas izmaksa vai kaut kas, ko vienkārši jāpārbauda klātienē (nav pirkuma šķērslis).
- **Vecums nav tas pats, kas nobraukums:** gumijas, plastmasas, dzesēšanas sistēmas, zobsiksnas un šļūteņu resurss iet pēc laika — vecs auto ar mazu nobraukumu var būt sliktākā stāvoklī nekā jaunāks auto ar lielu šosejas nobraukumu. Sasaisti ar motorstundu / pilsētas–šosejas loģiku, kad dati to atļauj.
- **150-200 tūkst. km outlook (mandatory in „1. Tehnisko risku analīze”):** always include a short separate section on what typically becomes relevant at 150-200 thousand km for THIS car’s actual units only (timing chain or belt, oil consumption, GPF or DPF if fitted, turbo if fitted, this gearbox’s clutch/mechatronics, micro-hybrid / 12V assist if fitted, suspension). Do not copy another engine’s list. If the car is already past that band, write the next band instead. If it is far below, keep this as a later-horizon note, not a present threat.
- **Pierādījumi maina risku:** ja servisa vēsturē ir attiecīgais darbs (ķēde, divsajūga eļļa, zobsiksna, ūdens sūknis, iesmidzinātāji), risks krīt — pasaki, ka darbs datos jau fiksēts. Ierakstu trūkums nav pierādījums, ka darbs nav veikts — formulē kā **nepierādītu**, kas jānoskaidro pie pārdevēja.
- Izmaksas vērtē **varbūtības × ietekmes** griezumā: pirmais nāk tas, kam ir gan reāla varbūtība šajā posmā, gan būtiska naudas ietekme. NERAKSTI orientējošas EUR joslas — tikai kvalitatīvi (dārgs / vidējs / pārbaudes punkts).
- Ja nobraukums, vecums un apkopes aina šim agregātam ir **relatīvi labvēlīga**, to ir atļauts un vajag pateikt — kalibrēti, ar atrunu, ka PROVIN auto fiziski nav apskatījis. Mākslīgi „sarkanie karogi” bez datu pamata ir tāda pati kļūda kā risku noklusēšana.`;

/**
 * Straujš gada nobraukuma kritums pirms importa / valsts maiņas — TIKAI nobraukuma komentāram.
 */
/**
 * AutoDNA/CarVertical „Laikposma ieraksti” sludinājumi nav fiziska valstu maiņa.
 */
export const AI_LISTING_IS_NOT_COUNTRY_CHANGE_RULES = `SLUDINĀJUMA VALSTS NAV FIZISKA PĀRVIETOŠANĀS (mandatory — visos laukos):
- Admin „Laikposma ieraksti” / AutoDNA-CarVertical rindas ar sludinājuma, izsoles vai vēsturiskās cenas tekstu („Pārdošanai piedāvātas automašīnas”, listed for sale, auction, historical price) rāda, KUR auto tika reklamēts, ne to, kur tas bija reģistrēts vai fiziski atradās.
- Vienlaicīgi sludinājumi Vācijā, Nīderlandē un Polijā (vai citās valstīs) NAV pierādījums, ka auto braucis no valsts uz valsti. NERAKSTI „valstu maiņa”, „imports”, „eksports”, „ceļojis”, „pārvietots” pēc šiem ierakstiem.
- Valstu maiņu ņem TIKAI no reģistrācijas, īpašnieka maiņas, tehniskās apskates vai cita oficiāla reģistra/dīlera notikuma ar valsti. Ja promptā ir atzīme „NAV reģistrācija vai fiziska valsts maiņa”, to ievēro.
- Šādus ierakstus drīkst minēt kā tirgus/sludinājuma faktu (auto tika piedāvāts šajā valstī), bez pārvietošanās stāsta.`;

export const AI_MILEAGE_PATTERN_CHANGE_RULES = `NOBRAUKUMA PARADUMA MAIŅA PIRMS IMPORTA (mandatory — only in NOBRAUKUMA VĒSTURES KOMENTĀRS):
- Compute the car's yearly km pace across its history from the available odometer points. Compare the pace in the LAST TWO YEARS (or the last two years before import / country-change / de-registration, whichever the data shows) against the earlier, established yearly pace.
- Trigger this note ONLY when the recent pace has dropped to LESS THAN HALF of the earlier established pace, AND that drop happens shortly before an import / country change. Smaller drops, or a drop with no import/country change nearby, are normal variation — say nothing. A marketplace listing in another country is NOT an import / country change (see SLUDINĀJUMA VALSTS NAV FIZISKA PĀRVIETOŠANĀS).
- Before writing it, check other sources (market/listing data, other registries, dealer records) so you do not confuse a genuine pace drop with a car that was simply sitting unsold on the market for a long time in the same country — that is a different, non-suspicious explanation and should be named as such when the data supports it.
- Wording (calibrated, never an accusation): name the fact (yearly pace before vs. after, and the timing near import), then explicitly offer a plausible innocent explanation (car sitting at a logistics/export lot, prolonged foreign listing, temporary storage) as equally possible — do NOT state or imply an odometer correction/rollback occurred. The goal is to make the buyer aware the pattern exists and worth asking about, not to accuse the seller.
- Do not repeat this analysis in any other field (tech risks, summary, incidents) — it lives only in the mileage comment; other fields may reference it in at most one short sentence if it changes their conclusion.`;

/**
 * Flagship quality bar for „1. Tehnisko risku analīze” — this field must be technically
 * excellent and detailed. Injected into the technical-risks (and inspection) task blocks.
 */
export const AI_TECHNICAL_RISKS_FLAGSHIP_RULES = `TEHNISKO RISKU KVALITĀTES LATIŅA (obligāti — šī ir atskaites dārgākā sadaļa):
- Vājš iznākums (aizliegts): vispārīgas rindkopas, kas der jebkuram dīzelim (EGR/DPF/turbo + „jāpārbauda klātienē”); slavinoša ievada tūre („uzticamākais… / veiksmīgākā konstrukcija / viens no veiksmīgākajiem / Dzinēja konstrukcija un resurss / Agregātu identifikācija”) kā pirmā sadaļa (aprīkojums + šī mezgla risks pirmajā teikumā ir atļauts); trūkstošus zobsiksnas dokumentus pasniegt kā „neatliekamu un obligātu” maiņu; „obligāti” / „kritiski” / „netiek rekomendēts” klienta tekstā; TA nosegtu sviru/bušu eseja; N-sērijas ķēdes stāsts uz M-sērijas motoru; **D5244T11 / ~158 kW pasniegšana kā viens turbo „bez bloka plaisām”** (T11 ir biturbo); biturbo bloka plaisas stāsts uz ~136 kW viena turbo (T5/T8/T14) klasi; slavenu E60 kaites uzskaitišana, nešķirojot, vai šim eksemplāram tās vispār ir; 300 tūkst. km pasniegšana kā „beigas” agregātam, kam tas ir ierasts darba mūžs; AI-šablona frāzes (near-term-investment, Kas-NAV-dargs-risks, divejada-aina).
- Spēcīgs iznākums (mērķis): seniora tehniskā instruktāža konkrētam paaudze+motors+kārba+piedziņa+virsbūve salikumam. Klients pēc šīs sadaļas saprot (1) kuri mezgli šim eksemplāram ir aktuāli pēc datiem (bez € skaitļiem), (2) kas ir paaudzes kaprīze ilgtermiņā, (3) vai dati rāda koptu auto vai tukšu vēsturi. Neraksti, kas šim modelim „neattiecas”.
- GARUMS: LENGTH CEILINGS (1 200-2 500 rakstz., 4-7 sadaļas). Kvota ir NOSACĪTA: tik sadaļu, cik ir atšķirīga agregāta materiāla. Īsāka analīze NAV kļūda. Aizliegts aizpildīt garumu ar TA nosegtiem nodiluma mezgliem (sviras, bukses, lodbalsti, bremzes).
- OBLIGĀTĀ IZKLĀSTA SEKVENCE (izvadē bez numuriem — virsraksts savā rindā, tad rindkopa; NEKAD *, **; BEZ Kas-NAV-dargs-risks / Tuvakais-rekins šablona virsrakstiem):
  0) Identifikācija ir **iekšēja**, ne izvades ievads. Nosaki paaudzi+motoru+kārbu+piedziņu no datiem (kods; ja koda nav - **kW + cm³ + gads + degviela** tajā pašā markā), BET NERAKSTI pirmo rindkopu „kas tas ir par auto”, „Dzinēja konstrukcija un resurss”, „Agregātu identifikācija” vai markas/motora/kārbas tūri - tas jau ir citās atskaites sadaļās. Dzinēja/kārbas fakti minami tikai tad, kad tie **izskaidro risku**. Iekšējais plāns (angļu „I have analyzed”, Internal Analysis, Risk Prioritization, Web Search & Knowledge, Final Review, #1/#2 saraksts) NEKAD nav izeja.
  1) Pirmā rindkopa = konkrēts **riska fakts** par šo eksemplāru. Km/vecuma kalibrāciju ievij šajā rindkopā. Volvo: T11/~158 kW biturbo sāc ar bloka plaisas/dzesēšanu; T5/T8/T14 viena turbo - ar papildsiksnas spriegotāju. Aprīkojums + šī mezgla risks ir atļauts; slavinošs „veiksmīgākā konstrukcija / uzticamākais / viens no veiksmīgākajiem” ievads nav.
  2) Galvenie aktuālie mezgli šajā posmā (varbūtība × ietekme, BEZ EUR skaitļiem) — maksimāli 1–2 pozīcijas — ja tie vēl nav 1. rindkopā. Nosauc mezglu, ne near-term-investment šablonu. Dārgo ekstraprīkojumu (E60/E61: Active Steering, Dynamic Drive, Soft Close, Logic 7, xDrive; MB: Airmatic / ABC) nosauc **tikai ja SA / dīleris / operators to rāda šim auto**. Ja nav datos - par to NERAKSTI.
  3–N) Katrs atšķirīgais relevantais sistēmas bloks atsevišķā rindkopā: motora mehānika (ķēde/zobsiksna un tās **puse/piekļuve**, eļļas noplūdes, dzesēšana); ieplūde/EGR/DPF/AdBlue/turbo/iesmidzinātāji (sprauslas); kārba („mūža eļļa”, mehatronika, DCT tips); elektronika kā **vecuma** kaprīze; virsbūvei specifiskā piekare (rūpnīcas pneumatika ≠ dārgais Adaptive/Dynamic Drive, ja tas nav sarakstā).
  Beigas) Prioritātes pēc DATIEM (kopts / nepierādīts / jau fiksēts defekts). Ja dati rāda labu apkopi — to PASAKI kalibrēti. Ilgtermiņa kaprīzi nošķir no „šis auto tūlīt sabruks”. Bez future-risk / financially-most-significant frāzēm.
- TIKAI AKTUĀLAIS: iekšēji drīksti noraidīt sveša koda kaiti, lai to nekopētu. Izvadē to NEMINI. Aizliegts uz-so-motoru-neattiecas un Kas-NAV-dargs-risks šablons.
- VĀRDU PRINCIPS (ne šablons, bet darbnīcas valoda): raksti kā vecāks meistars, kas lasa tabulu. Labie vārdi, kad tie atbilst faktam: „fiksēts”, „pēc dīlera datiem”, „starpība ir”, „jālūdz uzrādīt dokumenti”, „ja šajā periodā apkope datos nav fiksēta”. Sliktie: tukša „signāla/faktora” piedeva, „ko tas nozīmē šim darījumam”, near-term-investment padding, teikuma piepūšana bez jauna fakta. Datumi un km paliek; atmosfēras teikumi ne.
- APRĪKOJUMA DISCIPLĪNA: lasi dīlera SA/aprīkojuma sarakstu. Dārgs, šajā vecumā riskants ekstraprīkojums **maina TCO** - ja tas datos IR, raksti par to. Ja saraksts ir īss/nepilnīgs vai pozīcijas nav - par trūkstošo NERAKSTI. Neizdomā, ka kaut kā „nav”, un neveido nolieguma sadaļu.
- NOBRAUKUMA KALIBRĀCIJAS PIEMĒRI (loģika, ne šablons visiem modeļiem): M57 pie ~300 tūkst. km ar blīvu DE servisu var būt ierasts darba mūžs; N57 pie ~180 tūkst. km ķēde jau var būt pirkuma risks; D5244T5/T14 ~136 kW viena turbo ar labu eļļu - ierasts darba mūžs; **D5244T11 ~158 kW biturbo** - bloka plaisas/dzesēšana ir aktuāls risks, NE „bez bloka problēmām”; **OM651.913 ~100 kW pie ~300 tūkst. km** ar ritmisku eļļu: ja kārba ir **722.6**, aktuāli ir eļļa/elektroplāksne un **EGR dzesētājs**. Nekad nepārnes citas dzinēja versijas stāstu tikai tāpēc, ka marka sakrīt. Ja paka CONFLICTĒ ar šī auto kW/kodu - **meklē**, tad raksti.
- Katra rindkopa = viens mezgls + kāpēc šajā posmā + 1 teikums, ko saka ŠĪ auto dati. Bez orientējošām EUR joslām, bez ūdens, bez verdikta „pērc/nepērc” (tas ir 3. sadaļā), bez klātienes checklista (tas ir 2. sadaļā), bez eļļas maiņas intervālu tabulas (tas ir „Eļļas maiņas intervāli” — šeit maksimums viens teikums, ja long-life pret pilsētu ir pirkuma risks).
- TA COVERED WEAR: ja promptā LĪMENIS ir SVAIGA vai SPĒKĀ — sviras/bukses/lodbalsti/bremzes NAV riska sadaļa. Unknown history is a one-line inspection note, not a risk.
- WINTER SALT RUST: ja promptā „Ziemas sāls / rūsas ekspozīcija” saka OBLIGĀTI — viena atsevišķa īsa rindkopa (klimata risks, ne pierādīts defekts; cinkojums un tīra TA neatceļ). Tipiskās vietas nosauc vārdā. Bez garas „rada paaugstinātu risku” esejas.`;

/** Web research — primary knowledge path when packs do not cover this exact aggregate. */
export const AI_TECHNICAL_RISKS_RESEARCH_RULES = `WEB RESEARCH (obligāti „1. Tehnisko risku analīze” — tev IR web_search / Google Search; VISI ražotāji):
- ENGINE CODE FIRST: vispirms kods (vai 1-2 kandidāti no **kW + cm³ + gads + degviela** tajā pašā markā), tad meklēšana par **šī koda** konstrukciju un kaitēm, tad raksti. Nemeklē pēc markas vispār un nekope pakas rindkopu, ja kods/kW josla nesakrīt (Volvo: D5244T11 ~158 kW = biturbo ≠ ~136 kW viena turbo; pakas konfliktu gadījumā uzticies kW + meklēšanai).
- Statiskās pakas sedz tikai dažas agregātu grupas. Simtiem modeļu **nav** atmiņā. Meklē ŠO dzinēja kodu arī tad, ja promptā ir tādas pašas markas paka - paka ir prioram, ne šī motora fakta avots, kamēr tā nosauc tieši šo kodu. Ja paaudze + kods + kārba nav pilnībā nosegta, **vispirms meklē**, tad raksti. Meklē arī tad, ja paka ir, bet trūkst ķēdes/siksnas puses, ekstraprīkojuma slazdu vai šī km posma kalibrācijas.
- Vaicājumi (Eiropa vispirms): „{dzinēja kods} typical problems / timing belt OR chain”; „{marka} {šasija/paaudze} {dzinēja kods} known issues”; „{motors} intake manifold OR injectors OR thermostat”; „{modelis} {gads} Motor-Talk OR forum weaknesses”; šīs paaudzes dārgais ekstraprīkojums (air suspension, active steering, DCT, Airmatic u.tml.).
- Avoti: Eiropas īpašnieku forumi un klubu wiki (DE/UK/FR/IT/NL/Nordics - Motor-Talk, BimmerForums UK, club fora), neatkarīgo servisu raksti. ASV/Reddit - sekundāri (cits nobraukuma mērs, cits aprīkojums; vērtības tikai km).
- Sintezē: slimība + tipiskais km/vecuma posms, **bez** orientējošām EUR joslām klientam. **Neizdomā** citātus, kampaņu numurus, procentus, „foruma statistiku”. Ja avoti konfliktē — pasaki un ņem pircējam konservatīvāko lasījumu.
- Meklējumu neizgāž komentārā. Ieraksti flagship struktūrā, kalibrētu pret ŠĪ auto km, vecumu, servisu un aprīkojumu. IZEJA = tikai latviešu klienta komentārs. Aizliegts angļu plāns, „I have analyzed”, Internal Analysis, Web Search & Knowledge, Final Review.
- Ja meklēšana nedod ticamu materiālu: vispārīgais modeļa līmenis + skaidri „zināšanu ir maz”; neaizpildi ar vispārīgu dīzeļa/EGR tekstu.`;

/** Compact structure samples for the flagship field only — not full length, not this-order facts. */
export const AI_TECHNICAL_RISKS_FEW_SHOTS = `STRUKTŪRAS PARAUGI (tikai „1. Tehnisko risku analīze”; ritms un kalibrācija, ne pilns garums; 4-7 sadaļas; NEkopē faktus uz aktīvo pasūtījumu; NEKAD *, **):

Paraugs A — izturīgs agregāts, liels nobraukums, blīvs DE serviss (struktūra):
"Pneimatika
Universāļa rūpnīcas aizmugures pneimatika šajā vecumā ir aktuālais mezgls: spilveni un kompresors. Šajā km posmā motors ar ķēdi priekšpusē ir ierasts darba mūžs, ne resursa gals.

Blīves un kārba
Eļļas korpusa blīves un kārbas eļļa šajā posmā ir aktuālie mezgli, ja serviss vai TA to atbalsta; bez € skaitļiem.

Ilgtermiņa kaprīze
Elektronika un eļļas svītras 15-20 gadu vecumā ir paaudzes raksturs. Pēc datiem nekas neliecina, ka auto tuvākajā laikā būs problemātisks."

Paraugs D — BEV, bez auto tūres ievada:
"Iekšdedzes kaites
Iekšdedzes ķēdes, turbīnas, DPF un eļļas noplūdes šim eksemplāram neeksistē. Galvenā uzmanība ir akumulatoram, jaudas elektronikai un balstiekārtai.

Augstsprieguma akumulators (SOH)
Pie 137 000 km būtiskākais risks ir akumulatora stāvoklis. Rūpnīcas garantija parasti ir 8 gadi vai 160 000 km, tāpēc šis auto var tuvoties limitam. SOH diagnostika autorizētā servisā pirms pirkuma ir ieteicama."`;

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
- **Termiskais konteksts:** Latvijas, Lietuvas un Igaunijas ziemas (auksts akumulators pirms DC), vasaras karstums un auto novietošana ārā vs garāžā ietekmē reālo resursu. Karstumā uzlādēt līdz 100 % un atstāt stāvēt — sliktāks scenārijs nekā mērens diapazons mājās.
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
- These excerpts come from OTHER completed PROVIN audits. They are STYLE MEMORY only: paragraph rhythm, workshop vocabulary, heading shape, and model-family experience (this engine/gearbox typically has X).
- NEVER take instance facts from them: wrap / plēve / PPF, this other car’s rust findings, accidents, km, dates, owners, seller, listing, TA defect rows, prices, or any sentence that is about THAT car. If THIS order’s data does not contain the fact, do not write it.
- ADAPT / SUPPLEMENT / CONNECT: reuse phrasing and aggregate experience for THIS ACTIVE FIELD — then bind every claim to THIS order's facts and to OPERATORA KOMANDAS. Never paste a historical paragraph. Never transplant another car’s story.
- OPERATOR NOTES WIN over any historical excerpt.
- Match paragraph rhythm and "automašīna" vocabulary; keep CLIENT VALUE DENSITY (short, high-value — no fluff).`;

/** PDF extract komentārs (Sonnet iekšēji). ✨ avotu lauki vairs neieliek šo bloku virs CORE. */
export const HYBRID_COMMENT_RULES = `
COMMENTARY RULES for PROVIN Senior Auto Expert (PDF extract):
${AI_OPERATOR_NOTES_EXECUTION_RULES}
${AI_SOURCE_FIELDS_FACTS_ONLY_RULES}
- LENGTH OVERRIDE: When the user prompt includes OPERATORA KOMANDAS / a long Esošais melnraksts, IGNORE character/paragraph ceilings. Restyle into heading-then-paragraph; do not substantially shorten. If the operator limited the job („tikai par…”), do not pad.
- LOGIC: State what THIS source recorded. Do not interpret or add a buyer-advice sentence after the fact. Meaning belongs in summary sections (3. Kopsavilkums, NOBRAUKUMA VĒSTURES KOMENTĀRS, NEGADĪJUMU VĒSTURES KOPSAVILKUMS) or „2. Ieteikumi”.
- DAMAGE & CLAIM AMOUNT CONTEXT: recorded insurance/loss EUR from AutoDNA, CarVertical or LTAB may appear in this extract. Do not invent repair EUR. Interpret severity only in the incidents summary, not as a second source essay.
- ANTI-REPETITION (mandatory): Do NOT restate the mileage timeline (that belongs in „NOBRAUKUMA VĒSTURES KOMENTĀRS”), oil-change interval math („Eļļas maiņas intervāli”), incident severity essay, technical-risk catalogue, inspection checklist, or summary verdict. Per-source text = unique facts from THIS source + at most ONE cross-check sentence.
`;

/** AI PDF extract JSON — avota komentārs (visi avoti). */
export const SOURCE_PDF_COMMENT_AI_RULES = `COMMENTS field (client PDF expert commentary):
${HYBRID_COMMENT_RULES}
- Extract and interpret ALL substantive facts from this report: mileage, damage zones, registration, insurance, policy periods, dealer/service milestones — not only anomalies.
- Never return a generic one-liner when tables or descriptive history exist in the PDF.`;

/** ✨ Visu avotu bloku „Komentāri” ģenerēšana (admin) — dziļā forenzika. */
export const SOURCE_BLOCK_COMMENT_AI_RULES = `OUTPUT FORMAT (mandatory):\n${HYBRID_COMMENT_RULES}`;


/** auto-records.com / Outvin PDF — papildus dīlera specifika virs SOURCE_PDF_COMMENT_AI_RULES. */
export const AUTO_RECORDS_PDF_COMMENT_AI_RULES = `COMMENTS field (OFICIĀLĀ DĪLERA DATI):
${HYBRID_COMMENT_RULES}
- Cover type code, engine code, equipment, accident/stolen checks, and dealer service timeline—not only km digits.
- Explain fleet/taxi/commercial type-code signals for Latvian buyers when present.
- Never return a generic one-liner when VEHICLE INFORMATION or service tables exist in the PDF.`;

export type NormalizeExpertCommentOptions = {
  maxParagraphs?: number;
  /** PDF izvilkumam drīkst likt „…”; avota komentāram nogriež pie rindkopas, bez elipses. */
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
