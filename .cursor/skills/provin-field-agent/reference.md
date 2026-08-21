# PROVIN Field Agent — runtime reference

## `provinFieldAgentPrompt(activeField, taskBlock)`

Runtime shape in `lib/admin-ai-prompts.ts`:

```
${PROVIN_FIELD_AGENT_SYSTEM}

ACTIVE FIELD: ${activeFieldContext}

${taskBlock}
```

## Consumers (field agent)

| Export | Admin field |
|--------|-------------|
| `AI_TECHNICAL_RISKS_ANALYSIS_SYSTEM` | 1. Tehnisko risku analīze (flagship, 8–12 rindkopas) |
| `AI_INSPECTION_RECOMMENDATIONS_SYSTEM` | Ieteikumi klātienes apskatei (6–9 pārbaudes; lūka → paklāji/drenāža) |
| `AI_SELLER_ANALYSIS_SYSTEM` | Pārdevēja portrets |
| `AI_PRICE_ANALYSIS_SYSTEM` | Cenas vērtējums |
| `AI_SUMMARY_ANALYSIS_SYSTEM` | 2. Kopsavilkums (+ email rules) |
| `AI_MILEAGE_COMMENT_SYSTEM` | Nobraukuma vēstures komentārs |
| `AI_INCIDENTS_SUMMARY_SYSTEM` | Negadījumu vēstures kopsavilkums |
| `aiSourceCommentSystemPrompt(label)` | Avota „Komentāri” |

## Extensions beyond core prompt (in repo today)

`PROVIN_FIELD_AGENT_SYSTEM` in code may append operational blocks not repeated in the field-agent skill core:

- Admin copywriter scope (one field per ✨ trigger)
- Cross-source discipline (CSDD, AutoDNA, CarVertical, LTAB, listing)
- Data forensics (mileage, incidents, timelines)
- Regional / legal / test-drive / model-weakness context
- `OUTPUT CONSTRAINT` (no duplicate headers, no AI meta)
- `FIELD DIVISION & ANTI-REPETITION` (mileage synthesis only in NOBRAUKUMA VĒSTURES KOMENTĀRS; source comments = unique facts + brief compare)

When refactoring, prefer: **this skill = tone + LV grammar + mission**; **provin-expert-agent = domain knowledge**; **TypeScript = deployed merge of both + field `taskBlock`**.
