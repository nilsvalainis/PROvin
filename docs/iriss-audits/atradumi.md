# IRISS audits - atradumi (dzīvais žurnāls)

Formāts: [sadaļa] [ierīce] smagums (K kritisks / A augsts / V vidējs / Z zems) - apraksts. Pierādījums.

## Pavadzīmes
- [Pavadzīmes] [dators] V - Ielādes brīdī formā visi numuri (arī B 762-7 ar derīgu P02829) uz brīdi rāda "Brīvs", pēc tam pārslēdzas uz "Aizņemts". Statusam ielādes laikā jārāda "...", ne "Brīvs".
- [Pavadzīmes] [dators] Z - Viena un tā pati pavadzīme: kartē oranža josla "vēl 2 d.", sānjoslā zaļš aplis "39h" - dažādas krāsas un vienības.
- [Pavadzīmes] [dators] Z - Pogu rindā "Vēsture" ir mazāka, citāda stila poga nekā PDF/Pagarināt/Pārtraukt.

## Kopīgi / navigācija
- [Pasūtījumi] [dators] V - Statusu čipi: "Aktīvs" un "Rezervēts" abi melni (izskatās abi atlasīti), nav skaidrs, kurš filtrs aktīvs.
- [Pavadzīmes] [dators] A - Lapa ir ~17 700 px gara: visa dienas sarakste ("CSDD pavadzīme") izplešas bez augstuma ierobežojuma, un jaunās pavadzīmes forma ir pašā apakšā. Pēc iesniegšanas apstiprinājums parādās saraksta vidū, ne pie formas.
- [Pavadzīmes] [dators] V - Komentāra vietturis "B193 uz 48h", lai gan noklusējums ir 12 h un izvēlēts cits numurs - mulsina.
- [Pavadzīmes] [visas] Z - UI tekstā tehnisks žargons "comment_untrusted" (Aivara ierobežojumu blokā).
- [Pavadzīmes] [dators] V - Validācijas kļūda ("Izvēlies auto...") parādās virs pogas, nevis pie lauka, un paliek redzama arī pēc lauka aizpildīšanas; tās parādīšanās/pazušana un norāde "Nav tirdzniecībā pieņemto auto sarakstā" pārbīda pogas (klikšķis trāpa citur).
- [Pavadzīmes] [visas] A - "Ar roku" marka netiek pārbaudīta pret CSDD marku sarakstu. Automātika paņem darbu (10 s), krīt pēc 18 s ("marka nav atrasta CSDD sarakstā"), nodod Aivaram (+30 s). Vajag marku izvēli/ieteikumus no CSDD saraksta jau formā. (tests wbr_c17c5545d92e2ff7, 26.10 21:45)
- [Pavadzīmes] [dators] Z - Abas formas (mobilā un datora) vienmēr renderētas DOM (viena paslēpta ar CSS) - dubults stāvoklis, divas "Izveidot pavadzīmi" pogas.
- [Pavadzīmes] [telefons 390] A - Apakšējā peldošā josla (Sākums / 99+ / Meklēt) aizsedz galveno pogu "Izveidot pavadzīmi"; lapai trūkst apakšējās atstarpes. (ekrānuzņēmums 26.10 21:48)
- [Pavadzīmes] [telefons vs dators] A - Telefona formā ir bloks "Sākuma adrese" (Tukums / Cita adrese), datora formā tā nav (maršrutu var norādīt tikai komentārā). Divas dažādas formas vienai darbībai.
- [Pavadzīmes] [telefons] V - Kamēr B193-7 darbs ir pie Aivara (aplis "Aivars"), formas numura poga rāda "brīvs" - pretrunīgi; jārāda "gaida Aivaru".
- [Pavadzīmes] [telefons] Z - Komentāra vietturis "193 uz BMW 330" atšķiras no datora "B193 uz 48h".
- [Pavadzīmes] [dators] A - Aktīvās pavadzīmes kartē 1 h pavadzīme (P02832, līdz 22:47, atlikušas ~58 min) rāda "vēl 1 d." - dienu skaits noapaļots uz augšu. Sānjoslā tai pašai "0h". Vajag stundas/minūtes, ja < 24 h, un vienādu vienību visur.
- [Pavadzīmes] [dators] A - "Pagarināt" neko redzamu neizdara: tikai aizpilda formu lapas apakšā (~19 000 px zemāk). Lietotājs domā, ka poga nestrādā. Vajag logu/paneli turpat pie kartes.
- [Pavadzīmes] [visas] V - "Pagarināt" faktiski ir "pārtraukt veco + izdot jaunu no šī brīža". Apstiprinājuma logs saka "Vai tiešām pārtraukt iepriekšējo un izveidot jaunu?" - lietotājam, kas spieda "Pagarināt", tas izklausās biedējoši. Teksts: "Pagarināšana CSDD = jauna pavadzīme. P02832 tiks pārtraukta, jaunā derīga līdz ..."
- [Pavadzīmes] [dators] Z - Pagarināšanas formā noklusējums 12 h neatkarīgi no sākotnējās pavadzīmes ilguma.
- [Pavadzīmes] [visas] Z - Viena pavadzīme dažādi nosaukta: pieprasījumā "TESTS VW Golf", CSDD/kartē "VW GOLF"; P02829 kartē "BMW IX", telefona sarakstā "BMW ix40".
- [Pavadzīmes] [dators] Z - Kartē var būt divas pogas "Vēsture" (CSDD vēsture pēc VIN un izmaiņu vēsture) ar dažādu stilu.
- [Pavadzīmes] [telefons] A - "Pārtraukt" darbs (stop) sarakstā rādās kā "Izveido · Aivars veido pavadzīmi CSDD... solis 2 no 3", sānjoslas pogā "izraksta Aivars ar roku" - lietotājs redz, ka tiek izrakstīta jauna, nevis pārtraukta.
- [Pavadzīmes] [telefons] V - "Cits" stundas: telefons pieņem tikai 1-48 h ("Ieraksti derīgumu: no 1 līdz 48 h"), bet API un j8 lēmums atļauj 1-2160 h. Jāsaskaņo (un datorā jāpārbauda).
- [Pavadzīmes] [visas] V - Vēsturē teksts "Iepriekšējā pavadzīme P0xxxx CSDD anulēta", lai gan sistēma drīkst tikai "Pārtraukt" (Anulēt aizliegts). Vārdu "anulēta" jāaizstāj ar "pārtraukta", ja tā tiešām ir pārtraukšana.
- [Pavadzīmes] [telefons] Z - Apstiprinājuma logs nav centrēts; apakšējā josla paliek virs tumšā fona (nav aptumšota, var nospiest).
- [Pavadzīmes] [visas] Z - Viena pavadzīme ar dažādiem laikiem: kartē "līdz 22:51" (pieprasījums), logā "līdz 22:52" (CSDD).
- [Pavadzīmes] [visas] + Labi: telefona darba gaita ar soļiem (Gaida/Izveido/Izdota, "solis 2 no 3", iemesls "Automātikai neder (B192 tikai ar roku)") ir saprotama - šo modeli ņemt arī datoram.
- [Pavadzīmes] [dators] K - Datora formā "No saraksta" (tirdzniecībā pieņemts auto) pieprasījums aiziet ar tradeAct=false, noklusējuma maršrutu un bez komersanta pārstāvja (wbr_c4d870ac31fcc7c9, AUDI A6). Telefona forma to pašu sūta pareizi (tradeAct=true, pārstāvis "Nils Valainis", maršruts tukšs - wbr_d66c696ccb10caf9). Datora formā nav "Komersanta pārstāvis" izvēles. Sekas: automātika izdod parastu pavadzīmi (P02834, 42 s), nevis no tirdzniecības akta. Kods: IrissWaybillDesktopCreateForm + IrissKomandaAivaramChat nelieto buildWaybillMobileRequest/tradeAct. LABOT 1. PR.
- [Pavadzīmes] [dators] Z - Tirdzniecības auto izvēlē katrā rindā vienāda zīme "Pieņemts" (bezjēdzīga); trūkst numura zīmes un akta nr./datuma, pēc kā cilvēks atpazīst auto.
- [Pavadzīmes] [visas] Z - Automātikas darba vēsturē 5 tukši "message" notikumi (bez teksta) pirms "Izdota".
- [Pavadzīmes] [visas] Z - "Pārtraukt" darbs pēc izpildes saglabājas ar statusu "issued" (tāpat kā izdota pavadzīme) - jāatšķir "Pārtraukta".
- [Pavadzīmes] [telefons] V - "Saruna" ikonas skaitlis aug ar katru notikumu (24 -> 26 -> 28 -> 34 pusstundā), nav skaidrs, kas jāizlasa; troksnis.
- [Pavadzīmes/Kalendārs] [dators] A - Kalendārā pārtrauktas pavadzīmes (P02830 "SKODA OC..." pārtraukta, ar sākotnējo beigu laiku 27.10 01:48) rādītas oranžā kā "beidzas 24 h laikā" - izskatās, ka numurs vēl aizņemts. Pārtrauktajām jābeidzas pārtraukšanas brīdī vai jābūt pelēkām.
- [Pavadzīmes/Kalendārs] [dators] V - Īsas pavadzīmes vienā dienā pārklājas: joslas un teksti uzklājas viens uz otra ("S", "B", "N", "SKODA OC" + "A."), nav nolasāmi.
- [Pavadzīmes/Arhīvs] [dators] Z - Tabulā katrā rindā "Atkārtot" (zila saite) un 1-2 pogas "Vēsture"; kolonna "Pasūtījums" visur "-" (sasaiste ar pasūtījumu netiek aizpildīta). Pārtrauktām rindām "Derīga līdz" rāda sākotnējo, ne faktisko beigu laiku.
- [Pavadzīmes] [kods/docs] V - Maks. derīgums: kods WAYBILL_VALID_MAX_HOURS=48 (UI "no 1 līdz 48 h"), bet docs/iriss-aivars-api.md un lib/iriss-waybill-auto.ts komentārs saka 1-2160 h, j8 lēmums "Cits (1-2160)". JAUTĀJUMS Nilam: kāds ir pareizais maksimums?
- [Pavadzīmes] [visas] Z - B192 (DZA) pieprasījumā galamērķis "Tukuma CSDD", bet CSDD PDF galamērķis Hermaņi-1 (DZA tirdzniecības vieta). UI rāda vienu, dokuments citu.
- [Pavadzīmes] [telefons] V - "Atcelt" gaidošam darbam lieto pārlūka window.confirm (vienīgais tāds logs - pārējie ir lietotnes logi). Atcelšanas logs ir ļoti īss: Aivars aizvietošanas darbu paņēma ~35-45 s pēc izveides; "Atcelt" ir maza zila saite blakus "Gaida". Tests nebija pārliecinošs (natīvais logs testa pārlūkā).
- [Pavadzīmes] [visas] Z - Tirdzniecības akta PDF fails "P02835.pdf", pārējie "P0xxxx_MARKA_MODELIS_NUMURS.pdf".
- [Pavadzīmes] [visas] + Labi: ātrums. Automātika standarta pavadzīmi izdod 42 s; Aivars 2-3,5 min (ar roku, aizvietošana, pārtraukšana, tirdzniecības akts). PDF saturs pareizs (pārstāvis, maršruts, citā adrese).

## Dizains / vienots stils (koda mērījumi 26.10)
- [Visas] K - IRISS UI komponentēs 202 dažādas hex krāsas, 18 dažādi fonta izmēri (text-[Npx]), 12+ stūru noapaļojumi (rounded-full/xl/2xl/lg/[10px]/[22px]/[14px]/[18px]/[11px]/[7px]...). Paralēlas stila sistēmas: admin-mobile.css (--am-*), admin-iriss-theme.css (--ink, --s1, --hair...), autoparks-v2.css, piedavajumi.css (pd-*), plus tieši ierakstītas krāsas (piem. Pavadzīmes #E5E7EB, #067647, #3d5bd9). Tas ir galvenais iemesls, kāpēc sadaļas izskatās atšķirīgi. Risinājums: viens tokenu slānis (0. posms) un pakāpeniska pāreja.

## Pasūtījumi
- [Pasūtījumi/jauns] [dators] A - Klienta dati ir 6. blokā (pēc specifikācijas, diapazoniem, darījuma detaļām, kritērijiem, aprīkojuma, piezīmēm). Darbs sākas ar klientu - tam jābūt pirmajam.
- [Pasūtījumi/jauns] [dators] A - 9 atsevišķas "Saglabāt" pogas (katram blokam + augšā), lai gan ir autosaglabāšana (URL kļūst par pasūtījuma id jau pēc pirmajiem laukiem). Nav skaidrs, kas saglabāts un kas nē.
- [Pasūtījumi/jauns] [dators] A - Auto prasības trīs vietās: "Diapazoni" (cena/gadi/km/tilpums/jauda), "Kritēriji · Filtrs 1" ("Teksta laukos nav nolasāmu kritēriju") un teksta lauki (degviela, ātrumkārba, virsbūve, krāsas...). Lietotājs nezina, kas filtrē Meklētāju.
- [Pasūtījumi/jauns] [dators] V - Degvielas izvēlē nav "Elektro" (sarakstā ir Hyundai IONIQ EV pasūtījums), nav "Gāze".
- [Pasūtījumi/jauns] [dators] V - Tukšam pasūtījumam tāmes bloks rāda "Klientam redzamā gala summa 1439,90 €" (tikai komisija) - mulsinoši.
- [Pasūtījumi/jauns] [dators] Z - Virsraksts "SLUDINĀJUMU PLATFORMAS (SAITES)" atkārtojas divreiz; poga "Atjaunot ET" (nesaprotams saīsinājums); Mobile.de rindai nav "Izveidot", pārējām ir.
- [Pasūtījumi/jauns] [dators] Z - Izstrādātāju teksti UI: "Tas pats aprēķins IRISS un demo. Esošais pasūtījums netiek pārrakstīts.", "Aprēķinos ņemts augstākais skaitlis. Diapazons paliek tikai grāmatzīmēm."
- [Pasūtījumi/jauns] [dators] Z - "Dzēst pasūtījumu" redzams arī vēl nesaglabātam jaunam pasūtījumam; obligātie lauki (Cena, Gadi) iekrāsoti sarkani jau pirms lietotājs ko ievadījis.
- [Visas] [dators] V - Sānjoslas saitēm nav pieejama nosaukuma (ekrāna lasītājs/aģenti redz "link" bez teksta).
- [Pasūtījumi/jauns] [~580 px logs] V - Šaurā logā darbību josla (Līgums/Piedāvājums/Saglabāt) uzklājas uz lauka "Marka / modelis".
- [Pasūtījumi/kartiņa] [dators] A - Komunikācijas cilnē pasūtījuma piezīme parādās kā notikums ar datumu "01.01 03:00" (tukšs laiks attēlots kā 1970-01-01). (TESTS e9d3c751)
- [Pasūtījumi/kartiņa] [dators] V - Cilne "Dokumenti 2" jaunam pasūtījumam bez neviena dokumenta (skaita līguma un tāmes ģeneratorus, ne failus).
- [Pasūtījumi/kartiņa] [dators] V - Tāmes "Automašīnas cena" un "Komisija EUR" pieņem jebkuru tekstu (piem. e-pastu); tāme no tā izrēķina "2,00 €". Vajag skaitļa lauku ar validāciju.
- [Pasūtījumi/kartiņa] [dators] V - Pēc pirmās autosaglabāšanas lapa pārslēdzas no "jauns" uz pasūtījuma skatu ar citu bloku secību (Pārskats/Meklētājs/... cilnes) - lietotājs, kas vēl raksta, var nonākt citā laukā. Jāpārbauda ar roku uz telefona.
- [Pasūtījumi/kartiņa] [dators] V - Pasūtījumā vienlaikus "Statuss" (Aktīvs/Rezervēts/Izpildīts/Neaktīvs) un "Darījuma statuss" (Jauns...Atcelts, 8) - apstiprināts dzīvajā skatā.
- [Pasūtījumi/kartiņa] [dators] Z - Pasūtījuma cilne "Piedāvājumi" un sānjoslas sadaļa "Piedāvājumi" - divas dažādas lietas ar vienu nosaukumu.
- [Pasūtījumi/kartiņa] [dators] Z - Izstrādātāja teksts "Tas pats kārtotājs kā piedāvājumā: vāks, dzēšana, atcelšana, velkšana." foto blokos; Meklētājā "Aplēse ~0,02 $ · griesti 0,25 $" un "Izmaksu pieņēmumi" - tehniski, ikdienā nav vajadzīgi (aizvērt akordeonā).

## Piedāvājumi (jaunā sadaļa)
- [Piedāvājumi] [klients] K - SALABOTS #669: visas /p/d klientu saites (PD-0001..0003) un admin PDF skats atgrieza 500 kopš #666 (funkcijas servera->klienta komponentei). 22:18-22:45.
- [Piedāvājumi] [dators] A - Poga "Nosūtīt un kopēt saiti" neko nesūta: tikai maina statusu uz "Nosūtīts" un nokopē saiti. Pirms tam jāspiež "Saglabāt" (citādi poga pelēka, bez paskaidrojuma). Vajag: Nosūtīt ar e-pastu / WhatsApp / kopēt.
- [Piedāvājumi/jauns] [dators] V - Nav "Tukšs / ar roku" sākuma (ir tikai No Autoparka, Izsoles saite, Reģistrēt pieprasījumu).
- [Piedāvājumi/jauns] [dators] V - Autoparka izvēlē arī tehnika, kas nav auto (piekabe "Unsinn ... Kipper", pacēlājs "Nussbaum ..."); saraksts bez gada/statusa/foto, tikai VIN beigas.
- [Piedāvājumi] [dators] V - No Autoparka ielasītie dati nav pārveidoti klientam: "Gads = 2017-08-23", "Virsbūve = Vieglais plašlietojuma" (CSDD kategorija), ātrumkārba tukša. "Cena klientam" formā divreiz (Pamatdati un Cenas).
- [Piedāvājumi/saraksts] [dators] Z - Modeļa kolonnā bez markas ("Ateca 2.0 TDI...", "XC70 2.4 D5...").
- [Piedāvājumi] [visas] A - Divas piedāvājumu sistēmas: vecā pasūtījuma iekšā (Pamatinfo/Apraksti ar AI tulkošanu/Cenas, saite /p/<token>, Kopēt/WhatsApp/E-pasts) un jaunā (Pamatdati/Aprīkojums/Kopsavilkums ar šabloniem/Novērtējums/Iekšējās cenas un marža, saite /p/d/<token>). Pasūtījumā jaunais PD redzams tikai kā josla virs lapas ("Piedāvājumi: PD-0003 ... Apstiprināts"), bet cilne "Piedāvājumi" rāda 0 - divi skaitītāji vienai lietai.
- [Piedāvājumi->Pasūtījums] [dators] + Labi: klienta "Apstiprināt" (1 pieskāriens) -> PD "Apstiprināts" -> pasūtījums automātiski "Rezervēts" + iekšējā piezīme ar saiti + statusa vēsture "Klients (piedāvājuma saite)". (TESTS 22:40)
- [Piedāvājumi->Pasūtījums] [dators] A - Pēc apstiprinājuma pasūtījumā "Pašreizējais solis: Sagatavot pirmo piedāvājumu" (nepareizi) un "Darījuma statuss: Jauns", lai gan statuss "Rezervēts". Autoparka auto (ŠKODA OCTAVIA) statuss netiek mainīts uz "Rezervēts".
- [Piedāvājumi/klients] [telefons] V - Klienta skatā jēlas vērtības: "2017-08-23" (gads/1. reģ.), "Vieglais plašlietojuma" (virsbūve), "Dīzeļdegviela". Virsrakstu stils jaukts ("PARAMETRI" lieliem burtiem, "Kopsavilkums" parasti). Nav "Noraidīt" vai "Uzdot jautājumu" (vecajā saitē ir). "Apstiprināt" bez apstiprinājuma soļa - var nospiest netīšām.
- [Piedāvājumi/klients] [telefons] V - "Apstiprināt" atbilde 7,1 s (POST /api/iriss-piedavajums/respond) - klients redz "Sūta..." 7 s; paziņojumi (e-pasts+push) jāsūta pēc atbildes (after()).

## Ātrums (serveris, admin, 26.10 22:55, fetch no pārlūka)
- [Sludinājumi] [visas] K - Lapas HTML 7,7 MB (visi sludinājumi un atbilstības iekļauti lapā uzreiz), servera atbilde 2-4,5 s; iebūvētais pārlūks lapu neielādēja 300 s laikā. Telefonā tas ir galvenais "lēnuma" cēlonis. Labojums: lapā tikai 1. lappuse (40 auto) un kopsavilkums, pārējais pēc pieprasījuma (API ar lapošanu).
- [Pavadzīmes] [visas] A - Servera atbilde 6-10 s (citām sadaļām 0,2-0,8 s): loadIrissPavadzimesPageData katrā atvēršanā palaiž runIrissPavadzimesDropboxSync. Labojums: lapa rāda kešu (kā sānjoslas karte), sinhronizācija fonā (after()/cron) + poga "Atjaunot".
- [Pārējās] - Sākums 0,55 s, Pasūtījumi 0,6 s (353 KB), Piedāvājumi 0,6 s, Radars 0,7 s, Loģistika 0,8 s, Autoparks v2 0,5 s, Atskaite 0,8 s, Iestatījumi 0,6 s, Izmaksas 0,4 s, VIN 0,5 s.

## Sludinājumi (darbinieks claude.demo, dators)
- [Sludinājumi] [visas] A - TREŠAIS piedāvājuma veids: sānu logā "Sagatavot piedāvājumu" atver teksta lauku ziņai ("Teksts tīrs: bez cenām, ID, platformas..."), nesaistītu ar pasūtījuma piedāvājumiem un sadaļu Piedāvājumi. Kartītē vēl "Nosūtīt klientam". Jāapvieno vienā "Izveidot piedāvājumu no šī auto" -> vienotā forma (izsoles saite jau ir).
- [Sludinājumi] [dators] A - Kartītē "Pasūtījuma detaļas" divreiz (saite pie klienta un liela poga), "Piezīme..." lauks katrā kartītē; cenas bloks 9 rindas (Aplēse virsrakstā un vēlreiz rindā, Izmaksas, PVN, Kopējās, Budžets, Ietilpst, Maks. solījums, var solīt vēl) + nesaprotama zīme "Marža" bez vērtības.
- [Sludinājumi] [dators] V - Izsoles dati netulkoti: nosaukums "Automaat", "Petrol", "Automatic" (UI latviski).
- [Sludinājumi] [dators] V - Atbilstība neprecīza: pasūtījums "Volvo V60 · 2020 · līdz 200 000 km", piedāvāts 11/2022 auto bez norādes, ka gads neatbilst (nav ✓/✕ pa kritērijiem).
- [Sludinājumi] [dators] Z - Sānu logs aizsedz 60% ekrāna ar izplūdinātu fonu; galvenais saturs (tehniskais stāvoklis "Nav datu") zemāk par cenu blokiem; "Piezīme (tikai adminam)" rāda arī darbiniekam.
- [Sludinājumi] [dators] Z - Atvēršana darbiniekam: TTFB 3,9 s. Foto sīktēli ielādējas ar ~3 s aizturi (sākumā tukši rāmji).

## Lomas (claude.demo ar visām 15 sadaļām)
- [Navigācija] [darbinieks] V - Izvēlnē "Loģistika", "Grāmatvede" un "Serviss" visas ved uz /admin/iriss/logistika (trīs punkti vienai lapai). Autoparks darbiniekam ir pašā apakšā (adminam pēc Loģistikas) - secība atšķiras. Galvenē "Claude Demo · 10 sadaļas", lai gan piešķirtas 15 (ap_* skaitās kā viena?).
