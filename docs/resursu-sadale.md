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

22.10.2026, Claude Opus 5.5 pārskats (tikai lasīšana). Papildina 2.-6. sadaļu, to nemaina. Pieņēmums: Max 5x, nedēļas reset otrdienās ~23:00 (Rīga), 5h sesiju logi.

1. **Opus plāno, Sonnet raksta.** B klasē lieto `/model opusplan` (Opus plāna režīmā, Sonnet izpildē) vai Opus uzraksta plānu ar failiem un testiem, tad `/model sonnet` to izpilda; tīrs Opus visam darbam - tikai A klasē.
2. **Meklēšanu dod apakšaģentam.** Plašu koda meklēšanu dod Explore apakšaģentam, lai galvenās Opus sesijas konteksts nepiepildās ar failu saturu; aģentiem, kas tikai lasa (klientu-atbalsts, laba-roka, ekii-specis), `.claude/agents/*.md` iestatīt `model: sonnet`.
3. **Viens darbs = viena tīra sesija.** Pēc PR merge `/clear`; garā darbā `/compact` ar norādi, ko paturēt (piem. "plāns, zars, PR nr."), nevis turpināt ar garu vēsturi, kas katrā atbildē tiek apstrādāta no jauna.
4. **Prompts ar precīzu specifikāciju.** Norādi failus, gaidāmo uzvedību un testa komandu (`npx vitest run <fails>`); "salabo budžetu" tipa prompts liek aģentam izlasīt pusi repo, kas maksā vairāk nekā pats labojums.
5. **Kešošana - strādā blokos.** Saistītus uzdevumus dari pēc kārtas vienā sesijā, kamēr kešs ir silts; pēc vairāku stundu pauzes sāc jaunu sesiju ar īsu kopsavilkumu. CLAUDE.md un `.cursor/rules` turi īsus - tie ielādējas katrā sesijā.
6. **5h logs.** Lielu A darbu sāc tikai, ja sesijā izlietots < 40%; loga pēdējā stundā dari review, `tsc`/testus un mazus labojumus. Pirms limita aģents ieraksta stāvokli (zars, nākamais solis) `docs/komandu-zinojumi.md`, lai pēc reset nav jāpārlasa viss.
7. **Nedēļas reset (otrdiena ~23:00).** Ja otrdienas rītā nedēļas limits ir < 70% izlietots, atlikumu izmanto rindā gaidošiem A darbiem un auditiem (neizlietotais pazūd); ja > 85% - otrdien tikai sagatavo specifikācijas un palaiž trešdien no rīta.
8. **Review lētāks par implementāciju.** Grok 4.6 izmaiņu pārbaudei pietiek ar `koda-parbauditajs` uz Sonnet, kas lasa tikai `git diff origin/main...HEAD` un skartos testus; Opus review tikai A klases PR (maksājumi, drošība, migrācijas).
9. **Neatkārtot neveiksmes cilpā.** Ja pēc 2 mēģinājumiem tests joprojām krīt, aģents apstājas un ziņo cēloņa hipotēzi; Andris lemj par modeli vai pārplānošanu.
10. **Īsa komandu izvade.** Testus palaid tikai skartajiem failiem un garu izvadi saīsini (`| tail -n 40`), nevis ielādē kontekstā pilnu `vitest`/`next build` izdruku.
