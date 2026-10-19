# PROVIN agregātu faktu bāze un pirms-publicēšanas faktu pārbaude

Nils apstiprināja 17.10.2026. Kods: `lib/unit-facts/`, API: `POST /api/admin/ai/fact-check`.

## Faktu bāze (`lib/unit-facts/facts.ts`)
- Katrs fakts: `id`, kodi, tēma, kanonisks LV teikums, `status`, avoti (`kind`, `title`, `url`, `accessed`), `appliesTo` (kad attiecas uz auto), `contradictions` (deterministiski teikuma noteikumi).
- `verified`: ≥1 ražotāja/iestādes avots vai ≥2 neatkarīgi avoti → ģenerē pretrunu karodziņus.
- `disputed`: avoti nesakrīt (piem. 48VS piederība Tiguan; DQ381 eļļas intervāls ES pret ASV) → tikai brīdinājums „pārbaudi manuāli”.
- `pending_nils`: B1–B8 tēmas → pārbaude ignorē, līdz Nils izlemj.
- `draft`: ignorē (netiek ievadīts promptā un nepārbauda).
- Nils 17.10.2026: `vag_30tdi_gen2_chain_count` (CLAA/CRCA, EA897) ir `verified`, 2 ķēdes (SSP 479, 9. lpp.; Touareg 2010+ RG15). Drīkst ievadīt promptā.
- EUR summas faktu bāzē aizliegtas (tests).
- Nils 19.10.2026: tikai km. Avota jūdzes pārrēķina (1 mi = 1.609344 km, veseli km). Jūdzes / mi / mph faktu tekstā nav.
- Esošā `data/kb/*.yaml` (Andra draft KB) netiek mainīta; šī bāze ir stingrāka (tikai avototi fakti).

## Pārbaude (`checkAiCommentFacts`, bez maksas)
Teksts NETIEK mainīts vai dzēsts. Rezultāts: karodziņi adminam.
1. **E pretruna** ar verificētu faktu, kas attiecas uz šo auto (piem. Q7 4L + „ZF”).
2. **W strīdīgs fakts** (piem. 48VS Tiguan piederība, DQ381 intervāls).
3. **E „atsaukumu nav”**, lai gan pasūtījuma datos ir kampaņas kods (A12/…, 48VS, 21V-035, MB 7 ciparu kods), un teksts to nepiemin.
4. **W neavotots kampaņas kods** (nav ne datos, ne bāzē).
5. **W jauda kW**, kuras nav pasūtījuma datos.
6. **W apkopes intervāls** bez avota (nav ne datos, ne bāzē).
Konteksts = tikai šī pasūtījuma dati (`buildAiOrderContextText`), bez stila korpusa un citu auto vēstures.

## Neobligāts AI slānis
`UNIT_FACT_CHECK_AI=1` + pieprasījumā `useAi: true` → Gemini Flash (`gemini-flash`) meklē pārfrāzētas pretrunas tikai pret šī auto verificētajiem faktiem. Tikai W. Citāti, kuru nav tekstā, tiek izmesti. Anthropic netiek lietots. Noklusējumā izslēgts.

## Prompta ievade
`formatApplicableUnitFactsForPrompt()` atgriež šī auto **verificētos** faktus kompaktā blokā „Pārbaudīti fakti”. Ievadīts tehnisko risku v1 user promptā un v2 kartes promptā. Strīdīgie fakti, B tēmas (`pending_nils`) un `draft` netiek iekļauti. Modelim jānesakrīt ar šiem faktiem.

## Fakta pievienošana
Pievieno ierakstu `facts.ts` ar avotu un datumu; testi pārbauda avotu/datuma/EUR noteikumus. PROVIN ADMINS / IRISS labojumi: avots `iriss` + vismaz viens ārējs avots, lai būtu `verified`.
