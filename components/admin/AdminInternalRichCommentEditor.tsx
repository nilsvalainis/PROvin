"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { Baseline, Highlighter, RemoveFormatting } from "lucide-react";
import {
  coerceAdminRichHtmlForDisplay,
  normalizeEditorRichHtmlForStorage,
  normalizePastedAdminRichHtml,
  plainTextToMinimalRichHtml,
} from "@/lib/admin-rich-comment-html";
import {
  ADMIN_RICH_COMMENT_FONT_OPTIONS,
  ADMIN_RICH_COMMENT_HIGHLIGHT_OPTIONS,
  ADMIN_RICH_COMMENT_SIZE_OPTIONS,
  ADMIN_RICH_COMMENT_TEXT_COLOR_OPTIONS,
} from "@/lib/admin-rich-comment-fonts";

/** Pievienot read-only `className`, ja HTML rāda ar `AdminRichCommentReadonly`. */
export const ADMIN_RICH_READONLY_CHILD_MARKUP =
  "[&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through [&_del]:line-through [&_span]:[font:inherit]";

const editorMarkupClass =
  "[&_b]:font-semibold [&_strong]:font-semibold [&_i]:italic [&_em]:italic [&_u]:underline [&_s]:line-through [&_strike]:line-through [&_del]:line-through";

const editorShellDefaultClass =
  `w-full min-h-[min(40vh,280px)] rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 ${editorMarkupClass}`;

const editorShellCompactClass =
  `w-full min-h-[52px] rounded-md border border-[var(--admin-field-border)] bg-[var(--admin-field-bg)] px-2 py-1.5 text-[11px] leading-snug text-[var(--admin-field-text)] focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25 ${editorMarkupClass}`;

const toolBtnBase =
  "inline-flex h-[22px] min-w-[22px] items-center justify-center rounded border px-1.5 text-[10px] font-semibold transition-colors";

const toolBtnIdle =
  "border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] text-[var(--color-apple-text)] hover:bg-black/[0.05] dark:hover:bg-white/10";

/** Aktīvs formatējums pie kursora — lai redaktors nav „akls”. */
const toolBtnActive =
  "border-[var(--color-provin-accent)] bg-[var(--color-provin-accent)]/15 text-[var(--color-provin-accent)]";

const toolSelectClass =
  "h-[22px] max-w-[7.5rem] rounded border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] px-1 text-[10px] text-[var(--color-apple-text)]";

const dividerClass = "mx-0.5 h-[18px] w-px bg-[var(--admin-border-subtle)]";

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
  /** Virsraksts tajā pašā rindā ar formatēšanu / ✨. */
  label?: ReactNode;
  /** Ģenerēt, ✨, × — rindas labajā pusē. */
  toolbarEnd?: ReactNode;
};

type ActiveMarks = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
};

const NO_MARKS: ActiveMarks = { bold: false, italic: false, underline: false, strike: false };

export function AdminInternalRichCommentEditor({
  value,
  onChange,
  className = "",
  variant = "default",
  "aria-label": ariaLabel = "Iekšējais komentārs",
  label,
  toolbarEnd,
}: AdminInternalRichCommentEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const syncingFromParent = useRef(false);
  const shellClass = variant === "compact" ? editorShellCompactClass : editorShellDefaultClass;
  const [marks, setMarks] = useState<ActiveMarks>(NO_MARKS);
  const [palette, setPalette] = useState<"text" | "highlight" | null>(null);

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
    /** Glabā vienotu HTML (span style), lai PDF nekad nesaņem `<font color>`. */
    onChange(normalizeEditorRichHtmlForStorage(el.innerHTML));
  }, [onChange]);

  const selectionInsideEditor = useCallback(() => {
    const el = ref.current;
    if (!el) return false;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    return el.contains(sel.getRangeAt(0).commonAncestorContainer);
  }, []);

  const refreshMarks = useCallback(() => {
    if (!selectionInsideEditor()) return;
    const state = (cmd: string) => {
      try {
        return document.queryCommandState(cmd);
      } catch {
        return false;
      }
    };
    setMarks({
      bold: state("bold"),
      italic: state("italic"),
      underline: state("underline"),
      strike: state("strikeThrough"),
    });
  }, [selectionInsideEditor]);

  useEffect(() => {
    const onSelectionChange = () => refreshMarks();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [refreshMarks]);

  /** Aizver krāsu paleti, klikšķinot ārpus rīkjoslas. */
  useEffect(() => {
    if (!palette) return;
    const onDocPointerDown = (e: globalThis.MouseEvent) => {
      const target = e.target as Node | null;
      if (target && (e.currentTarget as Document).contains(target)) {
        const inToolbar = (target as HTMLElement).closest?.("[data-rich-toolbar]");
        if (inToolbar) return;
      }
      setPalette(null);
    };
    document.addEventListener("mousedown", onDocPointerDown);
    return () => document.removeEventListener("mousedown", onDocPointerDown);
  }, [palette]);

  const runFormat = useCallback(
    (command: string, commandValue?: string) => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      try {
        /** Bez tā pārlūki raksta `<font color>`, ko PDF konvertācija nesaprot. */
        document.execCommand("styleWithCSS", false, "true");
      } catch {
        /* ignore */
      }
      try {
        document.execCommand(command, false, commandValue);
      } catch {
        /* ignore */
      }
      emit();
      refreshMarks();
    },
    [emit, refreshMarks],
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

  const applyTextColor = useCallback(
    (hex: string) => {
      setPalette(null);
      runFormat("foreColor", hex);
    },
    [runFormat],
  );

  const applyHighlight = useCallback(
    (hex: string) => {
      setPalette(null);
      const el = ref.current;
      if (!el) return;
      el.focus();
      try {
        document.execCommand("styleWithCSS", false, "true");
      } catch {
        /* ignore */
      }
      let ok = false;
      try {
        ok = document.execCommand("hiliteColor", false, hex);
      } catch {
        ok = false;
      }
      if (!ok) {
        try {
          ok = document.execCommand("backColor", false, hex);
        } catch {
          ok = false;
        }
      }
      if (!ok) {
        applySpanStyle({ "background-color": hex });
        return;
      }
      emit();
    },
    [applySpanStyle, emit],
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

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      /** Pārlūka noklusējums nelieto styleWithCSS — pārņemam, lai HTML paliek vienots. */
      if (key === "b" || key === "i" || key === "u") {
        e.preventDefault();
        runFormat(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
        return;
      }
      if (key === "x" && e.shiftKey) {
        e.preventDefault();
        runFormat("strikeThrough");
      }
    },
    [runFormat],
  );

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

  const markBtn = (
    active: boolean,
    label: string,
    title: string,
    command: string,
    render: React.ReactNode,
  ) => (
    <button
      key={command}
      type="button"
      aria-label={label}
      aria-pressed={active}
      className={`${toolBtnBase} ${active ? toolBtnActive : toolBtnIdle}`}
      onClick={() => runFormat(command)}
      title={title}
    >
      {render}
    </button>
  );

  return (
    <div className={className}>
      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      {label ? <div className="min-w-0 shrink-0">{label}</div> : null}
      <div
        data-rich-toolbar
        className="relative flex min-w-0 flex-1 flex-wrap items-center gap-1"
        onMouseDown={onToolbarMouseDown}
        role="toolbar"
        aria-label="Teksta formatējums"
      >
        {markBtn(marks.bold, "Treknraksts", "Treknraksts (⌘B)", "bold", <span className="font-bold">B</span>)}
        {markBtn(marks.italic, "Kursīvs", "Kursīvs (⌘I)", "italic", <span className="italic">I</span>)}
        {markBtn(marks.underline, "Pasvītrots", "Pasvītrots (⌘U)", "underline", <span className="underline">U</span>)}
        {markBtn(
          marks.strike,
          "Pārsvītrots",
          "Pārsvītrots (⌘⇧X)",
          "strikeThrough",
          <span className="line-through">S</span>,
        )}

        <span className={dividerClass} aria-hidden />

        <button
          type="button"
          aria-label="Teksta krāsa"
          aria-expanded={palette === "text"}
          className={`${toolBtnBase} ${palette === "text" ? toolBtnActive : toolBtnIdle}`}
          onClick={() => setPalette((p) => (p === "text" ? null : "text"))}
          title="Teksta krāsa"
        >
          <Baseline className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Izcelt tekstu"
          aria-expanded={palette === "highlight"}
          className={`${toolBtnBase} ${palette === "highlight" ? toolBtnActive : toolBtnIdle}`}
          onClick={() => setPalette((p) => (p === "highlight" ? null : "highlight"))}
          title="Izcelt (marķieris)"
        >
          <Highlighter className="h-3.5 w-3.5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Notīrīt formatējumu"
          className={`${toolBtnBase} ${toolBtnIdle}`}
          onClick={() => runFormat("removeFormat")}
          title="Notīrīt formatējumu"
        >
          <RemoveFormatting className="h-3.5 w-3.5" aria-hidden />
        </button>

        <span className={dividerClass} aria-hidden />

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

        {palette ? (
          <div className="absolute left-0 top-full z-30 mt-1 w-[min(19rem,90vw)] rounded-md border border-[var(--admin-border-subtle)] bg-[var(--admin-surface-elevated)] p-2 shadow-lg">
            <p className="mb-1.5 text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
              {palette === "text" ? "Teksta krāsa" : "Izcēluma krāsa"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(palette === "text"
                ? ADMIN_RICH_COMMENT_TEXT_COLOR_OPTIONS
                : ADMIN_RICH_COMMENT_HIGHLIGHT_OPTIONS
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  aria-label={c.label}
                  onClick={() =>
                    palette === "text" ? applyTextColor(c.css) : applyHighlight(c.css)
                  }
                  className="h-6 w-6 rounded border border-black/15 shadow-sm transition-transform hover:scale-110 dark:border-white/25"
                  style={
                    c.id === "none"
                      ? {
                          backgroundImage:
                            "linear-gradient(45deg, transparent 45%, #ef4444 45%, #ef4444 55%, transparent 55%)",
                          backgroundColor: "var(--admin-field-bg)",
                        }
                      : { backgroundColor: c.css }
                  }
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
      {toolbarEnd ? (
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">{toolbarEnd}</div>
      ) : null}
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
        onKeyDown={onKeyDown}
        onKeyUp={refreshMarks}
        onMouseUp={refreshMarks}
        onFocus={refreshMarks}
      />
    </div>
  );
}

export const AdminRichCommentField = AdminInternalRichCommentEditor;
