# Autoparks v2 - Nila specifikācija (23.10.2026, oriģināls)
(skat. pilnu tekstu zemāk; mērķis: maksimāli vienkāršs UI, īpaši telefonā; uzņēmuma kodols)

SARAKSTS: kā PRO admin avotu sadaļas pa kategorijām. Katram auto: marka, modelis, gads, krāsa + maza reāla foto (klikšķis - lielāka; visām vienāds leņķis kā mājas lapā, auto no priekšas).

AUTO KABINETS - kategorijas:
1. Pamatdati: īpašnieks (Dzintarzeme/ĪRISS) + visi pašreizējie pirmās lapas dati, BEZ: Iepirkuma cena, Pārdošanas cena, CENU LAPAI, Nosaukums, Cena, Aprīkojuma rinda.
2. Iegādes dokumenti (iekšēji + grāmatvedei): izsole, pirkuma datums (tukšs, ja nezināms), visi izsoles faili (rēķini, pickup utt.) kā nelieli priekšskatījumi, klikšķis - popup. Iepirkuma cena (formula vēlāk) + izdevumi kopā.
3. Serviss: augšā redzams marka, modelis, 1. reģ. datums, VIN, motora tilpums, jauda kW, precīzs riepu izmērs (nezināmos tukšus, ar roku).
   Posmi: (1) CSDD diagnostikas lapa - PDF skenēšana ar telefona kameru, automātiski uz auto Dropbox mapi, uzreiz priekšskatījums. (2) Dinamisks saraksts "Problēma" (defekts/simptomi) + ķeksis "serviss novērsa" + ķeksis "mēs apstiprinām". (3) "Servisa piezīmes" brīvs lauks. (4) Rēķina skenēšana ar kameru PDF + priekšskatījums + dublikāts Dropbox; rēķina summas rindas (var pievienot), datums automātiski no skenēšanas dienas; gala piezīmju lauks. Rezultāts: visa sagatavošanas hronoloģija.
4. Citi izdevumi: ar roku apraksts + faili (krāsošana, remonti utt.).
5. Cenu lapa: Iepirkuma cena, Pārdošanas cena, CENU LAPAI, Nosaukums, Cena, Aprīkojuma rinda utt.; daļa automātiski no pamatdatiem.

STATUSI: redzami visās sadaļās, katrs var mainīt. Vēsture (kurš ko darīja) redzama tikai Nilam.
UI: mūsu dizainā, tik vienkārši, ka bērns var lietot. Izstrādā Claude Opus; obligāti prasīt Claude ieteikumus/uzlabojumus. Aptaujāt citus aģentus par IRISS ikdienas loģiku. Nepieciešams makets un Nila "jā" pirms ieviešanas.
Spēkā esošie noteikumi: izsoles foto Autoparkā nelikt (tikai STOCK), CSDD reģistra lauki saglabājas, Car Invoice CSDD indikators, sarkanie obligātie lauki (izņemot Pasūtījums), manuālas vērtības importam nepārrakstīt, "Uz Autoparku" spiež tikai Nils.
