"use client";

export type WorkspaceRevisionConflictKind = "stale_revision" | "overwrite_blocked";

export function AdminWorkspaceRevisionConflictBanner({
  kind,
  busy,
  onReload,
  onSafeMerge,
}: {
  kind: WorkspaceRevisionConflictKind;
  busy: boolean;
  onReload: () => void;
  onSafeMerge: () => void;
}) {
  const title =
    kind === "overwrite_blocked"
      ? "Saglabāšana apturēta: šis melnraksts ir tukšāks par serverī esošo."
      : "Konflikts: cita cilne jau saglabāja jaunāku melnrakstu.";
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
