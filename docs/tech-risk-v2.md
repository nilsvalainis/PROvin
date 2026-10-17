# Tehnisko risku v2

Feature flag: `TECH_RISK_V2=1`. Noklusējumā izslēgts. `parseAiModelTier` labojums (nezināms → `gemini-flash`, nekad Opus) ir vienmēr.

## Pipeline (3 soļi)

1. Identifikācija (`lib/admin-ai-engine-identification.ts`): `{engine, gearbox, platform}` ar `value`, `confidence` A|B|C, `evidence`, `candidates`.
   - A = VIN dekoders / dīleris / Outvin / CSDD tieši
   - B = izsecināts no markas + kW + cm³ + gada + tirgus / VIN
   - C = vairāki kandidāti; tekstā obligāta nosacīta formulēšana
2. Solis 1, karte (lētais modelis: Haiku / `lite`; dziļajā režīmā Sonnet tikai šim solim). JSON + web meklēšana. Atsaukumi obligāti (KBA / NHTSA / EU Safety Gate). Ja nav: `"nav atrasts"`. Trūkstošie dati → `unknowns[]` un operatora karogs, ne minējums.
3. Karte saglabājas `workspace.technicalRiskMap` (nav PDF). Esošie melnraksti bez kartes paliek neskarti.
4. Solis 2, latviešu teksts: **Gemini 2.5 Pro** (`gemini`, ne Opus). Tikai no kartes, bez web meklēšanas. Latviešu prompts + vārdnīca + 3 paraugi.
5. Solis 3, QA: **Gemini Flash**. Katram apgalvojumam jābūt kartē; kalki / aizliegtās frāzes; pārraksta tikai atzīmētos teikumus.
6. Validators (`lib/admin-ai-technical-risk-lint.ts`). Ja E kļūda: viena pārģenerēšana. Ja atkārtojas: teksts + operatora brīdinājums.

Opus nav nevienā solī. Nezināms `modelTier` → `gemini-flash`.

## EUR politika

EUR remonta joslas no `data/kb` **nav ieviestas** (`PROVIN_KB_EUR_ACTIVE = false`, Nils 17.10). Lint L3 un ģenerators failu KB EUR vērtības nelasa. Atsevišķs teikums ar EUR pagaidām nav.
Maksas detaļu katalogi (Autodoc, RockAuto, PartsLink u.c.) nav avots.
Lint L3 noraida EUR, kamēr KB joslas nav ieslēgtas, vai ja operators slēdzis `hide_cost_bands`.
`ALLOW_COST_BANDS=1` ieslēdz ģenerēšanu; operators var slēpt joslas kartes panelī.

## Identifikācijas neskaidrību tabula

| ID | Noteikums |
|---|---|
| bmw-x1-xdrive20d-135kw | BMW X1 xDrive20d 135 kW: E84 līdz 2015 = N47D20; F48 no 2015 = B47D20; 2015 bez šasijas = C (abi kandidāti) |

## Solis 1: sistēmas prompts

Skat. `AI_TECH_RISK_V2_MAP_SYSTEM` (`lib/admin-ai-tech-risk-v2-prompts.ts`).

## JSON shēma

```
{
  "identification": {
    "platform": {"value","confidence","evidence","candidates":[]},
    "engine": {"value","confidence","evidence","candidates":[]},
    "gearbox": {"value","confidence","evidence","candidates":[]},
    "drive": {"value","confidence","evidence","candidates":[]}
  },
  "risks": [{
    "component": "sadales ķēde (aizmugurē)",
    "failure_mode": "vadotņu nodilums, ķēdes izstiepšanās",
    "typical_km_range": [150000, 250000],
    "this_car_position": "pirms | iekšā | pēc | nezināms",
    "already_done_evidence": "AUTO RECORDS 2021-03 ķēdes maiņa" | null,
    "probability": "high|medium|low",
    "impact": "high|medium|low",
    "priority": 1,
    "applies_to_this_car": true,
    "confidence": "high|medium|low",
    "sources": [{"type":"kb|tsb|recall|specialist|forum","ref":"KB:N57D30|url","accessed":"2026-10-17"}],
    "cost_band_eur": {"min":0,"max":0,"source":"KB:...","dated":"2026-09"} | null,
    "inspection_hint": "aukstā palaišana, grabēšana 2-3 s"
  }],
  "damage_interpretation": [],
  "recalls": [{"id_or_title":"nav atrasts","source":"KBA/NHTSA/EU Safety Gate","status_known":false}],
  "strengths": [{"text":"...","source":"..."}],
  "unknowns": ["kārbas eļļas maiņa nav fiksēta"],
  "hide_cost_bands": false
}
```

## Solis 2: teksta prompts

Skat. `AI_TECH_RISK_V2_TEXT_SYSTEM` (vārdnīca + 3 paraugi). Mērķis: gandrīz bez manuālas labošanas.

## Solis 3: QA

Skat. `AI_TECH_RISK_V2_QA_SYSTEM`. Flash atgriež `{flagged, rewritten_text}` un labo tikai atzīmētos teikumus.

## Lint noteikumi

| ID | Līmenis | Noteikums |
|---|---|---|
| L1 | E | Tikai slavinājuma ievads: `viens no (veiksmīgāk\|uzticamāk\|pārbaudītāk)` vai slavinājuma „aprīkota ar” bez riska fakta |
| L2 | E | `manā (pieredzē\|praksē)`, `es esmu redzējis` |
| L3 | E | `€\|EUR\|eiro`, ja nav verificētas KB joslas (KB: + datums), summa nesakrīt, slēdzis slēpj, vai ALLOW_COST_BANDS=false |
| L4 | E | Svešs dzinēja kods ∉ {identification.engine.value, candidates} |
| L5 | E | Ķēde un zobsiksna vienam dzinējam (izņemot papildsiksna / piedziņas siksna) |
| L6 | E | Markdown: `*`, `__`, `- `, `#` |
| L7 | W | Resursa skaitlis bez avota |
| L8 | W | Trauksmes vārdi: `kritisk\|katastrof\|anomālij\|!` |
| L9 | W | Sadaļu jaukšana |
| L10 | W | Nolieguma sadaļa |
| L11 | W | Confidence C bez "marķējum" |
| L12 | W | <4 vai >12 sadaļas |
| L13 | W | `obligāti` / `kritiski` / `netiek rekomendēts` (jābūt konsultatīvam) |

N57 klaņa gultņu noberze ir verificēta tipiska kaite: lint/QA to neatzīmē kā minējumu.

## Mācīšanās

`recordAuditAggregateLearningFromDraft` ar `TECH_RISK_V2=1` raksta `status: "candidate"`.
AI kontekstā tiek injicēti tikai `approved` ieraksti.
Apstiprināšana: `POST /api/admin/audit-knowledge` `{ "action": "approve", "key": "..." }`.

## A/B harness

`npx tsx scripts/tech-risk-ab-harness.ts` (offline, 20 sloti `docs/fixtures/tech-risk-ab-gold.json`).
Mēra edit distance un labojumu skaitu pa sadaļām; aklie pāri IRISS (tehniskā precizitāte + latviešu valoda).
Neraksta pasūtījumu datus.

### Reāls A/B (20 pasūtījumi)
Dati (slotu karte ar Nila `_prov` zeltu, ģenerētie teksti, IRISS paka) glabājas TIKAI ārpus repo: tie satur klientu datus.
1. `npx tsx --import ./scripts/stub-server-only.mjs scripts/tech-risk-ab-generate.ts --slots=/abs/slots.json --drafts-dir=/abs/backup/admin-order-drafts --out=/abs/ab-generated.json`
   Lasa melnrakstus no lokāla Blob backup; Blob/DB env tiek izdzēsts procesa sākumā. v1 = `gemini`, v2 = `TECH_RISK_V2=1` tikai šim izsaukumam. Gala sadaļu teksti netiek doti (tie ir zelts). Opus izmantošana = kļūda. Vajag `GEMINI_API_KEY` + `ANTHROPIC_API_KEY` vidē.
2. `npx tsx scripts/tech-risk-ab-package.ts --slots=… --generated=… --out-dir=/abs/iriss-pack` → `ab-fixture.json`, `vertesana.html`, `vertejumi.csv`, `_atslega.json` (nedot IRISS).
3. `npx tsx --import ./scripts/stub-server-only.mjs scripts/tech-risk-ab-harness.ts --fixture=/abs/iriss-pack/ab-fixture.json --out=/abs/harness.json` (pievieno edit distance pret zeltu).

## Operatora checklist

1. Dzinēja kods A vai skaidri B/C?
2. Kārbas tips sakrīt ar modeli un gadu?
3. Ķēde vai zobsiksna atbilst kodam?
4. Galvenie 1-2 riski atbilst šī auto km un vecumam?
5. Fiksētie darbi nav "jāmaina"?
6. Atsaukumi ar avotu vai "nav atrasts"?
7. Izsoles bojājumi pārvērsti mezglu riskos?
8. Nav resursa skaitļu / kampaņu bez avota?
9. Nav ievada "aprīkota ar" / "manā pieredzē"?
10. Kartes avotos nav tikai Reddit/ASV forumi par Eiropas spec?
