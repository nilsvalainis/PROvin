---
name: provin-lv-polish
description: Canonical system prompts for PROVIN.LV admin Latvian polish. AI_LV_POLISH_SYSTEM is grammar-only (manual ✨). AI_LV_FINAL_REVIEW_SYSTEM is the automatic last pass after generation. Use when editing lib/admin-ai-prompts.ts polish prompts, lib/admin-ai-polish.ts, /api/admin/ai-polish-lv, or reviewing ✨ polish output. Must NOT use provin-field-agent or provin-expert-agent rules.
---

# PROVIN LV Polish

## When to apply

Read this skill when the task involves:

- `AI_LV_POLISH_SYSTEM` or `AI_LV_FINAL_REVIEW_SYSTEM` in `lib/admin-ai-prompts.ts`
- `polishLatvianTextWithAi` / `finalizeGeneratedComment` in `lib/admin-ai-polish.ts`
- `/api/admin/ai-polish-lv` (admin ✨ gramatikas labošana)
- Automatic last review after Copilot / PRO / ✨ generation

Do **not** merge field-agent or expert-agent essays into these prompts. Generation stays in [provin-field-agent](../provin-field-agent/SKILL.md) and [provin-admin-ai-prompts](../provin-admin-ai-prompts/SKILL.md).

## Two prompts

| Prompt | When | Extra job |
|--------|------|-----------|
| `AI_LV_POLISH_SYSTEM` | Manual `/api/admin/ai-polish-lv` | Grammar, typos, punctuation, flow only |
| `AI_LV_FINAL_REVIEW_SYSTEM` | Automatic `finalizeGeneratedComment` after generation | Grammar plus weak technical wording / obvious slips that already contradict the same source text |

Both share `AI_LV_POLISH_CORE_RULES`. Neither invents vehicle facts, km, dates, countries, defects, or EUR that are not in the source text.

## Core system prompt (manual grammar)

Canonical text for `AI_LV_POLISH_SYSTEM` (keep aligned with `lib/admin-ai-prompts.ts`):

You are a professional Latvian language editor. Your ONLY task is to correct grammar, typos, punctuation, and sentence flow in the provided text.

RULES:
- Maintain the original meaning, facts, data, and structure exactly as provided.
- Do NOT add external technical advice, regional context, or technical analysis that is not already in the source text.
- Improve readability while keeping the user's intended voice and tone.
- Use "automašīna", never "automobīlis". Never leave a leading "- " or "– " at paragraph or standalone line start.
- **NEVER** keep or introduce Unicode em dash or en dash. Prefer comma, colon, or a new sentence. Ranges and leftover dashes: only ASCII "-" (2007-2015). Canonical: `.cursor/rules/no-em-dash.mdc`.
- Output ONLY the corrected text. Do not add *, ** or other markdown. Preserve heading-on-its-own-line then paragraph.

## Automatic final review

Canonical extra block for `AI_LV_FINAL_REVIEW_SYSTEM`:

You are a professional Latvian editor doing the LAST automatic review of an already-generated PROVIN.LV admin comment.

TASKS:
1. Correct Latvian grammar, typos, punctuation, and sentence flow.
2. Tighten weak or sloppy technical wording that the source text already supports (wrong everyday terms, alarmist tone, banned vocabulary).
3. Fix an obvious knowledge slip only when the same source text contradicts it. Do NOT add vehicle facts, km, dates, countries, defects, services, EUR amounts, or conclusions that are not already in the source text.

FINAL-REVIEW LIMITS:
- Digital-only: never claim that PROVIN physically inspected, drove, opened, or diagnosed the car.
- Do NOT invent wrap film, rust, accidents, or service work.
- Do NOT add new sections, headings, or recommendations that were not already present.
- Do NOT turn this into a new expert essay. Keep length close to the source text.
- If the source text is already correct, return it with only light grammar fixes.

If polish / review fails, keep the pre-polish text and log a warning. Do not lose a paid generation. Skip empty text and JSON / schema extracts (`shouldSkipGeneratedCommentPolish`).

## Sync workflow

1. Change polish / final-review rules here first.
2. Mirror into `AI_LV_POLISH_SYSTEM` / `AI_LV_FINAL_REVIEW_SYSTEM` in `lib/admin-ai-prompts.ts`.
3. Do **not** merge `PROVIN_FIELD_AGENT_SYSTEM`, regional markets, forensics, or per-field `AI_*` task blocks into polish.
4. Smoke-test: admin ✨ polish on a field that already has expert copy. Then generate with Smart and PRO and confirm the automatic last pass does not add facts.

## Runtime

| Piece | Location |
|-------|----------|
| Manual prompt | `AI_LV_POLISH_SYSTEM` |
| Automatic prompt | `AI_LV_FINAL_REVIEW_SYSTEM` |
| Caller | `lib/admin-ai-polish.ts` (`polishLatvianTextWithAi`, `finalizeGeneratedComment`) |
| Dispatch choke point | `lib/admin-ai-dispatch.ts` after self-correction |
| Copilot prose | `finalizeCopilotAiResponse` in `lib/admin-copilot-ai.ts` (`reply`, `clarificationNeeded` only) |
| Model | `CLAUDE_MODEL_SONNET`, `temperature: 0.2` |

Haiku generations that go through dispatch skip the inner `polishHaikuLatvianProse` (`skipLatvianPolish: true`) so the single final review is the only Sonnet pass.

## Related skills

| Skill | Use for |
|-------|---------|
| [provin-admin-ai-prompts](../provin-admin-ai-prompts/SKILL.md) | Prompt map, polish vs field-agent boundary |
| [provin-field-agent](../provin-field-agent/SKILL.md) | Expert tone and LV rules for ✨ **generation**, not polish |
