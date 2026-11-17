# Nobraukuma etalona kopa

11 īstas lietas no pabeigtiem auditiem (Nils 17.11.2026). Ieejas dati ir pasūtījumu melnrakstu `sourceBlocks`
bez komentāriem, foto, neapstrādātiem tekstiem un sludinājuma analīzes. Klienta un pārdevēja datu failos nav.

- `<VIN>.json` - ieejas dati + Nila manuālie lēmumi (`odometerAnomalyOverrides`), ja tādi ir.
- `__snapshots__/<VIN>.snap.json` - ko sistēma secina TAGAD (tabula, anomālijas, klases, sarkanā josla, AI faktu lapa).
- Tests: `lib/mileage-etalons.regression.test.ts`.

Momentuzņēmums nav pareizā atbilde. Mainot nobraukuma loģiku, katra atšķirība jāizskata un jāsalīdzina ar
"Zināmās kļūdas" zemāk. Momentuzņēmumu atjauno ar `npx vitest run lib/mileage-etalons.regression.test.ts -u`.

## Ierobežojumi

- carVertical brīdinājums par nobraukumu tiek atpazīts no neapstrādātā teksta, kas šeit ir izņemts, tāpēc
  `carverticalMileageWarning` etalonā vienmēr ir `false`.
- Sludinājuma avots (`listingUrl`) ir tikai domēns.

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

## Kontroles lietas (jāpaliek bez brīdinājuma)

BMW M340i `WBA6N11090FM46528`, Audi Q5 `WAUZZZ8R1DA017696`, Audi A5 `WAUZZZ8T48A014034`, Mercedes GLE
`WDC1671191A002835`, Volvo V70 `YV1BW7051A1153569`, Volvo V90 `YV1PZ68TCK1076852`.

Īstas manipulācijas lietas kopā vēl nav - tāda jāpievieno, pirms maina izslēgšanas noteikumus.
