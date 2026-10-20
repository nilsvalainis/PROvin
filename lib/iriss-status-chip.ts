/**
 * Shared IRISS / B2B demo status chips.
 * Off state stays transparent (no grey panel). On state is a subtle tint.
 * Phone row scrolls in one line; wrap is for wide toolbars and sheets.
 */

export const STATUS_CHIP_TONES = [
  "neutral",
  "active",
  "searching",
  "offered",
  "reserved",
  "completed",
  "inactive",
  "trash",
] as const;

export type StatusChipTone = (typeof STATUS_CHIP_TONES)[number];

export type StatusChipRowLayout = "scroll" | "wrap";

const CHIP_BASE =
  "iriss-status-chip inline-flex h-11 min-h-11 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold leading-none transition md:h-8 md:min-h-8 md:px-2 md:text-[12px]";

const CHIP_OFF = "border-transparent bg-transparent text-black/70 hover:bg-black/[0.04]";

const CHIP_ON: Record<StatusChipTone, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-800",
  active: "border-slate-300 bg-slate-100 text-slate-900",
  searching: "border-sky-200 bg-sky-50 text-sky-950",
  offered: "border-amber-200 bg-amber-50 text-amber-950",
  reserved: "border-violet-200 bg-violet-50 text-violet-950",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-950",
  inactive: "border-rose-200 bg-rose-50 text-rose-950",
  trash: "border-neutral-300 bg-neutral-100 text-neutral-900",
};

export function statusChipClass(on: boolean, tone: StatusChipTone): string {
  return `${CHIP_BASE} ${on ? CHIP_ON[tone] : CHIP_OFF}`;
}

export const STATUS_CHIP_COUNT_CLASS =
  "iriss-status-chip-count inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-black/[0.08] px-1 text-[10px] font-semibold leading-none tabular-nums";

export function statusChipRowClass(layout: StatusChipRowLayout): string {
  const base = "flex items-center gap-1 bg-transparent";
  if (layout === "scroll") {
    return `${base} am-chip-fade w-full max-w-full flex-nowrap overflow-x-auto overscroll-x-contain touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`;
  }
  return `${base} flex-wrap`;
}
