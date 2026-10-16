# 09. Garuma un formulējumu noteikumi (Kopsavilkums un Tehniskie riski)

Aiz `LENGTH_RULES_V2=1`. Kanoniskais teksts promptam: `AI_LENGTH_WORDING_RULES_V2` (`lib/ai-length-rules-v2.ts`).

## Jaunie noteikumi

GARUMS
- Tehniskie riski: 1 200-2 500 rakstzīmes, 4-7 sadaļas. Katra sadaļa: virsraksts + 2-3 teikumi. Ja kāds mezgls neattiecas uz šo km posmu, to neraksti.
- Kopsavilkums: 500-900 rakstzīmes, divi bloki: "Fakti" (3-5 teikumi) un "Mūsu ieteikums" (2-3 teikumi).
- Cilvēki nelasa memuārus: katrs teikums dod jaunu faktu vai darbību.

SATURS (tehniskie riski)
1. Visas galvenās problēmas PAŠREIZĒJĀ nobraukumā: mezgli, kuru tipiskā km josla jau ir sasniegta vai pārsniegta un darbs datos nav fiksēts.
2. Nākamie ~100 000 km: 2-3 tipiskākās šī dzinēja/kārbas problēmas, kas parasti parādās šajā km logā (no KB next_100k_focus). Viena sadaļa "Nākamajos 100 000 km".
3. Ja darbs jau fiksēts servisā, to pasaki vienā teikumā, neliec kā risku.
4. Atsaukumi: viena rinda, ja atrasti vai "nav atrasti publiskajos avotos".

FORMULĒJUMI (konsultatīvi, mēs auto neesam redzējuši)
- Lieto: "iesakām", "ir vērts pārbaudīt", "pēc datiem", "tipiski šim dzinējam", "var norādīt", "pirms darījuma ieteicams".
- Nelieto: "obligāti", "noteikti", "kritiski", "jāmaina", "netiek rekomendēts", "auto ir bojāts", "garantēti", "ļoti bīstams".
- Verdikts kopsavilkumā: "Pēc pieejamajiem datiem mūsu ieteikums būtu …", nevis "iegāde netiek rekomendēta".
- Nekad nerakstīt kā PROVIN būtu auto redzējis, braucis vai diagnosticējis.

## Validatora noteikumi

| ID | Noteikums |
|---|---|
| G1 | TR > 2 500 vai < 1 000 rakstzīmes → brīdinājums; > 3 200 → pārģenerē īsāk |
| G2 | Kopsavilkums > 900 → pārģenerē |
| G3 | TR bez sadaļas „Nākamajos 100 000 km” (ICE) → kļūda |
| G4 | `obligāt|noteikti|kritisk|netiek rekomendēt|jāmaina` → aizstāt ar konsultatīvu formu (Gemini QA) |
