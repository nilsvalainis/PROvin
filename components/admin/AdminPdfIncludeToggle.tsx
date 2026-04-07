"use client";

/** Admin: vai sadaļa iekļauta klienta PDF (noklusējums — ieslēgts). */
export function AdminPdfIncludeToggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[10px] font-medium text-[var(--color-provin-muted)]">
      <input
        id={id}
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300 text-[var(--color-provin-accent)] focus:ring-[var(--color-provin-accent)]/25"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>Rādīt laukus</span>
    </label>
  );
}
