# Autoparks + CSDD tirdzniecības reģistrs - izpēte

Statuss: izpēte un apspriešana, nekas nav ieviests. Lēmums - pēc Nila atbildēm (sk. beigās).

Mērķis: Autoparks auto kartītē redzēt datus par auto, kas jau **pieņemti tirdzniecībā** CSDD tirdzniecības reģistrā (pieņemšanas akta nr., datums, odometrs, pieņemšanas cena), un no tiem kopā ar tehniskajiem datiem veidot **cenu šablonus**.

## 1. Pašreizējais stāvoklis

### 1.1. CSDD tehniskie dati (jau strādā)

- `lib/csdd-tech-data.ts` - CSDD web serviss pēc līguma **LĪG-ieņ/375/26** (1. pielikums). Viena metode: `epak.tl_tehn_dati?nr1=` (VIN vai numurzīme), atbilde XML `<TL_DATI>`.
- Lauki: numurzīme, VIN, marka, modelis, gads, degviela, jauda kW (arī elektro), tilpums, 1. reģistrācija, krāsa, TL veids, COC kategorija/tips/apstiprinājums/variants/versija, pilnā masa, pašmasa, OCTA beigas, TA termiņš.
- Piekļuve: serviss ir tikai CSDD privātajā tīklā (`ows.csdd.gov.lv:9999`), tāpēc ir **relejs** - atsevišķs Ubuntu hosts (`scripts/csdd-relay-setup.sh`, `scripts/csdd-relay-server.mjs`) ar `openconnect` (AnyConnect) VPN uz `vpn.csdd.lv`. Vercel to sauc caur `CSDD_RELAY_URL` + Bearer `CSDD_RELAY_TOKEN`.
- Relejs ielaiž **tikai vienu ceļu** (`ALLOWED_PATH = /zvt/plsql/epak.tl_tehn_dati`). Jebkurai jaunai CSDD metodei jāpaplašina gan līgums, gan releja baltais saraksts.
- Kvota līgumā: 10 000 ierakstu mēnesī par pamata maksu; atkārtotus zvanus 60 s ķer `dedupeAsync`.
- API: `POST /api/admin/csdd-tech-data` (IRISS sadaļa `vin`), veselība tiek reģistrēta `source-health-store` kā `csdd`.
- Autoparks šos datus **neizmanto** - auto kartīte tiek aizpildīta no Loģistikas pasūtījuma (`ensureAutoparksCarFromOrder`) vai ar roku.

### 1.2. Pavadzīmes (grokbot / Aivars + Dropbox)

- Aivars (ārējs aģents, Grok Bot) izraksta CSDD pavadzīmes e-CSDD pusē. PROVIN tam dod rindu: `/api/iriss/aivars/waybill-requests` (tikai darbība `create_waybill`, Bearer `IRISS_AIVARS_API_TOKEN`, apraksts `docs/iriss-aivars-api.md`).
- Aivars jau **meklē VIN starp tirdzniecībā pieņemtajiem** - tātad tam ir pieeja tirdzniecības reģistram e-CSDD vārdā SIA ĪRISS. Rezultātu PROVIN nesaņem (tikai `waybillNo` + PDF).
- Gatavie PDF nonāk Dropbox `/Pavadzīmes_IRISS`; `app/api/webhooks/dropbox-pavadzimes` (paraksta pārbaude) un `app/api/iriss/pavadzimes/sync` (`x-sync-secret`) palaiž `runIrissPavadzimesDropboxSync`, kas parsē PDF (`lib/iriss-pavadzimes-parse.ts`: nr. `P…`, marka/modelis, VIN, tirdzniecības nr., izdots, derīgs līdz).

### 1.3. Autoparks

- `lib/iriss-autoparks.ts` - auto (`AutoparksCar`: VIN, marka, modelis, gads, numurs, krāsa, km, statuss, atrašanās vieta, pirkuma/pārdošanas cena, atvešanas datums), faili pa posmiem (Iegāde/Transports/Serviss/Pārdošana), piezīmes, tāme (darbi), notikumi.
- Krātuve: viens `autoparks.json` Loģistikas Blob krātuvē (`lib/iriss-autoparks-store.ts`).
- Tiesības: rakstīt - admins, Loģistika, Serviss; Grāmatvede skatās; Serviss un Loģistika **neredz summas** (`autoparksHidesSums`).
- Nav nekādas saites ar CSDD vai pavadzīmēm.

## 2. Ko saka publiskie avoti

- Tirdzniecības reģistrs ir **atsevišķs CSDD uzturēts reģistrs**. Pieeju komersants saņem pēc tirdzniecības vietas reģistrācijas; pieslēgšanas un lietošanas kārtību nosaka **CSDD un komersanta sadarbības līgums** (CSDD lapa "Tirdzniecības vietas reģistrācija").
- MK 18.12.2007. noteikumi Nr. 876 "Transportlīdzekļu un to numurēto agregātu tirdzniecības noteikumi" (ar grozījumiem): pirms pieņemšanas reģistrā fiksē VIN, odometra rādījumu, **pārdošanas cenu**, **pieņemšanas akta numuru**, drošības sistēmu un tehniskā stāvokļa ziņas. Akts tiek izdrukāts no reģistra divos eksemplāros, dokumenti glabājami 5 gadus. Pārstāvim pieeju piešķir 3 darbdienu laikā, ja viņš ir VID reģistrēts darbinieks.
- CSDD piedāvā **automatizētus datu apmaiņas pakalpojumus** (API) ar mēneša maksu - piem., klientam reģistrēto TL dati, vadītāju tiesību pārbaude. **Publiski aprakstīta tirdzniecības reģistra API neatradu.** Tātad tā ir jāprasa CSDD kā līguma papildinājums (jauna metode tajā pašā web servisā).
- e-CSDD `e.csdd.lv/autoveikali` publiski rāda tikai tirdzniecības vietu sarakstu.
- Piezīme: likumi.lv šobrīd ir slēgts (kiberdrošība), tāpēc konsolidēto MK 876 tekstu pārbaudīt neizdevās - punkti ņemti no grozījumu tekstiem un CSDD lapām.

Avoti: [CSDD tirdzniecības vietas reģistrācija](https://www.csdd.lv/tirdzniecibas-vietas-registracija/vispareja-informacija), [MK 876 grozījumi (likumi.lv 277675)](https://likumi.lv/ta/id/277675), [MK 876](https://likumi.lv/ta/id/168576), [CSDD maksa par automatizēto datu apmaiņu](https://www.csdd.lv/transportlidzeklu-un-to-vaditaju-valsts-registrs/maksa-par-informacijas-sanemsanu-elektroniska-veida), [latvija.gov.lv 46031](https://latvija.gov.lv/Services/46031), [CSDD vispārīgie noteikumi](https://csdd.lv/doc/spec/Visparigie_noteikumi.pdf), [e-CSDD autoveikali](https://e.csdd.lv/autoveikali).

## 3. Varianti

| Variants | Kas jādara | + | - |
| --- | --- | --- | --- |
| **A. Oficiālā metode web servisā** | Lūgt CSDD līguma LĪG-ieņ/375/26 pielikumu: metode "SIA ĪRISS tirdzniecībā pieņemtie TL" (saraksts + akts pēc VIN). Paplašināt releja balto sarakstu. | Stabils, juridiski tīrs, iet pa jau gatavo VPN+releju. Strukturēti dati. | Jāgaida CSDD; iespējama papildu maksa; formāts nav zināms. |
| **B. Tas pats VPN, cits CSDD serviss** | Ja CSDD tirdzniecības reģistram ir sava sistēma ar citu galapunktu/sertifikātu. | Tas pats relejs. | Var prasīt atsevišķu lietotāju vai klienta sertifikātu; releja izmaiņas. |
| **C. Eksports no e-CSDD** | Darbinieks (vai Aivars) periodiski lejupielādē reģistra izdruku/aktu PDF uz Dropbox mapi; PROVIN to parsē kā pavadzīmes. | Var sākt uzreiz; jau ir Dropbox webhook + PDF parsēšana. | Atkarīgs no cilvēka vai bota; PDF formāts var mainīties; nav reāllaika. |
| **D. Grokbot (Aivars) pieeja** | Jauna darbība `read_trade_register` (vai `create_waybill` rezultātā atdot atrasto pieņemšanas ierakstu). Aivars nolasa e-CSDD un atdod JSON. | Aivars jau ir iekšā tirdzniecības reģistrā. | Ekrāna nolasīšana - trausla; jāpārbauda, vai līgums ar CSDD atļauj automatizētu piekļuvi; vēl viena uzticēšanās robeža. |

Ieteikums: **A kā mērķis, C (vai D) kā pagaidu tilts**. A pieprasījumu var sūtīt jau tagad; kamēr CSDD atbild, C dod datus bez jaunām piekļuvēm.

## 4. Nepieciešamās piekļuves un līgumi

- CSDD: līguma LĪG-ieņ/375/26 grozījums vai jauns pielikums par tirdzniecības reģistra datiem (metode, lauki, kvota, maksa). Jautāt, vai pietiek ar esošo VPN lietotāju un web servisa lietotāju, vai vajag jaunu/sertifikātu/IP balto sarakstu.
- Pārliecināties, ka SIA ĪRISS sadarbības līgums par tirdzniecības reģistru atļauj datus glabāt ārējā sistēmā (PROVIN/Vercel Blob) un - D variantam - automatizētu piekļuvi.
- Relejs: jauns ceļš baltajā sarakstā; tas pats Bearer tokens. Vercel env netiek mainīts, ja URL paliek tas pats.
- Personas dati: iepriekšējā īpašnieka vārdu/personas kodu no akta **neglabājam** - tikai akta nr., datumi, km, cena, statuss.

## 5. Datu modelis

### 5.1. Auto kartīte (`AutoparksCar` papildinājums)

```ts
type AutoparksCsddTrade = {
  actNumber: string;          // pieņemšanas akta nr.
  acceptedAt: string;         // ISO
  odometerKm: number | null;  // km pieņemšanas brīdī
  listedPriceEur: number | null; // reģistrā norādītā pārdošanas cena (slēpj kā summas)
  state: "accepted" | "sold" | "returned" | "unknown";
  closedAt: string;           // pārdots / atdots
  closingActNumber: string;
  source: "csdd_api" | "export" | "aivars" | "manual";
  syncedAt: string;
};

type AutoparksCsddTech = Pick<CsddTechData,
  "registrationNumber" | "fuel" | "powerKw" | "displacementCm3" | "firstRegistrationIso" |
  "vehicleKind" | "cocCategory" | "grossMassKg" | "inspectionValidUntilIso"> & { fetchedAt: string };

// AutoparksCar += { csddTrade: AutoparksCsddTrade | null; csddTech: AutoparksCsddTech | null }
```

- Sasaiste pēc VIN (tā pati loģika kā `ensureAutoparksCarFromOrder`). Jauns pieņemts auto bez kartītes -> kartīte statusā "Gaida sagatavošanu" ar `source`.
- Pieņemšanas cena ir summa -> `autoparksHidesSums` to slēpj tāpat kā pirkuma cenu.
- Normalizācija vecajam `autoparks.json`: lauki neesot = `null`; vecie dati netiek pārrakstīti.

### 5.2. Cenu šabloni

```ts
type AutoparksPriceTemplate = {
  id: string;
  name: string;                 // "Vieglais dīzelis 5-8 g."
  match: {
    makes: string[];            // tukšs = jebkura
    yearFrom: number | null; yearTo: number | null;
    fuel: string[];             // no CSDD DEGVIELA
    powerKwFrom: number | null; powerKwTo: number | null;
    vehicleKind: string[];      // no CSDD TL_VEIDS
  };
  costs: { title: string; eur: number }[]; // transports, CSDD reģ., tīrīšana...
  includeWorkTotal: boolean;    // pieskaita tāmi (autoparksWorkTotal)
  marginPct: number; marginMinEur: number;
  roundTo: 10 | 50 | 100;
  updatedAt: string;
};
```

Ieteiktā cena = pirkuma cena + `costs` + (tāme) + max(marginPct, marginMinEur), noapaļota. Kartītē rāda: ieteikto, reģistrā norādīto un faktisko pārdošanas cenu. Glabāt atsevišķā `autoparks-price-templates.json` tajā pašā krātuvē.

## 6. Riski

- **Līgums**: datu glabāšana ārpus CSDD un automatizēta e-CSDD lasīšana var būt aizliegta - jānoskaidro pirms C/D.
- **Relejs ir viens punkts**: ja VPN krīt, nav ne tehnisko datu, ne tirdzniecības datu. Vajag `source-health` brīdinājumu un kešu kartītē.
- **Kvota** 10 000/mēn. kopīga ar VIN SCAN; periodiska saraksta sinhronizācija jāplāno ar kešu.
- **Ekrāna nolasīšana (D)**: e-CSDD maiņa salauž bez brīdinājuma; nepareizs akta nr. kartītē ir sliktāk par tukšu.
- **Personas dati** aktos - filtrēt pie avota.
- **Drošība**: CSDD 2026. gadā piedzīvoja kiberincidentu - iespējamas pēkšņas piekļuves izmaiņas un stingrākas prasības pieslēgumiem.
- **Summas**: jaunais cenas lauks nedrīkst nopludināt summas Servisam/Loģistikai.

## 7. Ieteicamie soļi

1. Nils sūta CSDD pieprasījumu (līguma pielikums): tirdzniecībā pieņemto TL saraksts SIA ĪRISS + akts pēc VIN; lauki, formāts, maksa, vai pietiek ar esošo VPN.
2. PROVIN (bez CSDD): Autoparks kartītē poga "Ielasīt no CSDD", kas izsauc jau esošo `csdd-tech-data` un saglabā `csddTech`. Tas uzreiz dod laukus cenu šabloniem.
3. Cenu šabloni ar roku ievadītu pirkuma cenu + tāmi (nav atkarīgi no tirdzniecības reģistra).
4. Pagaidu tilts (C vai D, pēc Nila izvēles): akta nr. un pieņemšanas datums kartītē, `source` atzīme.
5. Kad CSDD atbild: jauna metode `lib/csdd-trade-register.ts`, releja baltais saraksts, ikdienas sinhronizācija + ieraksts pēc VIN.
