"use client";

import { useEffect, useState } from "react";

const toolbarBtn =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50";

export type PortfolioFileUi = {
  id: string;
  name: string;
  size: number;
  mime: string;
  addedAt: string;
  blobUrl: string;
};

type Props = {
  index: number;
  file: PortfolioFileUi;
  formatBytes: (n: number) => string;
  /** Saglabā visu portfeli IndexedDB (šī rinda iesaista kopējo persist) */
  onPersistAll: () => void | Promise<void>;
  onRemove: () => void;
  resetVersion?: number | string;
};

export function AdminSavablePortfolioFileRow({
  index,
  file,
  formatBytes,
  onPersistAll,
  onRemove,
  resetVersion,
}: Props) {
  const [viewMode, setViewMode] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    setViewMode(false);
  }, [resetVersion]);

  const save = async () => {
    await onPersistAll();
    setViewMode(true);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 2000);
  };

  /** Skats ↔ paplašināta rediģēšana (lejupielāde / noņemšana), kā pielikumu rindās */
  const labot = () => {
    setViewMode((v) => !v);
  };

  const addedLabel = new Date(file.addedAt).toLocaleString("lv-LV");

  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          Fails {index + 1}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          {flash ? (
            <span className="text-[11px] font-semibold text-emerald-700" role="status">
              Saglabāts
            </span>
          ) : null}
          <button type="button" className={toolbarBtn} onClick={() => void save()}>
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
            Noņemt
          </button>
        </div>
      </div>
      {viewMode ? (
        <div className="space-y-2 rounded-lg border border-slate-200/80 bg-white px-2.5 py-2 text-sm">
          <div>
            <span className="text-[10px] font-medium uppercase text-[var(--color-provin-muted)]">Nosaukums</span>
            <p className="mt-0.5 break-all font-medium text-[var(--color-apple-text)]">{file.name}</p>
          </div>
          <div>
            <span className="text-[10px] font-medium uppercase text-[var(--color-provin-muted)]">Izmērs · pievienots</span>
            <p className="mt-0.5 text-xs text-[var(--color-provin-muted)]">
              {formatBytes(file.size)} · {addedLabel}
            </p>
          </div>
          <a
            href={file.blobUrl}
            download={file.name}
            className="inline-block text-xs font-semibold text-[var(--color-provin-accent)] hover:underline"
          >
            Lejupielādēt
          </a>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/60 bg-white/80 px-2.5 py-2 text-sm">
          <div className="min-w-0 flex-1">
            <span className="break-all text-[var(--color-apple-text)]">{file.name}</span>
            <p className="mt-0.5 text-xs text-[var(--color-provin-muted)]">
              {formatBytes(file.size)} · {addedLabel}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              href={file.blobUrl}
              download={file.name}
              className="text-xs font-semibold text-[var(--color-provin-accent)] hover:underline"
            >
              Lejupielādēt
            </a>
          </div>
        </div>
      )}
    </li>
  );
}
