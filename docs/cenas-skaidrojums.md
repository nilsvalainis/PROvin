# Piedāvājuma "Cenas" cilnes lauki - skaidrojums

Piedāvājuma formā (`components/admin/IrissOfferForm.tsx`, cilne "Cenas") ir šādi lauki:

**Automašīnas cena** (`carPrice`) - auto pirkuma/izsoles cena. Ja atver no Autoparka/Loģistikas, šis lauks aizpildās automātiski no izsoles datiem, bet to var pārrakstīt ar roku. Šis pats skaitlis tiek nokopēts arī uz "Price Germany" lauku piedāvājuma blokos (PDF).

**Piegādes cena** (`deliveryPrice`) - transporta/piegādes izmaksas klientam. Vienmēr jāievada ar roku, automātiski nenāk nekur.

**Komisijas maksa** (`commissionFee`) - PROvin starpniecības maksa. Arī ievadāma ar roku.

**Kopā** - nav ievadāms lauks, bet tikai parādāms rezultāts. Aprēķins: `Kopā = Automašīnas cena + Piegādes cena + Komisijas maksa` (funkcija `offerDraftTotalPrice` failā `lib/iriss-offer-draft.ts`). Katrs no trim laukiem tiek "atlasīts" no teksta uz skaitli ar `parsePriceLike` (saprot gan "15000", gan "15.000", gan "15 000,50" u.tml.), un summa tiek atkal formatēta kā teksts (komats kā decimāldaļa, bez ".00" galā, ja summa vesela).

**Cenas formāta brīdinājums** (dzeltens teksts zem lauka) - parādās, ja ievadītais teksts neizskatās pēc parasta skaitļa (piem., satur burtus vai neparastu formātu) - tas ir mīksts brīdinājums, lai PDF vēlāk nebūtu "greizs" skaitlis, nevis kļūda, kas neļauj saglabāt.

**Piedāvājuma termiņš** (`validUntil` / precīzais `validUntilAt`) - datums/laiks, līdz kuram piedāvājums ir derīgs. Ja nav norādīts tieši, to var atvasināt no "cik dienas derīgs" (`offerValidDays`) + izveides datuma (`deriveOfferValidUntil`, Europe/Riga laika josla, diena beidzas pusnaktī Rīgā). Jauniem piedāvājumiem pēc noklusējuma - 3 dienas no šodienas.

**"Piedāvājums beidzies"** (sarkans teksts) - parādās, ja šodienas datums (Rīgas laikā) ir vēlāks par derīguma termiņu (`isIrissOfferExpired`). Tas ir tikai brīdinājums administratoram/klientam PDF skatā - piedāvājumu var tāpat saglabāt un sūtīt no jauna ar atjaunotu termiņu.
