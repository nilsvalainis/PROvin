"use client";

/** Admin: slēpt CheckCar.vin ūdenszīmi pirms fotogrāfiju saglabāšanas. */
export function AdminPhotoWatermarkToggle({
  checked,
  onChange,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <label
      className={`inline-flex select-none items-center gap-1.5 text-[10px] font-medium text-[var(--color-provin-muted)] ${
        disabled ? "pointer-events-none opacity-45" : "cursor-pointer opacity-70 transition-opacity hover:opacity-100"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        className="h-3.5 w-3.5 shrink-0 rounded border-slate-300/80 text-[var(--color-provin-accent)] opacity-90 focus:ring-[var(--color-provin-accent)]/25"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>Slēpt ūdenszīmi</span>
    </label>
  );
}
