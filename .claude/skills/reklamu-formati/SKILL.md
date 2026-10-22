---
name: reklamu-formati
description: Izmanto, kad veido statiskas vai video reklāmas Meta (Facebook/Instagram feed, Stories, Reels) vai Google Ads (Demand Gen, Performance Max, YouTube, uploaded display): izmēri, drošās zonas, teksta limiti, failu ierobežojumi un HTML uz PNG darba plūsma.
---

# Meta un Google reklāmu formāti

## PROVIN pielāgojumi (lasi pirms visa pārējā)
- Ievēro `CLAUDE.md` un `docs/resursu-sadale.md`. Atbildes Nilam tikai latviski, tekstos tikai īsā defise "-".
- Nekādu AI attēlu: tikai īsti foto un īstas zīmolu zīmes (`public/brand-logos/`). Neliec "eksperts". Cenas formāts "4,50 €", attālumi km.
- Zīmoli netiek jaukti: uz Dzintarzeme Auto materiāliem SIA ĪRISS nemin (ne tekstā, ne rekvizītos, ne logo); PROVIN un IRISS materiāli ir atsevišķi.
- Dzintarzeme Auto: balts fons, oranžs #F5861F tikai akcentiem (cena, CTA, plāna līnija), nekad lieliem laukumiem vai pamattekstam. Logo noteikumi - sk. aģentu `dizaineris` (sadaļa "Zīmola konsekvence").
- Fonts Inter (ar pilnu latviešu diakritiku), plakanas pogas bez ēnām un gradientiem.
- Viss, kas iziet ārpus (drukātājs, pašvaldība, reklāmu konts, klients), ir tikai melnraksts; sūta vai pasūta Nils. Reklāmu budžeti tikai ar Nila "jā".
- Šajā Mac vidē `google-chrome` komandas vietā lieto Playwright (`mcp__playwright__*`) vai `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new ...`. Ekrānuzņēmumus un renderus glabā `.playwright-mcp/`.
- Dīlera reklāmai cena attēlā sakrīt ar cenu sludinājumā vai cenu lapā (Reklāmas likums, 8. p.).

Specifikācijas pārbaudītas oficiālajās lapās 2026-10-17 (saites zemāk). Platformas specifikācijas maina bieži. Ja kopš pārbaudes pagājuši vairāk nekā 3 mēneši vai kampaņa ir svarīga, pārbaudi saites vēlreiz.

Meta lapas bloķē parasto fetch, bet atveras ar headless Chrome:
`google-chrome --headless=new --no-sandbox --virtual-time-budget=15000 --dump-dom <URL>`

## 1. Meta (Facebook / Instagram)
Avots: Meta Ads Guide, https://www.facebook.com/business/ads-guide/update/ + `image/facebook-feed`, `image/instagram-feed`, `image/instagram-story`, `video/facebook-feed`, `video/instagram-story`, `video/instagram-reels`.

**Izmēri** (Meta tagad iesaka 1440 px platumu, bet 1080 px ir pieņemams; minimālais platums ir 500-600 px):

| Placement | Ratio | Ieteicamais | Arī strādā |
|---|---|---|---|
| FB un IG feed (attēls un video) | 4:5 | 1440×1800 | 1080×1350 |
| Feed kvadrāts | 1:1 | 1440×1440 | 1080×1080 |
| Stories un Reels (FB, IG, Messenger) | 9:16 | 1440×2560 | 1080×1920 |
| Saites ainava (vecāks formāts) | 1.91:1 | 1200×628 | - |

- **Attēli:** JPG vai PNG, maks. 30 MB. Malu attiecības pielaide FB feed ir 3 %, IG 1 %. FB feed minimālais platums 600 px, IG 500 px.
- **Video:** MP4 vai MOV (feed un Stories arī GIF), H.264, fiksēts kadru ātrums, progressive, stereo AAC 128 kbps+, maks. 4 GB.
- **Video garums:** FB feed no 1 s līdz 241 min, IG Stories no 1 s līdz 60 min, IG Reels no 0 s līdz 15 min.
- **Attēlu reklāma Stories** tiek rādīta 5-16 sekundes.
- **Reels nedrīkst saturēt** licencētu mūziku (lieto Meta Sound Collection vai oriģinālo audio), sejas vai kameras efektus, GIF un produktu birkas.

**Stories un Reels drošā zona** (oficiāli: "roughly 14% top, 35% bottom, 6% each side" brīvi no teksta un logo):
- uz 1080×1920 tas ir augšā ~269 px, apakšā ~672 px, sānos ~65 px katrā pusē. Drošais laukums ir ~950×979 px, sākot no y≈269;
- uz 1440×2560 tas ir augšā ~358 px, apakšā ~896 px, sānos ~86 px;
- fons un attēls var iet līdz malām. Teksts, cena, logo un CTA paliek iekšā drošajā laukumā.

**Teksta ieteikumi** (rakstzīmes, pirms tiek nogriezts):

| Placement | Primary text | Headline |
|---|---|---|
| FB feed | 50-150 | 27 |
| IG feed | 125 | 40 |
| IG Stories | 125 | - |
| IG Reels | 44 | - |

Attēlā tekstam nav stingra limita, bet mazāk teksta parasti nozīmē labāku piegādi un lasāmību.

## 2. Google Ads
Avoti:
- kopsavilkums: https://support.google.com/google-ads/answer/13676244
- RDA: https://support.google.com/google-ads/answer/9823397
- PMax: https://support.google.com/google-ads/answer/17091269
- Uploaded display: https://support.google.com/google-ads/answer/1722096
- Demand Gen: https://support.google.com/google-ads/answer/13704860
- Video: https://support.google.com/google-ads/answer/17091270
- Non-skippable: https://support.google.com/google-ads/answer/11462260

**Svarīgi:** Display kampaņas pāriet uz Demand Gen. No 2026. gada jūnija var migrēt brīvprātīgi, vēlāk jaunas Display kampaņas varēs veidot tikai Demand Gen.

Visizplatītākie izmēri visās kampaņās ir **1200×628 (1.91:1)** un **1200×1200 (1:1)**.

**Responsive Display / Demand Gen attēli** (JPG vai PNG, maks. 5120 KB):
- horizontāls 1.91:1: ieteicams 1200×628, minimums 600×314;
- kvadrāts 1:1: ieteicams 1200×1200, minimums 300×300;
- vertikāls 4:5: ieteicams 960×1200, minimums 480×600;
- vertikāls 9:16: ieteicams 900×1600 (RDA) vai 1080×1920 (Demand Gen, Shorts), minimums 600×1067;
- RDA apraksts: līdz 80 rakstzīmēm;
- Google iesaka RDA un PMax attēlos **neuzlikt logo un tekstu virsū** un nelikt viltus pogas, jo pogas ir politikas pārkāpums. Neizmanto arī kolāžas, rāmjus, noapaļotas malas un "digitālus" baltus fonus. Logo un tekstu Google pievieno pats no atsevišķiem assetiem. Dizainēta reklāma ar tekstu der **uploaded display** formātā, nevis RDA attēlos.

**Uploaded display (statiski un animēti baneri):** GIF, JPG vai PNG, **maks. 150 KB**.
- Izmēri:
  - 200×200, 240×400, 250×250, 250×360, **300×250**, **336×280**, 580×400;
  - 120×600, **160×600**, **300×600**, 300×1050;
  - 468×60, **728×90**, 930×180, 970×90, **970×250**, 980×120;
  - mobilajiem 300×50, **320×50**, 320×100.
- Animēts GIF: līdz 30 s (pēc tam jāapstājas), lēnāk par 5 FPS.
- HTML5 ZIP ≤600 KB. Pieejams tikai kontiem ar vēsturi (>90 dienas, >9000 USD tēriņu).

**Performance Max:**
- Teksts:
  - headlines: 3-15 gab., ≤30 rakstzīmes, vismaz viens ≤15;
  - long headline: 1-5 gab., ≤90 rakstzīmes;
  - descriptions: 2-5 gab., ≤90 rakstzīmes;
  - business name: ≤25 rakstzīmes, jāsakrīt ar domēnu vai verificēto nosaukumu;
  - display path: 2× ≤15 rakstzīmes.
- Attēli: 1200×628 (min 600×314), 1200×1200 (min 300×300), 960×1200 4:5 (min 480×600). Līdz 20 attēliem, ieteicami 4+ no katra veida. Formāts JPG vai PNG, ≤5 MB.
- **Logo:**
  - kvadrāts 1:1: 1200×1200, min 128×128, ≤5120 KB, obligāts;
  - horizontāls 4:1: 1200×300, min 512×128, nav obligāts;
  - līdz 5 logo;
  - caurspīdīgu logo bieži rāda uz balta fona, tāpēc neliec pārsvarā baltu logo uz caurspīdīga fona. Labāk kvadrāts ar savu fonu.
- Video: 16:9, 1:1 un 9:16, katrs ≥10 s, līdz 15 gab. Ja video nav, Google ģenerē to automātiski. Lai no tā izvairītos, augšupielādē visus trīs formātus.

**Demand Gen:**
- Logo: 1:1, min 144×144, ieteicams 1200×1200, **maks. 150 KB**. Tas ir stingrāks limits nekā PMax.
- Video: no 5 s, bet video, kas īsāki par 10 s, nerāda YouTube in-stream.
- 9:16 attēlu drošās zonas ir līdzīgas 9:16 video drošajām zonām (precīzās vērtības skaties video safe zones lapā).

**YouTube video:**
- Izmēri: 1920×1080 (16:9), 1080×1920 (9:16), 1080×1080 (1:1). Ieteicamais formāts MPG (MPEG-2 vai MPEG-4), arī MP4 un MOV. Maks. 256 GB. Video jābūt public vai unlisted.
- Garumi:
  - **bumper** ≤6 s;
  - **non-skippable** 7-15 s;
  - 16-30 s non-skippable tikai CTV un tikai horizontāli;
  - in-feed un skippable ieteicami 15 s;
  - Shorts 6-60 s.
- In-feed teksts: headline 2 rindas × 40 rakstzīmes, description 2 rindas × 35.
- Video action: headline 30, long headline 90, description 90, CTA 10 rakstzīmes.
- Non-skippable headline ≤15 rakstzīmes.
- Thumbnail 1280×720 (min 1280×640), <2 MB.
- Companion banner 300×60, <150 KB, rāda tikai uz datora.

## 3. Labā prakse statiskām reklāmām
- **Viens vēstījums uz bildi:** virsraksts, ja vajag cena vai piedāvājums, un zīmols. Pārējo raksti reklāmas tekstā, nevis bildē.
- **Liela, lasāma tipogrāfija.** Pārbaudi to telefona izmērā (~360 px plats priekšskatījums). Ja nevar izlasīt 1 sekundē, teksts ir par mazu.
- **Cena vai piedāvājums redzams uzreiz.** Cenai jāatbilst galamērķa lapai (citādi rodas destination mismatch vai maldinošas reklāmas risks).
- **Zīmols agri:** logo vai nosaukums ir redzams, bet nedominē. Video zīmols parādās pirmajās 2-3 sekundēs.
- **Nekādu viltus UI elementu:** play pogas, aizvēršanas krustiņi, pogas, kas neko nedara, viltoti paziņojumi. Īsts produkta ekrānuzņēmums ir atļauts, ja tas ir patiess.
- **Kontrasts** ir pietiekams arī mazā izmērā. Teksts nav uz noisy foto daļas.
- Ievēro klienta aizliegtos vārdus un zīmola noteikumus, piem. zīmola grāmatā vai iepriekšējos labojumos. Ievēro arī tipogrāfiskās prasības, piem., vai drīkst lietot domuzīmes.
- **Testēšanai** taisi 3-5 variantus: cits virsraksts, izkārtojums vai akcents. Nosauc tos skaidri (v1, v2, v1a…).

## 4. Darba plūsma (HTML uz PNG)
1. Noskaidro: platformas, placementi, izmēri, gala teksts (precīzi, bez improvizācijas), zīmola krāsas, fonti, logo un aizliegtie vārdi.
2. Katram izmēram uztaisi atsevišķu HTML ar fiksētu `width` un `height` uz `body`, `margin:0` un `overflow:hidden`. Fontus ielādē lokāli vai no Google Fonts un pagaidi, līdz tie ielādējas.
3. Uzzīmē drošo zonu kā izslēdzamu overlay (debug klase). Pārbaudi, vai teksts un logo ir iekšā, un pirms gala renderēšanas overlay izslēdz.
4. Renderē:
   - `google-chrome --headless=new --no-sandbox --hide-scrollbars --force-device-scale-factor=1 --window-size=1080,1920 --screenshot=/ceļš/out.png file:///ceļš/ad.html`
   - vai ar Playwright, `page.set_viewport_size` un `page.screenshot(full_page=False)`.
   - Ja vajag 1440 px no 1080 px dizaina, izmanto `--force-device-scale-factor=1.3333`, vai uzreiz dizainē 1440 px platumā.
5. **Pārbaudi izmērus un svaru:** `python3 -c "from PIL import Image;im=Image.open('out.png');print(im.size)"` un `ls -l`.
   - Uploaded display failam jābūt ≤150 KB. Ja ir vairāk, pārvērt par JPG (kvalitāte 80-90) vai saspied ar pngquant.
   - Meta failiem jābūt ≤30 MB, PMax un RDA failiem ≤5 MB.
6. **Atver un apskati katru gala failu** ar attēla lasīšanas rīku. Pārbaudi:
   - drukas kļūdas, diakritiku (ā, č, ē, ģ, ī, ķ, ļ, ņ, š, ū, ž) un cenas formātu (piem., `24,99 €`);
   - aizliegtos vārdus un zīmes;
   - drošās zonas;
   - vai nekas nav nogriezts.
7. Saglabā ar skaidriem nosaukumiem: `<zīmols>_<placement>_<WxH>_v<N>.png`. Atskaitē ieliec ceļus un īsu aprakstu par katru variantu.
8. Neko nepublicē un neaugšupielādē reklāmu kontos bez skaidras lietotāja atļaujas.

## 5. Nepārbaudīts / jāprecizē
- Skippable in-stream ads: "skip pēc 5 s". Zināms no meklēšanas kopsavilkuma, oficiālo lapu (support.google.com/google-ads/answer/6055025) neatvēru.
- Precīzās Google 9:16 video drošās zonas pikseļos šeit nav ierakstītas. Skaties Google "video ad safe zones" lapu.
- Meta teksta limiti ir **ieteikumi** (nogriešanas robeža), nevis cieti limiti. Reels primary text oficiāli ir 44 rakstzīmes, daži trešo pušu avoti min 40.
