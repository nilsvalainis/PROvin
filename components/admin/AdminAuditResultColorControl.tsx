"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AUDIT_RESULT_COLORS,
  AUDIT_RESULT_COLOR_DOT_CLASS,
  AUDIT_RESULT_COLOR_LABEL_LV,
  AUDIT_RESULT_COLOR_RING_CLASS,
  type AuditResultColor,
} from "@/lib/admin-audit-result-color";

type Props = {
  sessionId: string;
  initialColor?: AuditResultColor | null;
  /** compact = bez „Rezultāts” etiķetes (saraksts). */
  compact?: boolean;
  onColorChange?: (color: AuditResultColor | null) => void;
};

export function AdminAuditResultColorControl({
  sessionId,
  initialColor = null,
  compact = false,
  onColorChange,
}: Props) {
  const [color, setColor] = useState<AuditResultColor | null>(initialColor);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setColor(initialColor ?? null);
  }, [initialColor, sessionId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
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

  const persist = useCallback(
    async (next: AuditResultColor | null) => {
      if (saving) return;
      const prev = color;
      setColor(next);
      onColorChange?.(next);
      setOpen(false);
      setSaving(true);
      try {
        const res = await fetch("/api/admin/audit-result-color", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, color: next }),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
        if (!res.ok) {
          setColor(prev);
          onColorChange?.(prev);
          window.alert(
            (typeof data.message === "string" && data.message) ||
              (typeof data.error === "string" && data.error) ||
              "Neizdevās saglabāt audita krāsu.",
          );
        }
      } catch {
        setColor(prev);
        onColorChange?.(prev);
        window.alert("Tīkla kļūda — audita krāsa netika saglabāta.");
      } finally {
        setSaving(false);
      }
    },
    [color, onColorChange, saving, sessionId],
  );

  const triggerTitle = color
    ? `${AUDIT_RESULT_COLOR_LABEL_LV[color]} - mainīt`
    : "Norādīt audita rezultāta krāsu";

  return (
    <div
      ref={rootRef}
      className={`relative inline-flex items-center ${compact ? "" : "gap-1.5"}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {!compact ? (
        <span className="text-[10px] font-medium text-[var(--color-provin-muted)]">Rezultāts</span>
      ) : null}
      <button
        type="button"
        disabled={saving}
        title={triggerTitle}
        aria-label={triggerTitle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/40 disabled:opacity-50 ${
          color
            ? `ring-1 ring-offset-0 ${AUDIT_RESULT_COLOR_RING_CLASS[color]}/40`
            : "ring-1 ring-dashed ring-slate-300/90 hover:ring-slate-400"
        }`}
      >
        {color ? (
          <span className={`h-2.5 w-2.5 rounded-full ${AUDIT_RESULT_COLOR_DOT_CLASS[color]}`} aria-hidden />
        ) : (
          <span className="h-2 w-2 rounded-full border border-dashed border-slate-300" aria-hidden />
        )}
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Audita rezultāta krāsa"
          className="absolute left-0 top-full z-50 mt-1 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5 shadow-[0_8px_24px_rgba(15,23,42,0.12)]"
        >
          {AUDIT_RESULT_COLORS.map((c) => {
            const selected = color === c;
            return (
              <button
                key={c}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                disabled={saving}
                title={AUDIT_RESULT_COLOR_LABEL_LV[c]}
                aria-label={AUDIT_RESULT_COLOR_LABEL_LV[c]}
                onClick={() => void persist(c)}
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/40 disabled:opacity-50 ${
                  selected
                    ? `ring-2 ${AUDIT_RESULT_COLOR_RING_CLASS[c]}`
                    : "ring-1 ring-slate-200/90 hover:bg-slate-50 hover:ring-slate-300"
                }`}
              >
                <span className={`h-3 w-3 rounded-full ${AUDIT_RESULT_COLOR_DOT_CLASS[c]}`} aria-hidden />
              </button>
            );
          })}
          {color ? (
            <button
              type="button"
              role="menuitem"
              disabled={saving}
              title="Noņemt krāsu"
              aria-label="Noņemt krāsu"
              onClick={() => void persist(null)}
              className="ml-0.5 rounded px-1.5 py-0.5 text-[9px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-50"
            >
              Noņemt
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Tikai indikators (bez klikšķa) — kad krāsa jau zināma no props. */
export function AdminAuditResultColorDot({
  color,
  className = "",
}: {
  color: AuditResultColor | null | undefined;
  className?: string;
}) {
  if (!color) return null;
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${AUDIT_RESULT_COLOR_DOT_CLASS[color]} ${className}`}
      title={AUDIT_RESULT_COLOR_LABEL_LV[color]}
      aria-label={AUDIT_RESULT_COLOR_LABEL_LV[color]}
    />
  );
}
