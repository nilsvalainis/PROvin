/** Kopīgie tipi — bez `server-only` (CLI + store + promote). */

export type AuditAggregateLearningStatus = "candidate" | "approved";

export type AuditAggregateLearningEntry = {
  key: string;
  label: string;
  updatedAt: string;
  snippets: string[];
  /** Jauns ieraksts no melnraksta = candidate; AI kontekstā tikai approved. */
  status?: AuditAggregateLearningStatus;
};

export function learningEntryIsInjectable(
  entry: Pick<AuditAggregateLearningEntry, "status">,
  techRiskV2: boolean,
): boolean {
  return techRiskV2 ? entry.status === "approved" : true;
}
