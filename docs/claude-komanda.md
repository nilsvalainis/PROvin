# Claude komanda (Grok aģentu analogs)

## Kas kur atrodas

| Grok | Claude |
|---|---|
| Galvenais aģents Andris | `.claude/agents/andris.md` + piesprausta Code sesija "Andris" |
| Nozaru aģenti | `.claude/agents/*.md` (viens fails = viena loma) |
| Kopīgās instrukcijas | `CLAUDE.md` + `.cursor/rules/*.mdc` |
| Ieplānotie darbi (rīta atskaite, EKII) | Ieplānotie uzdevumi (routines) Claude lietotnē |
| Cursor palīgs | `koda-parbauditajs` |

## Aģenti

| Aģents | Grok vārds | Joma |
|---|---|---|
| `andris` | Andris | Projektu vadītājs, sadala darbus |
| `provin-admins` | PROVIN ADMINS | PRO admin, pasūtījumi, auditi, AI komentāri |
| `iriss` | IRISS | IRISS admin, loģistika, autoparks, sludinājumi |
| `aivars-csdd` | Aivars Aksenoks | Pavadzīmes, CSDD |
| `iriss-b2b` | IRISS B2B | Partneri, maks, kredīti |
| `fricis-cmr` | Fricis CMR | CMR un kravu dokumenti |
| `pvn-atguvejs` | PVN atguvējs | PVN atgūšana, rēķinu pārbaude |
| `klientu-atbalsts` | Klientu atbalsts | Atbilžu melnraksti |
| `dizaineris` | Dizaineris | UI/UX, maketi |
| `google` | Google | Analytics, Search Console, SEO |
| `socialie-tikli` | Sociālie tīkli | Ieraksti, baneri |
| `ekii-specis` | EKII specis | EKII (uzdevums jāpapildina) |
| `laba-roka` | Labā Roka | Personīgais asistents |
| `koda-parbauditajs` | Cursor palīgs | Koda pārbaude pirms PR |

## Kā lietot

1. **Galvenā sesija.** Claude lietotnē, cilnē Code, atver jaunu sesiju PROvin projektā, nosauc to "Andris" un piesprauž sānjoslā. Raksti: "Andris, ..." un apraksti uzdevumu.
2. **Andris sadala darbu.** Īsus darbus viņš uzdod nozaru aģentam tajā pašā sesijā (piem. "lai `aivars-csdd` pārbauda termiņus"). Lielus darbus viņš atver kā atsevišķu sesiju ar savu zaru un PR; tā sesija atskaitās Andrim.
3. **Tieši pie aģenta.** Jebkurā sesijā vari rakstīt: "Lieto aģentu `iriss` un ...", vai sesijas sākumā izvēlēties aģentu.
4. **Sānjosla.** Sesijas var sagrupēt sadaļās (PRO, IRISS, Mārketings), līdzīgi kā Grok sarakstā.
5. **Ieplānotie darbi.** Rīta atskaite (`laba-roka`) un EKII (`ekii-specis`) var palaisties pēc grafika kā ieplānotie uzdevumi.
6. **Ne-koda darbi.** Klientu atbalstu, sociālos tīklus un Google var darīt arī Cowork cilnē ar Gmail, kalendāra un Drive savienotājiem; aģentu apraksti der kā instrukcijas arī tur.

## Kā mainīt vai pievienot aģentu

Rediģē vai pievieno failu `.claude/agents/<vārds>.md`:

```markdown
---
name: vards
description: Kad šo aģentu lietot (pēc šī teksta tiek izvēlēts aģents).
tools: Read, Grep, Glob   # neobligāti; bez šīs rindas aģentam ir visi rīki
---

Instrukcijas aģentam.
```
