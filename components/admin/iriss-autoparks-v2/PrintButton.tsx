"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";

export function PrintButton() {
  return (
    <button type="button" className="ap2-btn dark sm ap2-noprint" onClick={() => window.print()}>
      Drukāt
    </button>
  );
}

type NavLike = { userAgent?: string; platform?: string; maxTouchPoints?: number };

/** iPhone / iPad (arī iPadOS, kas sakās par Mac): tur slēpta iframe drukāšana nav uzticama. */
export function isIosLike(nav: NavLike | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  if (!nav) return false;
  return /iPad|iPhone|iPod/.test(nav.userAgent || "") || (nav.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1);
}

/** Pievieno vaicājuma parametru (`print=1` / `autoprint=1`) A4 lapas adresei. */
export function withPrintParam(href: string, param: "print" | "autoprint"): string {
  return `${href}${href.includes("?") ? "&" : "?"}${param}=1`;
}

/** Gaida fontus un visus attēlus (logo, QR), lai drukā nekas netrūkst. Ne ilgāk par `maxMs`. */
export async function waitForPrintAssets(doc: Document, maxMs = 5000): Promise<void> {
  const fonts = (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready ?? Promise.resolve();
  const imgs = Array.from(doc.images).map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((res) => {
          img.addEventListener("load", () => res(), { once: true });
          img.addEventListener("error", () => res(), { once: true });
        }),
  );
  await Promise.race([Promise.all([fonts, ...imgs]), new Promise((res) => setTimeout(res, maxMs))]);
}

/** Datorā/Android - slēpta iframe (bez jaunas cilnes); iPhone/iPad - atver lapu ar `?autoprint=1`. */
export function printA4Mode(nav?: NavLike): "iframe" | "open" {
  return isIosLike(nav) ? "open" : "iframe";
}

/** Ielādē A4 lapu (`?print=1`) slēptā iframe un pēc fontu/attēlu ielādes atver drukas logu. */
export function startIframePrint(doc: Document, href: string): HTMLIFrameElement {
  const frame = doc.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  // Ārpus ekrāna, bet ar A4 izmēru - nulles izmēra iframe dažos pārlūkos drukā tukšu lapu.
  Object.assign(frame.style, { position: "fixed", left: "-10000px", top: "0", width: "794px", height: "1123px", border: "0" });
  frame.onload = async () => {
    const w = frame.contentWindow;
    if (!w) return;
    await waitForPrintAssets(w.document);
    w.focus();
    w.print();
  };
  frame.src = withPrintParam(href, "print");
  doc.body.appendChild(frame);
  return frame;
}

/**
 * «Drukāt A4» (Nils 20.11): drukā uzreiz - atveras tikai pārlūka drukas logs, ne priekšskatījuma cilne.
 * Dators/Android: A4 lapa slēptā iframe (`?print=1`) -> pēc fontu/attēlu ielādes `contentWindow.print()`.
 * iPhone/iPad: iframe drukāšana Safari nav uzticama - saite atver A4 lapu ar `?autoprint=1`, tā pati izsauc `window.print()`.
 */
export function PrintA4Button({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => () => frameRef.current?.remove(), []);

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (printA4Mode() === "open") return; // iPhone: saite atver ?autoprint=1 lapu
    e.preventDefault();
    frameRef.current?.remove();
    frameRef.current = startIframePrint(document, href);
  }

  return (
    <a className={className} href={withPrintParam(href, "autoprint")} target="_blank" rel="noreferrer" onClick={onClick}>
      {children}
    </a>
  );
}

/** A4 lapa ar `?autoprint=1` (iPhone): pēc fontu/attēlu ielādes pati atver drukas logu. */
export function AutoPrint() {
  useEffect(() => {
    let cancelled = false;
    void waitForPrintAssets(document).then(() => {
      if (!cancelled) window.print();
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
