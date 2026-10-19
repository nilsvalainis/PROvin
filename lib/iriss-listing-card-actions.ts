/** LIST kartītes darbības: viena rinda, vienāds augstums, neitrālas ikonas. */

export const IRISS_LISTING_CARD_ACTION_ORDER = "Pasūtījums" as const;
export const IRISS_LISTING_CARD_ACTION_RADAR = "Pievienot radaram" as const;
export const IRISS_LISTING_CARD_ACTION_OFFER = "Piedāvājums" as const;
export const IRISS_LISTING_CARD_ACTION_ORDER_MENU = "Izveidot pasūtījumu" as const;

/** Trīs darbības paliek vienā rindā arī ~400px; teksts var iet uz otru rindu pogas iekšā. */
export const IRISS_LISTING_CARD_ACTIONS_ROW_CLASS =
  "flex w-full min-w-0 flex-nowrap items-stretch gap-1";

export const IRISS_LISTING_CARD_ACTION_BTN_CLASS =
  "inline-flex h-11 min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg border border-slate-200 bg-white px-0.5 text-center text-[10px] font-semibold leading-tight text-slate-600 hover:bg-slate-50 disabled:opacity-50";

export const IRISS_LISTING_CARD_ACTION_ICON_CLASS = "h-3.5 w-3.5 text-slate-500";

export const IRISS_LISTING_CARD_ACTION_MENU_BTN_CLASS =
  "inline-flex h-11 min-h-11 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50";
