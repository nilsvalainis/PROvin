# Autoparks v2 - Andra (projekta vadība) ieteikumi (23.10.2026)

## 1. Fāzes (mazi PR, katrs atsevišķi atgriežams)
- F0 (tikai dokumenti): Claude Opus ieteikumi + makets (telefons + dators) -> Nila "jā". BEZ koda.
- F1: datu modelis v2 (jaunas tabulas/lauki blakus vecajiem, feature flag `autoparks_v2`, vecais UI paliek).
- F2: Saraksts (kategorijas, mazais foto no priekšas, marka/modelis/gads/krāsa).
- F3: Kabinets - Pamatdati + Statusi (+ vēsture tikai Nilam).
- F4: Iegādes dokumenti (izsoles faili, priekšskatījumi, popup, izdevumi kopā).
- F5: Serviss (kamera -> PDF -> Dropbox API, problēmu saraksts ar 2 ķeksīšiem, rēķinu rindas).
- F6: Citi izdevumi + Cenu lapa (auto lauki no pamatdatiem).
- F7: pārslēgšana uz v2 pēc Nila testa; vecais skats vēl 2 nedēļas kā rezerve.
Katrai fāzei: novērtējums, brīdinājums, ja >1 h vai >25 faili.

## 2. Dati un migrācija
- Vecos ierakstus NEMAINĪT un nedzēst. Migrācija tikai additīva (jauni lauki/tabulas, nolasīšana no vecajiem).
- Manuālās vērtības importam nepārrakstīt; CSDD reģistra lauki saglabājas.
- Pirms katras migrācijas: DB backup + backup zars; dry-run uz kopijas; atgriešanas skripts.
- Faili tikai caur Dropbox API, auto mapē; neko nepārvietot/nedzēst esošajās mapēs.

## 3. Bez regresijām
- Feature flag; vecie maršruti strādā līdz F7.
- Saglabāt: izsoles foto Autoparkā nelikt (tikai STOCK), Car Invoice CSDD indikators, sarkanie obligātie lauki (izņemot Pasūtījums), "Uz Autoparku" spiež tikai Nils.
- Esošie testi zaļi + jauni e2e katrai fāzei.

## 4. Telefons pirmajā vietā
- Viena kolonna, lielas pogas, kategorijas kā cilnes/akordeons, statuss vienmēr redzams augšā.
- Kamera: tieša `capture`, automātiska PDF izveide, uzreiz priekšskatījums, darbs arī ar vāju internetu (rinda + atkārtota augšupielāde).
- Lapa atveras augšā, jaunākie augšā.

## 5. Piekļuve (deny-by-default, kā PR #514)
- Katra kabineta kategorija = atsevišķa tiesība (pamatdati, iegāde, serviss, citi izdevumi, cenu lapa).
- Kolēģis "tikai Autoparks": neredz cenas, iegādes summas, cenu lapu, PRO, citas sadaļas; serveris (API, faili, PDF, Dropbox saites) atraida pēc noklusējuma.
- Vēsture tikai Nilam (admin).
- Testu matrica lomām: tikai Autoparks, Autoparks bez cenām, tikai Serviss, tikai Pavadzīmes, tikai Loģistika, viss IRISS bez PRO, admins.

## 6. Integrācijas
- Pavadzīmes: no kabineta poga "Pavadzīme šim auto" (VIN, īpašnieks -> noklusētais pārstāvis: ĪRISS - Nils Valainis, Dzintarzeme - Taivo Batins).
- CSDD tirdzniecības reģistrs: statuss/numurs nolasāms, nekad nepārrakstīt ar roku ievadīto.
- Grāmatvedei: iegādes dokumentu eksports (PDF/ZIP) - vēlāk.

## 7. Testi
- Vienību testi formulām (izdevumi kopā, iepirkuma cena kad formula zināma).
- Piekļuves testi visām lomām (API + lapas + faili).
- e2e telefonā (iPhone izmērs): saraksts, kabinets, skenēšana, statusa maiņa.
- Migrācijas tests uz prod kopijas: vecie ieraksti identiski pirms/pēc.

## 8. Atvērtie jautājumi Nilam
1. Saraksta kategorijas: pēc statusa, īpašnieka vai abiem?
2. Statusu saraksts (precīzi nosaukumi un secība)?
3. Iepirkuma cenas formula (kad)?
4. Kurš drīkst redzēt Iegādes dokumentus un Cenu lapu (grāmatvede, Aivars)?
5. Foto "no priekšas": no STOCK automātiski vai izvēlas ar roku?
6. Vai problēmu ķeksi "mēs apstiprinām" drīkst likt jebkurš vai tikai Nils?
7. Vecie auto: migrēt visus vai tikai aktīvos?
