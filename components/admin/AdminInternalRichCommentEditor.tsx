"use client";

import { useCallback, useEffect, useRef, type ChangeEvent, type ClipboardEvent, type MouseEvent } from "react";
import {
  coerceAdminRichHtmlForDisplay,
  normalizePastedAdminRichHtml,
  plainTextToMinimalRichHtml,
} from "@/lib/admin-rich-comment-html";
import {
  ADMIN_RICH_COMMENT_FONT_OPTIONS,
  ADMIN_RICH_COMMENT_SIZE_OPTIONS,
} from "@/lib/admin-rich-comment-fonts";

/** Pievienot read-only `className`, ja HTML rāda ar `AdminRichCommentReadonly`. */
export const ADMIN_RICH_READONLY_CHILD_MARKUP =
  "[&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline [&_span]:[font:inherit]";

const editorShellDefaultClass =
  "w-full min-h-[min(40vh,280px)] rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline";

const editorShellCompactClass =
  "w-full min-h-[52px] rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 [&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline";

const toolBtnClass =
  "rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-apple-text)] hover:bg-black/[0.04] dark:hover:bg-white/10";

const toolSelectClass =
  "max-w-[7.5rem] rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1 py-0.5 text-[10px] text-[var(--color-apple-text)]";

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
  const t = (typeof html === "string" ? html : "").trim();
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

  const applySpanStyle = useCallback(
    (style: Record<string, string>) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const styleStr = Object.entries(style)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `${k}:${v}`)
        .join(";");
      if (!styleStr) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed) {
        try {
          document.execCommand(
            "insertHTML",
            false,
            `<span style="${styleStr}">&#8203;</span>`,
          );
        } catch {
          /* ignore */
        }
      } else {
        const contents = range.extractContents();
        const span = document.createElement("span");
        span.setAttribute("style", styleStr);
        span.appendChild(contents);
        range.insertNode(span);
        sel.removeAllRanges();
        const after = document.createRange();
        after.selectNodeContents(span);
        after.collapse(false);
        sel.addRange(after);
      }
      emit();
    },
    [emit],
  );

  const onFontChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const opt = ADMIN_RICH_COMMENT_FONT_OPTIONS.find((f) => f.id === e.target.value);
      e.target.value = "default";
      if (!opt || !opt.css) return;
      applySpanStyle({ "font-family": opt.css });
    },
    [applySpanStyle],
  );

  const onSizeChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const opt = ADMIN_RICH_COMMENT_SIZE_OPTIONS.find((s) => s.id === e.target.value);
      e.target.value = "";
      if (!opt) return;
      applySpanStyle({ "font-size": opt.css });
    },
    [applySpanStyle],
  );

  const onToolbarMouseDown = useCallback((e: MouseEvent) => {
    e.preventDefault();
  }, []);

  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      el.focus();
      const html = e.clipboardData.getData("text/html");
      const plain = e.clipboardData.getData("text/plain");
      const toInsert = html.trim()
        ? normalizePastedAdminRichHtml(html)
        : plainTextToMinimalRichHtml(plain);
      if (!toInsert) return;
      try {
        document.execCommand("insertHTML", false, toInsert);
      } catch {
        document.execCommand("insertText", false, plain);
      }
      emit();
    },
    [emit],
  );

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
        <select
          className={toolSelectClass}
          defaultValue="default"
          onChange={onFontChange}
          title="Fonts"
          aria-label="Fonts"
        >
          {ADMIN_RICH_COMMENT_FONT_OPTIONS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
        <select
          className={toolSelectClass}
          defaultValue=""
          onChange={onSizeChange}
          title="Izmērs"
          aria-label="Burtu izmērs"
        >
          <option value="" disabled>
            Izm.
          </option>
          {ADMIN_RICH_COMMENT_SIZE_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}px
            </option>
          ))}
        </select>
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
        onPaste={onPaste}
      />
    </div>
  );
}

export const AdminRichCommentField = AdminInternalRichCommentEditor;
