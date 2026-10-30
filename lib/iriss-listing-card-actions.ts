/** LIST kartītes darbības: viena rinda, vienāds augstums, neitrālas ikonas. */

export const IRISS_LISTING_CARD_ACTION_ORDER = "Pasūtījuma detaļas" as const;
/** Paliek kā palīga etiķete; kartītē pogu nerāda. */
export const IRISS_LISTING_CARD_ACTION_RADAR = "Pievienot radaram" as const;
/** Nils 29.10: veido piedāvājumu Piedāvājumu sadaļā (agrāk «Nosūtīt klientam» veidoja jaunu pasūtījumu). */
export const IRISS_LISTING_CARD_ACTION_OFFER = "Izveidot piedāvājumu" as const;
export const IRISS_LISTING_CARD_ACTION_ORDER_MENU = "Izveidot radaru" as const;

/** Darbības paliek vienā rindā arī ~400px; teksts var iet uz otru rindu pogas iekšā. */
export const IRISS_LISTING_CARD_ACTIONS_ROW_CLASS =
  "flex w-full min-w-0 flex-nowrap items-stretch gap-1 sm:gap-2";

export const IRISS_LISTING_CARD_ACTION_BTN_CLASS =
  "inline-flex h-11 min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[12px] bg-white px-0.5 text-center text-[10px] font-semibold leading-tight text-[var(--iriss-ink)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)] hover:bg-[var(--iriss-surface-2)] disabled:opacity-50 sm:h-9 sm:min-h-9 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-[13px]";

export const IRISS_LISTING_CARD_ACTION_ICON_CLASS = "h-3.5 w-3.5 text-slate-500";

export const IRISS_LISTING_CARD_ACTION_MENU_BTN_CLASS =
  "inline-flex h-11 min-h-11 w-9 shrink-0 items-center justify-center rounded-[12px] bg-white text-[var(--iriss-ink-2)] shadow-[inset_0_0_0_1px_var(--iriss-line-strong)] hover:bg-[var(--iriss-surface-2)] disabled:opacity-50 sm:h-9 sm:min-h-9 sm:w-10";
