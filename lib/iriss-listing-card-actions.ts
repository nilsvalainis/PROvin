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

/**
 * Nils/audits 07.11: Radaram (iekšējs salona monitorings) nav klienta.
 * Radara kontekstā kartīte nerāda «Pasūtījuma detaļas»; tā vietā - «Meklējuma detaļas» un «Pievienot salonam».
 */
export const IRISS_LISTING_CARD_ACTION_SEARCH = "Meklējuma detaļas" as const;
export const IRISS_LISTING_CARD_ACTION_SALON = "Pievienot salonam" as const;

export type IrissListingCardContext = "order" | "radar" | "none";

/** Konteksts pēc piesaistītajiem ierakstiem: tikai Radari (`scan:`) -> radar; ir klienta pasūtījums -> order. */
export function irissListingCardContext(linkedIds: readonly string[]): IrissListingCardContext {
  if (linkedIds.length === 0) return "none";
  return linkedIds.every((id) => id.startsWith("scan:")) ? "radar" : "order";
}

export function irissListingCardDetailsLabel(ctx: IrissListingCardContext): string {
  return ctx === "radar" ? IRISS_LISTING_CARD_ACTION_SEARCH : IRISS_LISTING_CARD_ACTION_ORDER;
}

/** Nils 14.11: Radaram nav klienta - sānu panelī bez «Klients»/«Klienta budžets» tekstiem. */
export function irissListingLinkedSectionTitle(ctx: IrissListingCardContext): string {
  return ctx === "radar" ? "Radara meklējums" : "Klients un pasūtījums";
}

export function irissListingBudgetLabel(ctx: IrissListingCardContext): string {
  return ctx === "radar" ? "Meklējuma cenas robeža" : "Klienta budžets";
}

const LOGISTICS_AUCTION_BY_PLATFORM: Record<string, string> = {
  autobid: "Autobid",
  auto1: "Auto1",
  openline: "Openlane",
};

/**
 * «Pievienot salonam»: atver Loģistikas «Nopirkts · jauns ieraksts» ar aizpildītiem laukiem.
 * Ieraksts netiek veidots, kamēr operators Loģistikā nenospiež «Saglabāt ierakstu».
 */
export function irissListingSalonHref(v: {
  platform: string;
  detailUrl: string;
  manufacturer?: string;
  title?: string;
  mileageKm?: number | null;
  vin?: string;
}): string {
  const p = new URLSearchParams();
  p.set("nopirkts", "1");
  const auction = LOGISTICS_AUCTION_BY_PLATFORM[v.platform];
  const marketplace = v.platform === "mobilede" || v.platform === "autoscout24";
  p.set("avots", marketplace ? "private" : "auction");
  if (!marketplace) p.set("izsole", auction ?? "cits");
  if (v.detailUrl.trim()) p.set("saite", v.detailUrl.trim());
  const make = (v.manufacturer ?? "").trim();
  const title = (v.title ?? "").trim();
  if (make) p.set("marka", make);
  const model = make && title.toLowerCase().startsWith(make.toLowerCase()) ? title.slice(make.length).trim() : title;
  if (model) p.set("modelis", model.slice(0, 80));
  if (typeof v.mileageKm === "number" && v.mileageKm > 0) p.set("km", String(Math.round(v.mileageKm)));
  const vin = (v.vin ?? "").trim().toUpperCase();
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) p.set("vin", vin);
  return `/admin/iriss/logistika?${p.toString()}`;
}

export type IrissLogistikaPurchasePrefill = {
  source: "auction" | "private";
  auction: string;
  link: string;
  make: string;
  model: string;
  km: string;
  vin: string;
};

/** Loģistikas puse: nolasa `irissListingSalonHref` parametrus (tikai drošas vērtības). */
export function irissLogistikaPurchasePrefill(params: { get(name: string): string | null }): IrissLogistikaPurchasePrefill | null {
  if (params.get("nopirkts") !== "1") return null;
  const get = (k: string, max: number) => (params.get(k) ?? "").trim().slice(0, max);
  const link = get("saite", 2048);
  const km = get("km", 9).replace(/[^\d]/g, "");
  const vin = get("vin", 17).toUpperCase();
  return {
    source: get("avots", 10) === "private" ? "private" : "auction",
    auction: get("izsole", 20) || "cits",
    link: /^https?:\/\//i.test(link) ? link : "",
    make: get("marka", 60),
    model: get("modelis", 80),
    km,
    vin: /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : "",
  };
}
