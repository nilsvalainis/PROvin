# PROVIN Business data: LV teksti korektūrai

Visi partneru portāla LV teksti: pieteikšanās lapa, cenu piedāvājuma forma, Sākums, Pasūtījumi, Profils, Rekvizīti, papildināšanas un pirkuma logi, RAW dati, admin partnera profils un e-pasti.

Statuss:

- **apstiprināts**: teksts no Nila apstiprinātās specifikācijas, nemainīts.
- **labots**: šajā PR izlabots (iepriekšējais teksts norādīts).
- **pārbaudīt**: nav apstiprinātajā sarakstā, jāpārbauda redaktoram.

Publiskie teksti ir `messages/lv/partner.json` (namespace `Partner`). Admin un e-pastu teksti ir kodā (fails norādīts).

## Pieteikšanās lapa (/partneriem)

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.titlePrefix` | PROVIN  | apstiprināts |
| `Partner.titleAccent` | Business data | apstiprināts |
| `Partner.heroLead` | Risinājums izstrādāts auto tirdzniecības uzņēmumiem. Pārbaudiet auto pirms iegādes, pieņemšanas komisijā vai maiņas darījumā un samaziniet riskus, ko rada koriģēts nobraukums, slēpti negadījumi un neievēroti apkopes intervāli. PROVIN Business data atskaite aizsargā uzņēmumu no zaudējumiem iepirkumos un sargā tā reputāciju. | apstiprināts |
| `Partner.heroLeadProof` | Bieži vien iepriekšējie tirgotāji auto vēsturei nav pievērsuši uzmanību, ir apzināti slēpuši defektus vai pat koriģējuši odometra rādījumus. Pieņemot tādu auto savā klāstā vai kā pirmo iemaksu, atbildība gala pircēja priekšā gulstas uz jūsu uzņēmuma pleciem. Veicot pārbaudi pirms katra darījuma, jūs nodrošināt, ka jūsu zīmols tiek saistīts tikai ar pārbaudītiem un uzticamiem auto. | pārbaudīt |
| `Partner.heroLeadTrust` | Klientiem šī atskaite sniedz nepārprotamus pierādījumus par auto faktisko vēsturi, un auto tirdzniecības nozarē tā kļūst par kvalitātes standartu, kas uzskatāmi demonstrē uzņēmuma atbildību un godprātību. Tas stiprina uzticēšanos, paaugstina jūsu piedāvājuma vērtību tirgū un atvieglo lēmuma pieņemšanu jebkurā darījuma veidā. | pārbaudīt |
| `Partner.heroPhoneLabel` | Tālr. | pārbaudīt |
| `Partner.heroPartnerEyebrow` | Partneriem | pārbaudīt |
| `Partner.heroSubhead` | Novērš iepirkuma riskus un sargā uzņēmuma reputāciju. Visi dati vienā atskaitē. | pārbaudīt |
| `Partner.heroCardTitle` | Partneru konts | pārbaudīt |
| `Partner.heroWhyHeading` | Kāpēc PROVIN Business data | apstiprināts |
| `Partner.heroBeatRisk` | Riski | pārbaudīt |
| `Partner.heroBeatReputation` | Reputācija | pārbaudīt |
| `Partner.heroBeatSafety` | Drošība | pārbaudīt |
| `Partner.loginEmail` | E-pasts | pārbaudīt |
| `Partner.loginPassword` | Parole | pārbaudīt |
| `Partner.loginSubmit` | Ieiet | pārbaudīt |
| `Partner.loginError` | Pārbaudiet e-pastu un paroli. | labots (bija: Pārbaudi e-pastu un paroli.) |
| `Partner.loginLoading` | Notiek pieteikšanās… | labots (bija: Ieiet…) |
| `Partner.loggedIn` | Esat pieteicies. | labots (bija: Ielogots.) |
| `Partner.emailAria` | E-pasta adrese | pārbaudīt |
| `Partner.passwordAria` | Parole | pārbaudīt |
| `Partner.signOut` | Iziet | pārbaudīt |
| `Partner.signedInAria` | Partnera sesija | pārbaudīt |
| `Partner.titleDealer` | DĪLERA DATI | pārbaudīt |
| `Partner.loginUnverified` | Vispirms apstipriniet e-pastu. Ja vēstule nav pienākusi, nosūtiet saiti vēlreiz. | labots (bija: Vispirms apstiprini e-pastu. Ja vēstule nav pienākusi, nosūti saiti vēlreiz.) |
| `Partner.forgotPassword` | Aizmirsāt paroli? | apstiprināts |
| `Partner.forgotPasswordTitle` | Atjaunot paroli | pārbaudīt |
| `Partner.forgotPasswordLead` | Ievadiet e-pastu. Ja konts pastāv, nosūtīsim saiti paroles atjaunošanai. | labots (bija: Ievadi e-pastu. Ja konts pastāv, nosūtīsim saiti paroles atjaunošanai.) |
| `Partner.forgotPasswordSubmit` | Sūtīt saiti | pārbaudīt |
| `Partner.forgotPasswordLoading` | Sūta… | pārbaudīt |
| `Partner.forgotPasswordSent` | Ja šis e-pasts ir reģistrēts, nosūtīsim saiti. Pārbaudiet iesūtni un surogātpasta mapi. | labots (bija: Ja šis e-pasts ir reģistrēts, nosūtīsim saiti. Pārbaudi pastkasti un surogātpasta mapi.) |
| `Partner.forgotPasswordBack` | Atpakaļ uz pieteikšanos | labots (bija: Atpakaļ pie ieiešanas) |
| `Partner.heroSourcesNote` | *Ja dati ir pieejami konkrētajam auto. | apstiprināts |

## Cenu piedāvājuma forma

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.quoteDivider` | Vēl neesat partneris? | apstiprināts |
| `Partner.quoteCta` | Saņemt cenu piedāvājumu | apstiprināts |
| `Partner.quoteCtaNote` | Individuāls piedāvājums 1 darba dienas laikā. | pārbaudīt |
| `Partner.quoteTitle` | Saņemt cenu piedāvājumu | pārbaudīt |
| `Partner.quoteLead` | Atstājiet kontaktus, un mēs sagatavosim individuālu piedāvājumu jūsu uzņēmumam. | pārbaudīt |
| `Partner.quoteContact` | Kontaktpersona (vārds, uzvārds) * | pārbaudīt |
| `Partner.quoteCompany` | Uzņēmuma nosaukums * | pārbaudīt |
| `Partner.quotePhone` | Tālrunis * | pārbaudīt |
| `Partner.quoteEmail` | E-pasts * | pārbaudīt |
| `Partner.quoteMessage` | Ziņa (nav obligāti) | pārbaudīt |
| `Partner.quoteMessagePlaceholder` | Piemēram, cik auto mēnesī pārbaudāt | pārbaudīt |
| `Partner.quoteConsent` | Piekrītu, ka PROVIN apstrādā manus personas datus, lai sagatavotu piedāvājumu un sazinātos ar mani. <privacy>Privātuma politika</privacy> * | pārbaudīt |
| `Partner.quoteSubmit` | Nosūtīt pieprasījumu | pārbaudīt |
| `Partner.quoteSubmitting` | Sūta… | pārbaudīt |
| `Partner.quoteRequiredNote` | Ar * atzīmētie lauki ir obligāti. | pārbaudīt |
| `Partner.quoteSuccess` | Paldies! Sazināsimies 1 darba dienas laikā. | pārbaudīt |
| `Partner.quoteClose` | Aizvērt | pārbaudīt |
| `Partner.quoteErrContact` | Lūdzu, ievadiet vārdu un uzvārdu. | pārbaudīt |
| `Partner.quoteErrCompany` | Lūdzu, ievadiet uzņēmuma nosaukumu. | pārbaudīt |
| `Partner.quoteErrPhone` | Lūdzu, ievadiet derīgu tālruņa numuru. | pārbaudīt |
| `Partner.quoteErrEmail` | Lūdzu, ievadiet derīgu e-pasta adresi. | pārbaudīt |
| `Partner.quoteErrConsent` | Lūdzu, apstipriniet piekrišanu datu apstrādei. | pārbaudīt |
| `Partner.quoteErrNetwork` | Neizdevās nosūtīt. Mēģiniet vēlreiz. | pārbaudīt |

## Paroles atjaunošana un jauna parole

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.resetPasswordTitle` | Jauna parole | pārbaudīt |
| `Partner.resetPasswordSubmit` | Saglabāt paroli | pārbaudīt |
| `Partner.resetPasswordLoading` | Saglabā… | pārbaudīt |
| `Partner.resetPasswordInvalid` | Saite nav derīga vai ir beigusies. Lūdziet jaunu saiti pieteikšanās lapā. | labots (bija: Saite nav derīga vai ir beigusies. Palūdz jaunu saiti no pieteikšanās lapas.) |
| `Partner.resetPasswordError` | Neizdevās saglabāt paroli. Mēģiniet vēlreiz. | labots (bija: Neizdevās saglabāt paroli. Mēģini vēlreiz.) |

## Reģistrācija ar ielūgumu un e-pasta apstiprinājums

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.inviteRegisterTitle` | Partnera reģistrācija | pārbaudīt |
| `Partner.inviteRegisterLead` | Aizpildiet uzņēmuma datus un izveidojiet paroli. Pēc tam būs jāapstiprina e-pasts. Šī saite ir vienreizēja. | labots (bija: Aizpildi uzņēmuma datus un izveido paroli. Pēc tam apstiprināsim e-pastu. Šī saite ir vienreizēja.) |
| `Partner.inviteRegisterSubmit` | Reģistrēties | pārbaudīt |
| `Partner.inviteRegisterLoading` | Reģistrē… | pārbaudīt |
| `Partner.inviteRegisterError` | Neizdevās reģistrēties. Pārbaudiet laukus vai lūdziet jaunu ielūgumu. | labots (bija: Neizdevās reģistrēties. Pārbaudi laukus vai palūdz jaunu ielūgumu.) |
| `Partner.inviteInvalid` | Ielūguma saite nav derīga vai jau izmantota. Lūdziet PROVIN jaunu saiti. | labots (bija: Ielūguma saite nav derīga vai jau izmantota. Palūdz jaunu saiti no PROVIN.) |
| `Partner.verifyPageTitle` | E-pasta apstiprinājums | pārbaudīt |
| `Partner.verifyWorking` | Apstiprinām e-pastu… | pārbaudīt |
| `Partner.verifyInvalid` | Apstiprinājuma saite nav derīga vai jau izmantota. Lūdziet jaunu saiti vai piesakieties vēlreiz. | labots (bija: Apstiprinājuma saite nav derīga vai jau izmantota. Palūdz jaunu saiti vai piesakies no jauna.) |
| `Partner.verifyBackToLogin` | Uz pieteikšanos | pārbaudīt |
| `Partner.verifyPendingTitle` | Apstipriniet e-pastu | labots (bija: Apstiprini e-pastu) |
| `Partner.verifyPendingLead` | Nosūtījām apstiprinājuma saiti uz {email}. Atveriet to, lai pabeigtu reģistrāciju. | labots (bija: Nosūtījām apstiprinājuma saiti uz {email}. Atver to, lai pabeigtu reģistrāciju.) |
| `Partner.verifyPendingHint` | Saite ir derīga 24 stundas un izmantojama vienu reizi. Pārbaudiet arī surogātpasta mapi. | labots (bija: Saite ir derīga 24 stundas un izmantojama vienu reizi. Pārbaudi arī surogātpasta mapi.) |
| `Partner.verifyResend` | Sūtīt saiti vēlreiz | pārbaudīt |
| `Partner.verifyResendOk` | Ja konts gaida apstiprinājumu, nosūtījām jaunu saiti. | pārbaudīt |
| `Partner.verifyResendBusy` | Sūta… | pārbaudīt |

## Sākums: atlikums un produktu kartes

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.walletBalancePill` | Atlikums {amount} | pārbaudīt |
| `Partner.walletTopupTooltip` | Papildināt kontu | pārbaudīt |
| `Partner.walletBannerLabel` | Konta atlikums | pārbaudīt |
| `Partner.walletBannerLead` | Atlikuma nepietiek pirkumam. Papildiniet kontu, lai pirktu pakalpojumus. | pārbaudīt |
| `Partner.walletTopupCta` | Papildināt kontu | pārbaudīt |
| `Partner.walletInsufficient` | Nepietiek atlikuma | apstiprināts |
| `Partner.walletBuy` | Pirkt | apstiprināts |
| `Partner.walletDeductNote` | tiks noskaitīts no atlikuma | apstiprināts |
| `Partner.walletRefundNote` | Ja datu nav, summa tiek atgriezta kontā. | apstiprināts |
| `Partner.walletInvoiceNote` | Rēķinu par konta papildināšanu nosūtām uz e-pastu. | apstiprināts |
| `Partner.walletLoading` | Ielādē atlikumu… | pārbaudīt |
| `Partner.walletProductsAria` | Pakalpojumi | pārbaudīt |
| `Partner.walletProductBusinessTitle` | PROVIN Business data | apstiprināts |
| `Partner.walletProductBusinessDesc` | Pilna auto vēstures atskaite: dīlera dati, carVertical, AutoDNA, reģistri un izsoļu arhīvs. | pārbaudīt |
| `Partner.walletProductBusinessTag` | 12-24h | apstiprināts |
| `Partner.walletProductRawTitle` | Dīlera dati (RAW) | apstiprināts |
| `Partner.walletProductRawDesc` | Neapstrādāti dīlera servisa ieraksti oriģinālvalodā. Dati pieejami uzreiz (drīzumā). | labots (bija: Neapstrādāti OEM dīlera servisa ieraksti. Uzreiz ekrānā.) |
| `Partner.walletProductRawTag` | Pieejami uzreiz | pārbaudīt |
| `Partner.walletProductProTitle` | Dīlera dati (PRO) | apstiprināts |
| `Partner.walletProductProDesc` | Apstrādāta dīlera datu atskaite pircējam: apkopju un remontu vēsture, eļļas maiņas intervālu grafiks, nobraukuma pārbaude un kopsavilkums. | labots (bija: Apstrādāta un pārbaudīta dīlera datu PDF atskaite, ko varat nodot pircējam.) |
| `Partner.walletProductProTag` | 12-24h | apstiprināts |
| `Partner.walletReportLang` | Atskaites valoda | pārbaudīt |
| `Partner.walletSample` | Skatīt paraugu | pārbaudīt |
| `Partner.walletSampleSoon` | Drīzumā | pārbaudīt |
| `Partner.walletSampleAria` | Atver PDF paraugu jaunā cilnē | pārbaudīt |
| `Partner.walletDiscountAria` | Atlaide {pct}% | pārbaudīt |
| `Partner.walletOldPriceAria` | Iepriekšējā cena {amount} | pārbaudīt |
| `Partner.walletLegacyCreditsHeading` | Iepriekš iegādātie kredīti | pārbaudīt |

## Papildināšanas logs

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.topupTitle` | Papildināt kontu | pārbaudīt |
| `Partner.topupCurrent` | Pašreizējais atlikums: {amount} | pārbaudīt |
| `Partner.topupChoose` | Izvēlieties summu | pārbaudīt |
| `Partner.topupCustom` | Cita summa | apstiprināts |
| `Partner.topupCustomPlaceholder` | Ievadiet summu | pārbaudīt |
| `Partner.topupSummaryAdd` | Papildinājums | pārbaudīt |
| `Partner.topupSummaryAfter` | Atlikums pēc papildināšanas | pārbaudīt |
| `Partner.topupPay` | Apmaksāt {amount} | pārbaudīt |
| `Partner.topupPayLoading` | Sagatavo apmaksu… | pārbaudīt |
| `Partner.topupSecure` | Droša apmaksa ar karti. Rēķinu nosūtīsim uz e-pastu. | pārbaudīt |
| `Partner.topupCancel` | Atcelt | pārbaudīt |
| `Partner.topupAmountError` | Ievadiet summu no {min} līdz {max}. | pārbaudīt |
| `Partner.topupPaidOk` | Apmaksa saņemta. Atlikums tiks atjaunināts dažu sekunžu laikā. | labots (bija: Apmaksa saņemta. Atlikums atjaunosies dažu sekunžu laikā.) |

## Pirkuma logs (VIN ievade)

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.vinLabel` | Ievadiet VIN kodu | labots (bija: Ievadi VIN kodu) |
| `Partner.vinAria` | VIN kods | pārbaudīt |
| `Partner.vinPlaceholder` | 17 rakstzīmes | labots (bija: 17 zīmes) |
| `Partner.vinError` | VIN: 17 rakstzīmes, bez I, O, Q. | labots (bija: VIN: 17 zīmes, bez I, O, Q.) |
| `Partner.vinLengthError` | VIN kodā jābūt 17 rakstzīmēm. Pārbaudiet VIN kodu. | labots (bija: VIN jābūt 17 zīmēm, pārbaudiet VIN numuru) |
| `Partner.vinCheckDigitWarning` | ISO 3779 kontrolcipars nesakrīt. Eiropā tas nav obligāts, bet pārbaudiet VIN kodu. | labots (bija: ISO 3779 kontrolcipars nesakrīt. Eiropā tas nav obligāts, bet pārbaudiet VIN numuru.) |
| `Partner.listingLabel` | Sludinājuma saite (neobligāti) | pārbaudīt |
| `Partner.listingAria` | Sludinājuma saite | pārbaudīt |
| `Partner.listingPlaceholder` | https://www.ss.lv/... | pārbaudīt |
| `Partner.listingError` | Ievadiet pilnu saiti uz konkrētu sludinājumu, ne tikai vietnes sākumlapu. | labots (bija: Ievadi pilnu saiti uz konkrētu sludinājumu, ne tikai vietnes sākumlapu.) |
| `Partner.auditPurposeLabel` | Kam paredzēts audits | pārbaudīt |
| `Partner.auditPurposeAria` | Audita mērķis | pārbaudīt |
| `Partner.auditPurposeClient` | Klientam | pārbaudīt |
| `Partner.auditPurposeInternal` | Iekšējai lietošanai | pārbaudīt |
| `Partner.auditPurposeError` | Norādiet, kam paredzēts audits. | labots (bija: Norādi, kam audits paredzēts.) |
| `Partner.vinSubmitTitle` | Iesniegt VIN | pārbaudīt |
| `Partner.vinSubmit` | Iesniegt | pārbaudīt |
| `Partner.vinSubmitLoading` | Iesniedz… | pārbaudīt |
| `Partner.vinSubmitOk` | VIN pieņemts. Atskaiti sagatavosim, un tā būs redzama sadaļā Pasūtījumi. | labots (bija: VIN pieņemts. Atskaiti sagatavosim un redzēsi to sadaļā Pasūtījumi.) |
| `Partner.vinDuplicateNotice` | Šis VIN jau pasūtīts {date} | pārbaudīt |
| `Partner.vinDuplicateOpenReport` | Atvērt atskaiti | pārbaudīt |
| `Partner.vinDuplicateReorder` | Pasūtīt jaunu (1 kr.) | pārbaudīt |
| `Partner.buyPacksCta` | Pirkt atskaites | pārbaudīt |
| `Partner.buyPanelTitle` | Pirkt atskaites | pārbaudīt |
| `Partner.buyCloseAria` | Aizvērt | pārbaudīt |
| `Partner.buyDialogPrice` | Cena: {amount} | pārbaudīt |
| `Partner.buyBalanceAfter` | Atlikums pēc pirkuma: {amount} | pārbaudīt |
| `Partner.buyConfirm` | Pirkt {amount} | pārbaudīt |
| `Partner.buyLoading` | Apstrādā… | pārbaudīt |
| `Partner.buyOk` | Pasūtījums pieņemts. Atskaiti redzēsiet sadaļā Pasūtījumi. | pārbaudīt |
| `Partner.buyError` | Neizdevās veikt pirkumu. Summa netika noskaitīta. Mēģiniet vēlreiz. | labots (bija: Neizdevās noformēt pirkumu. Summa netika noskaitīta. Mēģiniet vēlreiz.) |
| `Partner.buyOpenOrders` | Atvērt pasūtījumus | pārbaudīt |

## RAW dīlera datu lapa

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.rawTitle` | Dīlera dati (RAW) | pārbaudīt |
| `Partner.rawVin` | VIN: {vin} | pārbaudīt |
| `Partner.rawPending` | Ielādējam dīlera datus. Parasti tas aizņem līdz 2 minūtēm. | pārbaudīt |
| `Partner.rawNoData` | Dīlera datu šim VIN nav. Summa {amount} ir atgriezta kontā. | pārbaudīt |
| `Partner.rawFailed` | Datus neizdevās ielādēt. Mēģināsim vēlreiz; ja problēma saglabājas, sazinieties ar mums. | pārbaudīt |
| `Partner.rawServiceHeading` | Servisa ieraksti | pārbaudīt |
| `Partner.rawVehicleHeading` | Auto dati | pārbaudīt |
| `Partner.rawDate` | Datums | pārbaudīt |
| `Partner.rawOdometer` | Nobraukums | pārbaudīt |
| `Partner.rawPlace` | Serviss | pārbaudīt |
| `Partner.rawWorks` | Darbi | pārbaudīt |
| `Partner.rawEmpty` | Servisa ierakstu nav. | pārbaudīt |
| `Partner.rawNotFound` | Pasūtījums nav atrasts. | pārbaudīt |
| `Partner.rawBack` | Atpakaļ uz sākumu | pārbaudīt |
| `Partner.rawOriginalNote` | Ieraksti parādīti oriģinālā, bez tulkojuma un apstrādes. | pārbaudīt |

## Pasūtījumi: arhīvs un darījumu vēsture

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.archiveTitle` | Pasūtījumi | pārbaudīt |
| `Partner.archiveEmpty` | Pasūtījumu vēl nav. | pārbaudīt |
| `Partner.archiveLoading` | Ielādē pasūtījumus… | pārbaudīt |
| `Partner.archiveDate` | Datums | pārbaudīt |
| `Partner.archiveVin` | VIN | pārbaudīt |
| `Partner.archiveInvoice` | Rēķina nr. | pārbaudīt |
| `Partner.archiveAmount` | Summa | pārbaudīt |
| `Partner.archiveCreditUsed` | 1 kr. | pārbaudīt |
| `Partner.archiveCreditRestored` | Kredīts atgriezts | pārbaudīt |
| `Partner.archiveReport` | Atskaite | pārbaudīt |
| `Partner.archiveOpenReport` | Atvērt atskaiti | pārbaudīt |
| `Partner.archiveOpenInvoice` | Lejupielādēt rēķinu | pārbaudīt |
| `Partner.archiveStatus` | Statuss | pārbaudīt |
| `Partner.archiveStatusReceived` | Saņemts | pārbaudīt |
| `Partner.archiveStatusProcessing` | Tiek apstrādāts | labots (bija: Procesā) |
| `Partner.archiveStatusReady` | Gatavs | pārbaudīt |
| `Partner.archivePackBusiness` | Paka · PROVIN BUSINESS × {count} | pārbaudīt |
| `Partner.archivePackDealer` | Paka · Dīlera dati × {count} | pārbaudīt |
| `Partner.archiveTopup` | Konta papildināšana | pārbaudīt |
| `Partner.archiveWalletRefunded` | Atgriezts kontā | pārbaudīt |
| `Partner.archiveStatusRefunded` | Atgriezts kontā | pārbaudīt |
| `Partner.archiveOpenData` | Atvērt datus | pārbaudīt |
| `Partner.ledgerTitle` | Darījumu vēsture | labots (bija: Konta kustība) |
| `Partner.ledgerEmpty` | Darījumu vēl nav. | labots (bija: Kustību vēl nav.) |
| `Partner.ledgerDate` | Datums | pārbaudīt |
| `Partner.ledgerType` | Darījums | pārbaudīt |
| `Partner.ledgerAmount` | Summa | pārbaudīt |
| `Partner.ledgerBalance` | Atlikums | pārbaudīt |
| `Partner.ledgerTopup` | Papildinājums | pārbaudīt |
| `Partner.ledgerPurchase` | Pirkums | pārbaudīt |
| `Partner.ledgerRefund` | Atmaksa | pārbaudīt |
| `Partner.ledgerAdjust` | Korekcija | pārbaudīt |

## Profils: piekļuve un drošība

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.securityTitle` | Piekļuve un drošība | pārbaudīt |
| `Partner.passwordCurrent` | Pašreizējā parole | pārbaudīt |
| `Partner.passwordNew` | Jaunā parole | pārbaudīt |
| `Partner.passwordConfirm` | Atkārtojiet jauno paroli | labots (bija: Atkārto jauno paroli) |
| `Partner.passwordChange` | Mainīt paroli | pārbaudīt |
| `Partner.passwordChangeLead` | Jaunajai parolei jābūt vismaz 8 rakstzīmēm. | pārbaudīt |
| `Partner.passwordChanging` | Maina… | pārbaudīt |
| `Partner.passwordChanged` | Parole ir nomainīta. | pārbaudīt |
| `Partner.passwordError` | Neizdevās nomainīt paroli. | pārbaudīt |
| `Partner.passwordWeak` | Parolei jābūt vismaz 8 rakstzīmēm. | pārbaudīt |
| `Partner.passwordMismatch` | Paroles nesakrīt. | pārbaudīt |
| `Partner.passwordSame` | Jaunā parole nedrīkst būt tāda pati kā līdzšinējā. | pārbaudīt |
| `Partner.passwordCurrentWrong` | Pašreizējā parole nav pareiza. | pārbaudīt |
| `Partner.emailChangeTitle` | E-pasta maiņa | pārbaudīt |
| `Partner.emailChangeLead` | Jaunā adrese sāks darboties tikai pēc apstiprinājuma. Līdz tam paliek pašreizējais e-pasts. | pārbaudīt |
| `Partner.emailNew` | Jaunais e-pasts | pārbaudīt |
| `Partner.emailChangeSubmit` | Nosūtīt apstiprinājumu | pārbaudīt |
| `Partner.emailChangeBusy` | Sūta… | pārbaudīt |
| `Partner.emailChangeSent` | Uz jauno adresi nosūtījām apstiprinājuma saiti. | pārbaudīt |
| `Partner.emailChangeError` | Neizdevās sākt e-pasta maiņu. Pārbaudiet paroli un adresi. | labots (bija: Neizdevās sākt e-pasta maiņu. Pārbaudi paroli un adresi.) |
| `Partner.emailPending` | Gaida apstiprinājumu: {email} | pārbaudīt |
| `Partner.emailVerified` | E-pasts ir apstiprināts. | pārbaudīt |

## Rekvizīti: uzņēmuma dati

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.profileTitle` | Profils | pārbaudīt |
| `Partner.fieldCompany` | Uzņēmums | pārbaudīt |
| `Partner.fieldReg` | Reģ. Nr. | apstiprināts |
| `Partner.fieldAddress` | Adrese | pārbaudīt |
| `Partner.fieldContact` | Kontaktpersona | pārbaudīt |
| `Partner.fieldEmail` | E-pasts | pārbaudīt |
| `Partner.fieldPhone` | Tālrunis | pārbaudīt |
| `Partner.demoCompany` | SIA Demo Auto | pārbaudīt |
| `Partner.demoReg` | 40103123456 | pārbaudīt |
| `Partner.demoAddress` | Brīvības iela 1, Rīga | pārbaudīt |
| `Partner.demoContact` | Jānis Bērziņš | pārbaudīt |
| `Partner.demoPhone` | +371 20000000 | pārbaudīt |
| `Partner.requisitesTitle` | Rekvizīti | pārbaudīt |
| `Partner.requisitesLoading` | Ielādē rekvizītus… | pārbaudīt |
| `Partner.profileCompanyTitle` | Uzņēmuma dati | pārbaudīt |
| `Partner.profileCompanyLead` | Šie rekvizīti parādīsies rēķinos un partnera profilā. | pārbaudīt |
| `Partner.profileSave` | Saglabāt datus | pārbaudīt |
| `Partner.profileSaving` | Saglabā… | pārbaudīt |
| `Partner.profileSaved` | Dati ir atjaunināti. | pārbaudīt |
| `Partner.profileSaveError` | Neizdevās saglabāt. Pārbaudiet laukus un mēģiniet vēlreiz. | labots (bija: Neizdevās saglabāt. Pārbaudi laukus un mēģini vēlreiz.) |

## Navigācija

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.navPacks` | Atskaites | pārbaudīt |
| `Partner.navPacksDealer` | Dīlera dati | pārbaudīt |
| `Partner.navProfile` | Profils | apstiprināts |
| `Partner.accountNavAria` | Partnera konta sadaļas | pārbaudīt |
| `Partner.navHome` | Sākums | apstiprināts |
| `Partner.navArchive` | Pasūtījumi | apstiprināts |
| `Partner.navRequisites` | Rekvizīti | apstiprināts |

## Iepriekšējie kredīti, vairāku VIN pasūtījums, pakas (zem kartēm, ja ir kredīti)

| Atslēga | Teksts | Statuss |
|---|---|---|
| `Partner.bulkModeSingle` | Viens VIN | pārbaudīt |
| `Partner.bulkModeMany` | Vairāki VIN | pārbaudīt |
| `Partner.bulkModeAria` | Pasūtījuma veids | pārbaudīt |
| `Partner.bulkPasteLabel` | Ielīmējiet līdz 20 VIN kodiem (katru jaunā rindā vai atdalītus ar komatu) | labots (bija: Ielīmē VIN kodus (katru jaunā rindā vai atdalītus ar komatu), līdz 20) |
| `Partner.bulkPasteAria` | VIN saraksts | pārbaudīt |
| `Partner.bulkCounter` | {count} / {max} | pārbaudīt |
| `Partner.bulkUploadLink` | vai augšupielādējiet Excel/CSV failu | labots (bija: vai augšupielādē Excel/CSV failu) |
| `Partner.bulkUploadAria` | Augšupielādēt Excel vai CSV failu | pārbaudīt |
| `Partner.bulkCheckCta` | Pārbaudīt sarakstu | pārbaudīt |
| `Partner.bulkCheckLoading` | Pārbauda… | pārbaudīt |
| `Partner.bulkChipValid` | Derīgs | pārbaudīt |
| `Partner.bulkChipInvalid` | Nederīgs - {count} zīmes | pārbaudīt |
| `Partner.bulkChipDuplicate` | Dublikāts sarakstā | pārbaudīt |
| `Partner.bulkChipOrdered` | Jau pasūtīts {date} | pārbaudīt |
| `Partner.bulkChipOrderedOpen` | atvērt | pārbaudīt |
| `Partner.bulkReorder` | Pasūtīt jaunu atskaiti - izlietos 1 kredītu | pārbaudīt |
| `Partner.bulkRowInvalidHint` | VIN neatbilst garumam vai kontrolciparam. | pārbaudīt |
| `Partner.bulkRowDuplicateHint` | Šis VIN sarakstā atkārtojas. | pārbaudīt |
| `Partner.bulkRowOrderedHint` | Šis VIN jau ir pasūtīts. Jaunu atskaiti var pasūtīt ar 1 kredītu. | pārbaudīt |
| `Partner.bulkPurposeAll` | Visiem: | pārbaudīt |
| `Partner.bulkAddListing` | + sludinājuma saite (neobligāti) | pārbaudīt |
| `Partner.bulkRemoveAria` | Noņemt VIN | pārbaudīt |
| `Partner.bulkAddMore` | Pievienot vēl | pārbaudīt |
| `Partner.bulkAddMoreAria` | Pievienot vēl vienu VIN | pārbaudīt |
| `Partner.bulkAddMoreCta` | Pievienot | pārbaudīt |
| `Partner.bulkSummary` | {valid} derīgi · {invalid} nederīgs · {duplicate} dublikāts · {ordered} jau pasūtīts | pārbaudīt |
| `Partner.bulkCreditsLine` | Tiks izlietoti {used} kredīti, atlikums {from} → {to} | pārbaudīt |
| `Partner.bulkOrderCta` | Pasūtīt {count} atskaites | pārbaudīt |
| `Partner.bulkOrderLoading` | Pasūta… | pārbaudīt |
| `Partner.bulkShortfall` | Trūkst {count} kredītu - Pirkt paku | pārbaudīt |
| `Partner.bulkResultOk` | {count} pasūtījumi pieņemti | pārbaudīt |
| `Partner.bulkResultSubmitMore` | Iesniegt vēl VIN | pārbaudīt |
| `Partner.bulkResultOpenReports` | Atvērt atskaites | labots (bija: Atvērt Atskaites) |
| `Partner.bulkSkippedHeading` | Nav pasūtīti | pārbaudīt |
| `Partner.bulkFileType` | Derīgs CSV vai Excel (.xlsx) fails, pirmā kolonna VIN. | pārbaudīt |
| `Partner.bulkTooMany` | Ņemam pirmos 20 VIN. | pārbaudīt |
| `Partner.bulkEmpty` | Ielīmējiet vismaz vienu VIN. | labots (bija: Ielīmē vismaz vienu VIN.) |
| `Partner.bulkNeedPurpose` | Norādiet mērķi katram derīgajam VIN. | labots (bija: Norādi mērķi katram derīgajam VIN.) |
| `Partner.creditsHeading` | Pieejamās atskaites | pārbaudīt |
| `Partner.creditLeft` | Pieejamās atskaites: {count} | pārbaudīt |
| `Partner.creditChipBusiness` | Business | pārbaudīt |
| `Partner.creditChipDealer` | Dīlera dati | pārbaudīt |
| `Partner.servicePick` | Pakalpojums | pārbaudīt |
| `Partner.needService` | Izvēlieties vienu pakalpojumu. | labots (bija: Izvēlies vienu pakalpojumu.) |
| `Partner.noCredits` | Nav kredītu šim pakalpojumam. | pārbaudīt |
| `Partner.noCreditsLead` | Lai iesniegtu VIN, vispirms iegādājieties atskaites. | labots (bija: Lai iesniegtu VIN, vispirms iegādājies atskaites.) |
| `Partner.includedHeading` | Pakalpojumi | pārbaudīt |
| `Partner.dealerDisclosureAria` | Oficiālā dīlera datu apraksts | pārbaudīt |
| `Partner.dealerDisclosureOpen` | Atvērt oficiālā dīlera datu aprakstu ar visiem ražotājiem | pārbaudīt |
| `Partner.serviceLinkBusiness` | PROVIN Business → | pārbaudīt |
| `Partner.serviceLinkDealer` | Dīlera dati → | pārbaudīt |
| `Partner.commentLabel` | Komentārs | pārbaudīt |
| `Partner.commentAria` | Komentārs pasūtījumam | pārbaudīt |
| `Partner.commentPlaceholder` | Papildu norādes (nav obligāti) | pārbaudīt |
| `Partner.payCta` | PASŪTĪT ATSKAITES {price} | pārbaudīt |
| `Partner.payCtaPack` | PASŪTĪT ATSKAITES {price} | pārbaudīt |
| `Partner.packQty1` | 1 atskaite | pārbaudīt |
| `Partner.packQtyN` | {count} atskaites | pārbaudīt |
| `Partner.packPerReport` | par atskaiti | pārbaudīt |
| `Partner.packTotal` | Kopā {price} | pārbaudīt |
| `Partner.packFine` | Dīleru sistēmu dati pieejami noteiktiem ražotājiem. | pārbaudīt |
| `Partner.statusLoading` | Ielādē atlikumu… | pārbaudīt |
| `Partner.statusAvailable` | Pieejamas <count></count> atskaites | pārbaudīt |
| `Partner.statusAvailableHeading` | Pieejamās atskaites: | pārbaudīt |
| `Partner.dealerHighlightTitle` | Dīleru servisa vēsture un nobraukums | pārbaudīt |
| `Partner.dealerHighlightSubtitle` | Tiešā piekļuve oficiālajiem ražotāja apkopju ierakstiem. | pārbaudīt |
| `Partner.businessMeta` | Pilna vēsture vienā atskaitē, bez konsultācijas. | pārbaudīt |
| `Partner.partnerCodeError` | Ievadiet 6 ciparu partnera kodu. | labots (bija: Ievadi 6 ciparu partnera kodu.) |
| `Partner.statusPlanBusiness` | Business | pārbaudīt |
| `Partner.statusPlanDealer` | Dealer | pārbaudīt |
| `Partner.dealerDisabled` | Dīlera dati šajā kontā nav aktivizēti. | pārbaudīt |
| `Partner.packFineDealer` | * Ja ieraksti par odometra rādījumiem nav pieejami, kredīts tiek atgriezts kontā kā neiztērēts. | pārbaudīt |
| `Partner.dealerLineOdo` | Odometra rādījumi | pārbaudīt |
| `Partner.dealerLineService` | Servisa un apkopju vēsture | pārbaudīt |
| `Partner.dealerLineSummary` | Kopsavilkums | pārbaudīt |
| `Partner.bizLineDealer` | Oficiālā dīlera dati un izsoļu arhīvs | pārbaudīt |
| `Partner.bizLineDb` | autoDNA, carVertical, starptautiskie reģistri | pārbaudīt |
| `Partner.bizLineCurve` | Nobraukuma līkne un kopsavilkums | pārbaudīt |
| `Partner.dealerLineRecords` | Oficiālo dīleru fiksētie ieraksti | pārbaudīt |
| `Partner.dealerLineGuarantee` | Ja odometra datu nav, kredīts tiek atgriezts kontā | pārbaudīt |
| `Partner.payLoading` | Sagatavo apmaksu… | pārbaudīt |
| `Partner.payError` | Neizdevās atvērt apmaksu. Mēģiniet vēlreiz. | labots (bija: Neizdevās atvērt apmaksu. Mēģini vēlreiz.) |
| `Partner.payNetwork` | Savienojuma kļūda. Mēģiniet vēlreiz. | labots (bija: Savienojuma kļūda. Mēģini vēlreiz.) |
| `Partner.chooseService` | Izvēlieties pakalpojumu | labots (bija: Izvēlies pakalpojumu) |
| `Partner.packPaidOk` | Paka apmaksāta. Kredīti ir kontā. | pārbaudīt |
| `Partner.checkoutConsent` | Apstiprinu, ka esmu iepazinies ar <terms>Lietošanas noteikumiem</terms> un <privacy>Privātuma politiku</privacy>, piekrītu digitālā pakalpojuma tūlītējai izpildei un apzinos, ka zaudēju atteikuma tiesības, kad izpilde ir sākusies. | pārbaudīt |
| `Partner.checkoutConsentAria` | Apstiprinājums: noteikumi, privātuma politika, tūlītēja izpilde, atteikuma tiesību zaudēšana | pārbaudīt |
| `Partner.withdrawalRequired` | Lai turpinātu uz apmaksu, atzīmējiet apstiprinājumu pie noteikumiem. | labots (bija: Lai turpinātu uz apmaksu, atzīmē apstiprinājumu pie noteikumiem.) |

## Admin: partneru saraksts, partnera profils, maks un cenas

| Fails:rinda | Teksts | Statuss |
|---|---|---|
| `app/admin/(dashboard)/partneri/page.tsx:34` | Reģistrē dīleri pats vai izveido unikālu ielūguma saiti, lai partneris reģistrētos pats. Publiska reģistrācija paliek slēgta. | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:41` | Cenu piedāvājuma pieteikumi | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:56` | Vēl nav partneru | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:58` | Izveido pirmo ierakstu ar uzņēmuma rekvizītiem un paroli. | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:81` | Aktīvs | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:81` | Bloķēts | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:85` | Atvērt | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:95` | Uzņēmums | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:96` | E-pasts | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:97` | Business | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:98` | Dīleris | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:99` | Statuss | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:100` | Iztērēti | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:101` | Darbība | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:127` | Aktīvs | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:129` | Bloķēts | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:137` | Dīlera dati | pārbaudīt |
| `app/admin/(dashboard)/partneri/page.tsx:148` | Atvērt | pārbaudīt |
| `app/admin/(dashboard)/partneri/[id]/page.tsx:49` | Aktīvs | pārbaudīt |
| `app/admin/(dashboard)/partneri/[id]/page.tsx:49` | Bloķēts | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:17` | Dīlera dati (RAW) | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:18` | Dīlera dati (PRO) | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:22` | Papildinājums | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:98` | Neizdevās saglabāt cenas. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:107` | Atjaunotas noklusējuma cenas. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:107` | Cenas saglabātas. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:109` | Neizdevās saglabāt cenas. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:128` | Neizdevās koriģēt atlikumu. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:135` | Atlikums koriģēts. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:137` | Neizdevās koriģēt atlikumu. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:145` | Konta atlikums | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:149` | Papildināts kopā | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:150` | Iztērēts | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:160` | Individuālās cenas | apstiprināts |
| `components/admin/AdminB2bPartnerWallet.tsx:179` | Noklusējums: | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:186` | Ja lauks ir tukšs, piemēro noklusējuma cenu, ko jaunam partnerim piešķir automātiski. Katra pirkuma cenu | apstiprināts |
| `components/admin/AdminB2bPartnerWallet.tsx:187` | noskaita no partnera atlikuma. | apstiprināts |
| `components/admin/AdminB2bPartnerWallet.tsx:193` | Saglabā… | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:193` | Saglabāt cenas | apstiprināts |
| `components/admin/AdminB2bPartnerWallet.tsx:196` | Atjaunot noklusējuma cenas | apstiprināts |
| `components/admin/AdminB2bPartnerWallet.tsx:202` | Atlikuma korekcija | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:204` | Piem. manuāla atmaksa: 19,99 (pieskaita) vai -19,99 (noņem). Piezīme ir obligāta un redzama darījumu vēsturē. | labots (bija: ... redzama virsgrāmatā.) |
| `components/admin/AdminB2bPartnerWallet.tsx:208` | Summa (€) | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:222` | Piezīme | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:231` | Atmaksa par VIN ... | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:243` | Saglabā… | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:243` | Koriģēt atlikumu | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:248` | Darījumu vēsture | labots (bija: Virsgrāmata) |
| `components/admin/AdminB2bPartnerWallet.tsx:250` | Darījumu vēl nav. | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:256` | Laiks | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:257` | Darījums | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:258` | Detaļas | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:259` | Summa | pārbaudīt |
| `components/admin/AdminB2bPartnerWallet.tsx:260` | Atlikums | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:59` | Cenas formāts: piem. 79,99 (tukšs = kataloga noklusējums). | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:94` | Neizdevās saglabāt. | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:110` | Uzņēmums | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:114` | Reģ. Nr. | apstiprināts |
| `components/admin/AdminB2bPartnerEditForm.tsx:118` | Adrese | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:122` | Kontaktpersona | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:126` | Tālrunis | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:130` | E-pasts | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:134` | Statuss | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:136` | Aktīvs | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:137` | Bloķēts | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:141` | Jauna parole (nav obligāti) | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:153` | Vecie kredītu iepakojumi (mantotie) | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:168` | Rādīt Dīlera datus šim partnerim | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:173` | Audits · 1 gab. (€) | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:183` | Audits · 10 gab. (€ / gab.) | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:193` | Dīlera · 1 gab. (€) | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:204` | Dīlera · 10 gab. (€ / gab.) | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:218` | Saglabāts. | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:225` | Saglabā… | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:225` | Saglabāt | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:235` | Dzēst partneri „${name}”? Konts, pieteikšanās un kredīti pazudīs. Šo nevar atsaukt. | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:250` | Neizdevās dzēst partneri. | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:256` | Neizdevās dzēst partneri. | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:263` | Dzēš… | pārbaudīt |
| `components/admin/AdminB2bPartnerEditForm.tsx:263` | Dzēst partneri | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:43` | if (!res.ok \|\| !data.partner?.id) | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:51` | Neizdevās saglabāt. | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:65` | Jauns partneris | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:67` | Paroli paziņo dīlerim pats. Ielūguma e-pasts šajā versijā netiek sūtīts. | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:71` | Uzņēmums | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:75` | Reģ. Nr. | apstiprināts |
| `components/admin/AdminB2bPartnerCreateForm.tsx:79` | Adrese | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:83` | Kontaktpersona | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:87` | Tālrunis | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:91` | E-pasts | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:95` | Parole | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:111` | Saglabā… | pārbaudīt |
| `components/admin/AdminB2bPartnerCreateForm.tsx:111` | Izveidot partneri | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:29` | Neizdevās izveidot ielūgumu. | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:36` | Neizdevās izveidot ielūgumu. | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:48` | Neizdevās nokopēt saiti. | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:54` | Ielūguma saite | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:56` | Partneris reģistrējas pats pa unikālo saiti. Publiska reģistrācija paliek slēgta. Saite derīga 14 dienas. | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:65` | Izveidot ielūgumu | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:73` | Nokopēts | pārbaudīt |
| `components/admin/AdminB2bInvitePanel.tsx:73` | Kopēt saiti | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:24` | Dīlera dati (RAW) | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:25` | Dīlera dati (PRO) | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:37` | if (!partner) return NextResponse.json( | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:49` | if (!partner) return NextResponse.json( | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:74` | ${label}: cena nevar būt zemāka par ${formatB2bWalletEuro(validation.minCents)}. | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:75` | ${label}: nederīga summa. | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:100` | if (!partner) return NextResponse.json( | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:113` | Ievadiet derīgu summu. | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:129` | Piezīme ir obligāta. | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:131` | Atlikums nevar kļūt negatīvs. | pārbaudīt |
| `app/api/admin/partners/[id]/wallet/route.ts:132` | Summa nevar būt 0. | pārbaudīt |

## Admin: cenu piedāvājuma pieteikumi

| Fails:rinda | Teksts | Statuss |
|---|---|---|
| `app/admin/(dashboard)/partneri/pieteikumi/page.tsx:8` | Cenu piedāvājuma pieteikumi | pārbaudīt |
| `app/admin/(dashboard)/partneri/pieteikumi/page.tsx:25` | Cenu piedāvājuma pieteikumi | pārbaudīt |
| `app/admin/(dashboard)/partneri/pieteikumi/page.tsx:28` | Pieteikumi no partneru lapas („Saņemt cenu piedāvājumu”). Katrs jauns pieteikums tiek nosūtīts arī uz | pārbaudīt |
| `components/admin/AdminB2bPartnerLeadsList.tsx:36` | Neizdevās saglabāt statusu. | pārbaudīt |
| `components/admin/AdminB2bPartnerLeadsList.tsx:43` | Neizdevās saglabāt statusu. | pārbaudīt |
| `components/admin/AdminB2bPartnerLeadsList.tsx:52` | Pieteikumu vēl nav | pārbaudīt |
| `components/admin/AdminB2bPartnerLeadsList.tsx:96` | Atzīmēt kā neapstrādātu | pārbaudīt |
| `components/admin/AdminB2bPartnerLeadsList.tsx:96` | Atzīmēt kā apstrādātu | pārbaudīt |

## Kopīgās etiķetes (arhīvs, rēķini)

| Fails:rinda | Teksts | Statuss |
|---|---|---|
| `lib/b2b-partner-orders.ts:89` | Iekšējai lietošanai | pārbaudīt |
| `lib/b2b-partner-orders.ts:164` | Konta papildināšana | pārbaudīt |
| `lib/b2b-partner-orders.ts:166` | Dīlera dati | pārbaudīt |
| `lib/b2b-partner-orders.ts:181` | Kredīts | pārbaudīt |

## E-pasti

| Fails | Teksts | Statuss |
|---|---|---|
| `lib/email/send-transactional.ts:223` | PROVIN: jauns partneris: ${payload.companyName} | pārbaudīt |
| `lib/email/send-transactional.ts:225` | Jauns B2B partneris | pārbaudīt |
| `lib/email/send-transactional.ts:227` | Uzņēmums: ${payload.companyName} | pārbaudīt |
| `lib/email/send-transactional.ts:228` | Reģ. nr.: ${payload.companyReg} | pārbaudīt |
| `lib/email/send-transactional.ts:232` | Tālrunis: ${payload.phone} | pārbaudīt |
| `lib/email/send-transactional.ts:238` | Uzņēmums | pārbaudīt |
| `lib/email/send-transactional.ts:239` | Reģ. nr. | pārbaudīt |
| `lib/email/send-transactional.ts:243` | Tālrunis | pārbaudīt |
| `lib/email/send-transactional.ts:280` | PROVIN: cenu piedāvājuma pieprasījums: ${payload.companyName} | pārbaudīt |
| `lib/email/send-transactional.ts:283` | Uzņēmums | pārbaudīt |
| `lib/email/send-transactional.ts:284` | Tālrunis | pārbaudīt |
| `lib/email/send-transactional.ts:286` | Ziņa | pārbaudīt |
| `lib/email/send-transactional.ts:289` | Jauns cenu piedāvājuma pieprasījums (partneriem) | pārbaudīt |
| `lib/email/send-transactional.ts:297` | Cenu piedāvājuma pieprasījums | pārbaudīt |
| `lib/email/send-transactional.ts:298` | Pieteikums no partneru lapas (provin.lv/partneriem). | pārbaudīt |
| `lib/email/send-transactional.ts:299` | Atvērt pieteikumus adminā | pārbaudīt |
| `lib/email/html-templates.ts:114` | Atvērt partneri adminā | pārbaudīt |
| `lib/email/html-templates.ts:116` | Jauns B2B partneris | pārbaudīt |
| `lib/email/html-templates.ts:117` | Partneris reģistrējies ar ielūguma saiti. | pārbaudīt |
| `lib/email/html-templates.ts:294` | Apstipriniet šo adresi, lai pabeigtu PROVIN.LV partnera konta atvēršanu. | pārbaudīt |
| `lib/email/html-templates.ts:295` | Apstipriniet šo adresi, lai pabeigtu PROVIN.LV partnera konta e-pasta maiņu. | pārbaudīt |
| `lib/email/html-templates.ts:296` | Apstiprināt e-pastu | pārbaudīt |
| `lib/email/html-templates.ts:297` | Saite ir derīga 24 stundas un izmantojama vienu reizi. Ja jūs to neprasījāt, ignorējiet šo vēstuli. | pārbaudīt |
| `lib/email/html-templates.ts:351` | Ar šo saiti varat iestatīt jaunu paroli savam PROVIN.LV partnera kontam. | pārbaudīt |
| `lib/email/html-templates.ts:352` | Iestatīt jaunu paroli | pārbaudīt |
| `lib/email/html-templates.ts:353` | Saite ir derīga 24 stundas un izmantojama vienu reizi. Ja jūs to neprasījāt, ignorējiet šo vēstuli. | pārbaudīt |

Konta papildināšanas rēķina e-pasts izmanto kopīgo maksājuma apstiprinājuma veidni `email.payment_confirmation` (admin rediģējama ziņu veidne). Tajā ir teksts „Paldies par pasūtījumu.” un rinda „VIN: -”, kas papildināšanai neder: jāizlemj, vai veidot atsevišķu papildināšanas veidni.
