"use client";

import { useEffect, useRef, useState } from "react";
import { PdfIcon } from "./FileModal";
import { pdfjsWorkerSrc } from "@/lib/pdfjs-worker-src";

/**
 * Dokumenta priekšskats (Nils 27.10): PDF pirmā lapa pārlūkā (pdfjs, arī iPhone), bilde - pati bilde.
 * Zīmē tikai, kad kartīte redzama (IntersectionObserver); kļūdas gadījumā - PDF ikona.
 */
export function DocThumb({ url, contentType, title }: { url: string; contentType: string; title: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  const isImage = contentType.startsWith("image/");

  useEffect(() => {
    const el = host.current;
    if (!el || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || isImage) return;
    let cancelled = false;
    // Viens atkārtots mēģinājums: pirmā ielāde dažreiz neizdodas (tīkls / vienlaicīgas ielādes) un sīktēls palika pelēks (28.10).
    const render = async (attempt: number): Promise<void> => {
      let doc: { getPage: (n: number) => Promise<unknown>; destroy: () => Promise<void> } | null = null;
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerSrc(pdfjs.version);
        const loaded = await pdfjs.getDocument({ url, withCredentials: true }).promise;
        doc = loaded;
        const page = await loaded.getPage(1);
        const c = canvas.current;
        if (cancelled || !c) return;
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 360 / base.width);
        const vp = page.getViewport({ scale });
        c.width = Math.floor(vp.width);
        c.height = Math.floor(vp.height);
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("no_ctx");
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        if (!cancelled) setState("ok");
      } catch {
        if (cancelled) return;
        if (attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          if (!cancelled) return render(1);
          return;
        }
        setState("fail");
      } finally {
        if (doc) void doc.destroy().catch(() => undefined);
      }
    };
    void render(0);
    return () => {
      cancelled = true;
    };
  }, [visible, isImage, url]);

  return (
    <span ref={host} className={`ap2-thumb ${state}`} aria-hidden>
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        visible ? <img src={url} alt="" loading="lazy" /> : null
      ) : (
        <canvas ref={canvas} title={title} />
      )}
      {!isImage && state !== "ok" ? (
        <span className="ap2-thumb-ph">
          <PdfIcon />
        </span>
      ) : null}
    </span>
  );
}
