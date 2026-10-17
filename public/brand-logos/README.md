# PROVIN car brand logos

48 car brands: the full dealer-brand list in `lib/dealer-brands.ts` of nilsvalainis/PROvin (same 48 slugs as `public/brand-logos/`, commit af86401a).
For use in admin panels (PRO, IRISS), PDFs and dealer data. Slugs match the existing `public/brand-logos/<slug>.svg` filenames, so the set can replace those files 1:1.

## Contents

- `svg/<slug>.svg`: primary mark on a 256×256 transparent artboard (viewBox `0 0 256 256`).
- `svg/<slug>-wide.svg`: 512×128 horizontal artboard, made for every brand whose mark is wider than 2:1 (wordmarks, wings, ovals).
- `svg/alt/`: alternates (see below).
- `png/<slug>@256.png`, `png/<slug>@512.png`: transparent PNGs of the square SVGs.
- `png/<slug>-wide@512.png` and `@1024.png`: transparent PNGs of the wide SVGs (512×128 / 1024×256).
- `manifest.json`: brand, slug, files, source URL and page, source-file licence, colour/mono, notes.
- `overview.png`: every logo on white, rendered in Chrome from the SVG files.

## How the logos were sourced

No logo was redrawn, traced or AI-generated. Every file is an existing vector of the official mark:
- Official manufacturer websites: Alfa Romeo, Alpine, Lamborghini, Subaru (subaru.lv).
- Otherwise, the logo file that Wikipedia/Wikimedia Commons uses for the brand (current version per Wikidata P154 / infobox).
- Vectors with embedded raster images were rejected as primaries.

## How they were normalised (white background)

1. **Backing plates.** These were removed where present (Polestar's dark square). No other source had a plate. The Lotus yellow disc, the Ferrari, Abarth and Lamborghini shields, and the Land Rover oval are part of the official emblems.
2. **Colours.** Official colours were kept. White-only official marks (Alfa Romeo mono badge, Alpine A, Lamborghini bull) were recoloured to black, the official monochrome. The Polestar star went to the brand dark #081822.
3. **Lockups.** Where the source was a lockup (symbol plus a wordmark underneath), the symbol was isolated by cropping the viewBox at the gap between symbol and wordmark. The wordmark geometry is clipped, not edited. This applies to Citroën, Dacia, DS, Genesis, Infiniti, Lexus, Maserati, Mazda, Mitsubishi, Opel, SEAT, Smart, Subaru, Suzuki and Vauxhall.
4. **Tight crop.** The tight content box was measured from a 2000 px render (alpha > 3%).
5. **Placement.** The mark was placed centred in the artboard through a nested `<svg>` with that viewBox.
   - Scale = min(fit in 216×216, geometric-mean size 150 px), so round, square and wide marks look about equally heavy.
   - Wide artboard: fit in 488×104.
6. **Optimisation.** svgo 4 (preset-default, precision 3). IDs and classes are prefixed `pv-<slug>-`, so several logos can be inlined on one page without CSS/ID clashes. Each file was checked against its pre-svgo render.
7. **PNGs.** Rendered with resvg.

## Brands

| Brand | Slug | Colour | Wide | Source type | Source |
|---|---|---|---|---|---|
| Abarth | `abarth` | colour |  | Wikipedia (fr) non-free/logo file | [Fichier:Abarth_2007_Logo.svg](https://fr.wikipedia.org/wiki/Fichier:Abarth_2007_Logo.svg) |
| Alfa Romeo | `alfa-romeo` | mono |  | Official Alfa Romeo site (alfaromeousa.com, Stellantis) | [logoFooterWhite.svg](https://www.alfaromeousa.com/content/dam/alfa/2022/header/logoFooterWhite.svg) |
| Alpine | `alpine` | mono |  | Official Alpine site (alpine-cars.co.uk) | [ (inline header logo, class MainHeader__logo)](https://www.alpine-cars.co.uk/ (inline header logo, class MainHeader__logo)) |
| Aston Martin | `aston-martin` | colour | yes | Wikipedia (en) non-free/logo file | [File:Aston_Martin_Lagonda_brand_logo.svg](https://en.wikipedia.org/wiki/File:Aston_Martin_Lagonda_brand_logo.svg) |
| Audi | `audi` | mono | yes | Wikimedia Commons | [File:Audi-Logo_2016.svg](https://commons.wikimedia.org/wiki/File:Audi-Logo_2016.svg) |
| Bentley | `bentley` | colour | yes | Wikipedia (en) non-free/logo file | [File:Bentley_(Logo_2025).svg](https://en.wikipedia.org/wiki/File:Bentley_(Logo_2025).svg) |
| BMW | `bmw` | colour |  | Wikimedia Commons | [File:BMW_logo_(gray).svg](https://commons.wikimedia.org/wiki/File:BMW_logo_(gray).svg) |
| Citroën | `citroen` | mono |  | Wikimedia Commons | [File:Citroen_2022.svg](https://commons.wikimedia.org/wiki/File:Citroen_2022.svg) |
| CUPRA | `cupra` | mono |  | Wikimedia Commons | [File:Cupra_symbol.svg](https://commons.wikimedia.org/wiki/File:Cupra_symbol.svg) |
| Dacia | `dacia` | colour | yes | Wikimedia Commons | [File:Dacia_2021_logo_green.svg](https://commons.wikimedia.org/wiki/File:Dacia_2021_logo_green.svg) |
| DS Automobiles | `ds` | colour |  | Wikipedia (en) non-free/logo file | [File:DS_Automobiles_logo.svg](https://en.wikipedia.org/wiki/File:DS_Automobiles_logo.svg) |
| Ferrari | `ferrari` | colour |  | Wikipedia (it) non-free/logo file | [File:Logo_della_Ferrari_S.p.A..svg](https://it.wikipedia.org/wiki/File:Logo_della_Ferrari_S.p.A..svg) |
| Fiat | `fiat` | mono |  | Wikimedia Commons | [File:FIAT_logo_(2020).svg](https://commons.wikimedia.org/wiki/File:FIAT_logo_(2020).svg) |
| Ford | `ford` | colour | yes | Wikimedia Commons | [File:Ford_logo_flat.svg](https://commons.wikimedia.org/wiki/File:Ford_logo_flat.svg) |
| Genesis | `genesis` | colour | yes | Wikipedia (en) non-free/logo file | [File:Genesis_division_emblem.svg](https://en.wikipedia.org/wiki/File:Genesis_division_emblem.svg) |
| Honda | `honda` | mono |  | Wikimedia Commons | [File:Honda_auto_logo.svg](https://commons.wikimedia.org/wiki/File:Honda_auto_logo.svg) |
| Hyundai | `hyundai` | colour |  | Wikimedia Commons | [File:Hyundai_symbol.svg](https://commons.wikimedia.org/wiki/File:Hyundai_symbol.svg) |
| Infiniti | `infiniti` | colour | yes | Wikimedia Commons | [File:Infiniti_logo_2023.svg](https://commons.wikimedia.org/wiki/File:Infiniti_logo_2023.svg) |
| Jaguar | `jaguar` | mono | yes | Wikimedia Commons | [File:Jaguar_2024.svg](https://commons.wikimedia.org/wiki/File:Jaguar_2024.svg) |
| Jeep | `jeep` | colour | yes | Wikimedia Commons | [File:Jeep_wordmark.svg](https://commons.wikimedia.org/wiki/File:Jeep_wordmark.svg) |
| Kia | `kia` | mono | yes | Wikimedia Commons | [File:KIA_logo3.svg](https://commons.wikimedia.org/wiki/File:KIA_logo3.svg) |
| Lamborghini | `lamborghini` | mono |  | Official Lamborghini site (lamborghini.com, 2024 logo DAM) | [logo_header_01.svg](https://www.lamborghini.com/sites/it-en/files/DAM/lamborghini/logos/2024/03_26/logo_header_01.svg) |
| Lancia | `lancia` | mono | yes | Wikimedia Commons | [File:Lancia_Logo_2023.svg](https://commons.wikimedia.org/wiki/File:Lancia_Logo_2023.svg) |
| Land Rover | `land-rover` | colour |  | Wikipedia (en) non-free/logo file | [File:LandRover.svg](https://en.wikipedia.org/wiki/File:LandRover.svg) |
| Lexus | `lexus` | mono |  | Wikimedia Commons | [File:Lexus.svg](https://commons.wikimedia.org/wiki/File:Lexus.svg) |
| Lotus | `lotus` | colour |  | Wikipedia (en) non-free/logo file | [File:Lotus_Cars_logo.svg](https://en.wikipedia.org/wiki/File:Lotus_Cars_logo.svg) |
| Maserati | `maserati` | colour |  | Wikimedia Commons | [File:Maserati_logo_2.svg](https://commons.wikimedia.org/wiki/File:Maserati_logo_2.svg) |
| Mazda | `mazda` | colour |  | Wikimedia Commons | [File:Mazda_logo_2024_(vertical).svg](https://commons.wikimedia.org/wiki/File:Mazda_logo_2024_(vertical).svg) |
| Mercedes-Benz | `mercedes` | mono |  | Wikimedia Commons | [File:Mercedes-Benz_Star_(1969-1986,_2025-).svg](https://commons.wikimedia.org/wiki/File:Mercedes-Benz_Star_(1969-1986,_2025-).svg) |
| MG | `mg` | colour |  | Wikimedia Commons | [File:MG_Motor_2021_logo.svg](https://commons.wikimedia.org/wiki/File:MG_Motor_2021_logo.svg) |
| MINI | `mini` | mono | yes | Wikimedia Commons | [File:MINI_logo.svg](https://commons.wikimedia.org/wiki/File:MINI_logo.svg) |
| Mitsubishi | `mitsubishi` | colour |  | Wikimedia Commons | [File:Mitsubishi_motors_new_logo.svg](https://commons.wikimedia.org/wiki/File:Mitsubishi_motors_new_logo.svg) |
| Nissan | `nissan` | mono |  | Wikimedia Commons | [File:Nissan_2020_logo.svg](https://commons.wikimedia.org/wiki/File:Nissan_2020_logo.svg) |
| Opel | `opel` | mono |  | Wikimedia Commons | [File:Opel_logo_2023.svg](https://commons.wikimedia.org/wiki/File:Opel_logo_2023.svg) |
| Peugeot | `peugeot` | mono |  | Wikipedia (en) non-free/logo file | [File:Peugeot_2021_Logo.svg](https://en.wikipedia.org/wiki/File:Peugeot_2021_Logo.svg) |
| Polestar | `polestar` | mono |  | Wikimedia Commons | [File:Polestar_logo_2020.svg](https://commons.wikimedia.org/wiki/File:Polestar_logo_2020.svg) |
| Porsche | `porsche` | colour |  | Wikipedia (de) non-free/logo file | [Datei:Porsche_Wappen.svg](https://de.wikipedia.org/wiki/Datei:Porsche_Wappen.svg) |
| Renault | `renault` | mono |  | Wikimedia Commons | [File:Renault_2021.svg](https://commons.wikimedia.org/wiki/File:Renault_2021.svg) |
| Rolls-Royce | `rolls-royce` | mono |  | Wikimedia Commons | [File:Rolls-Royce_Motor_Cars_logo.svg](https://commons.wikimedia.org/wiki/File:Rolls-Royce_Motor_Cars_logo.svg) |
| SEAT | `seat` | colour |  | Wikimedia Commons | [File:SEAT_Logo_from_2017.svg](https://commons.wikimedia.org/wiki/File:SEAT_Logo_from_2017.svg) |
| Škoda | `skoda` | colour | yes | Wikimedia Commons | [File:%C5%A0koda_Auto_2022_text_logo.svg](https://commons.wikimedia.org/wiki/File:%C5%A0koda_Auto_2022_text_logo.svg) |
| Smart | `smart` | mono |  | Wikimedia Commons | [File:Smart_2022.svg](https://commons.wikimedia.org/wiki/File:Smart_2022.svg) |
| Subaru | `subaru` | mono | yes | Official Subaru Latvia distributor site (subaru.lv) | [subaru-logo-horisontal-black.svg](https://www.subaru.lv/media/g0gfdtmz/subaru-logo-horisontal-black.svg) |
| Suzuki | `suzuki` | colour |  | Wikimedia Commons | [File:Suzuki_logo_2025_(vertical).svg](https://commons.wikimedia.org/wiki/File:Suzuki_logo_2025_(vertical).svg) |
| Toyota | `toyota` | colour |  | Wikimedia Commons | [File:Toyota_Symbol.svg](https://commons.wikimedia.org/wiki/File:Toyota_Symbol.svg) |
| Vauxhall | `vauxhall` | colour |  | Wikimedia Commons | [File:Vauxhall_logo_2026.svg](https://commons.wikimedia.org/wiki/File:Vauxhall_logo_2026.svg) |
| Volkswagen | `volkswagen` | colour |  | Wikimedia Commons | [File:Volkswagen_logo_2019.svg](https://commons.wikimedia.org/wiki/File:Volkswagen_logo_2019.svg) |
| Volvo | `volvo` | mono |  | Wikimedia Commons | [File:Volvo-Iron-Mark-Black.svg](https://commons.wikimedia.org/wiki/File:Volvo-Iron-Mark-Black.svg) |

Per-brand version notes (e.g. BMW 2020 flat, VW 2019, Kia 2021, Peugeot 2021, Renault 2021, Opel 2023, Mazda 2024, Honda 2026 H mark) are in `manifest.json` → `notes`.

## Alternates
- `svg/alt/alfa-romeo-colour.svg`: Full-colour 2015 badge; contains embedded raster textures. Source: https://fr.wikipedia.org/wiki/Fichier:Logo_Alfa_Romeo_(2015).svg
- `svg/alt/fiat-colour.svg`: Multicolour 2022 FIAT wordmark. Source: https://commons.wikimedia.org/wiki/File:FIAT_logo_coloured.svg
- `svg/alt/lamborghini-shield.svg`: Classic 3D gold/black shield (pre-2024), heavy file. Source: https://en.wikipedia.org/wiki/File:Lamborghini_Logo.svg

## Caveats

- **Trademarks.** All marks are trademarks of their owners. Use them only to identify the brand whose dealer/service data is shown (nominative use). Do not modify them or imply endorsement or partnership.
- **Non-free files.** Several vectors come from Wikipedia "fair use"/"non-free logo" files: Aston Martin, Bentley, DS, Peugeot, Abarth, Ferrari, Porsche, and the alternates. They are faithful vector copies of the official logos, but they are not manufacturer press-kit files. For print-critical use, replace them with the press-kit vector if Nils obtains media-site access.
- **Hyundai.** The Hyundai symbol file on Commons is CC BY-SA 4.0 as a file; the trademark is Hyundai's.
- **Jaguar, Lancia, Škoda.** These are thin or very wide wordmarks; use the `-wide` files where space allows.
- **Lamborghini.** The primary is the official 2024 bull only. A flat full-shield 2024 vector was not obtainable.
- **Honda.** This is the new 2026 flat H mark, not the older chrome-style H emblem.
