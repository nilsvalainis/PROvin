"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { servisaLapaPageCount, type ServisaLapa } from "@/lib/iriss-autoparks-v2-servisa-lapa";
import { pdfjsWorkerSrc } from "@/lib/pdfjs-worker-src";
import { isModalImage } from "./FileModal";
import { ServisaDiagSheet, ServisaLapaSheet, type DiagPageState } from "./ServisaLapaSheets";

/** Cik CSDD diagnostikas PDF lapas drukā (parasti 1-2). */
const MAX_DIAG_PAGES = 4;
/** ~2x A4 platums pie 96 dpi - pietiekami ass drukai. */
const DIAG_TARGET_PX = 1600;

function fileUrl(carId: string, fileId: string): string {
  return `/api/admin/iriss-autoparks-v2/serviss/${encodeURIComponent(carId)}/faili/${encodeURIComponent(fileId)}`;
}

/** PDF lapas -> bildes (pdfjs, tas pats kā Servisa dokumentu priekšskatā), lai drukājas visā A4 lapā. */
async function renderPdfPages(url: string): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc(pdfjs.version);
  const doc = await pdfjs.getDocument({ url, withCredentials: true }).promise;
  try {
    const out: string[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, MAX_DIAG_PAGES); n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(4, DIAG_TARGET_PX / base.width) });
      const c = document.createElement("canvas");
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("no_ctx");
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      out.push(c.toDataURL("image/jpeg", 0.9));
    }
    return out;
  } finally {
    void doc.destroy().catch(() => undefined);
  }
}

/**
 * Servisa darbu lapa drukai (A4). Lapas tiek ieliktas tieši `body` (portāls), lai druka neatkarīga no admin
 * kolonnas un vairākas lapas plūst pa A4 lapām. Ekrānā - pārklājums ar pogu «Drukāt».
 */
export function AutoparksV2ServisaLapa({ s }: { s: ServisaLapa }) {
  const [mounted, setMounted] = useState(false);
  const [diag, setDiag] = useState<DiagPageState[]>(s.diag ? [{ kind: "loading" }] : []);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const f = s.diag;
    if (!f) return;
    const url = fileUrl(s.carId, f.id);
    if (isModalImage(f)) {
      setDiag([{ kind: "image", src: url }]);
      return;
    }
    let cancelled = false;
    renderPdfPages(url)
      .then((pages) => {
        if (cancelled) return;
        setDiag(pages.length ? pages.map((src) => ({ kind: "image", src })) : [{ kind: "failed", href: url }]);
      })
      .catch(() => {
        if (!cancelled) setDiag([{ kind: "failed", href: url }]);
      });
    return () => {
      cancelled = true;
    };
  }, [s.carId, s.diag]);

  if (!mounted) return null;
  const pages = servisaLapaPageCount(s, diag.length);
  const loading = diag.some((d) => d.kind === "loading");
  return createPortal(
    <div className="ap2 ap2-svl-root">
      <div className="ap2-svl-tools ap2-noprint">
        <button type="button" className="ap2-btn dark sm" disabled={loading} onClick={() => window.print()}>
          {loading ? "Ielādē..." : "Drukāt"}
        </button>
      </div>
      <ServisaLapaSheet s={s} pages={pages} />
      {diag.map((d, i) => (
        <ServisaDiagSheet key={i} s={s} page={i + 2} pages={pages} state={d} />
      ))}
    </div>,
    document.body,
  );
}
