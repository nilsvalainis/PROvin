# Resursu sadale - AI darbu sadales sistēma

Versija 1 - 2026-10-22. Īpašnieks: Andris (Grok Bot lead). Lēmumus pieņem Nils.
Mērķis: ekonomija. Katram darbam - lētākais izpildītājs, kas to izdarīs kvalitatīvi.

## 1. Audits (stāvoklis 22.10.2026)

| Resurss | Kas zināms | Kur lasīt | Nezināms |
|---|---|---|---|
| Claude Pro (Opus 5.5 Nila Mac, Claude Code + claude.ai + Cowork) | 5h sesijas limits + nedēļas limits, kopīgs visām Claude virsmām. Opus tērē ātrāk nekā Sonnet. 22.10 sesijas limits sasniegts 17:14, atjaunojās 17:50 (Rīga). Anthropic nepublicē precīzus Pro apjomus. | claude.ai Settings > Usage; Claude Code `/status` | Nedēļas reset diena/laiks; vai ieslēgti "usage credits" (jābūt IZSLĒGTIEM, lai nav papildu maksas) |
| Cursor (Grok Bot, CloudAgent, Cursor Agent) | Nedēļas kopējais lietojuma pūls Cursor+Grok, atjaunojas reizi nedēļā; pēc tam top-offs (maksas). Grok modeļi iekļauti pūlā; trešo pušu modeļi (Sonnet u.c.) - pēc API cenas, maksā atsevišķi. Grok Bot lietojums atjaunots šonedēļ. | Cursor settings > Usage/Billing | Nila plāna līmenis (Premium/Super/Ultra); nedēļas reset laiks; pēdējā mēneša faktiskais tēriņš EUR; vai ir spending cap |
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

Sonnet Cursorā (API cena, maksā atsevišķi) - lietot tikai, ja Nils apstiprina konkrēto darbu. Claude Pro iekšā Sonnet ir "bez maksas" līdz limitam - tas ir priekšroka.

Kad grok-4.6 drīkst aizstāt Claude (visiem jābūt "jā"):
1. Uzdevums ir B vai C klase, nevis A.
2. Precīza specifikācija: faili, rindas, gaidāmais rezultāts.
3. Ir vai tiks uzrakstīti testi; CI tos pārbauda.
4. Nav maksājumu, drošības, datu dzēšanas vai vecu pasūtījumu izmaiņu.
5. Pēc tam Claude (vai Andris) veic īsu review pirms merge.

## 3. Limitu uzskaite

- Andris uztur `limiti` ierakstu atmiņā: Claude sesijas %, nedēļas %, nākamais reset; Cursor nedēļas pūla % un reset; mēneša tēriņš.
- Pārbaudes biežums: no rīta (pirms brīfa), pirms katra A/B darba, pēc katra Claude darba (`/status`).
- Ja Claude Code atgriež limita kļūdu - pierakstīt reset laiku un ieplānot turpinājumu +5 min pēc reset.

## 4. Brīdinājuma sliekšņi

| Rādītājs | Dzeltens | Sarkans |
|---|---|---|
| Claude nedēļas limits | >= 60% izlietots | >= 85% - tikai A klase |
| Claude 5h sesija | >= 70% - jaunu lielu darbu nesākt | limits - gaidīt reset |
| Cursor nedēļas pūls | >= 60% | >= 85% - tikai D/E, nekādu top-off bez Nila "jā" |
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
- Nekad neieslēgt Claude usage credits un Cursor top-off bez Nila "jā".

## 7. Ziņošana rīta brīfā (07:30)

Viena rinda + rinda:
```
Resursi: Claude sesija X%, nedēļa Y% (reset <diena laiks>) | Cursor Z% (reset ...) | Rindā gaida: N darbi (A: .., B: ..)
Šodien ieteikums: <darbs> -> <izpildītājs/modelis>
```

## 8. Claude Opus ieteikumi

Nav vēl saņemti: 22.10 ~17:25 Claude Code atbildēja "session limit - resets 17:50 (Europe/Riga)". Review jāpalaiž pēc reset (B klase, tikai lasīšana) un šī sadaļa jāpapildina ar atsevišķu PR.
