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
| `AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM` | 1. Tehnisko risku analīze | `admin-ai-technical-risks.ts` — Claude web search (Eiropas forumi, ja paka nesedz) + aggregate knowledge |
| `AI_INSPECTION_RECOMMENDATIONS_SYSTEM` | 2. Ieteikumi klātienes apskatei | `admin-ai-inspection.ts` — heading then paragraph, no `*`; uses technical-risks section |
| `AI_SELLER_ANALYSIS_SYSTEM` | Pārdevēja portrets | `admin-ai-seller.ts` — heading then paragraph, no `*` |
| `AI_PRICE_ANALYSIS_SYSTEM` | Cenas vērtējums | `admin-ai-price.ts` |
| `AI_SUMMARY_ANALYSIS_SYSTEM` | 3. Kopsavilkums | `admin-ai-summary.ts` — free-form synthesis, no „Sveiki”, no EUR prices, avoid duplicating technical risks |
| `AI_MILEAGE_COMMENT_SYSTEM` | Nobraukuma vēstures komentārs | `admin-ai-mileage-comment.ts` |
| `AI_INCIDENTS_SUMMARY_SYSTEM` | Negadījumu vēstures kopsavilkums | `admin-ai-incidents-summary.ts` |
| `aiSourceCommentSystemPrompt(label)` | Avota „Komentāri” | `admin-ai-source-comment.ts` |
| `aiAutoRecordsServiceHistorySystemPrompt()` | Oficiālā dīlera „Servisa vēsture” | `admin-ai-source-comment.ts` (`targetField=serviceHistoryNotes`) |
| `aiAutoRecordsOilIntervalSystemPrompt()` | Oficiālā dīlera „Eļļas maiņas intervāli” | `admin-ai-source-comment.ts` (`targetField=oilChangeIntervalNotes`) — rēķina no visiem avotiem |
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
- Let per-source ✨ comments restate the full mileage synthesis — that belongs in `AI_MILEAGE_COMMENT_SYSTEM` / „NOBRAUKUMA VĒSTURES KOMENTĀRS”.
- Let any field except „Eļļas maiņas intervāli” run oil-change interval math — that belongs in `aiAutoRecordsOilIntervalSystemPrompt()` / `AI_OIL_CHANGE_INTERVAL_RULES`.
- Let tech risks, inspection recommendations, and summary absorb each other’s essays — keep strict field roles (complement, don’t 4×-repeat).
- Let brevity or anti-repetition skip topics from admin „Papildu piezīmes AI” (`OPERATORA KOMANDAS`). Those notes are a binding work order (`AI_OPERATOR_NOTES_EXECUTION_RULES`): every topic in, no cherry-pick, no extra lines when the operator limited the job.
- Tell the client to hunt CSDD TA defects that later inspections already show as cleared (~2+ years, lamps, play, etc.). Exception: rust and exhaust particulates/smoke stay cautious. Canonical: `AI_RESOLVED_HISTORICAL_FINDINGS_RULES`.
- Treat everyday TA-covered wear (sviras, bukses, lodbalsti, bremzes) as a purchase risk when the TA coverage brief is SVAIGA or SPĒKĀ. Canonical: `AI_TA_COVERED_WEAR_RULES`. Unknown history is an in-person line, not a risk — `AI_UNKNOWN_IS_NOT_A_RISK_RULES`.
- Copy historical / style-corpus excerpts instead of adapting them to THIS order and OPERATORA KOMANDAS.
- Omit wrap / plēve from technical risks or summary when any field already says the car is wrapped. Canonical: `AI_WRAP_FILM_RULES`.
- Put approximate repair/service EUR bands („orientējoši … €”) into any ✨ comment. Canonical: `AI_NO_ESTIMATED_REPAIR_EUR_RULES`. Aggregate packs may hold € for internal calibration only — `stripUnauthorizedEuroAmounts()` is a runtime safety net on technical-risks/inspection/summary, not a substitute for correct prompting.
- Use „saime”, „Baltija”/„Baltijas”, bare „injektori”, „vidējs uzturēšanas risks”, or „kontrolpunkts klātienē” anywhere the model can copy into client text (prompts, aggregate packs, few-shots). Use „agregāts/konstrukcija”, named countries (Latvija/Lietuva/Igaunija), „iesmidzinātājs (sprausla)”, „ierasta uzturēšanas izmaksa”, „jāpārbauda klātienē” instead.

## Prompt version & evals

- Bump `PROVIN_AI_PROMPT_VERSION` in `lib/ai-prompt-version.ts` when changing client-facing prompt rules.
- Regression: `lib/ai-eval/` (golden comment fixtures + prompt invariant tests) — run via `npm test`.

## Related

- [provin-expert-agent/reference.md](../provin-expert-agent/reference.md)
- `.cursor/rules/business-legal-lv.mdc` — payments/footer/Stripe (not vehicle mechanics)
