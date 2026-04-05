"use client";

const dlBtnClass =
  "rounded-md border border-slate-200/90 bg-white px-2 py-1 text-[11px] font-semibold tracking-tight text-[var(--color-apple-text)] shadow-sm transition hover:border-slate-300 hover:bg-slate-50 inline-flex items-center justify-center no-underline";

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
  onRemove: () => void;
  /** Šaurā kolonnā (augšējais 4 kolonnu režģis) */
  compact?: boolean;
};

export function AdminSavablePortfolioFileRow({
  index,
  file,
  formatBytes,
  onRemove,
  compact = false,
}: Props) {
  const addedLabel = new Date(file.addedAt).toLocaleString("lv-LV");

  return (
    <li
      className={`rounded-lg border border-slate-200/90 bg-white/90 shadow-sm ${compact ? "p-1" : "p-1.5"}`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-0.5 ${compact ? "mb-0.5 flex-col items-stretch sm:mb-1 sm:flex-row sm:items-center" : "mb-1"}`}
      >
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-provin-muted)]">
          Fails {index + 1}
        </span>
        <div className={`flex flex-wrap gap-0.5 ${compact ? "w-full justify-end sm:w-auto" : "items-center"}`}>
          <a href={file.blobUrl} download={file.name} className={dlBtnClass}>
            Lejupielādēt
          </a>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-700 hover:underline"
          >
            Noņemt
          </button>
        </div>
      </div>
      <div className="min-w-0 rounded-md border border-slate-200/70 bg-white px-2 py-1 text-[11px]">
        <span className="break-all leading-snug text-[var(--color-apple-text)]">{file.name}</span>
        <p className="mt-0.5 text-[10px] leading-tight text-[var(--color-provin-muted)]">
          {formatBytes(file.size)} · {addedLabel}
        </p>
      </div>
    </li>
  );
}
