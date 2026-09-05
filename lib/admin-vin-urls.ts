/**
 * VIN normalizācija un ārējo pakalpojumu URL admin paneļa īsajām saitēm.
 * VIN laukā / MENU — Tampermonkey `GM_setValue` hand-off (`data-provin-handoff-vin`).
 * Auto-Records joprojām `?vin=` + skripts; AutoDNA arī `/vin/{VIN}` ceļš.
 */

export function normalizeVinForServiceUrls(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export const AUTODNA_LV_HOME_URL = "https://www.autodna.lv";
/** CarVertical — ielogotā „Manas atskaites” lapa (ne mājaslapa, ne carvertical.lv). */
export const CARVERTICAL_REPORTS_URL = "https://www.carvertical.com/lv/user/reports";
/** @deprecated Izmanto `CARVERTICAL_REPORTS_URL`. */
export const CARVERTICAL_LV_BASE_URL = CARVERTICAL_REPORTS_URL;
export const AUTORECORDS_BASE_URL = "https://www.auto-records.com/";
export const CHECKTHISREG_HOME_URL = "https://checkthisreg.com/";
export const CARINFO_HOME_URL = "https://www.car.info/en-se/";

export type VinAutofillServiceKey =
  | "autodna"
  | "carvertical"
  | "auto_records"
  | "checkthisreg"
  | "carinfo";

export type VinAutofillService = {
  key: VinAutofillServiceKey;
  /** Īsā poga MENU / VIN rindā. */
  shortLabel: string;
  title: string;
  /** Vai userscript VIN ņem no `data-provin-handoff-vin` (ne tikai no URL). */
  handoffVin: boolean;
};

export const VIN_AUTOFILL_SERVICES: readonly VinAutofillService[] = [
  { key: "autodna", shortLabel: "DNA", title: "AutoDNA", handoffVin: true },
  { key: "carvertical", shortLabel: "CV", title: "CarVertical", handoffVin: true },
  { key: "auto_records", shortLabel: "AR", title: "Auto-Records", handoffVin: true },
  { key: "checkthisreg", shortLabel: "CTR", title: "CheckThisReg", handoffVin: true },
  { key: "carinfo", shortLabel: "INFO", title: "car.info", handoffVin: true },
] as const;

/** Klikšķis uz šiem elementiem neatver pasūtījumu (pogu / saišu zona). */
export const ADMIN_ORDER_ROW_NAV_IGNORE_SELECTOR =
  "a,button,input,textarea,select,label,[data-admin-row-nav-ignore]";

export function shouldOpenAdminOrderFromRowClick(target: EventTarget | null): boolean {
  if (typeof Element === "undefined" || !(target instanceof Element)) return false;
  return !target.closest(ADMIN_ORDER_ROW_NAV_IGNORE_SELECTOR);
}

export function buildAutodnaVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `${AUTODNA_LV_HOME_URL}/vin/${encodeURIComponent(v)}`;
}

export function buildCarverticalVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return CARVERTICAL_REPORTS_URL;
}

export function buildAutorecordsVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return `https://www.auto-records.com/?vin=${encodeURIComponent(v)}`;
}

export function buildCheckthisregVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return CHECKTHISREG_HOME_URL;
}

/** car.info — `/search?q=` ir 404; atveram EN/SE sākumu, VIN ieliek Tampermonkey header meklēšanā + Enter. */
export function buildCarinfoVinCheckUrl(raw: string): string | null {
  const v = normalizeVinForServiceUrls(raw);
  if (!v) return null;
  return CARINFO_HOME_URL;
}

export function buildVinAutofillHref(key: VinAutofillServiceKey, raw: string): string | null {
  if (key === "autodna") return buildAutodnaVinCheckUrl(raw);
  if (key === "carvertical") return buildCarverticalVinCheckUrl(raw);
  if (key === "auto_records") return buildAutorecordsVinCheckUrl(raw);
  if (key === "checkthisreg") return buildCheckthisregVinCheckUrl(raw);
  return buildCarinfoVinCheckUrl(raw);
}

export function vinAutofillServiceHomeUrl(key: VinAutofillServiceKey): string {
  if (key === "autodna") return AUTODNA_LV_HOME_URL;
  if (key === "carvertical") return CARVERTICAL_REPORTS_URL;
  if (key === "auto_records") return AUTORECORDS_BASE_URL;
  if (key === "checkthisreg") return CHECKTHISREG_HOME_URL;
  return CARINFO_HOME_URL;
}

export type SourceBlockExternalOpen = {
  href: string;
  handoffVin: string | null;
};

/** Avotu bloka virsraksta saite — ar VIN, ja ir; citādi bāzes URL. */
export function resolveSourceBlockExternalOpen(
  blockKey: "autodna" | "carvertical" | "auto_records" | "carinfo",
  rawVin: string,
): SourceBlockExternalOpen {
  const vin = normalizeVinForServiceUrls(rawVin);
  if (blockKey === "autodna") {
    return {
      href: vin ? (buildAutodnaVinCheckUrl(vin) ?? AUTODNA_LV_HOME_URL) : AUTODNA_LV_HOME_URL,
      handoffVin: vin || null,
    };
  }
  if (blockKey === "carvertical") {
    return { href: CARVERTICAL_REPORTS_URL, handoffVin: vin || null };
  }
  if (blockKey === "carinfo") {
    return {
      href: vin ? (buildCarinfoVinCheckUrl(vin) ?? CARINFO_HOME_URL) : CARINFO_HOME_URL,
      handoffVin: vin || null,
    };
  }
  return {
    href: vin ? (buildAutorecordsVinCheckUrl(vin) ?? AUTORECORDS_BASE_URL) : AUTORECORDS_BASE_URL,
    handoffVin: vin || null,
  };
}
