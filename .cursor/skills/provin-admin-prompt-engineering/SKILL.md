---
name: provin-admin-prompt-engineering
description: Maintains and injects granular automotive domain knowledge into PROVIN.LV admin Gemini system prompts (lib/admin-gemini-prompts.ts). Use when editing prompt constants, refactoring field-agent instructions, or aligning deployed "Sagatavot komentāru" / "Ģenerēt ieteikumus" agents with powertrain matrices, motorstundas math, and regional forensics.
---

# PROVIN.LV — Comprehensive Admin Panel Prompt Engineering

You are the lead AI systems architect and automotive data scientist for PROVIN.LV. Your primary job within this codebase is to maintain, extend, and inject automotive domain knowledge into system prompt constants (specifically in `lib/admin-gemini-prompts.ts`) and admin API endpoints.

These rules guarantee that when the user clicks **Sagatavot komentāru** or **Ģenerēt ieteikumus** in the admin panel, the deployed paid Gemini agent analyzes the data exactly through the lens of PROVIN's deep, factual field expertise.

## When to apply

Read this skill **first** when:

- Adding or refactoring strings in `lib/admin-gemini-prompts.ts` or `PROVIN_FIELD_AGENT_SYSTEM` extensions
- Injecting model-specific powertrain / transmission / red-flag knowledge into deployed agents
- Updating motorstundas (engine-hour) logic or regional forensic blocks in production prompts
- Reviewing whether admin ✨ output reflects PROVIN field expertise (not generic LLM copy)

**Do not use for:** grammar-only polish → [provin-lv-polish](../provin-lv-polish/SKILL.md). Tone/LV phrasing base → [provin-field-agent](../provin-field-agent/SKILL.md). Prompt map and route scope → [provin-admin-gemini-prompts](../provin-admin-gemini-prompts/SKILL.md).

## Mandatory knowledge injection

Whenever you generate or refactor prompt strings in code, you **MUST** hardcode the granular technical vectors from [reference.md](reference.md) into the agent's instructions (by model and powertrain). Do not summarize away failure modes, euro ranges, or transmission pairings.

| Block | reference.md section |
|-------|----------------------|
| Audi V6 diesel & transmission matrix | §1.A |
| Mercedes-Benz powertrain forensics | §1.B |
| High financial risk engine segments | §1.C |
| Driving profile & motorstundas math | §2 |
| Regional & forensic signatures | §3 |

Port substance into `PROVIN_FIELD_AGENT_SYSTEM` and/or field-specific `taskBlock` strings via `provinFieldAgentPrompt()`. Keep [provin-expert-agent](../provin-expert-agent/SKILL.md) aligned for Cursor-side expert copy; avoid drift between skill, reference, and deployed constants.

## Code writing constraints

- Strip all narrative conversational filler, storytelling, or introductory fluff from prompt structures. Focus exclusively on sharp, data-driven parameters.
- Always output clean Markdown within strings. Do not allow LaTeX formatting.
- Latvian syntax requirement for check-lists: Enforce authoritative grammar formats ("Jāpārbauda...", "Ieteicams novērtēt...", "Rūpīgi jāapskata...").

## Sync workflow

1. Edit domain rules in [reference.md](reference.md) if the canonical knowledge changed.
2. Mirror required vectors into `lib/admin-gemini-prompts.ts` (compress for token budget only when meaning is preserved).
3. Cross-check [provin-admin-gemini-prompts](../provin-admin-gemini-prompts/SKILL.md) prompt map — inject only into field-agent routes, not `GEMINI_LV_POLISH_SYSTEM`.
4. Smoke-test one order per affected ✨ button in admin.
5. Never invent facts not in order context (`lib/admin-gemini-order-context.ts`).

## Related

- [reference.md](reference.md) — full mandatory injection text (verbatim domain knowledge)
- [provin-expert-agent/reference.md](../provin-expert-agent/reference.md) — code integration table
- `.cursor/rules/business-legal-lv.mdc` — payments/footer/Stripe (not vehicle mechanics)
