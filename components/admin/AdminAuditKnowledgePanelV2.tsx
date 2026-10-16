"use client";

import { useCallback, useEffect, useState } from "react";
import type { KnowledgeAggregateRow, KnowledgeItem } from "@/lib/admin-audit-knowledge-items-types";

type Tab = "zina" | "queue" | "rejected";

type ItemRow = KnowledgeItem & { conflict?: string | null };

const btnClass =
  "inline-flex min-h-[40px] items-center justify-center rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

async function postAction(action: string, extra?: Record<string, unknown>) {
  const res = await fetch("/api/admin/audit-knowledge", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...extra }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `HTTP ${res.status}`);
  }
  return data;
}

function formatWhen(iso: string | undefined): string {
  if (!iso) return "nav";
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return "nav";
  try {
    return new Date(t).toLocaleString("lv-LV");
  } catch {
    return iso;
  }
}

function orderHref(sessionId: string): string {
  return `/admin/orders/${encodeURIComponent(sessionId)}`;
}

export function AdminAuditKnowledgePanelV2() {
  const [tab, setTab] = useState<Tab>("zina");
  const [aggregates, setAggregates] = useState<KnowledgeAggregateRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editClaim, setEditClaim] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadList = useCallback(async (status: string, aggregate?: string) => {
    const data = (await postAction("list", { status, aggregate })) as {
      items?: ItemRow[];
      aggregates?: KnowledgeAggregateRow[];
    };
    setItems(data.items ?? []);
    if (data.aggregates) setAggregates(data.aggregates);
  }, []);

  const refresh = useCallback(async () => {
    setBusy("status");
    setErr(null);
    try {
      await loadList(tab === "queue" ? "candidate" : tab === "rejected" ? "rejected" : "all", selected ?? undefined);
      setNotice("Statuss atjaunināts.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Neizdevās ielādēt");
    } finally {
      setBusy(null);
    }
  }, [loadList, selected, tab]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const runBackfill = async () => {
    setBusy("backfill");
    setErr(null);
    try {
      const data = (await postAction("backfill", { limit: 120 })) as {
        scanned?: number;
        recorded?: number;
        skipped?: number;
      };
      await loadList("candidate");
      setTab("queue");
      setNotice(
        `Nolasītas vecās atskaites: apskatīti ${data.scanned ?? "?"}, ierakstīti ${data.recorded ?? "?"}, izlaisti ${data.skipped ?? "?"}.`,
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Nolasīšana neizdevās");
    } finally {
      setBusy(null);
    }
  };

  const runReview = async (id: string, action: "approve" | "reject" | "delete", reason?: string, claim?: string) => {
    setBusy(id);
    setErr(null);
    try {
      await postAction(action, { id, reason, claim });
      setRejectId(null);
      setRejectReason("");
      setEditId(null);
      await loadList(tab === "queue" ? "candidate" : tab === "rejected" ? "rejected" : "all", selected ?? undefined);
      setNotice(action === "approve" ? "Apstiprināts." : action === "reject" ? "Noraidīts." : "Dzēsts (mīkstā dzēšana).");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Darbība neizdevās");
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async (id: string) => {
    if (!editClaim.trim()) return;
    setBusy(id);
    try {
      await postAction("edit", { id, claim: editClaim.trim() });
      setEditId(null);
      await loadList(tab === "queue" ? "candidate" : "all", selected ?? undefined);
      setNotice("Labots.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Labošana neizdevās");
    } finally {
      setBusy(null);
    }
  };

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      className={`${btnClass} ${tab === id ? "border-[var(--color-provin-accent)] bg-slate-50" : ""}`}
      onClick={() => {
        setSelected(null);
        setTab(id);
      }}
    >
      {label}
    </button>
  );

  const visibleItems = selected ? items.filter((i) => i.aggregate === selected) : items;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabBtn("zina", "Ko AI zina")}
        {tabBtn("queue", "Gaida apstiprinājumu")}
        {tabBtn("rejected", "Nepareizi apgalvojumi")}
        <button type="button" className={btnClass} disabled={busy !== null} onClick={() => void refresh()}>
          {busy === "status" ? "Ielādē…" : "Atsvaidzināt"}
        </button>
        <button type="button" className={btnClass} disabled={busy !== null} onClick={() => void runBackfill()}>
          {busy === "backfill" ? "Nolasa…" : "Nolasīt vecās atskaites"}
        </button>
      </div>

      {notice ? (
        <p className="rounded-xl border border-emerald-200/80 bg-emerald-50/80 px-4 py-3 text-[13px] text-emerald-950">
          {notice}
        </p>
      ) : null}
      {err ? (
        <p className="rounded-xl border border-red-200/80 bg-red-50/80 px-4 py-3 text-[13px] text-red-900">{err}</p>
      ) : null}

      {tab === "zina" && !selected ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-slate-100 text-[12px] text-[var(--color-provin-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Agregāts</th>
                <th className="px-3 py-3 font-medium">Apstiprinātas</th>
                <th className="px-3 py-3 font-medium">Ieteiktās zināšanas</th>
                <th className="px-3 py-3 font-medium">Noraidītas</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-[var(--color-provin-muted)]" colSpan={4}>
                    Vēl nav mācību teikumu. Nospied „Nolasīt vecās atskaites” vai nosūti atskaiti klientam.
                  </td>
                </tr>
              ) : (
                aggregates.map((row) => (
                  <tr key={row.aggregate} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="font-semibold text-[var(--color-provin-accent)] hover:underline"
                        onClick={() => setSelected(row.aggregate)}
                      >
                        {row.aggregate}
                      </button>
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.approved}</td>
                    <td className="px-3 py-2 tabular-nums">{row.candidate}</td>
                    <td className="px-3 py-2 tabular-nums">{row.rejected}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "zina" && selected ? (
        <AggregateCard
          aggregate={selected}
          items={visibleItems.filter((i) => i.status !== "deleted")}
          busy={busy}
          editId={editId}
          editClaim={editClaim}
          onBack={() => setSelected(null)}
          onEdit={(item) => {
            setEditId(item.id);
            setEditClaim(item.claim);
          }}
          onEditClaim={setEditClaim}
          onSaveEdit={saveEdit}
          onDelete={(id) => void runReview(id, "delete")}
        />
      ) : null}

      {tab === "queue" ? (
        <QueueList
          title="Ieteiktās zināšanas (gaida apstiprinājumu)"
          items={visibleItems.filter((i) => i.status === "candidate")}
          busy={busy}
          editId={editId}
          editClaim={editClaim}
          rejectId={rejectId}
          rejectReason={rejectReason}
          onEdit={(item) => {
            setEditId(item.id);
            setEditClaim(item.claim);
          }}
          onEditClaim={setEditClaim}
          onSaveEdit={saveEdit}
          onApprove={(id) => void runReview(id, "approve")}
          onStartReject={(id) => setRejectId(id)}
          onRejectReason={setRejectReason}
          onConfirmReject={(id) => void runReview(id, "reject", rejectReason)}
        />
      ) : null}

      {tab === "rejected" ? (
        <QueueList
          title="Nepareizi apgalvojumi"
          items={visibleItems.filter((i) => i.status === "rejected")}
          busy={busy}
          editId={null}
          editClaim=""
          rejectId={null}
          rejectReason=""
          onEdit={() => undefined}
          onEditClaim={() => undefined}
          onSaveEdit={() => undefined}
          onApprove={(id) => void runReview(id, "approve")}
          onStartReject={() => undefined}
          onRejectReason={() => undefined}
          onConfirmReject={() => undefined}
        />
      ) : null}
    </div>
  );
}

function kmLabel(item: KnowledgeItem): string {
  if (item.horizon === "next100k") return "Nākamie 100 000 km";
  if (item.kmBand) return `${item.kmBand[0]}-${item.kmBand[1]} km`;
  return "Tagad";
}

function ItemActions({
  item,
  busy,
  editId,
  editClaim,
  rejectId,
  rejectReason,
  showReject,
  onEdit,
  onEditClaim,
  onSaveEdit,
  onApprove,
  onStartReject,
  onRejectReason,
  onConfirmReject,
  onDelete,
}: {
  item: ItemRow;
  busy: string | null;
  editId: string | null;
  editClaim: string;
  rejectId: string | null;
  rejectReason: string;
  showReject: boolean;
  onEdit: (item: ItemRow) => void;
  onEditClaim: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onApprove: (id: string) => void;
  onStartReject: (id: string) => void;
  onRejectReason: (v: string) => void;
  onConfirmReject: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const disabled = busy !== null;
  return (
    <div className="mt-2 space-y-2">
      {editId === item.id ? (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
            rows={3}
            value={editClaim}
            onChange={(e) => onEditClaim(e.target.value)}
          />
          <button type="button" className={btnClass} disabled={disabled} onClick={() => onSaveEdit(item.id)}>
            Saglabāt
          </button>
        </div>
      ) : null}
      {rejectId === item.id ? (
        <div className="space-y-2">
          <input
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px]"
            placeholder="Noraidījuma iemesls"
            value={rejectReason}
            onChange={(e) => onRejectReason(e.target.value)}
          />
          <button type="button" className={btnClass} disabled={disabled} onClick={() => onConfirmReject(item.id)}>
            Apstiprināt noraidījumu
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {item.status === "candidate" || item.status === "rejected" ? (
          <button type="button" className={btnClass} disabled={disabled} onClick={() => onApprove(item.id)}>
            Apstiprināt
          </button>
        ) : null}
        {item.status !== "rejected" ? (
          <button type="button" className={btnClass} disabled={disabled} onClick={() => onEdit(item)}>
            Labot
          </button>
        ) : null}
        {showReject && item.status === "candidate" ? (
          <button type="button" className={btnClass} disabled={disabled} onClick={() => onStartReject(item.id)}>
            Noraidīt
          </button>
        ) : null}
        {onDelete && item.status === "approved" ? (
          <button type="button" className={btnClass} disabled={disabled} onClick={() => onDelete(item.id)}>
            Dzēst
          </button>
        ) : null}
      </div>
    </div>
  );
}

function QueueList(props: {
  title: string;
  items: ItemRow[];
  busy: string | null;
  editId: string | null;
  editClaim: string;
  rejectId: string | null;
  rejectReason: string;
  onEdit: (item: ItemRow) => void;
  onEditClaim: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onApprove: (id: string) => void;
  onStartReject: (id: string) => void;
  onRejectReason: (v: string) => void;
  onConfirmReject: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm">
      <h2 className="text-[14px] font-semibold text-[var(--color-apple-text)]">{props.title}</h2>
      {props.items.length === 0 ? (
        <p className="mt-3 text-[13px] text-[var(--color-provin-muted)]">Saraksts tukšs.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {props.items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-100 px-3 py-3">
              <p className="text-[13px] font-medium">{item.claim}</p>
              <p className="mt-1 text-[12px] text-[var(--color-provin-muted)]">
                {item.aggregate} · {kmLabel(item)} · redzēts {item.seenCount}×
                {item.fromOrders[0] ? (
                  <>
                    {" "}
                    ·{" "}
                    <a className="underline" href={orderHref(item.fromOrders[0])}>
                      atskaite
                    </a>
                  </>
                ) : null}
              </p>
              {item.conflict ? (
                <p className="mt-1 text-[12px] text-amber-800">Konflikts: {item.conflict}</p>
              ) : null}
              {item.rejectReason ? (
                <p className="mt-1 text-[12px] text-red-800">Iemesls: {item.rejectReason}</p>
              ) : null}
              <ItemActions
                item={item}
                busy={props.busy}
                editId={props.editId}
                editClaim={props.editClaim}
                rejectId={props.rejectId}
                rejectReason={props.rejectReason}
                showReject={props.title.startsWith("Ieteiktās")}
                onEdit={props.onEdit}
                onEditClaim={props.onEditClaim}
                onSaveEdit={props.onSaveEdit}
                onApprove={props.onApprove}
                onStartReject={props.onStartReject}
                onRejectReason={props.onRejectReason}
                onConfirmReject={props.onConfirmReject}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AggregateCard(props: {
  aggregate: string;
  items: ItemRow[];
  busy: string | null;
  editId: string | null;
  editClaim: string;
  onBack: () => void;
  onEdit: (item: ItemRow) => void;
  onEditClaim: (v: string) => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const now = props.items.filter((i) => i.status === "approved" && i.horizon !== "next100k");
  const next = props.items.filter((i) => i.status === "approved" && i.horizon === "next100k");
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold">{props.aggregate}</h2>
        <button type="button" className={btnClass} onClick={props.onBack}>
          Atpakaļ
        </button>
      </div>
      <Section title="Tagad" items={now} {...props} />
      <Section title="Nākamie 100 000 km" items={next} {...props} />
    </div>
  );
}

function Section({
  title,
  items,
  ...rest
}: {
  title: string;
  items: ItemRow[];
} & Omit<Parameters<typeof AggregateCard>[0], "aggregate" | "items" | "onBack">) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-[var(--color-provin-muted)]">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-[13px] text-[var(--color-provin-muted)]">Nav apstiprinātu zināšanu.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-slate-100 px-3 py-2">
              <p className="text-[13px]">{item.claim}</p>
              <p className="mt-1 text-[11px] text-[var(--color-provin-muted)]">
                Avoti: {item.sources.map((s) => s.ref).join(", ") || "nav"} · pēdējoreiz lietots{" "}
                {formatWhen(item.lastUsedAt)}
              </p>
              <ItemActions
                item={item}
                busy={rest.busy}
                editId={rest.editId}
                editClaim={rest.editClaim}
                rejectId={null}
                rejectReason=""
                showReject={false}
                onEdit={rest.onEdit}
                onEditClaim={rest.onEditClaim}
                onSaveEdit={rest.onSaveEdit}
                onApprove={() => undefined}
                onStartReject={() => undefined}
                onRejectReason={() => undefined}
                onConfirmReject={() => undefined}
                onDelete={rest.onDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
