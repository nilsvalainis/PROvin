# IRISS/PRO mobilā izvēlne - Claude dizaina briefs (25.10.2026)

Kam: Claude `dizaineris` (Opus). Ziņai: Andris / Kārlis.
No: Grok Dizaineris. Nils 25.10.2026 00:52 Rīgā: "Iedod claude uzdizainēt… 10 dažādus variantus ar visām ikonām."

## Uzdevums
Uzdizainēt **10 dažādus** IRISS (un tas pats stils PRO) mobilās sākumlapas variantus - svaigs, radošs skatiens. Nodot Nilam kā HTML maketus + PNG (iPhone ~390×852), **bez produkcijas koda**.

Galvenais fokuss: **Pavadzīmes + Loģistikas vidžeti** - dizainā **vienoti** (viena ģimene), bet **vizuāli atšķiras**, lai skaidri saprot, kurš ir kurš.

## Kas jau NOLEMTES (neārdīt)
1. **Apakšējā josla** - Nils: "Apakša ok". Peldoša īsa kapsula C (~176×48), ~97% necaurspīdīga balta, 3 ikonas: Sākums (mājiņa, Apple stila kontūrs), Vairāk (kontūrs), Meklēt. Sk. `josla-maja.png`.
2. Tikai 3 apakšējās ikonas (ne Pasūtījumi/Sludinājumi joslā).
3. Edge-to-edge līdz Dynamic Island / home indicator (`viewport-fit=cover`); PRO Safari chrome = standalone PWA.
4. **Ikonas flīzēs** (Nils apstiprinājis virzienu): Autoparks = Dzintarzeme logo mazliet lielāks ar atkāpi no malām; Pavadzīmes = CSDD logo **full-bleed** zaļš #006225 bez balta fona; Loģistika = Google Maps; VIN paliek; Pasūtījumi / Sludinājumi / Radars - jaunas, vienā stilā. Sk. `a04-ikonu-lapa.png`, `a02-iriss-vairak-pec.png`.
5. PRO fons - variants 7: gradients `#e4e4ea → #cfcfd6` (ne `#f5f5f7`). IRISS - mīksts zili-pelēks gradients.
6. Virziens: max transparent, clean, minimal (Apple premium). Flat pogas. Inter. Touch ≥44px. Nekādu AI attēlu - tikai īstas zīmolu zīmes.

## Kas NELIKĀS (Grok v7 - atmests)
- Loģistikas A/B/C (cipars+līnija / kapsulas / kvadrāti) - Nils: "Neviens nepatīk."
- Pavadzīmes + Loģistika nav pietiekami vienota ģimene.
- Sk. `sakums-c.png`, `sakums-c-b.png`, `logistika-varianti.png` - konteksts, **ne kopēt**.

## Pavadzīmes vidžets (prasības)
- Bez nosaukuma, bez pogas «Visas».
- Bez baltas kartītes fona - karājas uz ekrāna gradienta.
- Pieskaroties jebkurā vietā - uzreiz pavadzīmju rakstīšana.
- Apļi (statusu skaitļi) Nils teica, ka der - bet vari pārdomāt, ja ģimene ar Loģistiku prasa citu formu; ja citādāk - skaidri atšķir no Loģistikas.

## Loģistikas vidžets (prasības)
- Skaitļi: **Nākošā / Aiznākošā / Gaida** (krāsas OK virzienā: Nākošā zaļa ~`#1e9e4a`, Aiznākošā dzintara ~`#f59e0b`, Gaida pelēka ~`#8e8e93` - vari precizēt ģimenē).
- **Ne apļos** (Nils tieši: "ne apļos") - forma cita nekā Pavadzīmēm, bet tā pati dizaina valoda.
- Vesels vidžets = viens pieskāriens uz Loģistiku.
- Bez baltas kartītes, ja tas der vienotajam stilam.

## Ko rādīt katrā no 10 variantiem
Katrs variants = pilns sākums (flīžu režģis + abi vidžeti + apakšējā josla C), ideāli arī "Vairāk" ar visām ikonām. Numerēt 01-10. Īsa latviešu parakstu rinda katram.

## Nodošana
1. HTML + PNG mapē (piem. `docs/iriss-menu-mobilais/claude-v1/` vai `.playwright-mcp/`).
2. Rinda `docs/komandu-zinojumi.md` + Ziņai: Andris.
3. Nilam rāda Grok Dizaineris vai Andris - **kods produkcijā tikai pēc Nila "jā"**.

## Faili šajā mapē
- `sakums-c.png`, `sakums-c-b.png`, `logistika-varianti.png`, `josla-maja.png` - Grok v7 (atmests virziens virsū).
- `a01-iriss-sakums-pec.png`, `a02-iriss-vairak-pec.png`, `a03-pro-sakums-pec.png`, `a04-ikonu-lapa.png` - agrākie apstiprinātie ikonu / flīžu virzieni.
