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
