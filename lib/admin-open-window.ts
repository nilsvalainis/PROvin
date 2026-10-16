export type SyncOpenedWindow = {
  /** Logs, ko `window.open` atgrieza klikšķa brīdī. `null`, ja pārlūks to bloķēja. */
  window: Window | null;
  /** Ieraksta HTML iepriekš atvērtajā logā. Standalone PWA bez loga: `location.assign` uz blob URL. */
  writeHtml(html: string): boolean;
  /** Pēc `await` iestata gala URL. Standalone PWA bez loga: `location.assign`. */
  navigate(url: string): void;
  close(): void;
};

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  let media = false;
  try {
    media = window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    media = false;
  }
  return media || nav.standalone === true;
}

/**
 * Jāizsauc sinhroni klikšķa apstrādātājā, pirms jebkura `await`.
 * iOS Safari bloķē `window.open` pēc tīkla pieprasījuma.
 * `noopener` šeit nelieto: tas bieži liek `window.open` atgriezt `null`, un tad URL vairs nevar iestatīt.
 */
export function openWindowSyncThen(): SyncOpenedWindow {
  const popup = typeof window === "undefined" ? null : window.open("about:blank", "_blank");

  return {
    window: popup,
    writeHtml(html: string) {
      if (popup && !popup.closed) {
        popup.document.open();
        popup.document.write(html);
        popup.document.close();
        return true;
      }
      if (typeof window === "undefined" || !isStandaloneDisplayMode()) return false;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      window.location.assign(URL.createObjectURL(blob));
      return true;
    },
    navigate(url: string) {
      if (popup && !popup.closed) {
        popup.location.href = url;
        return;
      }
      if (typeof window !== "undefined" && isStandaloneDisplayMode()) {
        window.location.assign(url);
        return;
      }
      if (typeof window !== "undefined") {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    close() {
      if (popup && !popup.closed) popup.close();
    },
  };
}
