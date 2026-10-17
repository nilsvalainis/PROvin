/**
 * Agregātu zināšanu v2 modelis: atsevišķs Blob blakus mācību fragmentiem.
 * Esošie pasūtījumu JSON netiek pārrakstīti.
 */

export const KNOWLEDGE_ITEM_STATUSES = ["candidate", "approved", "rejected", "deleted"] as const;
export type KnowledgeItemStatus = (typeof KNOWLEDGE_ITEM_STATUSES)[number];

export const KNOWLEDGE_HORIZONS = ["now", "next100k"] as const;
export type KnowledgeHorizon = (typeof KNOWLEDGE_HORIZONS)[number];

export type KnowledgeSourceType = "report" | "kb" | "url";

export type KnowledgeSourceRef = {
  type: KnowledgeSourceType;
  ref: string;
};

export type KnowledgeHistoryAction = "create" | "edit" | "approve" | "reject" | "delete" | "restore";

export type KnowledgeItemHistoryEntry = {
  at: string;
  by?: string;
  action: KnowledgeHistoryAction;
  claim?: string;
  reason?: string;
};

export type KnowledgeItem = {
  id: string;
  aggregate: string;
  claim: string;
  kmBand?: [number, number];
  horizon?: KnowledgeHorizon;
  status: KnowledgeItemStatus;
  sources: KnowledgeSourceRef[];
  fromOrders: string[];
  seenCount: number;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectReason?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  history: KnowledgeItemHistoryEntry[];
};

export type KnowledgeUsageSnapshot = {
  sessionId: string;
  at: string;
  approved: Array<{ id: string; aggregate: string; claim: string }>;
  rejected: Array<{ id: string; aggregate: string; claim: string }>;
  packLabels: string[];
};

export type KnowledgeAggregateRow = {
  aggregate: string;
  approved: number;
  candidate: number;
  rejected: number;
  deleted: number;
};

export function isKnowledgeItemStatus(v: unknown): v is KnowledgeItemStatus {
  return typeof v === "string" && (KNOWLEDGE_ITEM_STATUSES as readonly string[]).includes(v);
}

export function newKnowledgeItemId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `ki_${Date.now().toString(36)}_${rand}`;
}
