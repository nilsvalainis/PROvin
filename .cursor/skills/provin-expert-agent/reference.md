# PROVIN Expert Agent — code integration

## System prompt source of truth

Runtime AI calls use constants in `lib/admin-ai-prompts.ts`:

| Constant | Active field |
|----------|----------------|
| `PROVIN_FIELD_AGENT_SYSTEM` | Base tone/LV grammar (synced with `provin-field-agent` skill) + domain blocks from this skill |
| `AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM` | 1. Tehnisko risku analīze (flagship: `AI_TECHNICAL_RISKS_FLAGSHIP_RULES`, nosacīts garums) |
| `AI_INSPECTION_RECOMMENDATIONS_SYSTEM` | Ieteikumi klātienes apskatei (pircēja soļi, ne risku spogulis) |
| `AI_SELLER_ANALYSIS_SYSTEM` | Pārdevēja portrets |
| `AI_PRICE_ANALYSIS_SYSTEM` | Cenas vērtējums |
| `AI_SUMMARY_ANALYSIS_SYSTEM` | 2. Kopsavilkums |
| `AI_MILEAGE_COMMENT_SYSTEM` | Nobraukuma vēstures komentārs |
| `AI_INCIDENTS_SUMMARY_SYSTEM` | Negadījumu vēstures kopsavilkums |
| `aiSourceCommentSystemPrompt(label)` | Per-source „Komentāri” blocks |

`provinFieldAgentPrompt(activeFieldContext, taskBlock)` wraps base + field task.

## Sync workflow

When updating data sufficiency, engine-hour, regional/legal/test-drive/model-weakness rules in this skill:

1. Edit **Core agent prompt** in [SKILL.md](SKILL.md) (canonical for Cursor sessions).
2. If production API must match, port the same substance into `PROVIN_FIELD_AGENT_SYSTEM` and relevant `AI_*_SYSTEM` task blocks — avoid drift between skill and deployed prompts.
3. Run admin ✨ generation smoke test on one order per affected field type.

## Related files

- `lib/admin-ai-order-context.ts` — order context assembly for prompts
- `lib/admin-ai-summary.ts` — expert section bundling before summary
- `components/admin/OrderDetailWorkspace.tsx` — admin UI ✨ triggers
- `.cursor/rules/business-legal-lv.mdc` — LV legal/Stripe/footer (not vehicle mechanics)
