---
name: provin-admin-gemini-prompts
description: Syncs PROVIN expert-agent rules into admin Gemini system prompts for vehicle comment generation and history enrichment. Use when editing lib/admin-gemini-prompts.ts, admin ✨ Gemini routes, or aligning deployed prompts with provin-expert-agent.
---

# PROVIN Admin Gemini Prompts

## Scope (strict)

| Uses `PROVIN_FIELD_AGENT_SYSTEM` | Does **not** use field agent |
|----------------------------------|------------------------------|
| `/api/admin/gemini/*` | `/api/admin/ai-polish-lv` |
| `lib/admin-gemini-{inspection,seller,price,summary,incidents-summary,mileage-comment,source-comment}.ts` | `lib/admin-gemini-polish.ts` → `GEMINI_LV_POLISH_SYSTEM` only |

Field agent prompts are for **data processing and Latvian expert copy** on admin ✨ actions: avotu komentāri, nobraukums, negadījumi, pārdevēja portrets, apskate, cena, kopsavilkums.

## Source of truth

1. **Base field agent (tone, LV grammar, mission):** [.cursor/skills/provin-field-agent/SKILL.md](../provin-field-agent/SKILL.md) → `PROVIN_FIELD_AGENT_SYSTEM`.
2. **Grammar polish only:** [.cursor/skills/provin-lv-polish/SKILL.md](../provin-lv-polish/SKILL.md) → `GEMINI_LV_POLISH_SYSTEM`.
3. **Extended expert knowledge:** [.cursor/skills/provin-expert-agent/SKILL.md](../provin-expert-agent/SKILL.md) — regional, legal, test-drive, forensics.
4. **Powertrain matrices & prompt injection:** [.cursor/skills/provin-admin-prompt-engineering/SKILL.md](../provin-admin-prompt-engineering/SKILL.md) — Audi/MB/BMW red flags, motorstundas math, regional forensics for deployed constants.
5. **Runtime API:** `lib/admin-gemini-prompts.ts` — merged base + extensions + per-field task via `provinFieldAgentPrompt()`.

When tone or LV grammar rules change, update provin-field-agent first, then mirror into `PROVIN_FIELD_AGENT_SYSTEM`. When regional/legal/forensic rules change, sync from provin-expert-agent. When model-specific powertrain or motorstundas injection changes, sync from provin-admin-prompt-engineering ([reference.md](../provin-admin-prompt-engineering/reference.md)). Avoid drift.

## Prompt map

| Export | Active field | Consumer |
|--------|--------------|----------|
| `PROVIN_FIELD_AGENT_SYSTEM` | Base | All field-agent prompts |
| `GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM` | Ieteikumi klātienes apskatei | `admin-gemini-inspection.ts` |
| `GEMINI_SELLER_ANALYSIS_SYSTEM` | Pārdevēja portrets | `admin-gemini-seller.ts` |
| `GEMINI_PRICE_ANALYSIS_SYSTEM` | Cenas vērtējums | `admin-gemini-price.ts` |
| `GEMINI_SUMMARY_ANALYSIS_SYSTEM` | 2. Kopsavilkums | `admin-gemini-summary.ts` |
| `GEMINI_MILEAGE_COMMENT_SYSTEM` | Nobraukuma vēstures komentārs | `admin-gemini-mileage-comment.ts` |
| `GEMINI_INCIDENTS_SUMMARY_SYSTEM` | Negadījumu vēstures kopsavilkums | `admin-gemini-incidents-summary.ts` |
| `geminiSourceCommentSystemPrompt(label)` | Avota „Komentāri” | `admin-gemini-source-comment.ts` |
| `GEMINI_LV_POLISH_SYSTEM` | Gramatika (✨ polish) | `admin-gemini-polish.ts` → [provin-lv-polish](../provin-lv-polish/SKILL.md) |

`GEMINI_CLIENT_EMAIL_FORMAT_RULES` applies only to **2. Kopsavilkums** (plain text, end with `APPROVED BY IRISS`).

## Sync workflow

1. Edit [provin-field-agent](../provin-field-agent/SKILL.md) for tone/LV grammar; [provin-expert-agent](../provin-expert-agent/SKILL.md) for domain rules.
2. Mirror into `PROVIN_FIELD_AGENT_SYSTEM` (shared base + extensions as needed).
3. Adjust field-specific `taskBlock` only when that field needs extra constraints.
4. Smoke-test one order per affected ✨ button in admin.

## Do not

- Attach field-agent system text to grammar polish or non-admin Gemini callers.
- Duplicate full report structure in single-field outputs.
- Invent facts not present in order context (`lib/admin-gemini-order-context.ts`).
- Let per-source ✨ comments restate the full mileage synthesis — that belongs in `GEMINI_MILEAGE_COMMENT_SYSTEM` / „NOBRAUKUMA VĒSTURES KOMENTĀRS”.

## Prompt version & evals

- Bump `PROVIN_GEMINI_PROMPT_VERSION` in `lib/gemini-prompt-version.ts` when changing client-facing prompt rules.
- Regression: `lib/gemini-eval/` (golden comment fixtures + prompt invariant tests) — run via `npm test`.

## Related

- [provin-expert-agent/reference.md](../provin-expert-agent/reference.md)
- `.cursor/rules/business-legal-lv.mdc` — payments/footer/Stripe (not vehicle mechanics)
