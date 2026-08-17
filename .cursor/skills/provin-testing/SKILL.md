---
name: provin-testing
description: >-
  PROVIN.LV test conventions for Vitest unit tests, evaluation scripts, and
  Playwright e2e checks. Use when adding or changing lib/**/*.test.ts,
  lib/ai-eval, npm test, test:ai-eval, Playwright MCP against localhost,
  screenshot scripts, or persist/PDF/parser regressions.
---

# PROVIN Testing

Three layers. Do not mix them.

| Layer | Tool | What it is |
|-------|------|------------|
| Unit | Vitest | Pure `lib/` logic, colocated `*.test.ts` |
| Eval | Vitest + goldens | Prompt invariants and comment quality |
| Browser | Playwright (scripts + MCP) | Visual / flow checks of **this** app |

## When to apply

- New or failing `lib/**/*.test.ts`
- `lib/ai-eval/**`, `PROVIN_AI_PROMPT_VERSION`, `npm run test:ai-eval`
- `scripts/mobile-screenshot.mjs`, `scripts/demo-mobile-preview.mjs`
- Playwright MCP driving `localhost:3040` (or `PREVIEW_URL`)
- Persist, PDF parse, mileage, Stripe field, or order-validation changes

## Vitest (default)

- Config: `vitest.config.ts` — `environment: "node"`, `include: ["lib/**/*.test.ts"]`, alias `@/` → repo root.
- Commands: `npm test` (run), `npm run test:watch`.
- Colocate: `lib/foo.ts` → `lib/foo.test.ts`. Import `{ describe, expect, it }` from `vitest`; add `vi` / `beforeEach` / `afterEach` only when mocking.
- No jsdom, no React Testing Library, no tests under `components/` or `app/` unless the user explicitly asks to change `include`.
- Unit tests must not hit network, Stripe live, Blob, or real SMTP. Fixtures: inline strings, `readFileSync` of repo files, or JSON next to the test.
- Live PDF fixtures: `*.integration.test.ts` (e.g. `lib/csdd-kg982-pdf.integration.test.ts`) — keep them hermetic (checked-in PDF), not live vendor APIs.

Cover behavior, not snapshots of huge HTML. Parser/persist tests should assert the field the operator cares about (comment text, row count, hydrate `source`).

### What to test when you change X

| Change | Add/extend |
|--------|------------|
| Parser (CSDD, LTAB, CarVertical, AutoDNA, VIN registry) | Colocated `lib/*-parse.test.ts` with a real excerpt |
| Workspace persist / hydrate | `lib/admin-order-workspace-hydrate.test.ts` and persist `*.test.ts` — localStorage wins over server |
| `dropOrResetRow` / field reset | `lib/admin-drop-or-reset-row.test.ts` |
| Order / VIN / listing validation | `lib/order-field-validation.test.ts` |
| Pricing experiment copy/routing | existing `lib/test-pricing-*.test.ts` |
| Public i18n keys (optional) | assert both locale files share key paths if the change is structural |

## Evaluation scripts (`lib/ai-eval`)

When **client-facing** prompt rules change in `lib/admin-ai-prompts.ts` or field-agent skills:

1. Bump `PROVIN_AI_PROMPT_VERSION` in `lib/ai-prompt-version.ts` (`YYYY-MM-DD.N`).
2. Keep invariants in `lib/ai-eval/prompt-invariants.test.ts` (string presence in prompts).
3. Comment shape: `lib/ai-eval/comment-quality.test.ts` + `lib/ai-eval/fixtures/golden-comments.json`.
4. Run `npm run test:ai-eval` (or `npm test` — evals are included).

Do not call paid Anthropic/Gemini APIs from tests. Goldens are local fixtures. Sync rules: [provin-admin-ai-prompts](../provin-admin-ai-prompts/SKILL.md).

## Playwright — this app only

There is **no** `@playwright/test` suite and no `playwright.config.ts`. Do not scaffold a full e2e project unless asked.

**Scripts (committed):**

- `npm run screenshot:mobile` → `scripts/mobile-screenshot.mjs` (needs `next start`; `PREVIEW_URL` default `http://localhost:3000`)
- `npm run screenshot:demo-mobile` → demo layouts
- Dev server for daily work: `npm run dev` → **port 3040**

**Playwright MCP / agent browser:** drive **PROVIN** — `/lv`, `/en`, `/pasutit`, checkout, `/admin` after login. Check locale prefix, order validation, footer requisites, admin persist after reload.

**Out of scope for tests:** AutoDNA, CarVertical, e.csdd.lv, tjekbil, or any third-party VIN site. Runtime scrapers live in `lib/vin-sources/` and `scripts/vin-fetch.mjs` — they are product code, not the test suite.

## Do not

- Add `app/**/*.test.ts` that Vitest will ignore.
- Snapshot entire `client-report-html.ts` output.
- Use Playwright MCP to “test” vendor history portals.
- Skip `test:ai-eval` after prompt edits that affect client PDF/email copy.
