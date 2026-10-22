# Resursu sadale - AI darbu sadales sistēma

Versija 1 - 2026-10-22. Īpašnieks: Andris (Grok Bot lead). Lēmumus pieņem Nils.
Mērķis: ekonomija. Katram darbam - lētākais izpildītājs, kas to izdarīs kvalitatīvi.

## 1. Audits (stāvoklis 22.10.2026)

| Resurss | Kas zināms | Kur lasīt | Nezināms |
|---|---|---|---|
| Claude Max 5x (no 22.10, 90 EUR/mēn., šodien proporcionāli 75,66 EUR) | 5x Pro lietojuma. 5h sesijas limits + nedēļas limits (visiem modeļiem), kopīgs claude.ai, Desktop, Cowork un Claude Code. Opus tērē ātrāk nekā Sonnet. Max plānā "wrap-up" pie katra 5h limita. Precīzus apjomus Anthropic nepublicē. 22.10 Pro sesijas limits: 17:14, reset 17:50 (Rīga). | claude.ai Settings > Usage; Claude Code `/status` | Nedēļas reset diena/laiks; vai Max sākas uzreiz; usage credits jābūt IZSLĒGTIEM |
| Cursor Pro+ (legacy, 60 USD/mēn.) | Divi MĒNEŠA pūli, reset ar norēķinu ciklu: "Cursor Models" (Grok 4.7, Grok 4.6, Grok 4.5, Composer 2.5) un "Other Models" (Sonnet/Opus/GPT u.c. pēc API cenas). Pēc tam on-demand, rēķins pēc fakta. Downgrade stājas spēkā perioda beigās. Cursor oficiāli nepublicē pūlu apjomu USD. | cursor.com/dashboard/billing; editor Settings > Usage | Pūlu apjoms; cikla datums; on-demand spend limit (ieteikums: 0 vai zems); vai Pro+ vispār pieejams pārejai (legacy plāns, jaunajiem nav pārdošanā); vai Grok Bot paliek pieejams uz legacy plāna (X Subscription to iekļauj, legacy tabulā Grok Bot nav minēts) |
| CloudAgent | Noteikums: grok-4.6 līdz 15.11.2026 | - | Kas mainās pēc 15.11 (cena/modelis) |
| Grok API | Netiek tērēts no pūla, maksā atsevišķi | - | Vai vispār tiek lietots |

Pēdējo dienu darbu tipi: PR labojumi (budžeta loģika #469, Kārlis #468), auditi (Opus 5.5 review), mobile labojumi (Claude), scraping/meklēšana (IRISS), atskaites/PDF, e-pastu apstrāde, aģentu koordinācija.

## 2. Darbu klases -> noklusētais izpildītājs

| Klase | Piemēri | Noklusētais | Rezerves variants |
|---|---|---|---|
| A - kritisks/sarežģīts | Maksājumi (Stripe), datu migrācija, drošība, arhitektūra, liela refaktorēšana, PDF atskaites loģika, auditi | Claude Code Opus 5.5 | GAIDĪT reset. Nekad nedod lētākam modelim. |
| B - vidējs | Bugfix ar skaidru cēloni, loģika ar testiem (piem. budžeta parseris), API integrācija pēc specifikācijas, mobile labojumi | Claude Code (Opus; vienkāršākiem - Sonnet Claude Code iekšā) | Ja Claude limits beidzies un nav steidzami - gaidīt. Ja steidzami un uzdevums labi specificēts + ir testi - Grok 4.6 CloudAgent, pēc tam Claude review. |
| C - rutīna | Teksta/tulkojumu labojumi, docs, konfigurācija, mazs UI teksts, atkarību bump, lint | Cursor CloudAgent grok-4.6 | Grok 4.7, ja 4.6 kļūdās |
| D - operatīvais | E-pasti, kopsavilkumi, aģentu koordinācija, pārbaudes pārlūkā, scraping, atskaišu sagatavošana | Grok Bot aģenti (Andris, IRISS, u.c.) | - |
| E - pārbaude | Prod pārbaude, CI statuss, ekrānuzņēmumi | Grok Bot (lēti) | - |

Sonnet/Opus Cursorā tērē "Other Models" pūlu pēc API cenas - lietot tikai, ja Nils apstiprina konkrēto darbu. Claude Max iekšā Sonnet/Opus jau ir apmaksāts - tas ir priekšroka. Grok 4.6/4.7 Cursorā tērē "Cursor Models" pūlu.

Kad grok-4.6 drīkst aizstāt Claude (visiem jābūt "jā"):
1. Uzdevums ir B vai C klase, nevis A.
2. Precīza specifikācija: faili, rindas, gaidāmais rezultāts.
3. Ir vai tiks uzrakstīti testi; CI tos pārbauda.
4. Nav maksājumu, drošības, datu dzēšanas vai vecu pasūtījumu izmaiņu.
5. Pēc tam Claude (vai Andris) veic īsu review pirms merge.

## 3. Limitu uzskaite

- Andris uztur `limiti` ierakstu atmiņā: Claude sesijas %, nedēļas %, nākamais reset; Cursor abu mēneša pūlu % un cikla datums; on-demand tēriņš.
- Cursor mēneša pūls: ideāli ap ~25% nedēļā. Ja tēriņš apsteidz kalendāru (piem. 50% pirmajā nedēļā) - C klasi atlikt vai grupēt.
- Pārbaudes biežums: no rīta (pirms brīfa), pirms katra A/B darba, pēc katra Claude darba (`/status`).
- Ja Claude Code atgriež limita kļūdu - pierakstīt reset laiku un ieplānot turpinājumu +5 min pēc reset.

## 4. Brīdinājuma sliekšņi

| Rādītājs | Dzeltens | Sarkans |
|---|---|---|
| Claude nedēļas limits | >= 60% izlietots | >= 85% - tikai A klase |
| Claude 5h sesija | >= 70% - jaunu lielu darbu nesākt | limits - gaidīt reset |
| Cursor pūls (mēneša) | izlietots ātrāk nekā kalendārs | >= 85% - tikai D/E; on-demand tikai ar Nila "jā" |
| Viens darbs | > ~30 min aģenta darba vai > 10 faili | > 1 h vai > 25 faili - obligāta iepriekšēja saskaņošana |

## 5. Iepriekšējas saskaņošanas formāts (lieliem darbiem)

```
LIELS DARBS: <nosaukums>
Klase: A/B/C | Apjoms: ~N faili, ~M min
Ieteikums: <izpildītājs + modelis> - jo <iemesls>
Alternatīvas: <modelis 2> (risks: ...), gaidīt līdz <reset laiks>
Limiti tagad: Claude sesija X%, nedēļa Y% (reset ...); Cursor Z% (reset ...)
Steidzamība: <var gaidīt / jādara šodien>
Nils: jā / cits modelis / gaidīt
```

## 6. Plānošana ap reset

- Lielos Claude darbus sākt sesijas sākumā, nevis 30 min pirms limita.
- Svarīgos, bet nesteidzamos darbus krāt rindā un palaist pēc nedēļas reset.
- Vienā Claude sesijā grupēt saistītus uzdevumus (mazāk konteksta ielādes).
- Nekad neieslēgt Claude usage credits un Cursor on-demand bez Nila "jā".
- Ar Max 5x Claude kļūst par galveno kodētāju (A un B klase); Cursor paliek C/D/E un rezervei.

## 7. Ziņošana rīta brīfā (07:30)

Viena rinda + rinda:
```
Resursi: Claude sesija X%, nedēļa Y% (reset <diena laiks>) | Cursor Z% (reset ...) | Rindā gaida: N darbi (A: .., B: ..)
Šodien ieteikums: <darbs> -> <izpildītājs/modelis>
```

## 8. Claude Opus ieteikumi

Nav vēl saņemti: 22.10 ~17:25 Claude Code atbildēja "session limit - resets 17:50 (Europe/Riga)". Review jāpalaiž pēc reset (B klase, tikai lasīšana) un šī sadaļa jāpapildina ar atsevišķu PR.
