---
name: provin-lv-polish
description: Canonical system prompt for PROVIN.LV admin Latvian grammar-only polish (GEMINI_LV_POLISH_SYSTEM). Use when editing lib/admin-gemini-prompts.ts GEMINI_LV_POLISH_SYSTEM, lib/admin-gemini-polish.ts, /api/admin/ai-polish-lv, or reviewing ✨ polish output. Must NOT use provin-field-agent or provin-expert-agent rules.
---

# PROVIN LV Polish (Grammar Only)

## When to apply

Read this skill when the task involves:

- `GEMINI_LV_POLISH_SYSTEM` in `lib/admin-gemini-prompts.ts`
- `polishLatvianTextWithGemini` in `lib/admin-gemini-polish.ts`
- `/api/admin/ai-polish-lv` (admin ✨ gramatikas labošana)

Do **not** use for expert copy, vehicle analysis, or field generation — see [provin-field-agent](../provin-field-agent/SKILL.md) and [provin-admin-gemini-prompts](../provin-admin-gemini-prompts/SKILL.md).

## Core system prompt

Canonical text for `GEMINI_LV_POLISH_SYSTEM` (keep verbatim when syncing to code):

You are a professional Latvian language editor. Your ONLY task is to correct grammar, typos, punctuation, and sentence flow in the provided text.

RULES:
- Maintain the original meaning, facts, data, and structure exactly as provided.
- Do NOT add external expert advice, regional context, or technical analysis.
- Improve readability while keeping the user's intended voice and tone.
- Use "automašīna" — never "automobīlis". Never leave a leading "- " or "– " at paragraph or standalone line start.
- Output ONLY the corrected text in clean Markdown.

## Sync workflow

1. Change polish rules here first.
2. Mirror the **Core system prompt** block into `GEMINI_LV_POLISH_SYSTEM` in `lib/admin-gemini-prompts.ts` (single string used at runtime).
3. Do **not** merge `PROVIN_FIELD_AGENT_SYSTEM`, regional markets, forensics, or per-field `GEMINI_*` task blocks into polish.
4. Smoke-test: admin ✨ polish on a field that already has expert copy — output should read cleaner, with no new facts or recommendations.

## Runtime

| Piece | Location |
|-------|----------|
| System prompt | `GEMINI_LV_POLISH_SYSTEM` |
| Caller | `lib/admin-gemini-polish.ts` |
| Model | `GEMINI_MODEL_FLASH`, `temperature: 0.2` |

## Related skills

| Skill | Use for |
|-------|---------|
| [provin-admin-gemini-prompts](../provin-admin-gemini-prompts/SKILL.md) | Prompt map, polish vs field-agent boundary |
| [provin-field-agent](../provin-field-agent/SKILL.md) | Expert tone and LV rules for ✨ **generation**, not polish |
