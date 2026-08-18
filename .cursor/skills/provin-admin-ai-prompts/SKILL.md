---
name: provin-admin-ai-prompts
description: Syncs PROVIN expert-agent rules into admin AI system prompts for vehicle comment generation and history enrichment. Use when editing lib/admin-ai-prompts.ts, admin ✨ AI routes, or aligning deployed prompts with provin-expert-agent.
---

# PROVIN Admin AI Prompts

## Scope (strict)

| Uses `PROVIN_FIELD_AGENT_SYSTEM` | Does **not** use field agent |
|----------------------------------|------------------------------|
| `/api/admin/ai/*` | `/api/admin/ai-polish-lv` |
| `lib/admin-ai-{inspection,seller,price,summary,incidents-summary,mileage-comment,source-comment}.ts` | `lib/admin-ai-polish.ts` → `AI_LV_POLISH_SYSTEM` only |

Field agent prompts are for **data processing and Latvian expert copy** on admin ✨ actions: avotu komentāri, nobraukums, negadījumi, pārdevēja portrets, apskate, cena, tehniskie riski, kopsavilkums.

**Institutional memory:** every ✨ generation receives historical similar-audit excerpts + aggregate case packs + learnings saved after each substantive workspace persist (`recordAuditAggregateLearningFromDraft`). Prefer client **value density** over long essays.

## Audit knowledge pipeline (token discipline)

**Never** dump full order drafts into Cursor Claude / expensive models. Use the cheap local path:

1. **Backfill (no LLM):** `POST /api/admin/audit-knowledge` `{ "action": "backfill", "limit": 120 }` — scans drafts → anonymized snippets → `provin_audit_aggregate_learnings.json`.
2. **Promote (no LLM):** `{ "action": "promote" }` or `npm run audit:knowledge:promote` → `.data/…/audit-knowledge-candidates.md` (hard-capped ~12k chars).
3. **Expensive agent:** review **only** that candidates MD → inject durable rules into [provin-admin-prompt-engineering/reference.md](../provin-admin-prompt-engineering/reference.md) + `lib/provin-aggregate-case-rules.ts` → sync prompts.
4. **Runtime ✨ budget:** `buildAggregateKnowledgeAiContext` caps packs (3), learning keys (3), snippets/key (4), total ~7500 chars.

Code: `lib/admin-audit-learning-extract.ts`, `lib/admin-audit-knowledge-promote.ts`, `lib/admin-ai-aggregate-knowledge.ts`, `app/api/admin/audit-knowledge/route.ts`.

## Source of truth

1. **Base field agent (tone, LV grammar, mission):** [.cursor/skills/provin-field-agent/SKILL.md](../provin-field-agent/SKILL.md) → `PROVIN_FIELD_AGENT_SYSTEM`.
2. **Grammar polish only:** [.cursor/skills/provin-lv-polish/SKILL.md](../provin-lv-polish/SKILL.md) → `AI_LV_POLISH_SYSTEM`.
3. **Extended expert knowledge:** [.cursor/skills/provin-expert-agent/SKILL.md](../provin-expert-agent/SKILL.md) — regional, legal, test-drive, forensics.
4. **Powertrain matrices & prompt injection:** [.cursor/skills/provin-admin-prompt-engineering/SKILL.md](../provin-admin-prompt-engineering/SKILL.md) — Audi/MB/BMW red flags, motorstundas math, regional forensics for deployed constants.
5. **Runtime API:** `lib/admin-ai-prompts.ts` — merged base + extensions + per-field task via `provinFieldAgentPrompt()`.

When tone or LV grammar rules change, update provin-field-agent first, then mirror into `PROVIN_FIELD_AGENT_SYSTEM`. When regional/legal/forensic rules change, sync from provin-expert-agent. When model-specific powertrain or motorstundas injection changes, sync from provin-admin-prompt-engineering ([reference.md](../provin-admin-prompt-engineering/reference.md)). Avoid drift.

## Prompt map

| Export | Active field | Consumer |
|--------|--------------|----------|
| `PROVIN_FIELD_AGENT_SYSTEM` | Base | All field-agent prompts |
| `AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM` | 1. Tehnisko risku analīze | `admin-ai-technical-risks.ts` — Claude web search (analīze); Gemini Flash pārraksta klienta LV (`AI_TECHNICAL_RISKS_GEMINI_REWRITE_SYSTEM`) |
| `AI_TECHNICAL_RISKS_GEMINI_REWRITE_SYSTEM` | 1. Tehnisko risku analīze (klienta LV) | Gemini Flash rewrite after Claude — not grammar polish; must not drop mezgli |
| `AI_INSPECTION_RECOMMENDATIONS_SYSTEM` | 2. Ieteikumi klātienes apskatei | `admin-ai-inspection.ts` — **expert markdown** (bold hooks, no `- `); uses technical-risks section |
| `AI_SELLER_ANALYSIS_SYSTEM` | Pārdevēja portrets | `admin-ai-seller.ts` — **expert markdown** |
| `AI_PRICE_ANALYSIS_SYSTEM` | Cenas vērtējums | `admin-ai-price.ts` |
| `AI_SUMMARY_ANALYSIS_SYSTEM` | 3. Kopsavilkums | `admin-ai-summary.ts` — free-form synthesis, no „Sveiki”, no EUR prices, avoid duplicating technical risks |
| `AI_MILEAGE_COMMENT_SYSTEM` | Nobraukuma vēstures komentārs | `admin-ai-mileage-comment.ts` |
| `AI_INCIDENTS_SUMMARY_SYSTEM` | Negadījumu vēstures kopsavilkums | `admin-ai-incidents-summary.ts` |
| `aiSourceCommentSystemPrompt(label)` | Avota „Komentāri” | `admin-ai-source-comment.ts` |
| `AI_LISTING_PEEK_COMMENT_SYSTEM` | Ātrais sludinājuma vērtējums | `admin-ai-listing-peek.ts` — Gemini Flash / Gemini JSON |
| `AI_LV_POLISH_SYSTEM` | Gramatika (✨ polish) | `admin-ai-polish.ts` → [provin-lv-polish](../provin-lv-polish/SKILL.md) |

`AI_CLIENT_EMAIL_FORMAT_RULES` applies only to **3. Kopsavilkums** (plain text, end with `APPROVED BY IRISS`).

## Sync workflow

1. Edit [provin-field-agent](../provin-field-agent/SKILL.md) for tone/LV grammar; [provin-expert-agent](../provin-expert-agent/SKILL.md) for domain rules.
2. Mirror into `PROVIN_FIELD_AGENT_SYSTEM` (shared base + extensions as needed).
3. Adjust field-specific `taskBlock` only when that field needs extra constraints.
4. Smoke-test one order per affected ✨ button in admin.

## Do not

- Attach field-agent system text to grammar polish or non-admin AI callers.
- Duplicate full report structure in single-field outputs.
- Invent facts not present in order context (`lib/admin-ai-order-context.ts`).
- Invent approximate repair/service EUR in any comment field (including technical risks). Never „Baltija”, „saime”, „atteice”, „kontrolpunkts”, „sviedru sajūgs”, „vecuma kaprīze” in client Latvian — write light workshop Latvian like Gemini Flash.
- Let per-source ✨ comments restate the full mileage synthesis — that belongs in `AI_MILEAGE_COMMENT_SYSTEM` / „NOBRAUKUMA VĒSTURES KOMENTĀRS”.
- Let tech risks, inspection recommendations, and summary absorb each other’s essays — keep strict field roles (complement, don’t 4×-repeat).

## Model parity (Gemini vs Claude)

Most ✨ fields share the same system + user prompts via `admin-ai-dispatch.ts`. Differences:

| | Gemini Flash / Gemini | Claude Sonnet (`flash`) / Opus (`pro`) |
|--|--|--|
| Prompts | Same field-agent + task block | Same |
| Post-process | `applyProvinReportCopyVocabulary` | Same + **Sonnet LV polish** of the output |
| Extra | — | `PROVIN_CLAUDE_LV_SURFACE` appended last (Claude calques) |

**Exception — „1. Tehnisko risku analīze”:** default `flash`/`pro` is a **two-step chain**. Claude (web search, flagship 8–12 paragraphs) analyzes; **Gemini Flash rewrites** client Latvian (`AI_TECHNICAL_RISKS_GEMINI_REWRITE_SYSTEM`). Sonnet polish is skipped on that path — polish keeps Claude’s paper voice („ne šis, ne tas”). If Gemini is missing or the rewrite is too thin, fall back to Sonnet polish. Operator Gemini-only buttons skip the chain (Gemini already writes). Do not dumb down Claude’s technical bar to fix language.

Default routing: source/listing comments → Gemini Flash; synthesis (mileage, price) → Sonnet; **technical risks → Sonnet/Opus analysis + Gemini Flash write**; summary → Opus.

When adding vocabulary, put it in `PROVIN_REPORT_COPY_VOCABULARY` (all models) **and** `PROVIN_CLAUDE_LV_SURFACE` if Claude historically ignores it.

- Bump `PROVIN_AI_PROMPT_VERSION` in `lib/ai-prompt-version.ts` when changing client-facing prompt rules.
- Regression: `lib/ai-eval/` (golden comment fixtures + prompt invariant tests) — run via `npm test`.

## Related

- [provin-expert-agent/reference.md](../provin-expert-agent/reference.md)
- `.cursor/rules/business-legal-lv.mdc` — payments/footer/Stripe (not vehicle mechanics)
