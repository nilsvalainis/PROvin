/** PRO pasūtījuma labās malas josla — variants 1 (uzraksts zem ikonas). */

export const ADMIN_RAIL_V1_ASIDE =
  "pointer-events-none fixed right-1.5 top-28 z-30 hidden w-[3.25rem] flex-col lg:flex";

export const ADMIN_RAIL_V1_BOX =
  "provin-rail-v1-box pointer-events-auto flex flex-col gap-1 bg-white/[0.08] p-1 shadow-none backdrop-blur-[8px] dark:bg-zinc-900/[0.08]";

export const ADMIN_RAIL_V1_ITEM =
  "group flex min-h-[30px] min-w-[30px] flex-col items-center gap-0.5 border-0 bg-transparent p-0.5 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-provin-accent)]/35 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-35";

export const ADMIN_RAIL_V1_ITEM_BTN =
  `${ADMIN_RAIL_V1_ITEM} cursor-pointer`;

export const ADMIN_RAIL_V1_GLYPH =
  "provin-rail-v1-glyph flex h-7 w-7 shrink-0 items-center justify-center";

export const ADMIN_RAIL_V1_GLYPH_INNER =
  "block h-5 w-5 max-h-5 max-w-5 shrink-0 object-contain";

export const ADMIN_RAIL_V1_LABEL =
  "max-w-[3rem] text-center text-[7px] font-bold leading-tight tracking-wide text-slate-600 dark:text-slate-400";
