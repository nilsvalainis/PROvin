# IRISS/PRO mobilā sākumlapa — Claude briefs v2 (25.10.2026 rīts)

**Kam:** Claude `dizaineris` (Opus). **Ziņai:** Andris / Kārlis. **No:** Grok Dizaineris.
Modelis: `--agent dizaineris --model claude-opus-5-5` (kā j64). Vēsturiskais konteksts: `claude-brief-2510.md` (j64).

## Nila citāts (25.10, 08:47)
> «Dod claude, es gribu gan funkcionalitati, gan modernu dizainu. Apli man patika, jo tie loti labi uzskatami un atri paradija statusu, bet neieklavas kopa ar logistiku. Iedod neparzimetas menu ikonas (iznemot csdd. Logistika, autoparks) ari parzimet labakas.»

## Uzdevums
10 (pieļaujami 8–12) **pilni** IRISS mobilās sākumlapas varianti + tas pats stils PRO. HTML+PNG, iPhone ~390×852. **Bez produkcijas koda.**
Fokuss: **funkcionalitāte + moderns dizains** vienā ģimenē.

**Galvenā dizaina mīkla:** apļi (vai tikpat uzskatāma statusa valoda) Pavadzīmēm — Nils tos mīl — **un Loģistika tajā pašā vizuālajā ģimenē**, bet skaidri atšķirama. Iepriekš apļi + Loģistika «nesadera».

## Kas NOLEMTS (neārdīt)
1. Apakšējā josla C — peldoša kapsula, 3 ikonas (Sākums / Vairāk / Meklēt), ~97% balta. Sk. `josla-maja.png`.
2. Hierarhija: **Pavadzīmes AUGŠĀ**, **Loģistika APAKŠĀ** (loģistikas info vienkāršāks).
3. Pavadzīmes: **visi auto uzreiz**; katram: **numurs** (burti/cipari, bez fotoreālas numurzīmes), **marka**, **atlikušais laiks**. Bez «Visas» pogas; bez slogana — vai ļoti kluss. Vesels laukums → pavadzīmju rakstīšana.
4. Loģistika: Nākošā / Aiznākošā / Gaida (krāsas OK). Viena pieskāriena zona.
5. Zaļais dominantais chrome Nilam **nepatīk** — CSDD flīze `#006225` OK; hero plāksnes nezaļas.
6. PRO fons (variants 7): `#e4e4ea → #cfcfd6`. IRISS — mīksts zili-pelēks.
7. Edge-to-edge; flat; Inter; Apple premium; touch ≥44px; bez AI zīmolu bildēm.

## Ikonas
**NEAIZTIKT (īstās zīmes):**
- Autoparks = Dzintarzeme logo (`dz-trim.png`), ar atkāpi
- Pavadzīmes = CSDD logo full-bleed `#006225` (`csdd.png`)
- Loģistika = Google Maps tapa (SVG rekonstrukcija OK, ja nav oficiālā faila)

**PĀRZĪMĒT labākas (vienā modernā stilā):** visas pārējās flīžu ikonas — vismaz VIN pārbaude, Pasūtījumi, Sludinājumi, Radars, Kravas — un «Vairāk» saraksta ikonas (sk. `a02-iriss-vairak-pec.png`, `a04-ikonu-lapa.png`). Premium, flat, savstarpēji saskaņotas.

Katram variantam: sākums ar jaunajām ikonām + ideāli viens «Vairāk» ekrāns ar pārzīmētajām.

## Jau noraidīts / konteksts (nekopēt)
- Grok v7 Loģistikas A/B/C — «Neviens nepatīk»
- Claude j64 01–10 — «nav tā sajūta, ka viss kopā»
- Zaļās R2 joslas kā dominantais chrome — zaļā nepatīk

Grok eksperimenti (konteksts, ne šablons):
- v8 radical, v8b/v8c R2 ar karti + visiem auto — `r2i.png`
- v9 Pavadzīmes augšā / Loģistika apakšā, mazāk zaļā — `v9b.png`, `v9d.png`
- v10 laika indikatori (josla, degvielas iedaļas, 0:43, luksofora mala, čipa platums) + foni — `v10-parskats.png`, `v10d.png`, `v10b.png`

## Funkcionalitātes prasības (dizainā skaidri redzamas)
1. Statuss no pirmā skatiena (apļi vai līdzvērtīgs — «ļoti labi uzskatāmi un ātri parādīja statusu»).
2. Steidzamība pēc atlikušā laika (0h 43m vs 45h).
3. Visi aktīvie auto bez scroll, ja iespējams. Demo: B762-7 MB E250 0h43m; B201-7 BMW 320 1h05m; B193-7 Audi Q7 2h14m; B192-7 VW Touran 45h.
4. Loģistika ātri lasāma, vizuāli ģimenē ar Pavadzīmēm.
5. Moderns 2026 iOS/Apple look — ne «admin tabula».

## Nodošana
HTML+PNG mapē `docs/iriss-menu-mobilais/claude-v2/` (vai Mac `~/opus-q2310/j…/out/`). Rinda `komandu-zinojumi.md`. Nilam rāda Grok Dizaineris. **Kods produkcijā tikai pēc Nila «jā».**
