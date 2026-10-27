# Bezmaksas VIN un numurzīmes dekoders: specifikācija (P10)

Versija 1 - 2026-10-27. Klase A (ārēja kvota, ļaunprātīgas lietošanas risks). Izpildītājs: Claude Opus.

## 1. Mērķis

Piltuves augšdaļa: cilvēks, kas meklē "VIN koda pārbaude" vai "auto pēc numura", bez maksas saņem pamatdatus un tiek novests uz bezmaksas sludinājuma pārbaudi un maksas AUDITU. Konkurenti (carVertical, wheelstreet.lt, automoli.com) šo lapu tipu jau izmanto.

## 2. Divi režīmi

| Režīms | Ievade | Avots | Maksā mums | Limits |
|---|---|---|---|---|
| A. VIN dekoders | 17 zīmju VIN | Lokāla WMI tabula + VIN struktūra (ISO 3779/3780) | 0 € | Tikai pret botiem |
| B. LV numurzīme (un LV reģistrēts VIN) | Numurzīme vai VIN | CSDD `epak.tl_tehn_dati` caur releju (`lib/csdd-tech-data.ts`) | Kvota no līguma | Mēneša, dienas, IP griesti |

### A. VIN dekoders (bez ārējiem izsaukumiem)
- WMI (1.-3. zīme): ražotājs un valsts. Datu avots: NHTSA vPIC WMI saraksts (ASV valdības publiski dati) + ISO 3780 reģionu kodi, saglabāti `data/wmi.json`. Atjaunināšana ar skriptu reizi gadā.
- 10. zīme: modeļa gads (30 gadu cikls, rādām abus iespējamos gadus, ja neviennozīmīgi, piem. "2014 vai 1984").
- 11. zīme: rūpnīcas kods (tikai ražotājiem, kam tabula ir).
- 9. zīme: kontrolcipars - pārbaudām tikai Ziemeļamerikas VIN (1-5 pirmā zīme), Eiropas VIN to neprasa.
- Validācija: 17 zīmes, bez I, O, Q.
- Rezultāts: ražotājs, valsts, iespējamais gads, (rūpnīca), "VIN formāts pareizs/nepareizs".

### B. LV numurzīmes un VIN dekoders (CSDD)
Rādām tikai tehniskos laukus, kas palīdz pirkuma lēmumam un nesatur īpašnieka datus:

Lauki pēc `CsddTechData` tipa (`lib/csdd-tech-data.ts`):

| Lauks | `CsddTechData` | Rādīt |
|---|---|---|
| Marka, modelis | `make`, `model` | Jā |
| Izlaiduma gads | `year` | Jā |
| Degviela, jauda kW, tilpums | `fuel`, `powerKw`, `displacementCm3` | Jā |
| Pirmā reģistrācija | `firstRegistrationIso` | Jā |
| Krāsa | `color` | Jā |
| VIN (ja ievadīta numurzīme) | `vin` | **Daļēji** (pirmās 11 zīmes + `******`), pilns VIN tikai AUDITĀ |
| Tehniskā apskate derīga līdz | `inspectionValidUntilIso` | Jā (āķis: "TA beidzas pēc 2 mēnešiem") |
| OCTA beigu termiņš | `insuranceEndIso` | **Nils lemj** (noderīgi, bet var uztvert kā sensitīvu) |
| Masa, COC dati | `grossMassKg`, `coc*` | Nē (nav vajadzīgs) |

Zem rezultāta: "Nobraukuma vēsture, negadījumi, apskašu defekti un sludinājuma analīze - PROVIN AUDITĀ" + poga "Pārbaudīt sludinājumu bez maksas" (esošais `listing-peek`, 3 dienā uz IP).

**Atļauts:** Nils 27.10 apstiprināja, ka CSDD līgums atļauj rādīt šos datus publiski bez maksas. Precīzais mēneša limits - no Andra (līgums).

## 3. CSDD kvota

### 3.1 Kopējais skaitītājs (visiem izsaucējiem)
- Jauns `lib/csdd-quota.ts`; visi izsaukumi iet caur `fetchCsddTechData` (6 izsaucēji), skaitītājs tiek palielināts tur, vienā vietā.
- Redis (P1 Upstash) atslēgas: `csdd:usage:2026-11` (kopā), `csdd:usage:2026-11:public` (publiskais dekoders), `csdd:usage:2026-11-15:public` (diena). Atomisks `INCR` + `EXPIRE` 40 dienas.
- Kešotie atbildes (sk. 3.3) skaitītāju **nepalielina**, jo CSDD netiek izsaukts.
- Admin skatā: "CSDD šomēnes: 1 234 / 10 000 (12 %)".

### 3.2 Griesti (ja līgumā 10 000 mēnesī)
| Griesti | Vērtība | Ko dara |
|---|---|---|
| Kopējā drošības robeža (2/3 no līguma) | 6 666 / mēn. | Publiskais dekoders izslēdzas; iekšējie izsaucēji turpina |
| Publiskā daļa | `min(3 000, 6 666 - iekšējais patēriņš)` / mēn. | Pēc tam B režīms rāda "Šomēnes bezmaksas numurzīmju pārbaudes beigušās" + A režīms + CTA |
| Publiskā dienas robeža | 150 / dienā | Vienmērīgs sadalījums, aizsardzība pret uzbrukumu vienā dienā |
| Uz IP | 3 / dienā, 1 / 10 min | 429 ar skaidru tekstu |
| Uz pārlūku (sīkdatne) | 3 / dienā | Papildus IP (mobilie tīkli dala IP) |
| Iekšējā cieto robeža | 9 500 / mēn. | Push Nilam, izsaukumi turpinās tikai admin manuāli |

Brīdinājumi Nilam (push, esošais `lib/admin-push.ts`): 50 %, 80 %, 100 % no publiskās daļas un 80 % no kopējās robežas.

Visas vērtības env mainīgajos (`CSDD_MONTHLY_CONTRACT_LIMIT`, `CSDD_PUBLIC_MONTHLY_CAP`, `CSDD_PUBLIC_DAILY_CAP`) ar drošiem noklusējumiem kodā. Kill switch: `CSDD_PUBLIC_DECODER=off`.

### 3.3 Kešs
- Pēc normalizēta nr1 (numurzīme vai VIN), 30 dienas, Redis vai Blob. Atkārtots pieprasījums tai pašai numurzīmei nemaksā.
- "Nav atrasts" kešot 7 dienas (citādi botiem ir lēts veids tērēt kvotu ar neeksistējošiem numuriem).

## 4. Bot aizsardzība (slāņi)

1. **Cloudflare Turnstile** obligāts B režīmam (esošais `lib/turnstile.ts`), tokens pārbaudīts serverī pirms jebkura CSDD izsaukuma.
2. **Rate limit** Redis (3.2), nevis instances atmiņā.
3. **Numurzīmes formāta validācija** pirms kvotas: LV formāti (2 burti + 1-4 cipari, personalizētās 2-8 zīmes, bez speciālajām zīmēm). Nederīgs formāts kvotu netērē.
4. **Secīgu numuru uzskaņošanas detektors**: ja vienā IP vai ASN 10 min laikā vaicā numurus ar mazu attālumu (AB1234, AB1235...), bloķēt uz 24 h un brīdināt.
5. **Vercel Firewall** noteikums: `/api/decoder/*` max 30 pieprasījumi minūtē no IP (bezmaksas līmenis).
6. **Atbilde bez pilna VIN** (2. sadaļa) - mazāka vērtība skreiperiem.
7. **Žurnāls** bez personas datiem: laiks, valsts, nr1 hash, rezultāts, kešs jā/nē.

## 5. Lapas un SEO

- `/[locale]/vin-dekoders` (A + B režīms), 4 valodas. Atsevišķa nošķirta lapa nevis sākumlapas tab, lai nemainītu hero.
- Title LV: "VIN dekoders un auto pārbaude pēc numura bez maksas | PROVIN".
- Saturs zem rīka: kā lasīt VIN (WMI, gads, rūpnīca), ko rāda un ko nerāda bezmaksas pārbaude, BUJ (FAQPage).
- Iekšējās saites no /vin-koda-parbaude, BUJ, bloga.
- Rezultāts noindex (rīka atbilde nav lapa), pati lapa index.

## 6. Juridiski

- Privātuma politikā: dekoders apstrādā ievadīto numurzīmi vai VIN tikai atbildes sagatavošanai, kešs 30 dienas, IP rate limitam 24 h.
- Teksts pie rezultāta: "Dati: CSDD Transportlīdzekļu reģistrs, [datums]. Nav oficiāls izraksts." (atbilstoši līguma prasībām par avota norādi, ja tādas ir).

## 7. Testi un pieņemšana

- Vienības testi: WMI dekods 20 VIN (Eiropa, Āzija, ASV ar kontrolciparu), gada neviennozīmība, nederīgi VIN.
- Kvota: skaitītājs palielinās tikai uz CSDD izsaukumu, nevis keša trāpījumu; griesti izslēdz publisko režīmu; iekšējie izsaucēji turpina.
- Bot: bez Turnstile 403; 4. pieprasījums dienā no IP 429; secīgie numuri bloķēti.
- Prod: 5 manuālas pārbaudes (2 numurzīmes, 3 VIN), skaitītājs admin skatā pieaug par 2.
