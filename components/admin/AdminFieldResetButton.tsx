"use client";

/** Mazā × poga — nodzēš komentāru, odometra / negadījuma rindu vai citu aizpildīto lauku. */
export function AdminFieldResetButton({
  onClick,
  disabled,
  title = "Nodzēst",
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-[12px] leading-none text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-red-950/50 dark:hover:text-red-300"
      title={title}
      aria-label={ariaLabel ?? title}
      onClick={onClick}
    >
      ×
    </button>
  );
}

/** Absolūtā pozīcija bagātinātā teksta / RAW ✨ joslā (pa kreisi no gramatikas pogas). */
export const ADMIN_FIELD_RESET_ABS_CLASS =
  "absolute right-8 top-2 z-[1] h-6 w-6";
