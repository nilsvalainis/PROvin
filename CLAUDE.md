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
