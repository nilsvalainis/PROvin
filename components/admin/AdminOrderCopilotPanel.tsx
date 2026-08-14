"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Bot, FileUp, GripVertical, Loader2, Minimize2, Send, Undo2, X } from "lucide-react";
import { COPILOT_SOURCE_KEYS, type CopilotAction, type CopilotChatMessage, type CopilotSourceKey } from "@/lib/admin-copilot-types";
import { SOURCE_BLOCK_LABELS, type WorkspaceSourceBlocks } from "@/lib/admin-source-blocks";
import {
  SourcePdfBlobUploadError,
  sourcePdfNeedsBlobUpload,
  uploadSourcePdfToBlob,
} from "@/lib/admin-source-pdf-blob-client";

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
  aiAllowed: boolean;
  getSourceBlocks: () => WorkspaceSourceBlocks;
  applyPatchedBlocks: (patched: Partial<WorkspaceSourceBlocks>, changedKeys: CopilotSourceKey[]) => void;
  restoreBlocksSnapshot: (snapshot: WorkspaceSourceBlocks) => void;
};

type PanelPos = { left: number; top: number };

const POS_STORAGE_KEY = "provin-admin-copilot-pos-v2";
const CHAT_STORAGE_PREFIX = "provin-admin-copilot-chat-v1:";
const CHAT_MAX_MESSAGES = 60;
const PANEL_W = 440;
const PANEL_H = 620;
const CHIP_W = 272;
const CHIP_H = 44;
const MARGIN = 12;

const WELCOME_MESSAGE: UiMessage = {
  id: "welcome",
  role: "system",
  content:
    "Ieslēdz mērķa avotus, pievieno PDF un īsu komandu (piem. „izvelc datus”). Pēc sūtīšanas logs samazinās — Tu vari turpināt darbu. Sarakste saglabājas šim pasūtījumam.",
};
const SOURCE_TOGGLE_LABELS: Record<CopilotSourceKey, string> = {
  csdd: SOURCE_BLOCK_LABELS.csdd,
  autodna: SOURCE_BLOCK_LABELS.autodna,
  carvertical: SOURCE_BLOCK_LABELS.carvertical,
  ltab: SOURCE_BLOCK_LABELS.ltab,
  auto_records: "Dīleris",
  citi_avoti: "Citi",
};
const SOURCE_TOGGLE_FULL_LABELS: Record<CopilotSourceKey, string> = {
  csdd: SOURCE_BLOCK_LABELS.csdd,
  autodna: SOURCE_BLOCK_LABELS.autodna,
  carvertical: SOURCE_BLOCK_LABELS.carvertical,
  ltab: SOURCE_BLOCK_LABELS.ltab,
  auto_records: "Oficiālais dīleris",
  citi_avoti: SOURCE_BLOCK_LABELS.citi_avoti,
};

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function defaultPos(minimized: boolean): PanelPos {
  if (typeof window === "undefined") return { left: 24, top: 24 };
  const w = minimized ? CHIP_W : Math.min(PANEL_W, window.innerWidth - MARGIN * 2);
  const h = minimized ? CHIP_H : Math.min(PANEL_H, window.innerHeight - 96);
  return {
    left: Math.max(MARGIN, window.innerWidth - w - MARGIN),
    top: Math.max(MARGIN, window.innerHeight - h - 80),
  };
}

function clampPos(pos: PanelPos, minimized: boolean): PanelPos {
  if (typeof window === "undefined") return pos;
  const w = minimized ? CHIP_W : Math.min(PANEL_W, window.innerWidth - MARGIN * 2);
  const h = minimized ? CHIP_H : Math.min(PANEL_H, window.innerHeight - 96);
  return {
    left: Math.min(Math.max(MARGIN, pos.left), Math.max(MARGIN, window.innerWidth - w - MARGIN)),
    top: Math.min(Math.max(MARGIN, pos.top), Math.max(MARGIN, window.innerHeight - h - MARGIN)),
  };
}

function loadStoredPos(): PanelPos | null {
  try {
    const raw = localStorage.getItem(POS_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PanelPos>;
    if (typeof p.left === "number" && typeof p.top === "number") return { left: p.left, top: p.top };
  } catch {
    /* ignore */
  }
  return null;
}

function savePos(pos: PanelPos) {
  try {
    localStorage.setItem(POS_STORAGE_KEY, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

function chatStorageKey(sessionId: string): string {
  return `${CHAT_STORAGE_PREFIX}${sessionId}`;
}

function loadStoredChat(sessionId: string): { messages: UiMessage[]; allowedSources?: CopilotSourceKey[] } | null {
  if (!sessionId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(chatStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      messages?: unknown;
      allowedSources?: unknown;
    };
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) return null;
    const messages: UiMessage[] = [];
    for (const item of parsed.messages.slice(-CHAT_MAX_MESSAGES)) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const role = o.role;
      const content = typeof o.content === "string" ? o.content : "";
      if (role !== "user" && role !== "assistant" && role !== "system") continue;
      if (!content.trim() && role === "system") continue;
      messages.push({
        id: typeof o.id === "string" ? o.id : newId(),
        role,
        content: content.slice(0, 12_000),
        ...(Array.isArray(o.needsConfirm) ? { needsConfirm: o.needsConfirm as UiMessage["needsConfirm"] } : {}),
        ...(Array.isArray(o.autoApplied) ? { autoApplied: o.autoApplied as UiMessage["autoApplied"] } : {}),
      });
    }
    if (messages.length === 0) return null;
    const allowedSources = Array.isArray(parsed.allowedSources)
      ? parsed.allowedSources.filter((s): s is CopilotSourceKey => typeof s === "string" && COPILOT_SOURCE_KEYS.includes(s as CopilotSourceKey))
      : undefined;
    return { messages, allowedSources: allowedSources?.length ? allowedSources : undefined };
  } catch {
    return null;
  }
}

function saveStoredChat(sessionId: string, messages: UiMessage[], allowedSources: CopilotSourceKey[]) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const slim = messages.slice(-CHAT_MAX_MESSAGES).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content.slice(0, 12_000),
      ...(m.needsConfirm?.length ? { needsConfirm: m.needsConfirm } : {}),
      ...(m.autoApplied?.length ? { autoApplied: m.autoApplied } : {}),
    }));
    localStorage.setItem(
      chatStorageKey(sessionId),
      JSON.stringify({ messages: slim, allowedSources, updatedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function AdminOrderCopilotTrigger({
  open,
  onOpen,
  disabled,
  busy,
}: {
  open: boolean;
  onOpen: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      data-copilot-trigger
      disabled={disabled}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-emerald-200/90 bg-emerald-50 px-2.5 text-sm font-medium text-emerald-900 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
      title="Order Copilot — chat + PDF (nebloķē paneli)"
      aria-label="Atvērt Order Copilot"
      aria-expanded={open}
      onClick={onOpen}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}
      <span className="hidden sm:inline">Copilot</span>
    </button>
  );
}

export function AdminOrderCopilotPanel({
  open,
  onClose,
  sessionId,
  aiAllowed,
  getSourceBlocks,
  applyPatchedBlocks,
  restoreBlocksSnapshot,
  onBusyChange,
}: Props & { onBusyChange?: (busy: boolean) => void }) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [unreadDone, setUnreadDone] = useState(false);
  const [pos, setPos] = useState<PanelPos>({ left: 24, top: 24 });
  const [dragging, setDragging] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([WELCOME_MESSAGE]);
  const [chatHydrated, setChatHydrated] = useState(false);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<WorkspaceSourceBlocks | null>(null);
  const [allowedSources, setAllowedSources] = useState<CopilotSourceKey[]>([...COPILOT_SOURCE_KEYS]);

  useEffect(() => {
    setMounted(true);
    const stored = loadStoredPos();
    setPos(clampPos(stored ?? defaultPos(false), false));
  }, []);

  useEffect(() => {
    setChatHydrated(false);
    const stored = loadStoredChat(sessionId);
    if (stored) {
      setMessages(stored.messages);
      if (stored.allowedSources?.length) setAllowedSources(stored.allowedSources);
    } else {
      setMessages([WELCOME_MESSAGE]);
    }
    setChatHydrated(true);
  }, [sessionId]);

  useEffect(() => {
    if (!chatHydrated || !sessionId) return;
    saveStoredChat(sessionId, messages, allowedSources);
  }, [allowedSources, chatHydrated, messages, sessionId]);

  useEffect(() => {
    if (!mounted) return;
    setPos((p) => clampPos(p, minimized));
  }, [minimized, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const onResize = () => setPos((p) => clampPos(p, minimized));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [minimized, mounted]);

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (open) {
      setMinimized(false);
      setUnreadDone(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || minimized) return;
    const onPointerDown = (e: PointerEvent) => {
      if (dragging || dragRef.current) return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("[data-copilot-panel]")) return;
      if (t.closest("[data-copilot-trigger]")) return;
      setMinimized(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, minimized, dragging]);

  useEffect(() => {
    if (!open || minimized) return;
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, open, busy, minimized]);

  const commitPos = useCallback((next: PanelPos, isMinimized: boolean) => {
    const clamped = clampPos(next, isMinimized);
    setPos(clamped);
    savePos(clamped);
  }, []);

  const onDragPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      // Atļauj vilkt no data-copilot-drag (t.sk. grip pogas); citas pogas bloķē
      if (target?.closest("button, a, input, textarea, select, label") && !target.closest("[data-copilot-drag]")) {
        return;
      }
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: pos.left,
        origTop: pos.top,
        moved: false,
      };
      setDragging(true);
    },
    [pos.left, pos.top],
  );

  const onDragPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
      setPos(clampPos({ left: d.origLeft + dx, top: d.origTop + dy }, minimized));
    },
    [minimized],
  );

  const onDragPointerUp = useCallback(
    (e: ReactPointerEvent) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const next = clampPos(
        { left: d.origLeft + (e.clientX - d.startX), top: d.origTop + (e.clientY - d.startY) },
        minimized,
      );
      dragRef.current = null;
      setDragging(false);
      commitPos(next, minimized);
    },
    [commitPos, minimized],
  );

  const historyForApi = useCallback((): CopilotChatMessage[] => {
    return messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  }, [messages]);

  const toggleSource = useCallback((source: CopilotSourceKey) => {
    setAllowedSources((prev) => {
      if (prev.includes(source)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== source);
      }
      const next = [...prev, source];
      return COPILOT_SOURCE_KEYS.filter((item) => next.includes(item));
    });
  }, []);

  const mergePatch = useCallback(
    (patched: Partial<WorkspaceSourceBlocks> | undefined, keys: CopilotSourceKey[] | undefined) => {
      if (!patched || !keys?.length) return;
      setUndoSnapshot(structuredClone(getSourceBlocks()));
      applyPatchedBlocks(patched, keys);
    },
    [applyPatchedBlocks, getSourceBlocks],
  );

  const send = useCallback(async () => {
    if (busy || !aiAllowed) return;
    const text = draft.trim();
    if (!text && files.length === 0) return;

    setBusy(true);
    setError(null);
    setUnreadDone(false);
    setMinimized(true);

    const userLabel =
      text ||
      (files.length === 1 ? `(PDF: ${files[0]!.name})` : `(${files.length} PDF)`);
    setMessages((prev) => [...prev, { id: newId(), role: "user", content: userLabel }]);
    setDraft("");
    const filesToSend = files;
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";

    try {
      const fd = new FormData();
      fd.set("sessionId", sessionId);
      fd.set("message", text);
      fd.set("applyMode", "auto");
      fd.set("history", JSON.stringify(historyForApi()));
      fd.set("sourceBlocks", JSON.stringify(getSourceBlocks()));
      fd.set("allowedSources", JSON.stringify(allowedSources));
      // Lielie PDF neiekļaujas Vercel funkcijas ķermenī — tos augšupielādē tieši krātuvē.
      const blobRefs: { url: string; name: string }[] = [];
      for (const f of filesToSend) {
        if (sourcePdfNeedsBlobUpload(f)) blobRefs.push(await uploadSourcePdfToBlob(sessionId, f));
        else fd.append("files", f);
      }
      if (blobRefs.length > 0) fd.set("fileUrls", JSON.stringify(blobRefs));

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
        let reason: string;
        if (data.error === "unauthorized") reason = "Nav admin piekļuves";
        else if (data.error === "missing_ai_key") reason = "Nav ANTHROPIC_API_KEY";
        else if (data.error === "ai_demo_only") reason = "AI tikai DEMO pasūtījumiem";
        else if (data.error === "file_too_large" || data.error === "too_many_files") {
          reason = detail || "PDF limits pārsniegts";
        } else if (data.error === "blob_fetch_failed") {
          reason = `Neizdevās nolasīt PDF no krātuves${detail ? ` (${detail})` : ""}`;
        } else if (res.status === 413) {
          reason = "Pieprasījums pārāk liels — pārlādē lapu un pievieno PDF vēlreiz";
        } else reason = detail || data.error || `Copilot kļūda (HTTP ${res.status})`;
        setError(reason);
        setMessages((prev) => [
          ...prev,
          { id: newId(), role: "assistant", content: `Neizdevās apstrādāt: ${reason}` },
        ]);
        setUnreadDone(true);
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
      setUnreadDone(true);
    } catch (e) {
      const reason =
        e instanceof SourcePdfBlobUploadError
          ? e.message
          : e instanceof Error
            ? e.message
            : "network_error";
      setError(reason);
      setMessages((prev) => [
        ...prev,
        { id: newId(), role: "assistant", content: `Neizdevās apstrādāt: ${reason}` },
      ]);
      setUnreadDone(true);
    } finally {
      setBusy(false);
    }
  }, [allowedSources, busy, draft, files, aiAllowed, getSourceBlocks, historyForApi, mergePatch, sessionId]);

  const confirmActions = useCallback(
    async (actions: CopilotAction[]) => {
      if (busy || !actions.length) return;
      setBusy(true);
      setError(null);
      setMinimized(true);
      try {
        const res = await fetch("/api/admin/copilot", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            sourceBlocks: getSourceBlocks(),
            allowedSources,
            actions,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as CopilotApiOk & { error?: string; detail?: string };
        if (!res.ok) {
          setError(data.detail || data.error || "Apstiprināšana neizdevās");
          setUnreadDone(true);
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
        setUnreadDone(true);
      } finally {
        setBusy(false);
      }
    },
    [allowedSources, busy, getSourceBlocks, mergePatch, sessionId],
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

  const requestClose = useCallback(() => {
    if (busy) {
      setMinimized(true);
      return;
    }
    setMinimized(false);
    setUnreadDone(false);
    onClose();
  }, [busy, onClose]);

  const expand = useCallback(() => {
    if (dragRef.current?.moved) return;
    setMinimized(false);
    setUnreadDone(false);
  }, []);

  if (!mounted || !open) return null;

  const posStyle: CSSProperties = {
    left: pos.left,
    top: pos.top,
    right: "auto",
    bottom: "auto",
  };

  const chip = (
    <div
      data-copilot-panel
      className={`fixed z-[45] flex max-w-[16rem] touch-none items-center gap-1 rounded-full border border-emerald-300/80 bg-emerald-50 pr-1 text-left text-xs font-medium text-emerald-950 shadow-lg dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-50 ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={posStyle}
    >
      <button
        type="button"
        data-copilot-drag
        className={`flex cursor-grab items-center self-stretch rounded-l-full px-2 text-emerald-800/80 active:cursor-grabbing dark:text-emerald-200/80 ${
          dragging ? "cursor-grabbing" : ""
        }`}
        aria-label="Pārvietot Copilot"
        title="Velc, lai pārvietotu"
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2" onClick={expand} title="Atvērt Copilot">
        {busy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Bot className="h-4 w-4 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 truncate">
          {busy ? "Copilot strādā… Turpini darbu" : unreadDone ? "Copilot gatavs — atver" : "Copilot (samazināts)"}
        </span>
        {unreadDone && !busy ? (
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-hidden />
        ) : null}
      </button>
    </div>
  );

  const panel = (
    <aside
      data-copilot-panel
      className={`fixed z-[45] flex h-[min(38.75rem,calc(100vh-5rem))] w-[min(27.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[var(--admin-border-subtle)] bg-white text-[var(--color-apple-text)] shadow-2xl dark:bg-zinc-950 dark:text-zinc-100 ${
        dragging ? "cursor-grabbing select-none" : ""
      }`}
      style={posStyle}
      aria-label="Order Copilot"
    >
      <div
        data-copilot-drag
        className={`flex shrink-0 touch-none items-center justify-between gap-2 border-b border-[var(--admin-border-subtle)] bg-emerald-50/70 px-3 py-2.5 dark:bg-emerald-950/30 ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
        title="Velc, lai pārvietotu logu"
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-emerald-800/70 dark:text-emerald-200/70" aria-hidden />
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
            <Bot className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold leading-tight text-[var(--color-apple-text)]">Order Copilot</h2>
            <p className="truncate text-[11px] text-[var(--color-provin-muted)]">
              {busy ? "Strādā fonā — panelis nebloķē" : "Chat + PDF · tikai ieslēgtie avoti"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
          {undoSnapshot ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
              onClick={undo}
              title="Atsaukt pēdējo aizpildījumu"
            >
              <Undo2 className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--color-provin-muted)] hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Samazināt"
            title="Samazināt — turpini darbu"
            onClick={() => setMinimized(true)}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--color-provin-muted)] hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={busy ? "Samazināt (Copilot vēl strādā)" : "Aizvērt"}
            title={busy ? "Kamēr strādā — tikai samazina" : "Aizvērt"}
            onClick={requestClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3 py-3 text-sm">
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-8 rounded-2xl rounded-br-md bg-emerald-700 px-3 py-2 text-[13px] leading-snug text-white shadow-sm"
                : m.role === "system"
                  ? "rounded-xl border border-dashed border-[var(--admin-border-subtle)] bg-slate-50/80 px-3 py-2 text-[12px] leading-snug text-[var(--color-provin-muted)] dark:bg-white/5"
                  : "mr-4 rounded-2xl rounded-bl-md border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-3 py-2 text-[13px] leading-snug text-[var(--color-apple-text)]"
            }
          >
            <div className="whitespace-pre-wrap break-words">{m.content}</div>
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
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            AI lasa / aizpilda fonā…
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="shrink-0 border-t border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="shrink-0 border-t border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-3 pb-3 pt-2.5">
        <div className="mb-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
              Mērķa avoti
            </p>
            <p className="text-[10px] text-[var(--color-provin-muted)]">
              {allowedSources.length}/{COPILOT_SOURCE_KEYS.length} ieslēgti
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {COPILOT_SOURCE_KEYS.map((source) => {
              const active = allowedSources.includes(source);
              return (
                <button
                  key={source}
                  type="button"
                  aria-pressed={active}
                  disabled={busy || !aiAllowed}
                  onClick={() => toggleSource(source)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? "border-emerald-400 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-700"
                      : "border-[var(--admin-border-subtle)] bg-white text-[var(--color-provin-muted)] hover:border-emerald-300 hover:text-emerald-800 dark:bg-zinc-900 dark:hover:border-emerald-700"
                  } disabled:opacity-50`}
                  title={
                    active
                      ? `Izslēgt: ${SOURCE_TOGGLE_FULL_LABELS[source]}`
                      : `Ieslēgt: ${SOURCE_TOGGLE_FULL_LABELS[source]}`
                  }
                >
                  {SOURCE_TOGGLE_LABELS[source]}
                </button>
              );
            })}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (!picked.length) return;
            setFiles((prev) => {
              const next = [...prev];
              for (const f of picked) {
                if (!/\.pdf$/i.test(f.name)) continue;
                if (next.some((x) => x.name === f.name && x.size === f.size)) continue;
                if (next.length >= 8) break;
                next.push(f);
              }
              return next;
            });
            e.target.value = "";
          }}
        />

        {files.length > 0 ? (
          <ul className="mb-2 max-h-20 space-y-1 overflow-y-auto">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${f.size}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-[var(--admin-border-subtle)] bg-white px-2.5 py-1.5 text-xs text-[var(--color-apple-text)] dark:bg-zinc-900 dark:text-zinc-100"
              >
                <span className="min-w-0 truncate font-medium" title={f.name}>
                  {f.name}
                </span>
                <button
                  type="button"
                  className="shrink-0 font-medium text-emerald-800 underline dark:text-emerald-300"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  Noņemt
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="rounded-xl border border-[var(--admin-border-subtle)] bg-white p-2 shadow-sm dark:bg-zinc-900">
          <label htmlFor={inputId} className="sr-only">
            Ziņa Copilot
          </label>
          <textarea
            id={inputId}
            rows={3}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="min-h-[4.5rem] w-full resize-none border-0 bg-transparent px-1.5 py-1 text-sm leading-snug text-[var(--color-apple-text)] outline-none placeholder:text-[var(--color-provin-muted)] dark:text-zinc-100"
            placeholder={
              aiAllowed
                ? files.length
                  ? "Piem. izvelc datus no PDF…"
                  : "Uzraksti uzdevumu vai pievieno PDF…"
                : "AI nav pieejams šim pasūtījumam"
            }
            value={draft}
            disabled={busy || !aiAllowed}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="mt-1 flex items-center justify-between gap-2 border-t border-[var(--admin-border-subtle)] pt-2">
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2.5 text-xs font-medium text-[var(--color-apple-text)] hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
              title="Pievienot PDF (vairākus)"
              disabled={busy || !aiAllowed || files.length >= 8}
              onClick={() => fileRef.current?.click()}
            >
              <FileUp className="h-3.5 w-3.5" aria-hidden />
              PDF{files.length > 0 ? ` (${files.length})` : ""}
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              disabled={busy || !aiAllowed || allowedSources.length === 0 || (!draft.trim() && files.length === 0)}
              onClick={() => void send()}
              aria-label="Sūtīt un turpināt darbu"
              title="Sūtīt — logs samazinās, Tu turpini darbu"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Sūtīt
            </button>
          </div>
        </div>

        <p className="mt-2 text-[10px] leading-snug text-[var(--color-provin-muted)]">
          AI raksta tikai ieslēgtajos avotos
          {files.length > 0 ? ` · ${files.length}/8 PDF` : ""}.
        </p>
      </div>
    </aside>
  );

  return createPortal(minimized ? chip : panel, document.body);
}
