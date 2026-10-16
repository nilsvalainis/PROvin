"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  adminChangeFieldLabel,
  adminChangeFieldValue,
  formatAdminChangeWhen,
  type AdminChangeHistoryKind,
  type AdminChangeHistoryView,
} from "@/lib/admin-change-history";

type Props = {
  kind: AdminChangeHistoryKind;
  recordId: string;
  endpoint: string;
  onRestored?: (body: { record?: Record<string, unknown> }) => void;
  className?: string;
};

export function AdminChangeHistoryButton({ kind, recordId, endpoint, onRestored, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<AdminChangeHistoryView[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    setError(false);
    setBusy(true);
    try {
      const url = `${endpoint}?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(recordId)}`;
      const res = await fetch(url, { credentials: "include", cache: "no-store" });
      const json = (await res.json().catch(() => null)) as { entries?: AdminChangeHistoryView[] } | null;
      if (!res.ok || !Array.isArray(json?.entries)) {
        setError(true);
        setEntries([]);
        return;
      }
      setEntries(json.entries);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    setConfirmId(null);
    if (next) void load();
  }

  async function restore(entryId: string) {
    if (confirmId !== entryId) {
      setConfirmId(entryId);
      return;
    }
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, recordId, entryId }),
      });
      const json = (await res.json().catch(() => null)) as { record?: Record<string, unknown> } | null;
      if (!res.ok) {
        setError(true);
        return;
      }
      onRestored?.(json ?? {});
      setConfirmId(null);
      await load();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`inline-flex h-7 shrink-0 items-center rounded-full border border-[#e5e7eb] bg-white px-2 text-[11px] font-semibold text-[#6b7280] ${className}`}
      >
        Vēsture
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
        <div className="fixed inset-0 z-[120] flex flex-col bg-white md:items-center md:justify-center md:bg-black/30 md:p-6" role="dialog" aria-label="Vēsture">
          <div className="flex min-h-0 w-full flex-1 flex-col md:max-h-[min(32rem,80dvh)] md:w-full md:max-w-lg md:flex-none md:overflow-hidden md:rounded-2xl md:border md:border-[#e5e7eb] md:bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-[#e5e7eb] px-3 py-2 pt-[max(8px,env(safe-area-inset-top))]">
              <h2 className="text-[15px] font-semibold text-[#111827]">Vēsture</h2>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-8 items-center px-2 text-[13px] font-semibold text-[#6b7280]">
                Aizvērt
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2 pb-[max(12px,env(safe-area-inset-bottom))]">
              {error ? <p className="text-[13px] text-red-700">Neizdevās</p> : null}
              {!error && !busy && entries.length === 0 ? <p className="text-[13px] text-[#6b7280]">Nav</p> : null}
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <li key={entry.id} className="rounded-xl border border-[#e5e7eb] px-3 py-2">
                    <p className="text-[12px] text-[#6b7280]">
                      {formatAdminChangeWhen(entry.at)}
                      {entry.by ? ` · ${entry.by}` : ""}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {entry.fields.map((field) => (
                        <li key={field.field} className="break-words text-[13px] leading-snug text-[#111827]">
                          <span className="font-semibold">{adminChangeFieldLabel(field.field)}</span>
                          {": "}
                          {adminChangeFieldValue(kind, field.field, field.before)}
                          {" -> "}
                          {adminChangeFieldValue(kind, field.field, field.after)}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void restore(entry.id)}
                      className="mt-2 inline-flex h-8 items-center rounded-full border border-[#e5e7eb] bg-white px-3 text-[12px] font-semibold text-[#111827] disabled:opacity-50"
                    >
                      {confirmId === entry.id ? "Apstiprināt" : "Atjaunot"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>,
        document.body,
      )
        : null}
    </>
  );
}
