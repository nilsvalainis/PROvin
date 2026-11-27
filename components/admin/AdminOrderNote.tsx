"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatOrderAdminNoteTime,
  orderAdminNoteOneLine,
  ORDER_ADMIN_NOTE_COLORS,
  ORDER_ADMIN_NOTE_MAX_LEN,
  type OrderAdminNote,
  type OrderAdminNoteColor,
} from "@/lib/order-admin-note";

/**
 * Iekšēja admina piezīme pasūtījumam (Nils 27.11, makets B, lēmumi «B, A, A»).
 * Galvenē krāsains čips (viena rinda, «…»), klikšķis atver labošanu. Tukšā stāvoklī tikai «+ Piezīme».
 * TIKAI adminā - nekad PDF, klienta e-pastos, AI promptos vai klienta saitēs.
 */

export type AdminOrderNoteSaveStatus = "idle" | "saving" | "saved" | "error";

const COLOR_LABEL: Record<OrderAdminNoteColor, string> = {
  red: "Sarkana",
  yellow: "Dzeltena",
  green: "Zaļa",
};

/** Čips / logs: fons, apmale, teksts. */
const TONE: Record<OrderAdminNoteColor | "off", { chip: string; box: string; dot: string }> = {
  red: {
    chip: "border-[#fecdca] bg-[#fef3f2] text-[#d92d20] dark:border-[#5c201b] dark:bg-[#3a1512] dark:text-[#ff6b5e]",
    box: "border-[#fecdca] bg-[#fef3f2] dark:border-[#5c201b] dark:bg-[#3a1512]",
    dot: "bg-[#d92d20] dark:bg-[#ff6b5e]",
  },
  yellow: {
    chip: "border-[#fedf89] bg-[#fffaeb] text-[#b54708] dark:border-[#54400f] dark:bg-[#33250a] dark:text-[#fdb022]",
    box: "border-[#fedf89] bg-[#fffaeb] dark:border-[#54400f] dark:bg-[#33250a]",
    dot: "bg-[#b54708] dark:bg-[#fdb022]",
  },
  green: {
    chip: "border-[#abefc6] bg-[#ecfdf3] text-[#067647] dark:border-[#164a31] dark:bg-[#0d2a1c] dark:text-[#47cd89]",
    box: "border-[#abefc6] bg-[#ecfdf3] dark:border-[#164a31] dark:bg-[#0d2a1c]",
    dot: "bg-[#067647] dark:bg-[#47cd89]",
  },
  off: {
    chip: "border-[#e5e5ea] bg-[#f2f2f5] text-[#aeaeb2] line-through dark:border-[#2c2c2e] dark:bg-[#26262a] dark:text-[#6c6c70]",
    box: "border-[#e5e5ea] bg-[#f2f2f5] dark:border-[#2c2c2e] dark:bg-[#26262a]",
    dot: "bg-[#aeaeb2] dark:bg-[#6c6c70]",
  },
};

function toneOf(note: Pick<OrderAdminNote, "color" | "resolved">): keyof typeof TONE {
  return note.resolved ? "off" : note.color;
}

/**
 * Piezīmes stāvoklis + automātiska saglabāšana (debounce) caur `PATCH /api/admin/order-draft`
 * ar `orderEdits: { adminNote }` (serveris sapludina ar pārējiem laukiem; `null` = dzēst).
 */
export function useAdminOrderNote(
  sessionId: string,
  initial: OrderAdminNote | null | undefined,
  enabled: boolean,
): [OrderAdminNote | null, (next: OrderAdminNote | null) => void, AdminOrderNoteSaveStatus] {
  const [note, setNoteState] = useState<OrderAdminNote | null>(initial ?? null);
  const [status, setStatus] = useState<AdminOrderNoteSaveStatus>("idle");
  const pendingRef = useRef<{ value: OrderAdminNote | null } | null>(null);
  const timerRef = useRef<number | null>(null);
  const seqRef = useRef(0);

  const flush = useCallback(
    (keepalive = false) => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const pending = pendingRef.current;
      if (!pending || !enabled) return;
      pendingRef.current = null;
      const seq = ++seqRef.current;
      setStatus("saving");
      void fetch("/api/admin/order-draft", {
        method: "PATCH",
        credentials: "include",
        keepalive,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, orderEdits: { adminNote: pending.value } }),
      })
        .then((res) => {
          if (seq === seqRef.current) setStatus(res.ok ? "saved" : "error");
        })
        .catch(() => {
          if (seq === seqRef.current) setStatus("error");
        });
    },
    [enabled, sessionId],
  );

  const setNote = useCallback(
    (next: OrderAdminNote | null) => {
      setNoteState(next);
      pendingRef.current = { value: next && next.text.trim() ? next : null };
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => flush(false), 700);
    },
    [flush],
  );

  useEffect(() => {
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush(true);
    };
  }, [flush]);

  return [note, setNote, status];
}

type ChipProps = {
  note: OrderAdminNote | null;
  onChange: (next: OrderAdminNote | null) => void;
  status: AdminOrderNoteSaveStatus;
  /** `mobile` - čips aizņem rindas brīvo vietu. */
  variant?: "desktop" | "mobile";
};

export function AdminOrderNoteChip({ note, onChange, status, variant = "desktop" }: ChipProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OrderAdminNote | null>(note);
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) setDraft(note);
  }, [note, open]);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    window.setTimeout(() => areaRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const update = (patch: Partial<Pick<OrderAdminNote, "text" | "color" | "resolved">>) => {
    const base: OrderAdminNote = draft ?? { text: "", color: "red", resolved: false, updatedAt: "" };
    const next: OrderAdminNote = { ...base, ...patch, updatedAt: new Date().toISOString() };
    setDraft(next);
    onChange(next.text.trim() ? next : null);
  };

  const mobile = variant === "mobile";
  const line = orderAdminNoteOneLine(note);
  const editing = draft ?? { text: "", color: "red" as const, resolved: false, updatedAt: "" };
  const tone = TONE[toneOf(editing)];
  const metaText =
    status === "saving"
      ? "Saglabā…"
      : status === "error"
        ? "Nav saglabāts"
        : note?.updatedAt
          ? `Saglabāts ${formatOrderAdminNoteTime(note.updatedAt)}`
          : "";

  return (
    <div
      ref={rootRef}
      // Telefonā `contents`: čips aizņem rindas brīvo vietu, labošana pārlec jaunā rindā (bez absolūta loga ārpus ekrāna).
      className={mobile ? "contents" : "relative inline-flex min-w-0 max-w-[300px] items-center"}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      data-admin-order-note
    >
      {note && line ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={line}
          aria-expanded={open}
          className={`inline-flex min-w-0 items-center gap-1.5 rounded-full border pl-2 pr-2.5 text-[12px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${
            mobile ? "h-7 min-w-[96px] flex-1 basis-0" : "h-6 max-w-full"
          } ${TONE[toneOf(note)].chip}`}
          data-admin-order-note-chip={note.resolved ? "resolved" : note.color}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${TONE[toneOf(note)].dot}`} aria-hidden />
          <span className="min-w-0 truncate">{line}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full border border-dashed border-[#d1d1d6] px-2.5 text-[11px] font-semibold text-[#8e8e93] hover:border-[#8e8e93] hover:text-[#1c1c1e] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] dark:border-[#3a3a3c] dark:hover:text-[#f2f2f7]"
          data-admin-order-note-add
        >
          + Piezīme
        </button>
      )}
      {open ? (
        <div
          role="dialog"
          aria-label="Piezīme"
          className={`flex flex-col gap-2 rounded-[10px] border p-2.5 text-left font-normal normal-case tracking-normal ${
            mobile ? "order-last w-full basis-full" : "absolute left-0 top-full z-40 mt-1.5 w-[min(380px,calc(100vw-32px))]"
          } ${tone.box}`}
        >
          <textarea
            ref={areaRef}
            aria-label="Piezīme"
            value={editing.text}
            maxLength={ORDER_ADMIN_NOTE_MAX_LEN}
            rows={3}
            onChange={(e) => update({ text: e.target.value })}
            className={`min-h-[56px] w-full resize-y rounded-md border bg-white px-2.5 py-2 text-[13px] font-medium leading-snug text-[#1c1c1e] focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#2563eb] dark:bg-[#1c1c1e] dark:text-[#f2f2f7] ${
              editing.resolved ? "text-[#8e8e93] line-through" : ""
            } ${tone.box}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            {ORDER_ADMIN_NOTE_COLORS.map((c) => {
              const on = editing.color === c && !editing.resolved;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={COLOR_LABEL[c]}
                  aria-pressed={on}
                  title={COLOR_LABEL[c]}
                  onClick={() => update({ color: c, ...(editing.resolved ? { resolved: false } : {}) })}
                  className={`h-[22px] w-[22px] shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${TONE[c].dot} ${
                    on ? "ring-2 ring-[#1c1c1e] ring-offset-2 ring-offset-white dark:ring-[#f2f2f7] dark:ring-offset-[#1c1c1e]" : ""
                  }`}
                />
              );
            })}
            <span
              className={`text-[11px] tabular-nums ${status === "error" ? "font-semibold text-[#d92d20]" : "text-[#8e8e93]"}`}
              data-admin-order-note-meta
            >
              {metaText}
            </span>
            <span className="flex-1" />
            {note || editing.text.trim() ? (
              <button
                type="button"
                onClick={() => {
                  setDraft(null);
                  onChange(null);
                  close();
                }}
                className="h-7 rounded-md px-3 text-[12px] font-semibold text-[#8e8e93] hover:text-[#d92d20] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
              >
                Dzēst
              </button>
            ) : null}
            {editing.text.trim() ? (
              <button
                type="button"
                onClick={() => {
                  const resolved = !editing.resolved;
                  update({ resolved });
                  if (resolved) close();
                }}
                className="h-7 rounded-md bg-[#1c1c1e] px-3 text-[12px] font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] dark:bg-[#f2f2f7] dark:text-[#1c1c1e]"
              >
                {editing.resolved ? "Atjaunot" : "Atrisināts"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Pasūtījumu saraksts: mazs krāsains punkts pie klienta; hover/tap rāda tekstu un laiku. */
export function AdminOrderNoteDot({ note }: { note?: OrderAdminNote | null }) {
  const [show, setShow] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!show) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [show]);
  const line = orderAdminNoteOneLine(note);
  if (!note || !line) return null;
  const time = formatOrderAdminNoteTime(note.updatedAt);
  return (
    <span
      ref={rootRef}
      className="group relative inline-flex shrink-0 items-center self-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      data-admin-order-note-dot={note.resolved ? "resolved" : note.color}
    >
      <button
        type="button"
        aria-label={`Piezīme: ${line}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShow((v) => !v);
        }}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className={`block h-2.5 w-2.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] ${TONE[toneOf(note)].dot}`}
      />
      {show ? (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1.5 block w-[min(300px,calc(100vw-48px))] whitespace-normal break-words rounded-[10px] bg-[#1c1c1e] px-2.5 py-2 text-left text-[12px] font-medium leading-snug text-white dark:bg-[#f2f2f7] dark:text-[#1c1c1e]"
        >
          <span className={note.resolved ? "line-through opacity-70" : ""}>{note.text}</span>
          {time ? <span className="mt-0.5 block text-[11px] opacity-65">{time}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
