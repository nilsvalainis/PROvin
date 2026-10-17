/**
 * AI melnraksts pret operatora galīgo tekstu, lai var izmērīt labojumus.
 * Loģiskais modelis: workspace.aiDrafts[field] / workspace.aiEdited[field].
 * Fiziski: atsevišķs Blob (`provin_ai_field_revisions.json`), ne pasūtījuma JSON.
 */

export type AiDraftFieldMeta = {
  model: string;
  promptVersion: string;
  text: string;
  ts: string;
};

export type AiEditedFieldMeta = {
  text: string;
  ts: string;
  fromDraftTs?: string;
};

export type WorkspaceAiDrafts = Record<string, AiDraftFieldMeta>;
export type WorkspaceAiEdited = Record<string, AiEditedFieldMeta>;

export type SessionAiFieldRevisions = {
  sessionId: string;
  aiDrafts: WorkspaceAiDrafts;
  aiEdited: WorkspaceAiEdited;
  updatedAt: string;
};

export const AI_DRAFT_FIELD_KEYS = [
  "technical_risks",
  "inspection",
  "summary",
  "seller",
  "price",
  "mileage",
  "incidents",
  "sources_comparison",
  "source",
] as const;

export type AiDraftFieldKey = (typeof AI_DRAFT_FIELD_KEYS)[number];

const URL_FIELD: Array<[RegExp, string]> = [
  [/technical-risk/i, "technical_risks"],
  [/inspection/i, "inspection"],
  [/summary-analysis/i, "summary"],
  [/seller/i, "seller"],
  [/price-analysis/i, "price"],
  [/mileage/i, "mileage"],
  [/incidents/i, "incidents"],
  [/sources-comparison/i, "sources_comparison"],
  [/source-comment/i, "source"],
];

export function aiDraftFieldFromAiUrl(url: string): string | null {
  const path = url.split("?")[0] ?? url;
  for (const [re, field] of URL_FIELD) {
    if (re.test(path)) return field;
  }
  return null;
}

export function parseAiDraftMeta(raw: unknown): AiDraftFieldMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.text !== "string" || !o.text.trim()) return null;
  return {
    model: typeof o.model === "string" && o.model.trim() ? o.model.trim().slice(0, 80) : "unknown",
    promptVersion:
      typeof o.promptVersion === "string" && o.promptVersion.trim()
        ? o.promptVersion.trim().slice(0, 40)
        : "",
    text: o.text.trim().slice(0, 24_000),
    ts: typeof o.ts === "string" && o.ts.trim() ? o.ts.trim() : new Date().toISOString(),
  };
}

export function parseAiEditedMeta(raw: unknown): AiEditedFieldMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.text !== "string" || !o.text.trim()) return null;
  return {
    text: o.text.trim().slice(0, 24_000),
    ts: typeof o.ts === "string" && o.ts.trim() ? o.ts.trim() : new Date().toISOString(),
    ...(typeof o.fromDraftTs === "string" && o.fromDraftTs.trim()
      ? { fromDraftTs: o.fromDraftTs.trim() }
      : {}),
  };
}

export function mergeAiDraftMaps(
  base: WorkspaceAiDrafts | undefined,
  incoming: WorkspaceAiDrafts | undefined,
): WorkspaceAiDrafts {
  const out: WorkspaceAiDrafts = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(incoming ?? {})) {
    const parsed = parseAiDraftMeta(v);
    if (!parsed) continue;
    const prev = out[k];
    if (!prev || Date.parse(parsed.ts) >= Date.parse(prev.ts)) out[k] = parsed;
  }
  return out;
}

export function mergeAiEditedMaps(
  base: WorkspaceAiEdited | undefined,
  incoming: WorkspaceAiEdited | undefined,
): WorkspaceAiEdited {
  const out: WorkspaceAiEdited = { ...(base ?? {}) };
  for (const [k, v] of Object.entries(incoming ?? {})) {
    const parsed = parseAiEditedMeta(v);
    if (!parsed) continue;
    const prev = out[k];
    if (!prev || Date.parse(parsed.ts) >= Date.parse(prev.ts)) out[k] = parsed;
  }
  return out;
}

export function snapshotAiEditedFromFields(
  fields: Record<string, string | undefined>,
  drafts: WorkspaceAiDrafts | undefined,
  at = new Date().toISOString(),
): WorkspaceAiEdited {
  const out: WorkspaceAiEdited = {};
  for (const [field, raw] of Object.entries(fields)) {
    const text = (raw ?? "").trim();
    if (!text) continue;
    out[field] = {
      text: text.slice(0, 24_000),
      ts: at,
      ...(drafts?.[field]?.ts ? { fromDraftTs: drafts[field]!.ts } : {}),
    };
  }
  return out;
}
