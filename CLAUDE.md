# PROVIN komanda (kopīgie noteikumi visiem aģentiem)

Šie noteikumi attiecas uz katru Claude sesiju un katru aģentu no `.claude/agents/`.
Sīkāki projekta noteikumi ir `.cursor/rules/*.mdc` (tie ir saistoši arī Claude) un `.cursor/skills/*/SKILL.md`.

## Valoda un teksts

- Atbildi Nilam latviski.
- UI, e-pastos, klientu tekstā un commit ziņās tikai īsā defise `-`. Nekad `—` vai `–` (`.cursor/rules/no-em-dash.mdc`, tests to pārbauda).
- Admin UI teksti ir latviski un hardkodēti; publiskā vietne caur `messages/**` (lv/en paritāte).

## Drošība

- Nekad neizdrukā atslēgas, tokenus vai paroles.
- Nemaini Vercel env, nedzēs atslēgas, neveido piekļuves datus. To dara Nils pats; pasaki, kas jāpievieno.
- Neaiztiec vecos datus (pasūtījumus, JSON krātuves ierakstus), ja Nils to tieši nelūdz.
- Neskenē disku ārpus projekta mapes.
- Ziņas klientiem, partneriem vai publiski ieraksti: tikai melnraksts, sūta Nils (ja vien viņš tieši nepalūdz nosūtīt).

## Darba plūsma kodā

- Katrs darbs = jauns zars no `origin/main`, PR uz `main`, squash merge, tad pārbaudi, ka Vercel production deploy ir success (`.cursor/rules/git-branch-pr-merge.mdc`).
- Pirms PR: `npx tsc --noEmit` un attiecīgie `npx vitest run ...` testi zaļi.
- Testi pārbauda uzvedību, nevis avota tekstu (`.cursor/rules/tests-behavior-first.mdc`).
- Atskaitē vienmēr: PR nr., squash commit uz `main`, Vercel production statuss, kas nav pārbaudīts.
- Ja mainīts `relay/` vai `provin-listings`: atskaites beigās raksti `VAJAG RELEJA DEPLOY`.

## Komanda

Galvenais aģents ir **Andris** (`.claude/agents/andris.md`), pārējie ir nozaru aģenti. Kā ar tiem strādāt: `docs/claude-komanda.md`.

# Papildu noteikumi (Grok/Claude sadalījums, 22.10)

## Valoda
- Nilam tikai latviski; Claude rezultātus tulko latviski. Tikai īsā defise "-". Nelieto "eksperts", "čomi". Attālumi km. Cenas "4,50 €".

## Drošība un ārējie darbi
- Ārējie e-pasti/ziņas tikai melnraksti; sūta Nils ar "sūti". Firmas pasts no sia-iriss@inbox.lv; Lainei/Taivo no nils.valainis@gmail.com; iestādēm Dzintarzemes vārdā no dzintarzeme-auto@inbox.lv.
- Paroles tikai 1Password. Nekad nelikt paroles, personas kodus, kartes Claude projektos.
- Apify, reklāmu budžeti, CSDD Saglabāt/Anulēt - tikai ar Nila jā.

## Produkts
- Galvene nekad nav sticky. Nemainīt vecos pasūtījumus. Neaiztikt PDF atskaites dizainu, Grandland, Panamera. Copart izslēgts. Google Maps tikai bezmaksas līmenī. stat.vin manuāli.
- UI izmaiņām vajag maketu + Nila "jā" (atjaunošanām nē). Plakanas pogas, Inter, bez AI attēliem.

## Darba plūsma
- Plānotais darbs: backup zars, rebase, zaļš CI, squash merge, Vercel READY + provin.lv/lv 200 (B2B: demo.provin.lv 200).
- Paralēli Cursor/Claude: atvērtajos PR nav kopīgu failu; sapludina pa vienam; redeploy tikai no main HEAD.
- Mobilie labojumi (390px) - Claude. Opus tikai, bez maksas kredītiem.
- Taupīt tokenus; naktī ziņas tikai kritiskas.

## Komanda
- Grok pusē: Andris (galvenais), Aivars, PVN atguvējs, EKII, Klientu atbalsts, Google, Sociālie tīkli, Labā Roka, Fricis, PROVIN ADMINS (atskaišu aizpilde), IRISS (pasts/izsoles).
- Claude pusē: koda darbi (iriss, provin-admins kods, iriss-b2b, dizaineris, koda-parbauditajs).
- Apmaiņa: docs/komandu-zinojumi.md (viena rinda par svarīgu darbu); lasīt sesijas sākumā.
