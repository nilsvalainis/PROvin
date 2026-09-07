# PROVIN komentāru ✨ prompti (runtime, pārstrādei)

Šis fails ir **kopija lasīšanai**. Kanons paliek kodā. Pēc pārstrādes labot:

1. `lib/admin-ai-prompts.ts` — system prompti
2. `lib/source-summary-comment-format.ts` — kopīgie noteikumi, kas tiek ielikti iekšā
3. `lib/admin-ai-*.ts` — user promptu sagataves (konkrētais uzdevums + konteksta sloti)

Gramatikas ✨ (`/api/admin/ai-polish-lv`) šeit NAV. Oneauto tulkošana arī NAV klienta komentārs.

Katrs ģenerējums = **system** + **user**. User vienmēr iet caur `appendAiOperatorNotesSection` (`lib/admin-ai-operator-notes.ts`): vispirms OPERATORA KOMANDAS (ja ir), tad esošais melnraksts, tad uzdevums + portfelis.

---

## Karte

| Lauks | System | User sagatave | Modelis (noklusējums) |
|---|---|---|---|
| Avota „Komentāri” (CSDD, AutoDNA, CV, LTAB, dīleris, reģistri, Citi avoti, Tirgus) | `aiSourceCommentSystemPrompt(label)` = `PROVIN_EXPERT_SYSTEM_PROMPT` + avota extra | `lib/admin-ai-source-comment.ts` | Gemini Flash |
| Oficiālā dīlera servisa vēsture | `aiAutoRecordsServiceHistorySystemPrompt()` | tas pats fails | Gemini Flash |
| Eļļas maiņas intervāli | `aiAutoRecordsOilIntervalSystemPrompt()` | tas pats fails | Gemini Flash |
| Negadījumu kopsavilkums | `AI_INCIDENTS_SUMMARY_SYSTEM` | `lib/admin-ai-incidents-summary.ts` | Sonnet |
| Nobraukuma komentārs | `AI_MILEAGE_COMMENT_SYSTEM` | `lib/admin-ai-mileage-comment.ts` | Sonnet |
| 1. Tehnisko risku analīze | `AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM` | `lib/admin-ai-technical-risks.ts` | Sonnet + web |
| 2. Ieteikumi klātienes apskatei | `AI_INSPECTION_RECOMMENDATIONS_SYSTEM` | `lib/admin-ai-inspection.ts` | Sonnet (+ web, ja risku vēl nav) |
| Avotu salīdzinājums (iekšējs, nav PDF) | `AI_SOURCES_COMPARISON_SYSTEM` | `lib/admin-ai-sources-comparison.ts` | Sonnet |
| 3. Kopsavilkums | `AI_SUMMARY_ANALYSIS_SYSTEM` | `lib/admin-ai-summary.ts` | Opus |
| Pārdevēja portrets | `AI_SELLER_ANALYSIS_SYSTEM` | `lib/admin-ai-seller.ts` | Gemini / web |
| Cenas vērtējums | `AI_PRICE_ANALYSIS_SYSTEM` | `lib/admin-ai-price.ts` | Gemini |
| Tirgus JSON | `AI_TIRGUS_MARKET_SYSTEM` | `lib/admin-ai-tirgus-market.ts` | Gemini |
| Foto analīze / sludinājuma konteksts | `AI_LISTING_PHOTO_ANALYSIS_SYSTEM` / `AI_LISTING_SALES_CONTEXT_SYSTEM` | `lib/admin-ai-listing-field.ts` | Gemini |
| Ātrais sludinājuma e-pasts | `AI_LISTING_PEEK_COMMENT_SYSTEM` | `lib/admin-ai-listing-peek.ts` | Gemini Flash |

Bāzes, kas ietilpst gandrīz visos system promptos:

- `PROVIN_FIELD_AGENT_SYSTEM` — `lib/admin-ai-prompts.ts` (sākums ~64)
- `PROVIN_EXPERT_SYSTEM_PROMPT` — turpat (~181); avotu komentāri iet caur šo, ne field-agent
- Kopīgie bloki — `lib/source-summary-comment-format.ts` (saraksts zemāk)

`provinFieldAgentPrompt(field, task)` = FIELD_AGENT + `ACTIVE FIELD: …` + task.

---

## Kopīgie noteikumi (`lib/source-summary-comment-format.ts`)

Šie **nav** atsevišķi ✨ — tie tiek ielikti system tekstā:

- `PROVIN_REPORT_COPY_VOCABULARY`
- `PROVIN_RESTRAINED_TONE_RULES`
- `AI_OPERATOR_NOTES_EXECUTION_RULES`
- `AI_NO_ESTIMATED_REPAIR_EUR_RULES`
- `AI_RESOLVED_HISTORICAL_FINDINGS_RULES`
- `AI_TA_COVERED_WEAR_RULES`
- `AI_UNKNOWN_IS_NOT_A_RISK_RULES`
- `AI_WRAP_FILM_RULES`
- `AI_WINTER_SALT_RUST_RULES`
- `AI_PAINT_GAUGE_INSPECTION_RULES`
- `AI_OIL_CHANGE_INTERVAL_RULES`
- `AI_PLAIN_LANGUAGE_TERMS`
- `PROVIN_COMMENT_BREVITY_RULES`
- `PROVIN_FINISHED_REPORT_FEW_SHOT_EXAMPLES`
- `AI_EXPERT_PARAGRAPH_PRESENTATION`
- `AI_DAMAGE_CLAIM_CONTEXT_RULES`
- `AI_POWERTRAIN_IDENTIFICATION_RULES`
- `AI_MILEAGE_BAND_RISK_RULES`
- `AI_TECHNICAL_RISKS_FLAGSHIP_RULES`
- `AI_TECHNICAL_RISKS_RESEARCH_RULES`
- `AI_TECHNICAL_RISKS_FEW_SHOTS`
- `AI_EV_BEV_FORENSICS_RULES`
- `AI_HISTORICAL_REPORTS_CONTEXT_RULES`
- `SOURCE_BLOCK_COMMENT_AI_RULES`
- `AI_AGGREGATE_KNOWLEDGE_RULES` — `lib/admin-ai-aggregate-knowledge.ts`

---

## 1. Avota komentāri — system (task daļa)

Aptinums: `PROVIN_EXPERT_SYSTEM_PROMPT` + `SOURCE_BLOCK_COMMENT_AI_RULES` + `aiSourceBlockExtraRules(label)`.

```
ACTIVE SOURCE BLOCK: ${blockLabel} — client PDF audit report expert commentary for THIS source only.

DIVISION OF LABOUR (mandatory — complementary sources, not 4× the same essay):
- Open with the single most important thing ${blockLabel} adds to this audit; the whole comment answers that one question.
- Primary content = facts, tables, and signals that THIS source uniquely provides (damage zones, TA defects, dealer codes, claims, Status Center, etc.).
- Comparison = at most ONE sentence, and only when a conflict changes the conclusion. The full cross-source picture is built in „3. Kopsavilkums”, not here.
- LENGTH: **2–4 short paragraphs (≈350–800 characters)** unless OPERATORA KOMANDAS are present — then cover every operator topic (and only the scoped ones if the operator limited the job); do not skip a theme to stay inside 350–800.
- If previously generated expert comments (other sources, mileage, incidents, tech risks, inspection, summary) appear in the user prompt: those facts are COVERED. Do not paraphrase them at similar length. Confirm in one sentence if needed, then ONLY add what is still missing for ${blockLabel}.
- If THIS source largely repeats another source with no new buyer signal: keep output very short (1–3 paragraphs) — never rewrite the same accident/km/ownership story.
- Do NOT write the global mileage chronology, annual km averages, motorstundas profile, or data-vacuum essay here — that belongs exclusively in „NOBRAUKUMA VĒSTURES KOMENTĀRS”. If this source only confirms the same km line, say so in one sentence and move on to unique content.
- Do NOT write oil-change interval math (how often oil was changed, km gaps vs OEM) — that belongs exclusively in „Eļļas maiņas intervāli”.
- Do NOT rewrite „1. Tehnisko risku analīze”, „2. Ieteikumi…”, or „3. Kopsavilkums” here.
- Match the tone, paragraph rhythm, and **bold** hook style of any existing expert comments — extend format, do not duplicate substance.
- Do not invent facts. No section headings in output. No AI meta-commentary.
- Every paragraph opens with **bold** topic hook; never start a line with "- ", "•", or "*".
```

Avotu extra (`aiSourceBlockExtraRules`): CSDD / AutoDNA / CarVertical / LTAB / dīleris / ārvalstu reģistri / Citi avoti / Tirgus — `lib/admin-ai-prompts.ts` ~493–566.

### User (avota komentārs)

```
Pasūtījuma ID: …
Avota sadaļa (fokuss): ${blockLabel}

=== Pilns pasūtījuma konteksts (visi avoti — salīdzināšanai) ===
${portfolioContext}

${chainingSection}=== Konkrētā avota „${blockLabel}” dati (bez esošajiem komentāriem) ===
${focusDataText}

Sagatavo komentāru TIKAI šai avota sadaļai klienta atskaitei.
Galvenais jautājums, uz ko atbildi: ko tieši „${blockLabel}” pievieno šim auditam? To pasaki pirmajā rindkopā.
Garums: **2–4 īsas rindkopas** (≈350–800 rakstzīmes). Salīdzinājums ar citiem avotiem — maksimums VIENS teikums un tikai tad, ja pretruna maina secinājumu; plašo kopainu veidojam „3. Kopsavilkumā”.
Avotiem JĀPAPILDINA viens otru — NEKĀDĀ GADĪJUMĀ nepārraksti gandrīz to pašu eseju 4× (negadījums / km / īpašniecība), ja tas jau ir citā komentārā.
Ja šis avots tikai apstiprina jau uzrakstīto: 1–2 īsas rindkopas max.
Tonis atturīgs: bez „kritisks”, „anomālija”, „katastrofāls”; digitālie ieraksti var būt nepilnīgi, tāpēc raksti, ko dati uzrāda, nevis ko tie „pierāda”.
${mileageHint}Ja OPERATORA KOMANDĀS ir plašs teksts — pārkārto PROVIN stilā, bet NEAPGRAIZI detalizāciju (datumi, km, servisi, intervāli).
Neizdomā faktus. Neparafrāzē citu avotu komentārus gandrīz tādā pašā garumā.
```

---

## 2. Servisa vēsture — system

```
ACTIVE FIELD: OFICIĀLĀ DĪLERA DATI — Servisa vēsture (service/repair journal for client PDF).

OUTPUT RULES:
- Factual journal only — one service/repair event per line.
- Preferred line format: DD.MM.YYYY | XXXXX km | work done / parts / notes
- If odometer missing: DD.MM.YYYY | work done
- Chronological or newest-first is fine; keep dates as in sources.
- Extract from dealer/Auto Records/AutoDNA RAW/Outvin service narratives present in context — do NOT invent services.
- No buyer essay, no **bold** hooks, no section titles, no bullet characters "- "/"•".
- Latvian language. Compact.
- Do NOT write oil-change interval analysis here — that is „Eļļas maiņas intervāli”.
```

### User

```
Sagatavo „Servisa vēsture” lauku klienta PDF — faktu saraksts no dīlera / AutoDNA / RAW / Outvin servisa ierakstiem.
Formāts: katra rinda „DD.MM.YYYY | XXXXX km | darbi / komentārs” (ja km nav — izlaid km daļu).
Tikai fakti no konteksta; neizdomā apkopes. Bez ievada, bez kopsavilkuma, bez bold virsrakstiem.
```

---

## 3. Eļļas maiņas intervāli — system

```
ACTIVE FIELD: OFICIĀLĀ DĪLERA DATI — Eļļas maiņas intervāli (oil-interval analysis for client PDF).

${AI_OIL_CHANGE_INTERVAL_RULES}
${AI_CLIENT_PDF_EXPERT_MARKDOWN_RULES}

OUTPUT RULES:
- THIS is the only field that may run the oil-interval calculation in full.
- Use ALL sources in the user prompt: dealer service works, AutoDNA/CarVertical/RAW service text, mileage timeline, city vs highway / motorstundas profile, OEM interval from packs or context.
- Be short and precise: successive oil changes, km and/or months between them, actual vs manufacturer interval, size of deviations.
- City / short-trip: ~10 000 km ceiling. Dense highway: 15 000-20 000 km can be acceptable. Shorten OEM 25 000-30 000 km long-life when profile or recorded gaps demand it.
- If records are insufficient: say so; do not invent oil changes or intervals.
- No EUR. No full mileage essay. No copy of the „Servisa vēsture” journal line-by-line.
- Latvian. Heading on its own line, then the paragraph. 2–4 short paragraphs.
```

### User

```
Sagatavo lauku „Eļļas maiņas intervāli” klienta PDF.
Uzdevums: ĪSI un PRECĪZI izrēķini un izanalizē ŠĪ auto eļļas maiņas intervālus no VISIEM iegūtajiem datiem …
Jāatbild: cik bieži mainīta; faktiskais intervāls pret ražotāju; nobīdes; pilsēta ~10 000 / šoseja 15–20 000 / long-life 25–30 000 saīsināt.
Ja ierakstu nav — tā arī saki; NEIZDOMĀ apkopes. Bez remonta EUR. 2–4 īsas rindkopas. Virsraksts savā rindā. Bez *, **.
```

---

## 4. 1. Tehnisko risku analīze — system (task)

Aptinums: `PROVIN_FIELD_AGENT_SYSTEM`. Pilnais teksts: `lib/admin-ai-prompts.ts` ~304–351.

Īsumā: flagship sadaļa, 4–10 (līdz 8–12) virsraksts+rindkopa, bez EUR, bez auto prezentācijas ievada, web research ja paka nesedz, wrap/ziemas sāls tikai ja triggeris.

### User (kodols)

```
Sagatavo tehniski izcilu, detalizētu tehnisko risku analīzi. Īss vispārīgs teksts šeit ir kļūda.
Identificē agregātu iekšēji; izvadē pirmā sadaļa = risks, ne markas tūre.
Kalibrē pret km un vecumu. Kas NAV risks. Web, ja paka nesedz.
Garums: 4–10 sadaļas. BEZ EUR. BEZ * / **.
Neraksti klātienes checklistu un gala verdiktu.
```

---

## 5. 2. Ieteikumi — system (task)

`lib/admin-ai-prompts.ts` ~353–383.

Obligāti: viena sadaļa „Virsbūves stāvoklis un krāsas biezums”; ziemas sāls ja OBLIGĀTI; 6–12 soļi; grupē pēc pircēja darbības.

### User

```
Sagatavo ieteikumus klātienes apskatei.
Katra rindkopa — konkrēta pārbaude + kāpēc šim auto. 6–12 soļi.
OBLIGĀTI: Virsbūves stāvoklis un krāsas biezums (100 līdz 150 µm / nobīde 50 līdz 150 / iekšējās ailes).
Neatkārto 1. sadaļas eseju — tikai soļi.
```

---

## 6. 3. Kopsavilkums — system (task)

`lib/admin-ai-prompts.ts` ~449–488.

Kopaina + rekomendācija, 3–5 rindkopas, **bold** ievadi, bez €, bez Sveiki, pēdējā rinda `APPROVED BY IRISS`.

### User

```
Īss profesionāls viedoklis par datu kopainu + rekomendācija.
NEATKĀRTO jau ģenerētos teikumus. Bez cenas EUR. Beigās: APPROVED BY IRISS.
```

---

## 7. Nobraukums — system (task)

`lib/admin-ai-prompts.ts` ~678–697. Vienīgais lauks pilnai odometra sintēzei, 3–5 rindkopas.

### User

```
APKOPOJOŠAIS nobraukuma lauks: lineārums, periodi bez datiem, neatbilstības, motorstundas ja dati ļauj.
3–5 rindkopas. Nesakritības = neatbilstības datos, ne pierādīta manipulācija.
```

---

## 8. Negadījumi — system (task)

`lib/admin-ai-prompts.ts` ~656–676. 2–4 rindkopas, EUR interpretācija kontekstā.

### User

```
Analizē fiksētos ierakstus visos avotos. 2–4 rindkopas.
Ja nav incidentu: skaidri, bez dramatizēšanas, plus atruna par nefiksētiem.
```

---

## 9. Pārdevējs / cena / tirgus / foto / sludinājuma e-pasts / avotu salīdzinājums

Pilnie system teksti: `lib/admin-ai-prompts.ts`

- Pārdevējs ~385–406 (web, 2–3 rindkopas)
- Cena ~408–427 (`PROVIN_EXPERT_SYSTEM_PROMPT`, 2–3 rindkopas)
- Tirgus ~429–447 (JSON: listedForSale, listingCreated, priceDrop, comments)
- Foto ~629–641
- Sludinājuma konteksts ~643–654
- Listing peek ~699–717 (e-pasta JSON, bez Markdown)
- Avotu salīdzinājums ~719–743 (iekšējs blogs, 1. persona, 4–8 rindkopas)

---

## Deprecated (joprojām failā, jaunajiem laukiem nelietot)

- `AI_FORENSIC_ANALYST_DIRECTIVE`
- `AI_EXPERT_VOICE_LV`
- `AI_CLIENT_SUMMARY_SYSTEM` (= kopsavilkums)
- `AI_CLIENT_PDF_PLAIN_RULES`

---

## Pārstrādes piezīme

Mainot klienta redzamos noteikumus: bump `PROVIN_AI_PROMPT_VERSION` (`lib/ai-prompt-version.ts`) un `npm test` (`lib/ai-eval/prompt-invariants.test.ts`).
