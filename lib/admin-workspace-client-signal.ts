/**
 * Klienta puse: pārlūka/ierīces id, īss pārlūka nosaukums, beacon drošības signāli.
 */
const CLIENT_ID_KEY = "provin-admin-client-id";

export function getAdminBrowserClientId(): string {
  try {
    const cur = localStorage.getItem(CLIENT_ID_KEY);
    if (cur && /^[a-zA-Z0-9_-]{8,64}$/.test(cur)) return cur;
    const rnd =
      typeof crypto !== "undefined" && "randomUUID" in crypto ?
        crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(CLIENT_ID_KEY, rnd);
    return rnd;
  } catch {
    return "nostorage_" + Math.random().toString(36).slice(2, 12);
  }
}

/** «Safari iPhone», «Chrome Mac» u.tml. - bez versijām. */
export function shortBrowserLabel(ua: string): string {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /FxiOS|Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Pārlūks";
  const device =
    /iPhone/.test(ua) ? "iPhone"
    : /iPad/.test(ua) ? "iPad"
    : /Android/.test(ua) ? "Android"
    : /Macintosh|Mac OS X/.test(ua) ? "Mac"
    : /Windows/.test(ua) ? "Windows"
    : /Linux/.test(ua) ? "Linux"
    : "";
  return device ? `${browser} ${device}` : browser;
}

export type WorkspaceClientEvent = {
  sessionId: string;
  event: "unsaved_not_sent" | "conflict_auto_merged" | "conflict_merge_failed" | "local_restore";
  reason?: string;
  fields?: number;
  blocks?: number;
  unsavedMs?: number;
  revision?: number;
};

/** Tikai skaitļi un iemesls - nekad saturs. */
export function sendWorkspaceClientEvent(ev: WorkspaceClientEvent): void {
  try {
    const body = JSON.stringify(ev);
    const url = "/api/admin/order-draft/client-event";
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    }
    void fetch(url, { method: "POST", body, keepalive: true, credentials: "include" }).catch(() => {});
  } catch {
    /* ignore */
  }
}
