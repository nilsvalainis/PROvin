# Admin pogu inventārs

Pēdējā pārbaude pret kodu `components/admin` + `app/admin`. Atkārtotas „+ Rinda” / saglabāšanas pogas avotu blokos ir grupētas. Nav garo svītru.

| Etiķete | Lapa / sadaļa | Ko dara | Kad lietot |
| --- | --- | --- | --- |
| Pieteikties | `/admin` ielāde | Ielaiž operatoru admin sesijā | Katru reizi, kad sesija nav aktīva |
| Iziet | Sānjosla / mobilo „Vairāk” | Beidz admin sesiju | Beidzot darbu |
| Meklēt | Sānjosla, globālā meklēšana | Atver VIN / pasūtījumu / partneru meklēšanu | Kad jāatrod konkrēts pasūtījums vai partneris |
| Aizvērt (meklēšana) | Globālā meklēšana | Aizver meklēšanas paneli | Pēc rezultāta |
| Pasūtījumi | Sānjosla PRO | Atver `/admin/pasutijumi` | Ikdienas rinda |
| Rīta kopsavilkums | Sānjosla PRO | Atver rīta SLA skatu | No rīta, kavējumi |
| VIN pārbaude | Sānjosla PRO | Atver VIN skenēšanas rīku | Pirms / bez pasūtījuma |
| Ātrie vērtējumi | Sānjosla PRO | Atver listing peek rindu | Ātrie sludinājumu vērtējumi |
| Partneri | Sānjosla B2B | Atver `/admin/partneri` | B2B konti |
| Demo dīleri | Sānjosla B2B | Atver demo tenantus | Demonstrācija |
| Pasūtījumi / Jauns / Radars / Klientu filtri / Mēneša atskaite / Pavadzīmes / Iestatījumi | Sānjosla IRISS | IRISS darba vietas | IRISS tirdzniecība |
| Blogs / Agregāti / Statistika / Tekstu šabloni / Rēķini | Sānjosla WEB | Vietnes un rēķinu rīki | Saturs, statistika, rēķini |

## Pasūtījumu saraksts (`/admin/pasutijumi`)

| Etiķete | Lapa / sadaļa | Ko dara | Kad lietot |
| --- | --- | --- | --- |
| Jauns manuāls pasūtījums | Saraksta galva | Izveido `manual_order_*` | B2B VIN, telefona pasūtījums, bez Stripe |
| Eksportēt | Saraksta galva | Lejupielādē pasūtījumu CSV | Grāmatvedība / arhīvs |
| Filtru / statusa čipi | Saraksts | Filtrē rindu | Meklējot konkrētu stāvokli |

## Pasūtījuma darba vieta (PRO)

| Etiķete | Lapa / sadaļa | Ko dara | Kad lietot |
| --- | --- | --- | --- |
| Saglabāt / Labot / Dzēst | Pielikumi, foto, lauki | Persistē vai noņem failu | Pēc katra operatora labojuma |
| ✨ / AI ģenerēt | Komentāru lauki | Ģenerē klienta tekstu | Kad avoti ir ielasīti |
| Flash Max / Ģenerēt | Flash Max | Ģenerē visus izvēlētos laukus | Lielā pakešu ģenerēšana |
| Noklusējumi / Notīrīt / Tikai kopsavilkums / Atcelt | Flash Max dialogs | Atlasa, kurus laukus ģenerēt | Pirms ģenerēšanas |
| Pārbaudīt faktus / Labot / Ignorēt / Apstiprināt / Atcelt / ? / Atpakaļ | Fact-check | Validē komentāru pret avotiem | Pirms nosūtīšanas klientam |
| Ielasīt vēlreiz | Dīlera ielase | Palaiž OEM ielasi vēlreiz | Jaunas ielases vai kļūda |
| Atgriezt maksājumu | Dīlera ielase, Stripe `cs_*` | Stripe atmaksa uz karti | B2C, datu nav |
| Datu nav, atmaksa uz atlikumu (B2B) | Dīlera ielase, maka pasūtījums | Atgriež eiro partnera atlikumā + IRISS e-pasts | B2B RAW/PRO, datu nav |
| Atgriezt kredītu (B2B) | Dīlera ielase, vecie kredīti | Atgriež 1 dīlera kredītu | Tikai mantotie kredīti |
| WhatsApp: nav datu / WhatsApp: atcelts | Dīlera ielase | Kopē WA tekstu | Klienta saziņa |
| Nosūtīt e-pastu / E-pasts: atcelts / Nosūtīt dīlera PDF | Dīlera ielase | Atver e-pasta dialogu | B2C paziņojums (ne B2B IRISS atmaksa) |
| Nosūtīt / Atcelt / Aizvērt | E-pasta dialogs | Sūta vai aizver | Pēc teksta pārbaudes |
| + Rinda | CSDD, AutoRecords, LTAB, vendor, Outvin | Pievieno tabulas rindu | Kad avotā ir vēl viens ieraksts |
| Pārtulkot visas / Pārtulkot šo rindu | AutoRecords | LV tulkojums darbiem | Kad rinda ir svešvalodā |
| Pieņemt PDF vērtību / Atjaunot API | CSDD konflikts | Izvēlas PDF vai API vērtību | Kad PDF un API atšķiras |
| + Izziņas rinda | LTAB | Pievieno izziņas rindu | Jauna izziņa |
| Augšup / Lejup / Dzēst rindu / + Pievienot maiņu | Eļļas intervāli | Kārto / dzēš / pievieno maiņu | Dīlera eļļas tabula |
| Pirkt CarVertical atskaiti | Avoti | Pērk CarVertical | Kad vajag CV PDF |
| Sūtīt WhatsApp | Klienta saite | Atver WA ar klienta saiti | Pēc atskaites |
| Kopēt saiti / WhatsApp / E-pasts / Atsaukt | IRISS piedāvājuma saite | Dalās ar piedāvājumu | IRISS piedāvājums klientam |

## B2B partneri (`/admin/partneri` un partnera lapa)

| Etiķete | Lapa / sadaļa | Ko dara | Kad lietot |
| --- | --- | --- | --- |
| Izveidot partneri (B2B) | Partneru saraksts | Izveido jaunu B2B kontu | Jauns dīleris / partneris |
| Saglabāt (B2B) | Partnera profils | Saglabā rekvizītus, `dealerEnabled`, paku cenas | Pēc rediģēšanas |
| Dzēst partneri (B2B) | Partnera profils | Dzēš kontu (neatsaucami) | Tikai kļūdains / testa konts |
| Saglabāt cenas (B2B) | Maka cenas | Ieraksta individuālās cenas | Atlaide konkrētam partnerim |
| Atjaunot noklusējuma cenas (B2B) | Maka cenas | Notīra overrides | Atgriezt kataloga cenas |
| Koriģēt atlikumu (B2B) | Maka korekcija | Pieskaita / noņem eiro ar piezīmi | Manuāla atmaksa ārpus dīlera pogas |
| Redzamības ķekši | Pieejamie pakalpojumi | Paslēpj Business / RAW / PRO kartes | Kad partnerim kāds produkts nav jāredz |

## IRISS

| Etiķete | Lapa / sadaļa | Ko dara | Kad lietot |
| --- | --- | --- | --- |
| Saglabāt | Pasūtījuma / piedāvājuma redaktors | Persistē IRISS ierakstu | Pēc izmaiņām |
| Izveidot piedāvājumu / Piedāvājums | Pasūtījums | Atver / veido piedāvājumu | Cenas piedāvājums |
| PDF | Piedāvājums | Ģenerē piedāvājuma PDF | Nosūtīšanai |
| Dzēst / Atcelt / Aizvērt joslu | Piedāvājums | Dzēš, aizver, noņem kļūdas joslu | Kļūda vai atcelšana |
| € / Cita summa / Samaksāts šodien / Rēķins PDF | Avanss | Fiksē avansu un rēķinu | Avansa saņemšana |
| Kopēt / ZIP / WhatsApp / Ģenerēt LV tulkojumu | List drawer | Dalās ar sludinājuma failiem | Klientam sūtāmais |
| Sinhronizēt klientus ar Google Contacts | IRISS iestatījumi | Backfill kontaktu | Vienreizēja sinhronizācija |
| Aizvērt (login panelis) | Listings login | Aizver pieteikšanās paneli | Pēc eCarstrade pieteikšanās |

## Citi admin rīki

| Etiķete | Lapa / sadaļa | Ko dara | Kad lietot |
| --- | --- | --- | --- |
| VIN skenēšanas palaišana | `/admin` VIN pārbaude | Ielasa bezmaksas avotus | Ātra VIN pārbaude |
| Blogs saglabāt / publicēt | `/admin/blogs` | Saglabā rakstu | Saturs |
| Tekstu šablonu saglabāšana | `/admin` šabloni | Maina e-pasta / WA tekstus | Kad Nils apstiprina copy |
| Statistika filtri | `/admin` statistika | Atlasa periodu | Mēneša pārskats |
| Rēķinu lejupielāde | `/admin` rēķini | Atver Stripe / iekšējo PDF | Grāmatvedība |

Avotu blokos atkārtojas: **+ Rinda**, **Saglabāt**, **Labot**, **Dzēst**, **Aizvērt**, **Atcelt**. Tās pievieno, labo vai noņem vienu rindu / dialogu. Lietot, kad konkrētajā avotā (CSDD, AutoRecords, LTAB, vendor, Outvin, Citi avoti) ir jāmaina dati.

B2B darbības pogas ir ar IRISS oranžo kontūru un mazu **B2B** birku, lai tās nejauc ar PROVIN B2C pogām (zils / pelēks / sarkans `ADMIN_PRO_TONE`).
