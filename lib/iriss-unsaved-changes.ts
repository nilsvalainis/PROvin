export const IRISS_UNSAVED_CHANGES_TITLE = "Ir nesaglabātas izmaiņas.";
export const IRISS_UNSAVED_CHANGES_SAVE = "Saglabāt";
export const IRISS_UNSAVED_CHANGES_LEAVE = "Iziet nesaglabājot";
export const IRISS_UNSAVED_CHANGES_CANCEL = "Atcelt";

export function irissRecordIsDirty(currentJson: string, savedJson: string): boolean {
  return currentJson !== savedJson;
}

export function irissInternalAdminHref(href: string): string | null {
  const t = href.trim();
  if (!t || t.startsWith("#") || t.startsWith("javascript:")) return null;
  try {
    if (/^https?:\/\//i.test(t)) {
      const u = new URL(t);
      if (typeof window === "undefined" || u.origin !== window.location.origin) return null;
      return `${u.pathname}${u.search}${u.hash}`;
    }
  } catch {
    return null;
  }
  if (t.startsWith("/")) return t;
  return null;
}
