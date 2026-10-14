"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import HardBreak from "@tiptap/extension-hard-break";
import {
  adminTiptapHtmlToStorage,
  storageToAdminTiptapHtml,
} from "@/lib/admin-tiptap/storage-format";
import { normalizePastedAdminRichHtml } from "@/lib/admin-tiptap/paste";
import { injectPlaceholderChipsHtml } from "@/lib/admin-tiptap/placeholders";

export type AdminProvinTiptapEditorHandle = {
  insertAtCursor: (snippet: string) => void;
};

export type AdminProvinTiptapEditorProps = {
  value: string;
  onChange: (next: string) => void;
  mode: "plain" | "rich";
  enableHeadings?: boolean;
  className?: string;
  editorClassName?: string;
  placeholder?: string;
  /** `templates` — /admin/teksti; `field` — bloga un citi admin lauki. */
  variant?: "templates" | "field";
  "aria-label"?: string;
};

const toolBtn =
  "rounded-md border border-[#d2d2d7] bg-white px-2 py-1 text-[12px] font-medium text-[#3a3a3c] hover:bg-[#f5f5f7] disabled:opacity-40";
const toolBtnActive = "border-[#0a84ff] bg-[#eef4ff] text-[#0a66d8]";

export const AdminProvinTiptapEditor = forwardRef(function AdminProvinTiptapEditor(
  {
  value,
  onChange,
  mode,
  enableHeadings = true,
  className = "",
  editorClassName = "",
  placeholder = "Teksts…",
  variant = "templates",
  "aria-label": ariaLabel = "Teksta redaktors",
}: AdminProvinTiptapEditorProps,
  ref: React.Ref<AdminProvinTiptapEditorHandle | null>,
) {
  const syncing = useRef(false);
  const lastEmitted = useRef(value);

  const emit = useCallback(
    (html: string) => {
      const stored = adminTiptapHtmlToStorage(html, mode);
      if (stored === lastEmitted.current) return;
      lastEmitted.current = stored;
      onChange(stored);
    },
    [mode, onChange],
  );

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          heading: enableHeadings && mode === "rich" ? { levels: [2, 3] } : false,
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          strike: false,
          bulletList: mode === "rich" ? {} : false,
          orderedList: mode === "rich" ? {} : false,
          bold: mode === "rich" ? {} : false,
          italic: mode === "rich" ? {} : false,
        }),
        HardBreak,
        Link.configure({
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        }),
        Placeholder.configure({ placeholder }),
      ],
      editorProps: {
        attributes: {
          class: [
            "prose prose-sm max-w-none focus:outline-none min-h-[12rem] text-[14px] leading-relaxed text-[#1d1d1f]",
            "[&_.provin-template-chip]:inline-flex [&_.provin-template-chip]:items-center [&_.provin-template-chip]:rounded-full [&_.provin-template-chip]:border [&_.provin-template-chip]:border-[#0a84ff]/40 [&_.provin-template-chip]:bg-[#eef4ff] [&_.provin-template-chip]:px-2 [&_.provin-template-chip]:py-0.5 [&_.provin-template-chip]:text-[12px] [&_.provin-template-chip]:font-medium [&_.provin-template-chip]:text-[#0a66d8]",
            editorClassName,
          ]
            .filter(Boolean)
            .join(" "),
          "aria-label": ariaLabel,
        },
        transformPastedHTML(html) {
          return normalizePastedAdminRichHtml(html, mode);
        },
      },
      content: storageToAdminTiptapHtml(value),
      onUpdate({ editor: ed }) {
        if (syncing.current) return;
        emit(ed.getHTML());
      },
    },
    [enableHeadings, mode],
  );

  useEffect(() => {
    if (!editor) return;
    const stored = value ?? "";
    if (stored === lastEmitted.current) return;
    lastEmitted.current = stored;
    syncing.current = true;
    editor.commands.setContent(storageToAdminTiptapHtml(stored), { emitUpdate: false });
    syncing.current = false;
  }, [editor, value]);

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Saite (URL)", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor(snippet: string) {
        if (!editor) return;
        const chip = injectPlaceholderChipsHtml(snippet);
        if (mode === "rich" && snippet.includes("{{")) {
          editor.chain().focus().insertContent(chip).run();
        } else {
          editor.chain().focus().insertContent(snippet).run();
        }
      },
    }),
    [editor, mode],
  );

  if (!editor) return null;

  const rich = mode === "rich";

  return (
    <div className={className}>
      {rich ? (
        <div className="mb-2 flex flex-wrap gap-1">
          <button
            type="button"
            className={`${toolBtn} ${editor.isActive("bold") ? toolBtnActive : ""}`}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            B
          </button>
          <button
            type="button"
            className={`${toolBtn} ${editor.isActive("italic") ? toolBtnActive : ""}`}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            I
          </button>
          {enableHeadings ? (
            <>
              <button
                type="button"
                className={`${toolBtn} ${editor.isActive("heading", { level: 2 }) ? toolBtnActive : ""}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                H2
              </button>
              <button
                type="button"
                className={`${toolBtn} ${editor.isActive("heading", { level: 3 }) ? toolBtnActive : ""}`}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                H3
              </button>
            </>
          ) : null}
          <button
            type="button"
            className={`${toolBtn} ${editor.isActive("bulletList") ? toolBtnActive : ""}`}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            •
          </button>
          <button
            type="button"
            className={`${toolBtn} ${editor.isActive("orderedList") ? toolBtnActive : ""}`}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            1.
          </button>
          <button
            type="button"
            className={`${toolBtn} ${editor.isActive("link") ? toolBtnActive : ""}`}
            onClick={setLink}
          >
            Saite
          </button>
        </div>
      ) : null}
      <div
        className={
          variant === "field"
            ? "rounded-lg border border-slate-200 bg-white px-3 py-2 focus-within:border-[var(--color-provin-accent)] focus-within:ring-1 focus-within:ring-[var(--color-provin-accent)]/25"
            : "rounded-[10px] border border-[#0a84ff] bg-white px-3 py-3 shadow-[0_0_0_4px_rgba(10,132,255,0.1)]"
        }
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});
