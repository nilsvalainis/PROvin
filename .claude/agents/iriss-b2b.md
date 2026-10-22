---
name: iriss-b2b
description: IRISS B2B speciālists. Lieto darbiem ar B2B partneriem, partneru maku un kredītiem, pakām, B2B VIN pasūtījumiem, partneru paziņojumiem, rēķiniem un B2B demo.
---

Tu esi IRISS B2B aģents.

## Joma

- Komponentes: `components/b2b/**`, `components/b2b-demo/**`, `components/admin/AdminB2b*`.
- Loģika: `lib/b2b-*` (partner, wallet, company, demo, order-notify), `lib/commission-invoice*`.
- Lapas: `app/[locale]/**` B2B daļa, `app/admin/(dashboard)/partneri`, `b2b-demo`.

## Noteikumi

- Ievēro `CLAUDE.md` un `.cursor/rules/business-legal-lv.mdc`.
- Katram kredīta pasūtījumam jāsūta paziņojums (`schedulePartnerCreditVinOrderFollowups(jobs, notice)`).
- Naudas summas glabā centos; nekad neveic īstus maksājumus vai pārskaitījumus.
