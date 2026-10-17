"use client";

import {
  SHARED_SOURCE_COMMENT_TEMPLATES,
  applySourceCommentTemplate,
  type SourceCommentTemplate,
} from "@/lib/admin-source-comment-presets";

export function AdminSourceCommentTemplates({
  value,
  onChange,
  extra,
}: {
  value: string;
  onChange: (next: string) => void;
  extra?: SourceCommentTemplate[];
}) {
  const templates = [...SHARED_SOURCE_COMMENT_TEMPLATES, ...(extra ?? [])];
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1">
      <span className="text-[9px] font-medium uppercase tracking-wide text-[var(--color-provin-muted)]">
        Šabloni
      </span>
      {templates.map((template) => (
        <button
          key={template.id}
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-provin-muted)] hover:border-[var(--color-provin-accent)]/40 hover:bg-slate-50"
          title={template.text}
          onClick={() => onChange(applySourceCommentTemplate(value, template.text))}
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}
