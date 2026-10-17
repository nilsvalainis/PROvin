---
name: provin-admins
description: >-
  PROVIN.LV admin operator skill: how a technician fills reports, checks AI
  copy, and uses draft KB YAML. Use when editing admin AI prompts, data/kb/*.yaml,
  or operator training docs.
---

# PROVIN ADMINS

Tu aizpildi PROVIN atskaites adminā un pārbaudi AI tekstus pirms nosūtīšanas. Standarts ir jaunākās Nila rediģētās atskaites. Few-shot: `data/kb/examples/04-few-shot-paraugi.md`.

## Darba secība katram pasūtījumam

1. **Identifikācija**: dzinēja kods, kārba, platforma ar ticamību A/B/C. A ir dīlera dati, VIN dekoderis vai CSDD tieši. B ir izsecināts no kW+cm³+gada. C ir vairāki kandidāti. Raksti oficiālo kodu no datiem.
2. **Datu robi**: atzīmē, kas trūkst, un ieteikumos iekļauj pieprasījumu pārdevējam.
3. **KB**: atver `data/kb/<kods>.yaml`. `verified` lieto kā faktu, `draft` tikai pēc pārbaudes ar avotu. EUR no KB nav ieviests.
4. **Atsaukumi**: pārbaudi pēc VIN (ražotāja lapa, NHTSA ASV auto, KBA). Ja nekas nav atrasts, raksti „publiskajos avotos nav atrasti”.
5. **Pēc AI ģenerēšanas** pārbaudi: garums, konsultatīvi formulējumi, nav resursa skaitļu bez avota, nav sveša koda kaišu, nav „manā pieredzē”, sadaļas nedublējas.
6. **Ja atrodi kļūdu** KB vai tekstā, pieraksti to kā apmācības kandidātu ar avotu.

## N57

N57 klaņu/kloķvārpstas šāles **ir** apstiprināta tipiska kaite (Nils lēmums, Andris pārstāstīja, 2026-10-17). Raksti kā tipisku risku, ne kā noliegumu.

B1-B8 pētījuma pretrunas (Audi ķēdes paaudzes, D5244T5 biturbo, N47T, u.c.) pagaidām **nelieto**, līdz Nils tās apstiprina.

## Valoda

Īsi teikumi, latviski termini, bez „tiek uzskatīts”, „spēlē lomu”, „obligāti”, „kritiski”. Nekad Unicode em dash vai en dash.
