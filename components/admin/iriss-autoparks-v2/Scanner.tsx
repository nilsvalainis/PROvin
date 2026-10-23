"use client";

import { useEffect, useRef, useState } from "react";
import { compressScanImage, uploadScanPages, type ScanTarget } from "./scan-upload";

export type ScannerTarget = { target: ScanTarget; title: string; invoiceId?: string };

/**
 * Skenēšana (T4): kamera visā ekrānā, lapu sīktēli, "Atcelt" / zibšņa poga / "Gatavs (N)".
 * Ja kamera nav pieejama (atļauja, vecs pārlūks) - poga atver telefona kameru (`capture="environment"`).
 * Malu noteikšana 1. kārtā netiek darīta.
 */
export function Scanner({ carId, target, onClose, onDone }: { carId: string; target: ScannerTarget; onClose: () => void; onDone: (invoiceId?: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [noCamera, setNoCamera] = useState(false);
  const [pages, setPages] = useState<Array<{ blob: Blob; url: string }>>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let s: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setNoCamera(true);
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false })
      .then((st) => {
        if (cancelled) {
          st.getTracks().forEach((t) => t.stop());
          return;
        }
        s = st;
        setStream(st);
      })
      .catch(() => setNoCamera(true));
    return () => {
      cancelled = true;
      s?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (video.current && stream) {
      video.current.srcObject = stream;
      void video.current.play().catch(() => undefined);
    }
  }, [stream]);

  useEffect(() => () => pages.forEach((p) => URL.revokeObjectURL(p.url)), [pages]);

  async function addBlob(blob: Blob) {
    const small = await compressScanImage(blob);
    setPages((ps) => [...ps, { blob: small, url: URL.createObjectURL(small) }]);
  }

  async function shoot() {
    const v = video.current;
    if (!stream || !v || !v.videoWidth) {
      input.current?.click();
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    if (blob) await addBlob(blob);
  }

  async function finish() {
    if (pages.length === 0) return;
    setBusy(0);
    setError("");
    let createdInvoice: string | undefined;
    const res = await uploadScanPages(carId, target.target, pages.map((p) => p.blob), {
      invoiceId: target.invoiceId,
      onProgress: (p) => setBusy(p),
      onInvoice: (id) => {
        createdInvoice = id;
      },
    });
    setBusy(null);
    if (!res.ok) {
      setError("Neizdevās");
      return;
    }
    onDone(createdInvoice);
    onClose();
  }

  return (
    <div className="ap2-cam" role="dialog" aria-label={target.title}>
      <div className="ap2-camview">
        {stream && !noCamera ? <video ref={video} playsInline muted /> : null}
        <div className="ap2-camtop">
          {target.title}
          <small>{pages.length + 1}. lapa</small>
        </div>
      </div>
      <div className="ap2-tray">
        <div className="tp">
          {pages.map((p, i) => (
            <span key={p.url} className="tg2" style={{ backgroundImage: `url(${p.url})` }}>
              <b>{i + 1}</b>
            </span>
          ))}
        </div>
        {error ? (
          <p className="ap2-camerr">
            {error}{" "}
            <button type="button" onClick={() => void finish()}>
              VĒLREIZ
            </button>
          </p>
        ) : null}
        {busy != null ? (
          <div className="ap2-prog">
            <i style={{ width: `${Math.round(busy * 100)}%` }} />
          </div>
        ) : null}
        <div className="acts">
          <button type="button" className="txt" onClick={onClose} disabled={busy != null}>
            Atcelt
          </button>
          <button type="button" className="shutter" onClick={() => void shoot()} aria-label="Nofotografēt lapu" disabled={busy != null} />
          <button type="button" className="txt r" onClick={() => void finish()} disabled={pages.length === 0 || busy != null}>
            Gatavs ({pages.length})
          </button>
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={async (e) => {
          for (const f of Array.from(e.target.files ?? [])) await addBlob(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
