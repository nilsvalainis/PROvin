# Nobraukuma etalona kopa

41 īsta lieta no pabeigtiem auditiem (Nils 17.11.2026): 11 no Dropbox atskaitēm + 30 ar avotiem piesātinātākie
admin pasūtījumi (atlase pēc avotu skaita, nobraukuma rindām un negadījumiem; demo un dublikāti izlaisti). Ieejas dati ir pasūtījumu melnrakstu `sourceBlocks`
bez komentāriem, foto, neapstrādātiem tekstiem un sludinājuma analīzes. Klienta un pārdevēja datu failos nav.

- `<VIN>.json` - ieejas dati + Nila manuālie lēmumi (`odometerAnomalyOverrides`), ja tādi ir.
- `__snapshots__/<VIN>.snap.json` - ko sistēma secina TAGAD (tabula, anomālijas, klases, sarkanā josla, AI faktu lapa).
- Tests: `lib/mileage-etalons.regression.test.ts`.

Momentuzņēmums nav pareizā atbilde. Mainot nobraukuma loģiku, katra atšķirība jāizskata un jāsalīdzina ar
"Zināmās kļūdas" zemāk. Momentuzņēmumu atjauno ar `npx vitest run lib/mileage-etalons.regression.test.ts -u`.

## Ierobežojumi

- carVertical brīdinājums par nobraukumu tiek atpazīts no neapstrādātā teksta, kas šeit ir izņemts, tāpēc
  `carverticalMileageWarning` etalonā vienmēr ir `false`.
- Sludinājuma avots (`listingUrl`) ir tikai domēns (pirmajām 11), pārējām nav.
- 30 admin lietām izņemti arī "Citi avoti" komentāri, tāpēc no komentāriem parsētie rādījumi tur nav.
- Ford Galaxy VIN eksportā ir maskēts (`WF0KXXXXXXXXXXXXX`), fails nosaukts pēc pasūtījuma.

## Zināmās kļūdas pašreizējā rezultātā (17.11.2026)

1. **carVertical mēneša datumi kā 1. datums.** carVertical dod mēnesi un gadu, mēs glabājam `01.MM.GGGG` ar dienas
   precizitāti. Rādījums no mēneša beigām nonāk pirms precīza dīlera ieraksta mēneša sākumā, un pareizais dīlera
   rādījums tiek atzīmēts kā ievades kļūda:
   - BMW 650i `WBAYM9C55DDW20079`: `01.12.2013 35820 CarVertical` pret `02.12.2013 33694 dīleris` (dīleris 14.12.2013: 35842);
     `01.07.2016 138029 CarVertical` pret `05.07.2016 135633 dīleris` (dīleris 19.07.2016: 138084).
   - BMW 120d `WBAUD91050PA62588`: `01.08.2013 13437` pret `10.10.2013 12177 dīleris` - jāpārbauda tāpat.
   - BMW X5 `WBAFF41030L065449`: `01.05.2026 279560 CarVertical (Itālija)` pret `26.06.2026 277681 CSDD` - sarkanā josla
     uz CSDD rādījuma. Starpība 1879 km; var būt īsta, jāvērtē atsevišķi, bet vainīgais punkts nav CSDD.
2. **AI faktu lapa pretrunā ar klasifikāciju.** `faktuLapa.rollbacks` satur arī kritumus, kas klasificēti kā
   `typo_outlier` (BMW 650i 5 ieraksti, `maxRollbackDropKm` 54722; BMW 120d 1260), lai gan `odometerAnomaly` ir `false`.
   Komentāru ģenerēšana tos saņem kā kritumus.
3. **Sludinājuma rādījums kā kritums.** Audi A6 `WAUZZZ4G8DN015599`: `01.05.2026 310000` -> `05.09.2026 309000 ss.lv`
   ir faktu lapas kritumu sarakstā (noapaļots sludinājuma rādījums).
4. **Ieraksta veids nav saglabāts.** BMW 320d `WBA3K31080F656545`: `27.09.2015 90000 AutoDNA` ir pārdošanas
   sludinājums, bet klasificēts kā `typo_outlier` (ievades kļūda), nevis "pārdevēja norādīts".
5. **Neapstrādātais dīlera ieraksts apiet tabulu.** BMW 320d: OneAuto oriģinālā ir `20.11.2012 90000 km` (6 dienas pēc
   pirmās reģistrācijas). Tabulā tā nav, bet dīlera komentārs to ņēma no oriģināla un uzrakstīja "kritums par 87 046 km".
   Nils šai lietai ar roku noraidīja 3 atzīmes un apstiprināja 1 (sk. `odometerAnomalyOverrides`).
6. **Izsoļu arhīva mēneša datumi.** Audi A6: `01.07.2022 207000 izsoļu arhīvs` pēc `28.04.2022 216060 CSDD` - sarkanā
   josla; jānoskaidro, vai izsoles rādījums ir no agrāka brīža (dokumenta datums) vai īsts kritums.

## Kopsavilkums visām 41 lietai (17.11.2026)

- Sarkanā josla: 9 lietas. No tām 3 ir īstas manipulācijas (kontrole, sk. zemāk), pārējās 6 ir datu kļūdas vai
  neskaidras.
- Klasificēti kritumi kopā: 21; no tiem 11 sākas no rādījuma ar datumu `01.MM.GGGG` (mēneša precizitāte, 1. kļūda).
- AI faktu lapa satur kritumus, lai gan karogs ir izslēgts: 6 lietas (2. kļūda).

### Kļūdu klases ar piemēriem

| Klase | Lietas |
|---|---|
| A. Mēneša datums kā 1. datums (carVertical, AutoDNA). **carVertical labots 17.11:** tā rādījumi ir mēneša precizitātē un mēnesī kārtoti pēc km - pazuda 6 viltus kritumi (A3, 318d, 525, 320d, 650i x2), jaunu nav. Atlikušie: AutoDNA mēneša datumi, CV pret dīleri dažādos mēnešos (120d xDrive, X5) - sk. B | 650i `WBAYM9C55DDW20079`, 120d `WBAUD91050PA62588`, X5 `WBAFF41030L065449`, 120d xDrive `WBA1B51010J842587` (CV 01.07.2023 167 422 pret dīleri 05.02.2024 159 891 - josla uz dīlera), 318d `WBA8X11080BH25532`, 525 `WBAMX31050C524401`, A3 `WAUZZZ8V1H1033853`, Galaxy 2017 |
| B. Vainots pareizais punkts, nevis kļūdainais. **Kļūdains pirmais rādījums labots 17.11** (`isLeadingMileageEntryError`): 320d `WBAUY11040F045354` josla nodzisa, kļūda tagad uz 22 997. 320d `WBA3K31080F656545` 90 000 nav tabulā (tikai OneAuto oriģinālā) - jālabo komentāra avotā, ne analīzē | 320d `WBAUY11040F045354`: dīleris 22.09.2011 22 997, nākamajā dienā 12 397, CV 10.2011 12 347 - josla uz 12 397 (pareizā); 320d `WBA3K31080F656545` (90 000 pirmajā ierakstā) |
| C. Faktu lapa pretrunā ar klasifikāciju. **Labots 17.11:** faktu lapas kritumi tikai tur, kur tabula redz `rollback` - pazuda 11 viltus kritumi, visas 8 lietas ar joslu savus kritumus patur | 650i, 120d, 316 `WBA3D91080J411190`, 318d, 525 `WBAMX31050C524401`, 525 `WBAPX51050CU09550` |
| D. Novecojis dokuments / sludinājums kā kritums. **Sludinājumi labots 17.11 (Nils B2):** AutoDNA/CV rādījums, kas avota laika joslā ir sludinājums, ir "AutoDNA (sludinājums)"; sludinājums zem iepriekš fiksētā ir dzeltens "sludinājumā mazāk" (tabula, PDF piezīme, laika josla), nekad sarkanā josla (320d 27.09.2015 90 000, A6 ss.lv 309 000). Izsoļu arhīvs (A6 07.2022 207 000, 640i) paliek pilnvērtīgs rādījums (izsoļu nama fiksējums, apstiprina AutoDNA/CV) - pēc Nila 18.11 noteikuma kritums = manipulācija, josla paliek | Audi A6 Allroad (izsoļu arhīvs, ss.lv noapaļots), 640i `WBALW3C59CC891863` (izsoļu arhīvs atkārto 81 116 un 93 593) |
| E. Jūdzes / km aizdomas (ASV auto). **Pārbaudīts 18.11:** 650i un 640i dīlera dati jau km (BMW parsētājs pārrēķina), kritumi īsti; 330i "Citi avoti" 49 890 bez vienības - kritums US->DE valsts maiņā paliek (manipulācija). Automātiski minēt vienību nedrīkst; kur avots dod jūdzes, PDF tagad ir skaidrojums (Nils B7) | 330i `WBA5R1C0XLFH42873` (ASV 11.08.2020 49 890 -> DE dīleris 2022 32 552 km), 640i (AutoDNA 2017 126 012 starp ASV jūdzēm?), 650i (0 rindu atzīmētas kā jūdzes) |

### Īstas manipulācijas (kontrole - josla jāpaliek)

- Ford Galaxy (Dānijas taksometrs) `WF0K-maskets-VmX9EF`: DK reģistrs 20.04.2022 529 000 -> LV 09.2024 195 623.
- Škoda Superb `TMBJH9NP9H7561596`: Zviedrija 11.05.2020 253 760 -> LV 28.09.2020 181 345.
- Ford F-150 `1FTEX15NXSKB79831`: EE 10.07.2025 340 543 -> LV 05.03.2026 72 348 (Nils 18.11: manipulācija).
- BMW 120d xDrive `WBA1B51010J842587` (Francija): CV 07.2023 167 422 -> dīleris 05.02.2024 159 891 (Nils 18.11:
  nepārprotama korekcija = manipulācija).
- BMW X5 `WBAFF41030L065449`: Itālija 05.2026 279 560 -> LV CSDD 26.06.2026 277 681 (imports; Nils 18.11: korekcija =
  manipulācija).

Nila noteikums 18.11: katra īsta neatbilstība atskaitē ir odometra manipulācija neatkarīgi no iemesla (korekcijas Nils
labo komentārā). Neloģiski rādījumi ap valsts maiņu jāvērtē īpaši uzmanīgi.

## Kontroles lietas (jāpaliek bez brīdinājuma)

Bez brīdinājuma (32 lietas), piemēram: BMW M340i `WBA6N11090FM46528`, Audi Q5 `WAUZZZ8R1DA017696`, Audi A5
`WAUZZZ8T48A014034`, Mercedes GLE `WDC1671191A002835`, Toyota Land Cruiser `JTEBZ29J500168234`, Renault Espace
`VF1JK1HC647031151` (52 rindas), BMW 525 `WBAFW31060C941862` (95 rindas), Volvo V90 `YV1PZ68TCK1076852`.
