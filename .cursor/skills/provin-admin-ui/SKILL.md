---
name: provin-admin-ui
description: >-
  PROVIN.LV admin workspace conventions — 110 admin komponenšu standarti, UI
  shell un persistences loģika. Use when editing components/admin/**,
  OrderDetailWorkspace, source blocks, SavableTextField, AI polish shells,
  field reset, persist queue, or VIN userscript handoff attributes.
---

# PROVIN Admin UI

Operator workspace is Latvian-only. Do not add next-intl here — public i18n is [provin-i18n](../provin-i18n/SKILL.md). ✨ prompt text is [provin-admin-ai-prompts](../provin-admin-ai-prompts/SKILL.md), not this skill.

## When to apply

- `components/admin/**`, `app/admin/**`
- `lib/admin-source-blocks.ts`, `lib/admin-workspace-persist-*.ts`, `lib/admin-order-workspace-hydrate.ts`
- `lib/admin-drop-or-reset-row.ts`, `lib/admin-vin-urls.ts`
- New history source, comment field, PDF toggle, or persist bug

`OrderDetailWorkspace.tsx` is ~4k lines. Prefer extracting or composing existing shells over growing it.

## Component map (reuse, don't fork)

| Job | Use |
|-----|-----|
| Source section chrome | `AdminSourceBlockHeader` + `AdminCollapsibleShell` |
| Source labels / URLs / empty state | `SOURCE_BLOCK_LABELS`, `SOURCE_BLOCK_EXTERNAL_URL`, `empty*Block()` in `lib/admin-source-blocks.ts` |
| Text that operators save | `AdminSavableTextField` (`multiline` / `multilineRich`) |
| Grammar ✨ | wrap with `AdminAiPolishTextareaShell` or `AdminAiPolishRichCommentShell` → `POST /api/admin/ai-polish-lv` |
| Expert ✨ generate | existing field buttons → `/api/admin/ai/*` (not polish) |
| Clear one field / last table row | `AdminFieldResetButton`; rows via `dropOrResetRow(rows, index, empty)` |
| PDF include | `AdminPdfIncludeToggle` |
| Icons | `AdminProvinLucide` + `SOURCE_BLOCK_LUCIDE` / `SUBHEADING_LUCIDE` |
| VIN / listing userscript | `data-provin-handoff-vin`, `data-provin-handoff-listing-url` |

New vendor source: add a `SourceBlockKey`, labels, empty/normalize/hasContent/toPlainText in `lib/admin-source-blocks.ts`, then `Admin*SourceBlock.tsx` following `AdminCsddSourceBlock` / `AdminVendorAvotuSourceBlock`. Keep `createDefaultSourceBlocks()` complete.

## Persistence (do not invent a second path)

**Load** (`resolveOrderWorkspaceHydration`): if `localStorage` has a snapshot, **always** use it (never overwrite with a newer server draft). Else backup snapshot, else server/Blob, else empty. First visit hydrates from server.

**Save**: `enqueueWorkspacePersist(sessionId, job)` then the canonical PATCH in `lib/admin-workspace-persist-client.ts`. Serialize per `sessionId` — no parallel PATCHes. `credentials: "include"` on every admin `fetch`.

- Collapsible accordion state is UI-only (`AdminCollapsibleShell`) — must not change PDF or saved JSON.
- Do not dump full order drafts into Cursor or ✨ prompts (audit-knowledge pipeline in [provin-admin-ai-prompts](../provin-admin-ai-prompts/SKILL.md)).
- After persist/hydrate changes, extend `lib/admin-order-workspace-hydrate.test.ts` / persist tests — [provin-testing](../provin-testing/SKILL.md).

## UI rules

- `"use client"` on interactive admin components.
- Compact slate controls, `var(--color-provin-accent)` focus rings — match neighboring fields, don't restyle the workspace.
- Table delete: last row resets to `empty()`, never `[]`.
- Traffic/luksofors colors come from `lib/admin-block-traffic-status.ts`, not ad-hoc classes.

## Do not

- i18n-wrap admin strings into `messages/`.
- Call `/api/admin/ai-polish-lv` for expert generation (or field-agent routes for grammar).
- Bypass `enqueueWorkspacePersist` with a raw `fetch` PATCH from a new component.
- Break `data-provin-handoff-*` attributes (Tampermonkey `provin-vin-autofill.user.js`).
