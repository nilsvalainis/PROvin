# Juridisko tekstu labojumi: melnraksts (P6, P7)

Versija 1 - 2026-10-27. Sagatavoja Claude (Opus 5.5). Nils apstiprina LV tekstu, tad EN/DE/RU tulkojums. Tas nav jurista atzinums; galīgo B2B noteikumu redakciju ieteicams parādīt juristam.

Fakti no Nila (27.10):
- Pakalpojuma sniedzējs: Nils Valainis, saimnieciskās darbības veicējs, reģ. nr. 09118711109, mikrouzņēmumu nodokļa maksātājs.
- PVN: īpašais režīms, PVN numurs LV09118711109, PVN tikai darījumiem ar ārvalstīm. Iekšzemē PVN netiek piemērots.
- Vācam: vārds un/vai uzvārds, e-pasts, tālrunis, VIN vai numurzīme, sludinājuma saite. AI apstrādē sūtām tikai VIN un tehniskos datus.
- Partneri: < 5, rakstiski līgumi nav, pērk kredītus pēc rēķina.

Jāapstiprina ar Andri pirms publicēšanas: apstrādātāju saraksts un glabāšanas vietas (darba uzdevuma 7.2), e-pasta sūtītāji (7.4).

## 1. Privātuma politika: faktu kļūdas

| Vieta | Tagad | Jābūt |
|---|---|---|
| 6. Trešās puses | "Vietnes mitināšana: jūsu izvēlētais pakalpojumu sniedzējs (piemēram, Vercel)." | "Vietnes mitināšana: Vercel Inc. (ASV), serveri ES reģionā, ja pieejams." |
| 8. Jūsu tiesības | "Sūdzību var iesniegt uzraudzības iestādē (Latvijā: VDAR)." | "Sūdzību var iesniegt Datu valsts inspekcijā (www.dvi.gov.lv, Elijas iela 17, Rīga, LV-1050)." |
| 6. Trešās puses | "Google Analytics 4, TikTok Pixel un Meta Pixel ielādējas tikai tad, ja sīkdatņu joslā piekrītat analītikai." | Sk. 2.4 (Consent Mode apraksts). Šobrīd teikums ir nepatiess. |
| 1. Pārzinis | "juridiskā persona un pilni rekvizīti ir vietnes kājenē" | Rakstīt tieši tekstā: "Nils Valainis, saimnieciskās darbības veicējs, reģ. nr. 09118711109, Jana iela 3, Tukums, LV-3101; e-pasts info@provin.lv, tālrunis +371 29 502 039." (pārzinis ir fiziska persona, ne juridiska) |

EN, DE, RU: tās pašas vietas; EN 8. punktā jau ir "DVI" - saskaņot ar pilno nosaukumu "Data State Inspectorate (Datu valsts inspekcija)".

## 2. Privātuma politika: jaunās sadaļas

### 2.1 Glabāšanas termiņi (aizstāj 7. punktu)
- Pasūtījuma dati un atskaites: 5 gadi pēc pasūtījuma (likums "Par grāmatvedību" attaisnojuma dokumentiem; strīdu termiņi).
- Nepabeigti pasūtījumi (bez apmaksas): 90 dienas, tad dzēšam.
- Saziņa e-pastā un WhatsApp: 2 gadi pēc pēdējās ziņas.
- Bezmaksas sludinājuma pārbaudes pieteikumi: 12 mēneši.
- Sīkdatnes: sk. 2.5 tabulu.
- Servera žurnāli (IP, laiks): līdz 30 dienām (Vercel).

### 2.2 Apstrādātāji un saņēmēji (jauns punkts)
| Apstrādātājs | Kam | Kur |
|---|---|---|
| Vercel Inc. | Vietnes mitināšana, datu glabāšana (Blob) | ASV/ES |
| Stripe Payments Europe Ltd. | Maksājumi | ES (Īrija), ASV |
| Google Ireland Ltd. | E-pasts (Workspace), Analytics, Ads | ES, ASV |
| Meta Platforms Ireland Ltd. | WhatsApp saziņa; Meta Pixel un Conversions API pēc piekrišanas | ES, ASV |
| TikTok Technology Ltd. | TikTok Pixel pēc piekrišanas | ES, citas valstis |
| Dropbox International Unlimited Co. | Atskaišu un dokumentu glabāšana | ES, ASV |
| Google (Gemini API), Anthropic PBC | Atskaites sagatavošanas atbalsts. **Nosūtām tikai VIN un tehniskos datus, ne jūsu vārdu, e-pastu vai tālruni.** | ASV |
| carVertical, autoDNA, oficiālo dīleru sistēmas | Transportlīdzekļa datu pieprasījums pēc VIN (pilnvarojums noteikumu 3.5. punktā) | ES |
| VAS "CSDD" | Transportlīdzekļa tehnisko datu pieprasījums | Latvija |

Saraksts jāsaskaņo ar Andra atbildi (7.2): ja kāda apstrādātāja nav, rindu dzēšam.

### 2.3 Datu nosūtīšana ārpus ES (jauns punkts)
"Daļa apstrādātāju (Vercel, Stripe, Google, Meta, Dropbox, Anthropic) var apstrādāt datus ASV. Nosūtīšanas pamats: ES-ASV datu privātuma regulējums (Data Privacy Framework), ja apstrādātājs tajā ir sertificēts, vai Eiropas Komisijas standarta līguma klauzulas (GDPR 46. pants)."

### 2.4 Analītika, reklāma un Consent Mode (aizstāj 5. un 6. punkta analītikas daļu)
"Mēs izmantojam Google Consent Mode v2. Google tags (Google Analytics 4 un Google Ads) ielādējas katrā apmeklējumā, bet līdz jūsu piekrišanai darbojas režīmā 'liegts': tas nesaglabā un nelasa sīkdatnes un nosūta Google tikai bezsīkdatņu signālus (piemēram, laiku, lapu, pārlūka veidu un piekrišanas stāvokli) bez identifikatoriem. Google šos signālus izmanto apkopotai konversiju modelēšanai. Ja piekrītat 'Analītikai', Google Analytics var saglabāt sīkdatnes. Ja piekrītat 'Reklāmai', Google Ads, Meta Pixel un TikTok Pixel var saglabāt sīkdatnes un izmantot datus reklāmas mērīšanai un personalizācijai; pēc pirkuma Meta Conversions API var nosūtīt pirkuma notikumu ar hashētu e-pastu un tālruni. Piekrišanu var mainīt jebkurā laikā, kājenē izvēloties 'Sīkdatņu iestatījumi'."

Kodam (P6): kājenē saite "Sīkdatņu iestatījumi", kas atver joslu (GDPR 7. panta 3. punkts: atsaukt tikpat viegli kā dot). Kājenes rekvizītu rinda paliek nemainīta; saiti liek blakus "Privātuma politika".

### 2.5 Sīkdatņu tabula (ģenerēt no koda konstantēm, `lib/cookie-consent.ts`)
| Nosaukums | Kam | Kategorija | Termiņš |
|---|---|---|---|
| `provin_consent`, `provin_cookie_consent` (localStorage) | Jūsu sīkdatņu izvēle | Nepieciešamā | 12 mēneši |
| `provin-site-theme`, `provin-b2b-locale` | Tēma un valoda | Nepieciešamā | 12 mēneši |
| Partnera un admin sesija (httpOnly) | Pieteikšanās | Nepieciešamā | līdz izrakstīšanās / termiņš kodā |
| `provin_attr` | Pirmais un pēdējais mārketinga avots (UTM, gclid, fbclid, ttclid) | Analītika | 180 dienas |
| `_ga`, `_ga_*` | Google Analytics | Analītika | 2 gadi |
| `_gcl_au`, `_gcl_ls` | Google Ads konversijas | Reklāma | 90 dienas |
| `_fbp` | Meta Pixel | Reklāma | 90 dienas |
| `_ttp`, `_tt_enable_cookie`, `ttcsid*` | TikTok Pixel | Reklāma | līdz 13 mēnešiem |

Termiņus pārbaudīt pēc faktiskajām sīkdatnēm pārlūkā pirms publicēšanas.

### 2.6 Jūsu tiesības (papildināt 8. punktu)
"Lai izmantotu tiesības, rakstiet uz info@provin.lv. Atbildam 1 mēneša laikā (GDPR 12. panta 3. punkts). Piekrišanu analītikai un reklāmai varat atsaukt jebkurā laikā sīkdatņu iestatījumos; atsaukšana neietekmē iepriekšējās apstrādes likumību. Mēs nepieņemam lēmumus, kas balstīti tikai uz automatizētu apstrādi un kam ir juridiskas sekas jums."

### 2.7 Bezmaksas rīki (jauns punkts, kad P10 gatavs)
"VIN dekoderā un bezmaksas sludinājuma pārbaudē ievadītos datus (VIN, numurzīme, sludinājuma saite, kontakti, ja norādīti) izmantojam tikai atbildes sagatavošanai. Rezultātu kešojam 30 dienas; IP adresi ļaunprātīgas lietošanas novēršanai glabājam 24 stundas."

## 3. Lietošanas noteikumi: labojumi

1. **11. punkta ievads:** dzēst redzamās rindas "Lai politikas pārbaudītāji un klienti ātri atrastu šo vietu ... refund, withdrawal, right of withdrawal" un "angliski bieži meklē kā withdrawal...". Atslēgvārdus EN versijā lapā jau ir; LV lapā tie nav vajadzīgi. Ja Google Ads pārbaudei vajag angļu vārdus, tie ir EN lapā.
2. **Drukas kļūdas:** "neparedzamu tiesību" -> "neekskluzīvas, nenododamas tiesības"; "labvēzīgāku" -> "labvēlīgāku"; "nepilnībā nekontrolē" -> "nekontrolē pilnībā"; kājenes "PRO VIN" ar atstarpi ir logotipa teksts (nemainām kājeni), bet noteikumu tekstā rakstām "PROVIN".
3. **5.2. PVN:** "Cenas ir galīgās. Pakalpojuma sniedzējs Latvijā nav reģistrēts kā PVN maksātājs iekšzemes darījumiem, tāpēc PVN cenai netiek pievienots. PVN reģistrācijas numurs LV09118711109 tiek izmantots darījumiem ar citu ES valstu PVN maksātājiem." **Jāapstiprina grāmatvedim/Andrim** (īpašā režīma formulējums).
4. **12. punkts, jauns 12.2.:** "Uz rakstisku sūdzību atbildam 15 darba dienu laikā (Patērētāju tiesību aizsardzības likuma 26.¹ pants)."
5. **15. punkts:** "Jautājumi: info@provin.lv, +371 29 502 039. Pakalpojuma sniedzējs: Nils Valainis, reģ. nr. 09118711109, Jana iela 3, Tukums, LV-3101."
6. **8.3. punkts:** papildināt "Partneriem (juridiskām personām) atskaišu izmantošanu nosaka Partneru sadarbības noteikumi."
7. "Spēkā no" - publicēšanas datums.

## 4. Partneru sadarbības noteikumi + DPA (P7, struktūra)

Lapa `/partneriem/noteikumi`. Piemēro tikai juridiskām personām un saimnieciskās darbības veicējiem (ne patērētājiem; PTAL atteikuma tiesības neattiecas).

1. **Puses un piemērošana** - PROVIN (Nils Valainis, rekvizīti) un Partneris (uzņēmums, reģistrējies ar ielūgumu). Noteikumi + Partnera akceptētais cenrādis = līgums. Akcepts ar atzīmi reģistrācijā vai pirmo pirkumu.
2. **Pakalpojumi** - PROVIN Business atskaite (no 69,99 €), Oficiālā dīlera dati (no 14,99 €); saturs kā lietošanas noteikumu 2.-3. punktā.
3. **Konts un piekļuve** - viens konts uzņēmumam; Partneris atbild par paroli un darbiniekiem; aizdomas par nesankcionētu piekļuvi - ziņot 24 h laikā.
4. **Kredīti un norēķini** - kredīti ir priekšapmaksa pēc rēķina; derīgi 12 mēnešus no iegādes; neizlietoti kredīti netiek atmaksāti naudā, izņemot PROVIN vainas gadījumu vai sadarbības izbeigšanu no PROVIN puses; rēķina apmaksas termiņš 7 dienas; PVN: Latvijas partneriem PVN netiek piemērots; citu ES valstu PVN maksātājiem - reversā maksāšana (PVN numurs LV09118711109). **Jāapstiprina grāmatvedim.**
5. **Atmaksa** - Dīlera dati: ja nav neviena oficiāla ieraksta, kredīts tiek atgriezts kontā automātiski. Business: atskaite izpildīta, ja veiktas noteikumu 3.4. punkta pārbaudes.
6. **Termiņi** - atskaite 24-72 h darba dienās; steidzamība pēc vienošanās.
7. **Atskaišu izmantošana** - Partneris drīkst atskaiti rādīt un nodot savam klientam konkrēta transportlīdzekļa darījuma ietvaros (pārdošana, komisija, maiņa). Aizliegts: publicēt atklāti (piem. sludinājumā kā pielikumu bez PROVIN zīmola), pārdot atsevišķi, izmantot datu bāzes veidošanai, noņemt PROVIN zīmolu vai atrunas.
8. **Atbildība** - kā lietošanas noteikumu 9. punktā; kopējā atbildība - summa, ko Partneris samaksājis par konkrēto atskaiti; PROVIN neatbild par Partnera saistībām pret viņa klientu.
9. **Konfidencialitāte** - abas puses neizpauž otras puses komerciālo informāciju.
10. **Datu apstrāde** - Partneris ir pārzinis datiem, ko ievada par savu klientu (ja ievada); PROVIN ir apstrādātājs; DPA pielikums.
11. **Termiņš un izbeigšana** - beztermiņa; jebkura puse var izbeigt ar 14 dienu brīdinājumu; PROVIN var bloķēt kontu nekavējoties ļaunprātīgas lietošanas gadījumā.
12. **Grozījumi** - PROVIN paziņo e-pastā 14 dienas iepriekš; turpināta lietošana = piekrišana.
13. **Piemērojamās tiesības un strīdi** - Latvijas Republikas tiesības; Latvijas tiesas.

### DPA pielikums (GDPR 28. panta 3. punkts)
Priekšmets un ilgums; apstrādes raksturs un mērķis (atskaites sagatavošana); datu veidi (VIN, numurzīme, sludinājuma saite, Partnera klienta vārds, ja ievadīts); datu subjekti (Partnera klienti); PROVIN pienākumi: apstrādāt tikai pēc Partnera norādījumiem, konfidencialitāte, drošības pasākumi (šifrēts savienojums, piekļuves kontrole, sesijas), apakšapstrādātāji (saraksts kā privātuma politikā, paziņot par izmaiņām 14 dienas iepriekš), palīdzība datu subjektu tiesībās, pārkāpuma paziņošana 48 h laikā, dzēšana vai atdošana pēc izbeigšanas, audita informācija pēc pieprasījuma.

## 5. Sīkdatņu josla (P6)

LV teksts:
- Virsraksts: "Sīkdatnes un privātums"
- Teksts: "Nepieciešamās sīkdatnes nodrošina vietnes darbību. Ar jūsu piekrišanu izmantojam arī analītiku (Google Analytics), lai saprastu, kā vietne tiek lietota, un reklāmu (Google Ads, Meta, TikTok), lai mērītu reklāmu rezultātus. Bez piekrišanas Google saņem tikai bezsīkdatņu signālus."
- Slēdži: "Analītika" (izslēgts), "Reklāma" (izslēgts).
- Pogas: "Tikai nepieciešamās", "Saglabāt izvēli", "Piekrītu analītikai un reklāmai" (vienāds vizuālais svars pirmajai un trešajai).
- Saite: "Privātuma politika".

Kods: `analytics_storage` = Analītika; `ad_storage`, `ad_user_data`, `ad_personalization`, Meta Pixel, TikTok Pixel, `provin_attr` klikšķu identifikatori = Reklāma. Vecā `{analytics:true}` piekrišana tiek nolasīta kā abas kategorijas "jā" (nav jāprasa no jauna).
