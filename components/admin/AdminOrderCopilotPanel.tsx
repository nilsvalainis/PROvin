"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bot, FileUp, Loader2, Send, Undo2, X } from "lucide-react";
import type { CopilotAction, CopilotChatMessage, CopilotSourceKey } from "@/lib/admin-copilot-types";
import type { WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";

type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  needsConfirm?: Array<CopilotAction & { label?: string }>;
  autoApplied?: Array<CopilotAction & { label?: string }>;
};

type CopilotApiOk = {
  ok: true;
  reply: string;
  clarificationNeeded?: string;
  autoApplied?: Array<CopilotAction & { label?: string }>;
  needsConfirm?: Array<CopilotAction & { label?: string }>;
  skipped?: Array<CopilotAction & { label?: string; reason?: string }>;
  patchedSourceBlocks?: Partial<WorkspaceSourceBlocks>;
  changedKeys?: CopilotSourceKey[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  geminiAllowed: boolean;
  getSourceBlocks: () => WorkspaceSourceBlocks;
  applyPatchedBlocks: (patched: Partial<WorkspaceSourceBlocks>, changedKeys: CopilotSourceKey[]) => void;
  restoreBlocksSnapshot: (snapshot: WorkspaceSourceBlocks) => void;
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminOrderCopilotTrigger({
  open,
  onOpen,
  disabled,
}: {
  open: boolean;
  onOpen: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200/90 bg-emerald-50 px-2.5 text-sm font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
      title="Order Copilot — chat + PDF"
      aria-label="Atvērt Order Copilot"
      aria-expanded={open}
      onClick={onOpen}
    >
      <Bot className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">Copilot</span>
    </button>
  );
}

export function AdminOrderCopilotPanel({
  open,
  onClose,
  sessionId,
  geminiAllowed,
  getSourceBlocks,
  applyPatchedBlocks,
  restoreBlocksSnapshot,
}: Props) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "Raksti brīvi vai pievieno PDF. Piemērs: „AutoDNA: negadījums 17.11.2020, 5000 €, Vācija”. Skaidras high-confidence rindas aizpildās automātiski; neskaidrām — apstiprini.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<WorkspaceSourceBlocks | null>(null);

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, busy]);

  const historyForApi = useCallback((): CopilotChatMessage[] => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [messages]);

  const mergePatch = useCallback(
    (patched: Partial<WorkspaceSourceBlocks> | undefined, keys: CopilotSourceKey[] | undefined) => {
      if (!patched || !keys?.length) return;
      setUndoSnapshot(structuredClone(getSourceBlocks()));
      applyPatchedBlocks(patched, keys);
    },
    [applyPatchedBlocks, getSourceBlocks],
  );

  const send = useCallback(async () => {
    if (busy || !geminiAllowed) return;
    const text = draft.trim();
    if (!text && !file) return;

    setBusy(true);
    setError(null);
    const userLabel = text || `(PDF: ${file?.name ?? "fails"})`;
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: userLabel }]);
    setDraft("");
    const fileToSend = file;
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";

    try {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      fd.set("message", text);
      fd.set("applyMode", "auto");
      fd.set("history", JSON.stringify(historyForApi()));
      fd.set("sourceBlocks", JSON.stringify(getSourceBlocks()));
      if (fileToSend) fd.set("file", fileToSend);

      const res = await fetch("/api/admin/copilot", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as CopilotApiOk & {
        error?: string;
        detail?: string;
      };

      if (!res.ok) {
        const detail = typeof data.detail === "string" ? data.detail : "";
        if (data.error === "unauthorized") setError("Nav admin piekļuves");
        else if (data.error === "missing_gemini_key") setError("Nav GEMINI_API_KEY");
        else if (data.error === "gemini_demo_only") setError("Gemini tikai DEMO pasūtījumiem");
        else if (data.error === "file_too_large") setError(detail || "PDF pārāk liels");
        else setError(detail || data.error || "Copilot kļūda");
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", content: "Neizdevās apstrādāt — skatīt kļūdu zemāk." },
        ]);
        return;
      }

      mergePatch(data.patchedSourceBlocks, data.changedKeys);

      const parts: string[] = [data.reply || "Gatavs."];
      if (data.clarificationNeeded?.trim()) {
        parts.push(`\nJautājums: ${data.clarificationNeeded.trim()}`);
      }
      if (data.autoApplied?.length) {
        parts.push(`\nAutomātiski aizpildīts (${data.autoApplied.length}):`);
        for (const a of data.autoApplied) parts.push(`• ${a.label ?? a.type}`);
      }
      if (data.skipped?.length) {
        parts.push(`\nIzlaists: ${data.skipped.map((s) => s.label ?? s.type).join("; ")}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: parts.join("\n"),
          needsConfirm: data.needsConfirm,
          autoApplied: data.autoApplied,
        },
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "network_error");
    } finally {
      setBusy(false);
    }
  }, [busy, draft, file, geminiAllowed, getSourceBlocks, historyForApi, mergePatch, sessionId]);

  const confirmActions = useCallback(
    async (actions: CopilotAction[]) => {
      if (busy || !actions.length) return;
      setBusy(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/copilot", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            sourceBlocks: getSourceBlocks(),
            actions,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as CopilotApiOk & { error?: string; detail?: string };
        if (!res.ok) {
          setError(data.detail || data.error || "Apstiprināšana neizdevās");
          return;
        }
        mergePatch(data.patchedSourceBlocks, data.changedKeys);
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: `Apstiprināts: ${(data.autoApplied ?? []).map((a) => a.label ?? a.type).join("; ") || "—"}`,
          },
        ]);
      } finally {
        setBusy(false);
      }
    },
    [busy, getSourceBlocks, mergePatch, sessionId],
  );

  const undo = useCallback(() => {
    if (!undoSnapshot) return;
    restoreBlocksSnapshot(undoSnapshot);
    setUndoSnapshot(null);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: "system", content: "Atsaukts pēdējais Copilot aizpildījums." },
    ]);
  }, [restoreBlocksSnapshot, undoSnapshot]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[55] bg-black/30"
        aria-label="Aizvērt Copilot"
        onClick={onClose}
      />
      <aside
        className="fixed right-0 top-0 z-[56] flex h-full w-full max-w-md flex-col border-l border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] shadow-2xl"
        aria-label="Order Copilot"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--admin-border-subtle)] px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--color-apple-text)]">Order Copilot</h2>
            <p className="truncate text-[11px] text-[var(--color-provin-muted)]">Chat + PDF → tabulas</p>
          </div>
          <div className="flex items-center gap-1">
            {undoSnapshot ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
                onClick={undo}
                title="Atsaukt pēdējo aizpildījumu"
              >
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
                Atsaukt
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md p-1.5 text-[var(--color-provin-muted)] hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Aizvērt"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-sm">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-6 rounded-lg bg-emerald-600/90 px-3 py-2 text-white"
                  : m.role === "system"
                    ? "rounded-lg border border-dashed border-[var(--admin-border-subtle)] px-3 py-2 text-[12px] text-[var(--color-provin-muted)]"
                    : "mr-4 rounded-lg bg-black/[0.04] px-3 py-2 text-[var(--color-apple-text)] dark:bg-white/10"
              }
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.needsConfirm && m.needsConfirm.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                    onClick={() => confirmActions(m.needsConfirm!)}
                  >
                    Apstiprināt ({m.needsConfirm.length})
                  </button>
                </div>
              ) : null}
            </div>
          ))}
          {busy ? (
            <div className="flex items-center gap-2 text-xs text-[var(--color-provin-muted)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Gemini lasa / aizpilda…
            </div>
          ) : null}
        </div>

        {error ? <p className="px-3 pb-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="border-t border-[var(--admin-border-subtle)] p-3">
          {file ? (
            <div className="mb-2 flex items-center justify-between gap-2 rounded-md bg-black/[0.04] px-2 py-1 text-xs dark:bg-white/10">
              <span className="truncate">{file.name}</span>
              <button type="button" className="shrink-0 underline" onClick={() => setFile(null)}>
                Noņemt
              </button>
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--admin-border-subtle)] hover:bg-black/5 dark:hover:bg-white/10"
              title="Pievienot PDF"
              disabled={busy || !geminiAllowed}
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-4 w-4" aria-hidden />
            </button>
            <label htmlFor={inputId} className="sr-only">
              Ziņa Copilot
            </label>
            <textarea
              id={inputId}
              rows={2}
              className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-[var(--admin-border-subtle)] bg-transparent px-2.5 py-2 text-sm outline-none focus:border-emerald-500"
              placeholder={geminiAllowed ? "Uzraksti uzdevumu…" : "Gemini nav pieejams šim pasūtījumam"}
              value={draft}
              disabled={busy || !geminiAllowed}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
              disabled={busy || !geminiAllowed || (!draft.trim() && !file)}
              onClick={() => void send()}
              aria-label="Sūtīt"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
