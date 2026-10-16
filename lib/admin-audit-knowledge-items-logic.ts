/**
 * Zināšanu v2 tīrā loģika (bez Blob) - testējama.
 */
import type {
  KnowledgeAggregateRow,
  KnowledgeItem,
  KnowledgeItemHistoryEntry,
  KnowledgeItemStatus,
  KnowledgeUsageSnapshot,
} from "@/lib/admin-audit-knowledge-items-types";
import { isKnowledgeItemStatus } from "@/lib/admin-audit-knowledge-items-types";
import { findConflictClaim } from "@/lib/admin-audit-knowledge-claim-extract";

export type KnowledgeItemsDoc = {
  version: 1;
  updatedAt: string;
  items: Record<string, KnowledgeItem>;
  usageBySession: Record<string, KnowledgeUsageSnapshot>;
};

export function emptyKnowledgeItemsDoc(): KnowledgeItemsDoc {
  return { version: 1, updatedAt: new Date(0).toISOString(), items: {}, usageBySession: {} };
}

function parseKmBand(raw: unknown): [number, number] | undefined {
  if (!Array.isArray(raw) || raw.length !== 2) return undefined;
  const a = Number(raw[0]);
  const b = Number(raw[1]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a) return undefined;
  return [Math.round(a), Math.round(b)];
}

function parseHistory(raw: unknown): KnowledgeItemHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: KnowledgeItemHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (typeof o.at !== "string" || typeof o.action !== "string") continue;
    out.push({
      at: o.at,
      action: o.action as KnowledgeItemHistoryEntry["action"],
      ...(typeof o.by === "string" ? { by: o.by } : {}),
      ...(typeof o.claim === "string" ? { claim: o.claim } : {}),
      ...(typeof o.reason === "string" ? { reason: o.reason } : {}),
    });
  }
  return out.slice(-40);
}

export function parseKnowledgeItem(raw: unknown): KnowledgeItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) return null;
  if (typeof o.aggregate !== "string" || !o.aggregate.trim()) return null;
  if (typeof o.claim !== "string" || !o.claim.trim()) return null;
  if (!isKnowledgeItemStatus(o.status)) return null;
  const sources: KnowledgeItem["sources"] = [];
  if (Array.isArray(o.sources)) {
    for (const s of o.sources) {
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      if ((so.type === "report" || so.type === "kb" || so.type === "url") && typeof so.ref === "string") {
        sources.push({ type: so.type, ref: so.ref.slice(0, 200) });
      }
    }
  }
  const fromOrders = Array.isArray(o.fromOrders)
    ? o.fromOrders.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 40)
    : [];
  const kmBand = parseKmBand(o.kmBand);
  return {
    id: o.id.trim(),
    aggregate: o.aggregate.trim().slice(0, 80),
    claim: o.claim.trim().slice(0, 500),
    ...(kmBand ? { kmBand } : {}),
    ...(o.horizon === "now" || o.horizon === "next100k" ? { horizon: o.horizon } : {}),
    status: o.status,
    sources,
    fromOrders,
    seenCount: typeof o.seenCount === "number" && o.seenCount > 0 ? Math.round(o.seenCount) : 1,
    ...(typeof o.reviewedBy === "string" ? { reviewedBy: o.reviewedBy.slice(0, 80) } : {}),
    ...(typeof o.reviewedAt === "string" ? { reviewedAt: o.reviewedAt } : {}),
    ...(typeof o.rejectReason === "string" ? { rejectReason: o.rejectReason.slice(0, 400) } : {}),
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date(0).toISOString(),
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    ...(typeof o.lastUsedAt === "string" ? { lastUsedAt: o.lastUsedAt } : {}),
    history: parseHistory(o.history),
  };
}

export function normalizeKnowledgeItemsDoc(raw: unknown): KnowledgeItemsDoc {
  if (!raw || typeof raw !== "object") return emptyKnowledgeItemsDoc();
  const o = raw as Record<string, unknown>;
  const items: Record<string, KnowledgeItem> = {};
  const src = o.items && typeof o.items === "object" ? (o.items as Record<string, unknown>) : {};
  for (const val of Object.values(src)) {
    const item = parseKnowledgeItem(val);
    if (item) items[item.id] = item;
  }
  const usageBySession: Record<string, KnowledgeUsageSnapshot> = {};
  const usageRaw =
    o.usageBySession && typeof o.usageBySession === "object"
      ? (o.usageBySession as Record<string, unknown>)
      : {};
  for (const [sid, val] of Object.entries(usageRaw)) {
    if (!val || typeof val !== "object") continue;
    const u = val as Record<string, unknown>;
    usageBySession[sid] = {
      sessionId: sid,
      at: typeof u.at === "string" ? u.at : new Date(0).toISOString(),
      approved: Array.isArray(u.approved)
        ? u.approved
            .filter((x): x is { id: string; aggregate: string; claim: string } =>
              Boolean(x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string"),
            )
            .slice(0, 40)
        : [],
      rejected: Array.isArray(u.rejected)
        ? u.rejected
            .filter((x): x is { id: string; aggregate: string; claim: string } =>
              Boolean(x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string"),
            )
            .slice(0, 40)
        : [],
      packLabels: Array.isArray(u.packLabels)
        ? u.packLabels.filter((x): x is string => typeof x === "string").slice(0, 12)
        : [],
    };
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString(),
    items,
    usageBySession,
  };
}

export function listKnowledgeItems(
  doc: KnowledgeItemsDoc,
  status?: KnowledgeItemStatus | "all",
  aggregate?: string,
): KnowledgeItem[] {
  return Object.values(doc.items)
    .filter((i) => (status && status !== "all" ? i.status === status : i.status !== "deleted"))
    .filter((i) => (aggregate ? i.aggregate === aggregate : true))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export function summarizeKnowledgeByAggregate(doc: KnowledgeItemsDoc): KnowledgeAggregateRow[] {
  const map = new Map<string, KnowledgeAggregateRow>();
  for (const item of Object.values(doc.items)) {
    const row = map.get(item.aggregate) ?? {
      aggregate: item.aggregate,
      approved: 0,
      candidate: 0,
      rejected: 0,
      deleted: 0,
    };
    row[item.status] += 1;
    map.set(item.aggregate, row);
  }
  return [...map.values()].sort((a, b) => a.aggregate.localeCompare(b.aggregate, "lv"));
}

export function upsertCandidateItem(doc: KnowledgeItemsDoc, incoming: KnowledgeItem): KnowledgeItem {
  const existing = Object.values(doc.items).find(
    (i) =>
      i.aggregate === incoming.aggregate &&
      i.status !== "deleted" &&
      i.claim.trim().toLowerCase() === incoming.claim.trim().toLowerCase(),
  );
  const now = incoming.updatedAt;
  if (!existing) {
    doc.items[incoming.id] = incoming;
    doc.updatedAt = now;
    return incoming;
  }
  const fromOrders = [...new Set([...existing.fromOrders, ...incoming.fromOrders])].slice(0, 40);
  const sources = [...existing.sources];
  for (const s of incoming.sources) {
    if (!sources.some((x) => x.type === s.type && x.ref === s.ref)) sources.push(s);
  }
  const next: KnowledgeItem = {
    ...existing,
    seenCount: existing.seenCount + 1,
    fromOrders,
    sources: sources.slice(0, 40),
    updatedAt: now,
    history: [
      ...existing.history,
      { at: now, action: "create" as const, claim: incoming.claim },
    ].slice(-40),
  };
  doc.items[existing.id] = next;
  doc.updatedAt = now;
  return next;
}

export function applyKnowledgeReview(
  item: KnowledgeItem,
  action: "approve" | "reject" | "delete" | "restore",
  opts: { by?: string; reason?: string; claim?: string; now?: string },
): KnowledgeItem {
  const now = opts.now ?? new Date().toISOString();
  const status: KnowledgeItemStatus =
    action === "approve"
      ? "approved"
      : action === "reject"
        ? "rejected"
        : action === "delete"
          ? "deleted"
          : "candidate";
  return {
    ...item,
    status,
    ...(opts.claim && opts.claim.trim() ? { claim: opts.claim.trim().slice(0, 500) } : {}),
    reviewedBy: opts.by,
    reviewedAt: now,
    ...(action === "reject" ? { rejectReason: (opts.reason ?? "").trim().slice(0, 400) } : {}),
    updatedAt: now,
    history: [
      ...item.history,
      {
        at: now,
        action,
        by: opts.by,
        ...(opts.claim ? { claim: opts.claim } : {}),
        ...(opts.reason ? { reason: opts.reason } : {}),
      },
    ].slice(-40),
  };
}

export function approvedClaimsForAggregate(doc: KnowledgeItemsDoc, aggregate: string): string[] {
  return Object.values(doc.items)
    .filter((i) => i.aggregate === aggregate && i.status === "approved")
    .map((i) => i.claim);
}

export function conflictWarningFor(doc: KnowledgeItemsDoc, item: KnowledgeItem): string | null {
  const hit = findConflictClaim(item.claim, approvedClaimsForAggregate(doc, item.aggregate));
  return hit ? `pretrunā ar apstiprināto: ${hit}` : null;
}

export function itemsForAiContext(doc: KnowledgeItemsDoc, aggregates: string[]): {
  approved: KnowledgeItem[];
  rejected: KnowledgeItem[];
} {
  const set = new Set(aggregates);
  const approved: KnowledgeItem[] = [];
  const rejected: KnowledgeItem[] = [];
  for (const item of Object.values(doc.items)) {
    if (!set.has(item.aggregate) && !aggregates.some((a) => item.aggregate.includes(a) || a.includes(item.aggregate))) {
      continue;
    }
    if (item.status === "approved") approved.push(item);
    else if (item.status === "rejected") rejected.push(item);
  }
  approved.sort((a, b) => b.seenCount - a.seenCount);
  rejected.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return { approved: approved.slice(0, 12), rejected: rejected.slice(0, 8) };
}

export function formatKnowledgeItemsForAi(approved: KnowledgeItem[], rejected: KnowledgeItem[]): string {
  const parts: string[] = [];
  if (approved.length > 0) {
    parts.push("### Apstiprinātās agregātu zināšanas (fakti, kurus drīkst lietot)");
    for (const i of approved) {
      const km = i.kmBand ? ` [${i.kmBand[0]}-${i.kmBand[1]} km]` : "";
      const hor = i.horizon === "next100k" ? " (nākamie 100 000 km)" : "";
      parts.push(`- ${i.aggregate}${km}${hor}: ${i.claim}`);
    }
  }
  if (rejected.length > 0) {
    parts.push("### Nepareizi apgalvojumi (AI NEDRĪKST atkārtot)");
    for (const i of rejected) {
      const why = i.rejectReason ? ` Iemesls: ${i.rejectReason}` : "";
      parts.push(`- ${i.aggregate}: ${i.claim}.${why}`);
    }
  }
  return parts.join("\n");
}
