"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Loader2 } from "lucide-react";
import type { OrderDraftRevisionMeta } from "@/lib/admin-order-draft-types";

type LocalBackupEntry = { savedAt: string; data: string };

function formatBackupTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString("lv-LV", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  sessionId: string;
  backupStorageKey: string;
  orderDraftPersistenceEnabled: boolean;
  disabled?: boolean;
  onRestoreLocalSnapshot: (snapshot: string) => boolean;
};

export function AdminWorkspaceRestoreMenu({
  sessionId,
  backupStorageKey,
  orderDraftPersistenceEnabled,
  disabled,
  onRestoreLocalSnapshot,
}: Props) {
  const router = useRouter();
  const menuId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [localBackups, setLocalBackups] = useState<LocalBackupEntry[]>([]);
  const [serverRevisions, setServerRevisions] = useState<OrderDraftRevisionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadLists = useCallback(() => {
    setErr(null);
    try {
      const raw = localStorage.getItem(backupStorageKey);
      const parsed = raw ? (JSON.parse(raw) as LocalBackupEntry[]) : [];
      setLocalBackups(
        Array.isArray(parsed) ?
          parsed.filter((x) => x && typeof x.savedAt === "string" && typeof x.data === "string")
        : [],
      );
    } catch {
      setLocalBackups([]);
    }

    if (!orderDraftPersistenceEnabled) {
      setServerRevisions([]);
      return;
    }
    setLoading(true);
    void fetch(`/api/admin/order-draft?sessionId=${encodeURIComponent(sessionId)}&limit=20`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("server_list_failed");
        const data = (await res.json()) as { revisions?: OrderDraftRevisionMeta[] };
        setServerRevisions(Array.isArray(data.revisions) ? data.revisions : []);
      })
      .catch(() => {
        setServerRevisions([]);
        setErr("Neizdevās ielādēt servera versijas");
      })
      .finally(() => setLoading(false));
  }, [backupStorageKey, orderDraftPersistenceEnabled, sessionId]);

  useEffect(() => {
    if (!open) return;
    loadLists();
  }, [open, loadLists]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const confirmRestore = (label: string) =>
    window.confirm(`Atjaunot darba zonu no: ${label}?\n\nPašreizējie nesaglabātie labojumi tiks aizstāti.`);

  const restoreLocal = (entry: LocalBackupEntry) => {
    const label = formatBackupTime(entry.savedAt);
    if (!confirmRestore(`pārlūka rezerves kopija (${label})`)) return;
    setBusyId(`local:${entry.savedAt}`);
    setErr(null);
    const ok = onRestoreLocalSnapshot(entry.data);
    setBusyId(null);
    if (!ok) {
      setErr("Rezerves dati nav derīgi vai nav lasāmi");
      return;
    }
    setOpen(false);
  };

  const restoreServer = async (rev: OrderDraftRevisionMeta) => {
    const label = formatBackupTime(rev.savedAt);
    if (!confirmRestore(`servera versija (${label})`)) return;
    setBusyId(`server:${rev.revisionId}`);
    setErr(null);
    try {
      const res = await fetch("/api/admin/order-draft", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_revision",
          sessionId,
          revisionId: rev.revisionId,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "store_disabled") {
          setErr("Servera glabātuve nav ieslēgta (ADMIN_ORDER_DRAFT_DIR)");
        } else {
          setErr("Neizdevās atjaunot no servera");
        }
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setErr("Neizdevās savienoties ar serveri");
    } finally {
      setBusyId(null);
    }
  };

  const hasAny = localBackups.length > 0 || serverRevisions.length > 0;

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        type="button"
        disabled={disabled}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 text-[10px] font-semibold text-[var(--color-apple-text)] shadow-sm transition hover:bg-black/[0.04] disabled:opacity-50 dark:hover:bg-white/[0.06]"
        aria-expanded={open}
        aria-controls={menuId}
        title="Atjaunot iepriekšējo saglabāto darba zonas versiju"
        onClick={() => setOpen((v) => !v)}
      >
        <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Atjaunot no rezerves
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] p-2 shadow-lg"
        >
          {loading ? (
            <p className="flex items-center gap-1.5 px-1 py-2 text-[10px] text-[var(--color-provin-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Ielādē…
            </p>
          ) : null}
          {err ? (
            <p className="mb-2 rounded-md bg-amber-50 px-2 py-1 text-[10px] text-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
              {err}
            </p>
          ) : null}
          {!loading && !hasAny && !err ? (
            <p className="px-1 py-2 text-[10px] text-[var(--color-provin-muted)]">
              Nav pieejamu rezerves kopiju. Saglabā darba zonu — pēc tam šeit parādīsies versijas.
            </p>
          ) : null}
          {localBackups.length > 0 ? (
            <div className="mb-2">
              <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
                Pārlūkā (līdz 20)
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                {localBackups.map((entry) => {
                  const id = `local:${entry.savedAt}`;
                  const busy = busyId === id;
                  return (
                    <li key={entry.savedAt}>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={Boolean(busyId)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[10px] hover:bg-black/[0.05] disabled:opacity-50 dark:hover:bg-white/[0.06]"
                        onClick={() => restoreLocal(entry)}
                      >
                        <span>{formatBackupTime(entry.savedAt)}</span>
                        {busy ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {orderDraftPersistenceEnabled && serverRevisions.length > 0 ? (
            <div>
              <p className="mb-1 px-1 text-[9px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
                Serverī (Dropbox / disks)
              </p>
              <ul className="max-h-40 space-y-0.5 overflow-y-auto">
                {serverRevisions.map((rev) => {
                  const id = `server:${rev.revisionId}`;
                  const busy = busyId === id;
                  return (
                    <li key={rev.revisionId}>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={Boolean(busyId)}
                        className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1 text-left text-[10px] hover:bg-black/[0.05] disabled:opacity-50 dark:hover:bg-white/[0.06]"
                        onClick={() => void restoreServer(rev)}
                      >
                        <span className="font-medium">{formatBackupTime(rev.savedAt)}</span>
                        <span className="text-[9px] text-[var(--color-provin-muted)]">{rev.reason}</span>
                        {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
