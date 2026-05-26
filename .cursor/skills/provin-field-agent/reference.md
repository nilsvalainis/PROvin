# PROVIN Field Agent — runtime reference

## `provinFieldAgentPrompt(activeField, taskBlock)`

Runtime shape in `lib/admin-gemini-prompts.ts`:

```
${PROVIN_FIELD_AGENT_SYSTEM}

ACTIVE FIELD: ${activeFieldContext}

${taskBlock}
```

## Consumers (field agent)

| Export | Admin field |
|--------|-------------|
| `GEMINI_INSPECTION_RECOMMENDATIONS_SYSTEM` | Ieteikumi klātienes apskatei |
| `GEMINI_SELLER_ANALYSIS_SYSTEM` | Pārdevēja portrets |
| `GEMINI_PRICE_ANALYSIS_SYSTEM` | Cenas vērtējums |
| `GEMINI_SUMMARY_ANALYSIS_SYSTEM` | 2. Kopsavilkums (+ email rules) |
| `GEMINI_MILEAGE_COMMENT_SYSTEM` | Nobraukuma vēstures komentārs |
| `GEMINI_INCIDENTS_SUMMARY_SYSTEM` | Negadījumu vēstures kopsavilkums |
| `geminiSourceCommentSystemPrompt(label)` | Avota „Komentāri” |

## Extensions beyond core prompt (in repo today)

`PROVIN_FIELD_AGENT_SYSTEM` in code may append operational blocks not repeated in the field-agent skill core:

- Admin copywriter scope (one field per ✨ trigger)
- Cross-source discipline (CSDD, AutoDNA, CarVertical, LTAB, listing)
- Data forensics (mileage, incidents, timelines)
- Regional / legal / test-drive / model-weakness context
- `OUTPUT CONSTRAINT` (no duplicate headers, no AI meta)

When refactoring, prefer: **this skill = tone + LV grammar + mission**; **provin-expert-agent = domain knowledge**; **TypeScript = deployed merge of both + field `taskBlock`**.
