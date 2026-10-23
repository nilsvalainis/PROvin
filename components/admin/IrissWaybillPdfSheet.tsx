"use client";

import { useEffect, useRef, useState } from "react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";

/**
 * PDF priekšskatījums lietotnē (arī iPhone): lapas tiek uzzīmētas ar pdf.js, nevis iframe,
 * kas iPhone rāda tikai pirmo lapu.
 */
export function IrissWaybillPdfSheet({ href, title, onClose }: { href: string | null; title: string; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!href) return;
    let cancelled = false;
    setState("loading");
    const host = box.current;
    if (host) host.innerHTML = "";
    void (async () => {
      try {
        const res = await fetch(href, { credentials: "include" });
        if (!res.ok) throw new Error("pdf");
        const data = await res.arrayBuffer();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const pdf = await pdfjs.getDocument({ data }).promise;
        const width = Math.min(host?.clientWidth || 360, 900);
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        for (let p = 1; p <= Math.min(pdf.numPages, 6); p++) {
          if (cancelled || !host) return;
          const page = await pdf.getPage(p);
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (width / base.width) * ratio });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${width}px`;
          canvas.className = "iriss-wb-pdf-page";
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          host.appendChild(canvas);
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [href]);

  return (
    <AdminMobileSheet open={Boolean(href)} title={title || "Pavadzīme"} onClose={onClose}>
      {state === "loading" ? <p className="py-6 text-center text-[13px] text-[#6e6e73]">Ielādē PDF...</p> : null}
      {state === "error" ? <p className="py-6 text-center text-[13px] text-[#b91c1c]">PDF neizdevās atvērt.</p> : null}
      <div ref={box} className="iriss-wb-pdf" />
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[#f2f2f7] text-[14px] font-semibold text-[#1d1d1f]">
          Atvērt pilnā izmērā
        </a>
      ) : null}
    </AdminMobileSheet>
  );
}
