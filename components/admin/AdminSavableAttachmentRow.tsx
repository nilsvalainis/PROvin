"use client";

import { useEffect, useRef, useState } from "react";

const toolbarBtn =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

type Row = { label: string; fileName: string };

type Props = {
  index: number;
  row: Row;
  onChangeRow: (next: Row) => void;
  onRemove: () => void;
  resetVersion?: number | string;
};

export function AdminSavableAttachmentRow({ index, row, onChangeRow, onRemove, resetVersion }: Props) {
  const [viewMode, setViewMode] = useState(false);
  const [flash, setFlash] = useState(false);
  const snapshotRef = useRef<Row>({ ...row });

  useEffect(() => {
    snapshotRef.current = { ...row };
    setViewMode(false);
  }, [resetVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    snapshotRef.current = { ...row };
    setViewMode(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 2000);
  };

  const labot = () => {
    if (viewMode) {
      setViewMode(false);
    } else {
      onChangeRow({ ...snapshotRef.current });
    }
  };

  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          Rinda {index + 1}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {flash ? <span className="text-[11px] font-semibold text-emerald-700">Saglabāts</span> : null}
          <button type="button" className={toolbarBtn} onClick={save}>
            Saglabāt
          </button>
          <button type="button" className={toolbarBtn} onClick={labot}>
            Labot
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-700 hover:underline"
          >
            Dzēst
          </button>
        </div>
      </div>
      {viewMode ? (
        <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-sm">
          <div>
            <span className="text-[10px] font-medium uppercase text-[var(--color-provin-muted)]">Apraksts</span>
            <p className="mt-0.5 whitespace-pre-wrap text-[var(--color-apple-text)]">{row.label || "—"}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase text-[var(--color-provin-muted)]">Fails</span>
            <p className="mt-0.5 font-mono text-xs text-[var(--color-apple-text)]">{row.fileName || "—"}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-[var(--color-apple-text)]"
            value={row.label}
            onChange={(e) => onChangeRow({ ...row, label: e.target.value })}
            placeholder="Apraksts / avots"
            aria-label={`Pielikuma apraksts ${index + 1}`}
          />
          <input
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-[var(--color-apple-text)]"
            value={row.fileName}
            onChange={(e) => onChangeRow({ ...row, fileName: e.target.value })}
            placeholder="faila_nosaukums.pdf"
            aria-label={`Faila nosaukums ${index + 1}`}
          />
        </div>
      )}
    </li>
  );
}
