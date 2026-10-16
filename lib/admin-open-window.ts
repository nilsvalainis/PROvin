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
      return false;
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

function downloadTextFile(filename: string, contents: string, mime: string): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  const later = typeof window.setTimeout === "function" ? window.setTimeout.bind(window) : globalThis.setTimeout;
  later(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * PDF/HTML pēc ģenerēšanas: vispirms saturs, tad jauns logs vai lejupielāde.
 * Nekad neatver tukšu logu pirms `await` un nekad neaizstāj admin lapu ar `location.assign`.
 */
export function openGeneratedHtmlDocument(
  html: string,
  filename = "provin-report.html",
): { window: Window | null; opened: boolean } {
  const popup = typeof window === "undefined" ? null : window.open("", "_blank");
  if (popup && !popup.closed) {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    return { window: popup, opened: true };
  }
  if (typeof document !== "undefined") {
    downloadTextFile(filename, html, "text/html;charset=utf-8");
    return { window: null, opened: true };
  }
  return { window: null, opened: false };
}

/** Jau gatavs Blob/URL (PDF) - atver vai lejupielādē, bez `location.assign`. */
export function openGeneratedFileUrl(url: string, filename = "document.pdf"): boolean {
  const popup = typeof window === "undefined" ? null : window.open(url, "_blank");
  if (popup && !popup.closed) return true;
  if (typeof document !== "undefined") {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true;
  }
  return false;
}
