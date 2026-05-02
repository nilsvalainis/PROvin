"use client";

import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { coerceAdminRichHtmlForDisplay } from "@/lib/admin-rich-comment-html";

/** Pievienot read-only `className`, ja HTML rāda ar `AdminRichCommentReadonly`. */
export const ADMIN_RICH_READONLY_CHILD_MARKUP =
  "[&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline [&_span]:[font:inherit]";

const editorShellDefaultClass =
  "w-full min-h-[min(40vh,280px)] rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline";

const editorShellCompactClass =
  "w-full min-h-[52px] rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline";

const toolBtnClass =
  "rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-apple-text)] hover:bg-black/[0.04] dark:hover:bg-white/10";

export function AdminRichCommentReadonly({
  html,
  className,
  variant = "card",
}: {
  html: string;
  className?: string;
  /** `inline` — bez apmales / fona; ietvēruma kaste dod ārējais konteiners. */
  variant?: "card" | "inline";
}) {
  const t = html.trim();
  if (!t) return <span className="text-slate-400">—</span>;
  const safe = coerceAdminRichHtmlForDisplay(html);
  if (variant === "inline") {
    return (
      <div
        className={[`min-h-[1em] w-full whitespace-pre-wrap leading-snug`, ADMIN_RICH_READONLY_CHILD_MARKUP, className]
          .filter(Boolean)
          .join(" ")}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }
  if (className?.trim()) {
    return (
      <div
        className={`${className} ${ADMIN_RICH_READONLY_CHILD_MARKUP}`}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    );
  }
  return (
    <div
      className={`min-h-[40px] w-full whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-2 py-1.5 text-[11px] text-[var(--color-provin-muted)] ${ADMIN_RICH_READONLY_CHILD_MARKUP}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

type AdminInternalRichCommentEditorProps = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  variant?: "default" | "compact";
  "aria-label"?: string;
};

export function AdminInternalRichCommentEditor({
  value,
  onChange,
  className = "",
  variant = "default",
  "aria-label": ariaLabel = "Iekšējais komentārs",
}: AdminInternalRichCommentEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const syncingFromParent = useRef(false);
  const shellClass = variant === "compact" ? editorShellCompactClass : editorShellDefaultClass;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (syncingFromParent.current) {
      syncingFromParent.current = false;
      return;
    }
    if (document.activeElement === el) return;
    const next = value || "";
    if (el.innerHTML !== next) {
      el.innerHTML = next;
    }
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    syncingFromParent.current = true;
    onChange(el.innerHTML);
  }, [onChange]);

  const runFormat = useCallback(
    (command: string, commandValue?: string) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      try {
        document.execCommand(command, false, commandValue);
      } catch {
        /* ignore */
      }
      emit();
    },
    [emit],
  );

  const onToolbarMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className={className}>
      <div
        className="mb-1.5 flex flex-wrap items-center gap-1"
        onMouseDown={onToolbarMouseDown}
        role="toolbar"
        aria-label="Teksta formatējums"
      >
        <button type="button" className={toolBtnClass} onClick={() => runFormat("bold")} title="Treknraksts">
          <span className="font-bold">B</span>
        </button>
        <button type="button" className={toolBtnClass} onClick={() => runFormat("italic")} title="Kursīvs">
          <span className="italic">I</span>
        </button>
        <button type="button" className={toolBtnClass} onClick={() => runFormat("underline")} title="Pasvītrots">
          <span className="underline">U</span>
        </button>
        <button
          type="button"
          className={toolBtnClass}
          onClick={() => runFormat("foreColor", "#ef4444")}
          title="Sarkans teksts"
        >
          <span className="font-semibold text-red-500">A</span>
        </button>
        <button
          type="button"
          className={toolBtnClass}
          onClick={() => runFormat("foreColor", "#22c55e")}
          title="Zaļš teksts"
        >
          <span className="font-semibold text-green-500">A</span>
        </button>
      </div>
      <div
        ref={ref}
        className={shellClass}
        contentEditable
        suppressContentEditableWarning
        aria-label={ariaLabel}
        aria-multiline
        role="textbox"
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
}

export const AdminRichCommentField = AdminInternalRichCommentEditor;
