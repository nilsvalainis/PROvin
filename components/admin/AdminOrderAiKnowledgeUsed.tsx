"use client";

import { useEffect, useState } from "react";
import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import type { KnowledgeUsageSnapshot } from "@/lib/admin-audit-knowledge-items-types";
import type { SessionAiFieldRevisions } from "@/lib/admin-ai-draft-fields";

export function AdminOrderAiKnowledgeUsed({ sessionId }: { sessionId: string }) {
  const [used, setUsed] = useState<KnowledgeUsageSnapshot | null>(null);
  const [revisions, setRevisions] = useState<SessionAiFieldRevisions | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/audit-knowledge", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "used", sessionId }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          used?: KnowledgeUsageSnapshot | null;
          revisions?: SessionAiFieldRevisions | null;
          trainingV2?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setErr(data.error ?? `HTTP ${res.status}`);
          return;
        }
        if (!data.trainingV2) return;
        setUsed(data.used ?? null);
        setRevisions(data.revisions ?? null);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "neizdevās ielādēt");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const draftEntries = Object.entries(revisions?.aiDrafts ?? {});
  const editedEntries = Object.entries(revisions?.aiEdited ?? {});
  const hasAnything =
    Boolean(used && (used.approved.length > 0 || used.rejected.length > 0)) ||
    draftEntries.length > 0 ||
    editedEntries.length > 0;
  if (!hasAnything && !err) return null;

  return (
    <AdminCollapsibleShell
      sessionId={sessionId}
      blockId="ai-knowledge-used"
      defaultCollapsed
      disableCollapse={false}
      header={<span className="text-[13px] font-semibold">Ko AI izmantoja šajā atskaitē</span>}
    >
      <div className="space-y-3 px-1 py-3 text-[13px]">
        {err ? <p className="text-red-800">{err}</p> : null}
        {used?.approved.length ? (
          <div>
            <p className="font-semibold">Apstiprinātās zināšanas</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {used.approved.map((i) => (
                <li key={i.id}>
                  <span className="font-medium">{i.aggregate}:</span> {i.claim}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {used?.rejected.length ? (
          <div>
            <p className="font-semibold">Nepareizi apgalvojumi (aizliegums)</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {used.rejected.map((i) => (
                <li key={i.id}>
                  <span className="font-medium">{i.aggregate}:</span> {i.claim}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {draftEntries.length > 0 ? (
          <div>
            <p className="font-semibold">AI melnraksts (pirms labojuma)</p>
            <ul className="mt-1 space-y-2">
              {draftEntries.map(([field, meta]) => (
                <li key={field} className="rounded-lg border border-slate-100 px-2 py-2">
                  <p className="text-[11px] text-[var(--color-provin-muted)]">
                    {field} · {meta.model} · {meta.promptVersion}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[12px]">{meta.text.slice(0, 800)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {editedEntries.length > 0 ? (
          <div>
            <p className="font-semibold">Galīgais teksts (pēc labojuma)</p>
            <ul className="mt-1 space-y-2">
              {editedEntries.map(([field, meta]) => (
                <li key={field} className="rounded-lg border border-slate-100 px-2 py-2">
                  <p className="text-[11px] text-[var(--color-provin-muted)]">{field}</p>
                  <p className="mt-1 whitespace-pre-wrap text-[12px]">{meta.text.slice(0, 800)}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </AdminCollapsibleShell>
  );
}
