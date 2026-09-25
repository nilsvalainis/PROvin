"use client";

import { useCallback, useEffect, useState } from "react";
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
  /** compact = tikai punkti (saraksts); default = ar etiķeti (profils). */
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

  useEffect(() => {
    setColor(initialColor ?? null);
  }, [initialColor, sessionId]);

  const persist = useCallback(
    async (next: AuditResultColor | null) => {
      if (saving) return;
      const prev = color;
      setColor(next);
      onColorChange?.(next);
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

  return (
    <div
      className={`inline-flex items-center gap-1 ${compact ? "" : "gap-1.5"}`}
      role="group"
      aria-label="Audita rezultāta krāsa"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {!compact ? (
        <span className="text-[10px] font-medium text-[var(--color-provin-muted)]">Rezultāts</span>
      ) : null}
      {AUDIT_RESULT_COLORS.map((c) => {
        const selected = color === c;
        return (
          <button
            key={c}
            type="button"
            disabled={saving}
            title={AUDIT_RESULT_COLOR_LABEL_LV[c]}
            aria-label={AUDIT_RESULT_COLOR_LABEL_LV[c]}
            aria-pressed={selected}
            onClick={() => void persist(selected ? null : c)}
            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-offset-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/40 disabled:opacity-50 ${
              selected ? `ring-2 ${AUDIT_RESULT_COLOR_RING_CLASS[c]}` : "ring-1 ring-slate-200/90 hover:ring-slate-300"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${AUDIT_RESULT_COLOR_DOT_CLASS[c]}`} aria-hidden />
          </button>
        );
      })}
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
  if (!color) {
    return (
      <span
        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-slate-200 ring-1 ring-slate-300/80 ${className}`}
        title="Rezultāta krāsa nav norādīta"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${AUDIT_RESULT_COLOR_DOT_CLASS[color]} ${className}`}
      title={AUDIT_RESULT_COLOR_LABEL_LV[color]}
      aria-label={AUDIT_RESULT_COLOR_LABEL_LV[color]}
    />
  );
}
