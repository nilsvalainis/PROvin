"use client";

import { useCallback, useEffect, useRef, type MouseEvent } from "react";

const editorShellClass =
  "w-full min-h-[min(40vh,280px)] rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline";

const toolBtnClass =
  "rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-apple-text)] hover:bg-black/[0.04] dark:hover:bg-white/10";

type AdminInternalRichCommentEditorProps = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  "aria-label"?: string;
};

export function AdminInternalRichCommentEditor({
  value,
  onChange,
  className = "",
  "aria-label": ariaLabel = "Iekšējais komentārs",
}: AdminInternalRichCommentEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const syncingFromParent = useRef(false);

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
        className={editorShellClass}
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
