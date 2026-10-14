"use client";

export type WorkspaceRevisionConflictKind = "stale_revision" | "overwrite_blocked";

export function AdminWorkspaceRevisionConflictBanner({
  kind,
  busy,
  onReload,
  onSafeMerge,
  inline = false,
}: {
  kind: WorkspaceRevisionConflictKind;
  busy: boolean;
  onReload: () => void;
  onSafeMerge: () => void;
  /** Viena šaura rinda header joslā. */
  inline?: boolean;
}) {
  const title =
    kind === "overwrite_blocked"
      ? "Saglabāšana apturēta: šis melnraksts ir tukšāks par serverī esošo."
      : "Konflikts: cita cilne jau saglabāja jaunāku melnrakstu.";
  const hint = "Izmaiņas nav pārrakstītas.";

  if (inline) {
    return (
      <div
        className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-400/60 bg-amber-50/95 px-2 py-1 text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/50 dark:text-amber-50"
        role="alert"
      >
        <p className="min-w-0 flex-1 text-[10px] font-semibold leading-snug">
          <span className="max-md:block">{title}</span>
          <span className="hidden font-normal text-amber-900/80 max-md:inline md:ml-1 dark:text-amber-100/80">
            {hint}
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={onReload}
            className="inline-flex h-6 items-center rounded-md border border-amber-400/80 bg-white px-2 text-[9px] font-semibold text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950 dark:text-amber-50"
          >
            Pārlādēt jaunāko
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSafeMerge}
            className="inline-flex h-6 items-center rounded-md border border-amber-800/40 bg-amber-900 px-2 text-[9px] font-semibold text-white shadow-sm hover:bg-amber-800 disabled:opacity-50"
          >
            Apvienot droši
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="mx-auto mb-3 max-w-2xl rounded-lg border border-amber-400/70 bg-amber-50 px-3 py-2.5 text-amber-950"
      role="alert"
    >
      <p className="text-[12px] font-semibold leading-snug">{title}</p>
      <p className="mt-1 text-[11px] leading-snug">
        Šīs cilnes izmaiņas nav pārrakstītas. Pārlādē servera versiju vai apvieno droši (tukšais lauks neēd
        aizpildīto).
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={onReload}
          className="inline-flex h-7 items-center rounded-lg border border-amber-400/80 bg-white px-2 text-[10px] font-semibold text-amber-950 shadow-sm hover:bg-amber-100 disabled:opacity-50"
        >
          Pārlādēt jaunāko
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSafeMerge}
          className="inline-flex h-7 items-center rounded-lg border border-amber-700/40 bg-amber-900 px-2 text-[10px] font-semibold text-white shadow-sm hover:bg-amber-800 disabled:opacity-50"
        >
          Apvienot droši
        </button>
      </div>
    </div>
  );
}
