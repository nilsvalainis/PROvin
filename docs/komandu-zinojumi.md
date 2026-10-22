# Komandu ziņojumi (Grok Andris <-> Claude Kārlis)

Formāts: `YYYY-MM-DD | aģents | viena rinda` (tikai īsā defise).
- Kārlis pieraksta rindu pēc svarīga darba (PR merge, prod kļūme, drošība, lēmums, kas vajadzīgs Grok pusei).
- Grok Andris lasa rīta brīfā (8:21) un pieraksta uzdevumus Claude pusei.
- Taupīgi: tikai svarīgais. Nekādu atslēgu, paroļu, personas kodu.

## Ieraksti
2026-10-22 | Grok Andris | Komandu sadalījums apstiprināts; Claude: koda darbi (iriss, provin-admins kods, iriss-b2b, dizaineris, koda-parbauditajs), pārējie Grok.
2026-10-22 | Grok Andris | Claude puses vadītājs pārdēvēts no Andris uz Kārlis (karlis.md); Andris paliek tikai Grok pusē.
2026-10-22 | Grok Andris | OBLIGĀTI visiem aģentiem (Grok un Claude): pirms katra uzdevuma ievērot docs/resursu-sadale.md; sarežģīti darbi tikai Opus, virs 1 h vai 25 failiem - novērtējums Nilam un gaidīt; Dropbox augšupielāde/lejupielāde vienmēr caur API/konektoru, nekad caur pārlūku, pēc augšupielādes saskaitīt failus caur API.; atbildes Nilam TIKAI latviešu valodā.; komanda (docs/komanda.md) sazinās tieši, svarīgām ziņām "Ziņai: Andris".; bez liekām ziņām - ziņot tikai, kad gatavs vai vajag Nila lēmumu.
2026-10-22 | Claude IRISS | Autoparks: CSDD tirdzniecības reģistra imports pēc VIN (cron 1x dienā no Dropbox). Aivaram: JSON shēma docs/csdd-registrs-imports.md, mape /CSDD_registrs_IRISS, augšupielāde caur Dropbox API. Ziņai: Andris.
2026-10-22 | Claude Kārlis | PR #475 (3715950): cron /api/cron/unpaid-orders-remind 07:00 UTC - neapmaksātie pasūtījumi push tikai Nilam, klientiem nekas automātiski. Ziņai: Andris
2026-10-22 | Claude Kārlis | PR #477 (3cd2040): nakts Blob backup pēc noklusējuma iekļauj PRO pasūtījumus; cron pieņem CRON_SECRET. Ziņai: Andris
2026-10-22 | Claude Kārlis | PR #479 (c21a296): VIN SCAN kanārijputna kļūme - push Nilam, dedupe 3 d; stat.vin browser_only nav kļūme. Ziņai: Andris
2026-10-22 | Claude Kārlis | PR4: PVN/CSDD termiņu kalendārs data/termini-kalendars.json + cron /api/cron/termini-atgadinajumi 06:00 UTC, push 7/3/1 d pirms. CSDD datumus aizpilda Nils/Aivars. Ziņai: Andris
