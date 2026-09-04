---
name: provin-i18n
description: >-
  Maintains PROVIN.LV public i18n — tulkojumu struktūra (lv/en parity, nekad
  nehardkodēt publisko tekstu). Use when editing messages/**, i18n/routing.ts,
  i18n/request.ts, next-intl, useTranslations, locale-aware Link, or public
  marketing/checkout/legal copy in app/[locale] or components (not admin).
---

# PROVIN i18n (lv / en)

Public site copy lives in JSON. Admin UI is Latvian-only and is **not** this skill — see [provin-admin-ui](../provin-admin-ui/SKILL.md). Legal/Stripe identity still follows `.cursor/rules/business-legal-lv.mdc`.

## When to apply

- `messages/lv/**`, `messages/en/**`
- `i18n/routing.ts`, `i18n/request.ts`, `i18n/navigation.ts`, `lib/i18n/load-app-messages.ts`
- `useTranslations`, `useLocale`, `getTranslations` from `next-intl`
- Public pages under `app/[locale]/` and marketing/checkout components

Do **not** use for admin ✨ expert copy (`provin-field-agent`) or grammar polish (`provin-lv-polish`).

## Locales

| | |
|---|---|
| Locales | `lv` (default), `en` |
| Prefix | `localePrefix: "always"` → `/lv/…`, `/en/…` |
| Detection | `localeDetection: false` |
| Plugin | `next.config.ts` → `createNextIntlPlugin("./i18n/request.ts")` |

Links and redirects for localized routes: `Link` / `redirect` / `usePathname` from `@/i18n/navigation`, never `next/link` or hardcoded `/lv` prefixes in hrefs.

## File map

One namespace file per locale, same basename:

```
messages/lv/hero.json
messages/en/hero.json
```

Namespaces (must exist in **both** locales): `meta`, `header`, `hero`, `pricing`, `iriss`, `how`, `faq`, `order`, `footer`, `thanks`, `misc`, `legal`, `provinSelect`, `googleReviews`, `riskAuditGuide`, `samples`, `partner`.

Register a **new** namespace in **both** loaders (keep lists in sync):

1. `i18n/request.ts` (`loadMessages`)
2. `lib/i18n/load-app-messages.ts` (`loadAppMessages`)

Top-level JSON keys are next-intl namespaces (`Hero`, `Order`, `Header`, …). Components call `useTranslations("Hero")` then `t("cta")`.

## Parity checklist (every copy change)

1. Add or change the key in `messages/lv/{file}.json` **and** `messages/en/{file}.json` with the **same key path**.
2. Do not leave English as a copy-paste of Latvian, or Latvian as machine-English.
3. Arrays/objects must have the same shape (e.g. `Hero.pillars`, `Hero.heroOrderBenefits`).
4. Empty strings that are intentional placeholders (`heroConsultLink: ""`) stay empty in **both** files.
5. Brand: public provider is **PROVIN.LV**. LV copy: `automašīna` / `auto`, never `automobīlis`. **NEVER** Unicode em dash `—` or en dash `–`. Prefer a comma, colon, or a new sentence. If a dash is needed, only ASCII `-` (`PASŪTĪT no 39,99 €`, `24-72h`). Canonical: `.cursor/rules/no-em-dash.mdc`.

## Never hardcode public text

- No user-visible Latvian or English string literals in `app/[locale]/**` or public `components/**` (buttons, headings, aria-labels, errors, FAQ, footer).
- Exceptions: brand tokens (`PROVIN.LV`, `IRISS`), VIN/format examples, CSS class names, `data-*` attributes.
- Operator-only admin (`components/admin/**`, `app/admin/**`) **may** stay hardcoded Latvian — do not migrate admin into `messages/`.

## Legal and checkout

- Distances-līgums / PTAC / MK Nr. 255 / footer requisites: edit `messages/*/legal.json` + `messages/*/footer.json` together with `lib/company.ts`. Do not invent a different legal name than `getCompanyLegal()`.
- Order validation copy belongs in `messages/*/order.json` (`Order.errors`), wired through `useTranslations("Order")`.
- Pricing experiments (`app/test-pricing*`, `lib/test-pricing-*.ts`) often keep copy in TypeScript — if you add a string there, add/adjust the matching `lib/test-pricing-*.test.ts`. Prefer `messages/` when the string is on the main `/lv` `/en` site.

## Do not

- Add a third locale without updating `i18n/routing.ts` and both message loaders.
- Translate admin source-block labels (`SOURCE_BLOCK_LABELS`) via next-intl.
- Change `localePrefix` without checking the `/` → `/lv` redirect loop note in `i18n/routing.ts`.
