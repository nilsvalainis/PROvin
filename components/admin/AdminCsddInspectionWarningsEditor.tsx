"use client";

import type {
  CsddInspectionWarningRow,
  CsddInspectionWarningSeverity,
} from "@/lib/admin-source-blocks";
import { emptyCsddInspectionWarningRow } from "@/lib/admin-source-blocks";

const inp =
  "min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-[var(--color-apple-text)] placeholder:text-slate-400 focus:border-[var(--color-provin-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-provin-accent)]/25";

const SEVERITY_OPTIONS: { id: CsddInspectionWarningSeverity; label: string; swatch: string }[] = [
  { id: "gray", label: "Pelēks", swatch: "bg-slate-400" },
  { id: "yellow", label: "Dzeltenš", swatch: "bg-amber-400" },
  { id: "red", label: "Sarkans", swatch: "bg-red-500" },
];

export function adminCsddWarningPreviewClass(severity: CsddInspectionWarningSeverity): string {
  if (severity === "red") {
    return "border-l-2 border-l-red-500 bg-red-50/90 text-red-950";
  }
  if (severity === "yellow") {
    return "border-l-2 border-l-amber-500 bg-amber-50/90 text-amber-950";
  }
  return "border-l-2 border-l-slate-400 bg-slate-50/90 text-slate-800";
}

type Props = {
  value: CsddInspectionWarningRow[];
  readOnly: boolean;
  disabled?: boolean;
  onChange: (next: CsddInspectionWarningRow[]) => void;
  idPrefix: string;
};

export function AdminCsddInspectionWarningsEditor({
  value,
  readOnly,
  disabled,
  onChange,
  idPrefix,
}: Props) {
  const rows = value.length > 0 ? value : [];

  const setRow = (index: number, patch: Partial<CsddInspectionWarningRow>) => {
    const base = [...rows];
    const row = base[index] ?? emptyCsddInspectionWarningRow();
    base[index] = { ...row, ...patch };
    onChange(base);
  };

  const addRow = () => {
    onChange([...rows, emptyCsddInspectionWarningRow()]);
  };

  const removeRow = (index: number) => {
    onChange(rows.filter((_, i) => i !== index));
  };

  if (readOnly && rows.every((r) => !r.text.trim())) return null;

  return (
    <div className="mb-2 space-y-1.5">
      {rows.map((row, i) =>
        readOnly ? (
          row.text.trim() ? (
            <p
              key={i}
              className={`rounded-md px-2 py-1 text-[10px] leading-snug ${adminCsddWarningPreviewClass(row.severity)}`}
            >
              {row.text.trim()}
            </p>
          ) : null
        ) : (
          <div key={i} className="flex min-w-0 flex-wrap items-start gap-1.5">
            <div
              className="flex shrink-0 flex-col gap-0.5 rounded-md border border-slate-200 bg-white p-0.5"
              role="group"
              aria-label={`Brīdinājuma veids rinda ${i + 1}`}
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  title={opt.label}
                  disabled={disabled}
                  className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${
                    row.severity === opt.id
                      ? "bg-slate-100 text-[var(--color-apple-text)] ring-1 ring-slate-300"
                      : "text-[var(--color-provin-muted)] hover:bg-slate-50"
                  }`}
                  onClick={() => setRow(i, { severity: opt.id })}
                  aria-pressed={row.severity === opt.id}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${opt.swatch}`} aria-hidden />
                  {opt.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              className={inp}
              value={row.text}
              disabled={disabled}
              id={`${idPrefix}_warn_${i}`}
              placeholder="Brīdinājuma teksts…"
              onChange={(e) => setRow(i, { text: e.target.value })}
              aria-label={`Brīdinājums rinda ${i + 1}`}
            />
            <button
              type="button"
              className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-[var(--color-provin-muted)] hover:bg-slate-50"
              disabled={disabled}
              onClick={() => removeRow(i)}
              aria-label={`Dzēst brīdinājumu ${i + 1}`}
            >
              ✕
            </button>
          </div>
        ),
      )}
      {!readOnly ? (
        <button
          type="button"
          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-[var(--color-apple-text)] shadow-sm hover:bg-slate-50"
          onClick={addRow}
        >
          + Brīdinājums
        </button>
      ) : null}
    </div>
  );
}

export function AdminCsddInspectionWarningsDisplay({
  warnings,
}: {
  warnings: CsddInspectionWarningRow[];
}) {
  const data = warnings.filter((w) => w.text.trim());
  if (data.length === 0) return null;
  return (
    <div className="mb-2 space-y-1">
      {data.map((row, i) => (
        <p
          key={i}
          className={`rounded-md px-2 py-1 text-[10px] leading-snug ${adminCsddWarningPreviewClass(row.severity)}`}
        >
          {row.text.trim()}
        </p>
      ))}
    </div>
  );
}
