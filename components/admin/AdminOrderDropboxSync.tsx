"use client";

import { useCallback, useEffect, useState } from "react";

type PhotoStatus = { total: number; saved: number; failed: number; waiting: number; folderError?: string };

/** «Dropbox: N/M» pasūtījuma bildēm + «Saglabāt visu Dropbox» (bildes + dokumenti, bez dublikātiem). Nils 27.11. */
export function orderDropboxSyncLabel(s: PhotoStatus | null): string {
  if (!s) return "Dropbox: …";
  return `Dropbox: ${s.saved}/${s.total}`;
}

export function AdminOrderDropboxSync({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState<PhotoStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/order-dropbox-sync?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      const j = (await res.json().catch(() => null)) as { photos?: PhotoStatus } | null;
      if (res.ok && j?.photos) setStatus(j.photos);
    } catch {
      /* statuss nav kritisks */
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) void load();
  }, [sessionId, load]);

  async function saveAll() {
    setBusy(true);
    setLine(null);
    try {
      const res = await fetch("/api/admin/order-dropbox-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const j = (await res.json().catch(() => null)) as {
        photos?: PhotoStatus & { partial?: boolean; skipped?: string };
        documents?: { uploaded: number } | null;
      } | null;
      if (!res.ok || !j?.photos) {
        setLine("Neizdevās saglabāt Dropbox");
      } else {
        setStatus(j.photos);
        const docs = j.documents?.uploaded ?? 0;
        if (j.photos.skipped === "no_folder") setLine("Pasūtījuma Dropbox mape nav pieejama");
        else if (j.photos.partial) setLine("Daļa vēl tiek saglabāta");
        else if (docs) setLine(`+${docs} dok.`);
      }
    } catch {
      setLine("Neizdevās saglabāt Dropbox");
    } finally {
      setBusy(false);
    }
  }

  const bad = Boolean(status && (status.failed > 0 || status.folderError));
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`inline-flex h-7 items-center rounded-md px-2 text-[10px] font-semibold ${bad ? "bg-rose-700 text-white" : "bg-slate-100 text-slate-700"}`}
        role="status"
        title={status?.folderError || (status?.failed ? `Neizdevās: ${status.failed}` : undefined)}
      >
        {orderDropboxSyncLabel(status)}
      </span>
      <button
        type="button"
        onClick={() => void saveAll()}
        disabled={busy}
        className="inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Saglabā…" : "Saglabāt visu Dropbox"}
      </button>
      {line ? <span className={`text-[10px] ${line.startsWith("+") ? "text-slate-600" : "text-rose-700"}`}>{line}</span> : null}
    </span>
  );
}
