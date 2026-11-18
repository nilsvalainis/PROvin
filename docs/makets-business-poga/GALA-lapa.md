# PROVIN Business galamērķa lapa - apstiprinātais dizains (Nils, 05.11.2026)

Lapa, uz kuru ved PROVIN poga partnera auto sludinājumā.

Skati: `galamerka-lapa/skati/V4-GALA-dators.png`, `V4-GALA-telefons.png`, `V4-GALA-telefons-pirmais-ekrans.png`.
Maketa kods: `galamerka-lapa/varianti.html?v=4&bg=B&lg=2` (tikai maketam, ne produkcijai).

## Dators (dalīts ekrāns)
- Kreisā puse tumša, fonā izpludināts auto foto no sludinājuma (blur, aptumšots).
- Augšā dīlera logo, zem tā «Auto vēstures pārbaude sadarbībā ar PROVIN». Bez «×».
- Zils virsraksts «PROVIN BUSINESS DATU ATSKAITE», lielais virsraksts «Pilna auto vēstures pārbaude dažādos avotos».
- Auto: foto, nosaukums, gads · nobraukums · degviela · ātrumkārba, **pilns VIN** (nekad neaizklāts).
- 5 pakalpojumi vienā kolonnā ar ķeksīti, teksti no provin.lv sadaļas «Pilnīgākais vēstures datu pārklājums Eiropā»:
  - Oficiālo dīleru servisa dati* - Detalizēti nobraukuma, apkopju intervālu un remontu dati.
  - Maksas vēstures atskaites - carVertical, autoDNA u.c. vienā atskaitē - avoti papildina cits citu.
  - Oficiālie valstu reģistri - Vēsturi pārbaudām arī ES valstu oficiālajos reģistros. Citi reģioni - pēc pieprasījuma.
  - Eiropas izsoļu portālu arhīvi* - Ieraksti un foto no brīža, kad auto bija bojāts vai pārdots izsolē.
  - Latvijas avoti - Apdrošinātāju dati, sludinājuma un tehnisko apskašu vēsture.
- Zvaigznīte: «* Dīleru un izsoļu dati pieejami noteiktiem ražotājiem un modeļiem. Vecākiem auto dīlera datu var nebūt.»
- Labā puse balta: «PROVIN Business datu atskaite», 69,99 €, «Visi pieejamie vēstures dati par šo auto vienā atskaitē.»
- Pelēks info lodziņš: «Šī ir vēstures datu atskaite. Tehnisko risku izvērtējumu un konsultāciju piedāvā PROVIN audits.» (saite uz auditu)
- Forma: e-pasts, tālrunis (neobligāti), «Rēķins uzņēmumam» (atveras), piekrišana, plakana zila poga «Maksāt 69,99 €», «Droša apmaksa ar Stripe».

## Telefons
- Visa lapa melna, kompakta.
- Secība: logo -> virsraksts -> auto ar VIN (maza bilde blakus) -> cena un info lodziņš -> forma un poga -> pakalpojumi un zvaigznīte.
- Atverot redzams auto, cena un e-pasta lauks.

## Slēgtā lapa
- Ja saiti atver tieši (ne no partnera sludinājuma): «Saite nav pieejama» (`galamerka-lapa/3-slegta-dators.png`).

## Dati, kas vajadzīgi no partnera
- Logo divās versijās (gaišam un tumšam fonam) - PRO admin partnera iestatījumos.
- VIN: partnera plūsma (feed) vai `data-vin`; rezerve - numurzīme caur CSDD vai dīleris apstiprina VIN B2B kabinetā.
- Auto nosaukums, parametri un foto - no sludinājuma.
