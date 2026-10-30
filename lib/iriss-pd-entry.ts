/**
 * Viena piedāvājuma ieeja (Nils 27.10): visas pogas «Izveidot piedāvājumu» ved uz PD
 * `/admin/iriss/piedavajumi/jauns` ar jau izvēlētu avotu. Tīra loģika (bez servera atkarībām).
 */

export const IRISS_PD_NEW_PATH = "/admin/iriss/piedavajumi/jauns";

export type IrissPdEntryTab = "link" | "autoparks" | "logistics" | "empty";

export const IRISS_PD_ENTRY_TAB_LV: Record<IrissPdEntryTab, string> = {
  link: "Saite",
  autoparks: "Autoparks",
  logistics: "Loģistika",
  empty: "Tukšs",
};

export type IrissPdEntry = {
  tab: IrissPdEntryTab;
  /** Autoparka vai Loģistikas auto id (no `from=autoparks:ID` / `from=logistics:ID`). */
  carId: string;
  link: string;
  orderId: string;
};

const SAFE_ID = /^[\w-]{1,80}$/;

export function irissPdNewHref(opts: { from?: "autoparks" | "logistics"; id?: string; link?: string; orderId?: string } = {}): string {
  const q = new URLSearchParams();
  if (opts.from && opts.id) q.set("from", `${opts.from}:${opts.id}`);
  if (opts.link?.trim()) q.set("link", opts.link.trim());
  if (opts.orderId) q.set("order", opts.orderId);
  const s = q.toString();
  return s ? `${IRISS_PD_NEW_PATH}?${s}` : IRISS_PD_NEW_PATH;
}

function one(v: string | string[] | null | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** `?from=autoparks:ID|logistics:ID`, `?link=URL`, `?order=ID` -> sākuma cilne un dati. Nederīgais tiek ignorēts. */
export function parseIrissPdEntry(params: Record<string, string | string[] | undefined>): IrissPdEntry {
  const orderRaw = one(params.order);
  const orderId = SAFE_ID.test(orderRaw) ? orderRaw : "";
  const from = one(params.from);
  const m = from.match(/^(autoparks|logistics):(.+)$/);
  if (m && SAFE_ID.test(m[2]!)) return { tab: m[1] as "autoparks" | "logistics", carId: m[2]!, link: "", orderId };
  const link = one(params.link).slice(0, 2000);
  if (/^https?:\/\//i.test(link)) return { tab: "link", carId: "", link, orderId };
  return { tab: "link", carId: "", link: "", orderId };
}

/** Avota auto saite piedāvājuma kartītē (`autoparks:ID` -> Autoparka kabinets, `logistics:ID` -> Loģistika). */
export function irissPdSourceRefHref(sourceRef: string): string {
  const [kind, id = ""] = sourceRef.split(":");
  if (!SAFE_ID.test(id)) return kind === "logistics" ? "/admin/iriss/logistika" : "/admin/iriss/autoparks-v2";
  return kind === "logistics" ? `/admin/iriss/logistika?car=${encodeURIComponent(id)}` : `/admin/iriss/autoparks-v2/${encodeURIComponent(id)}`;
}
