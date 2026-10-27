"use client";

import { useEffect, useRef, useState } from "react";
import { enqueueScan } from "./scan-queue";
import { compressScanImage, type ScanTarget } from "./scan-upload";

export type ScannerTarget = { target: ScanTarget; title: string; invoiceId?: string };

/**
 * Skenēšana (T4): kamera visā ekrānā, lapu sīktēli, "Atcelt" / zibšņa poga / "Gatavs (N)".
 * Ja kamera nav pieejama (atļauja, vecs pārlūks) - poga atver telefona kameru (`capture="environment"`).
 * Malu noteikšana 1. kārtā netiek darīta.
 */
export function Scanner({ carId, target, onClose, onDone }: { carId: string; target: ScannerTarget; onClose: () => void; onDone: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [noCamera, setNoCamera] = useState(false);
  const [pages, setPages] = useState<Array<{ blob: Blob; url: string }>>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  /** iOS: ja automātiskā atskaņošana bloķēta - pieskāriens kameras laukam to ieslēdz. */
  const [needTap, setNeedTap] = useState(false);

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

  // iOS 18 (Nils 27.10: melna bilde): React neieliek `muted`/`playsinline` atribūtus DOM, bez tiem Safari
  // neatskaņo kameras video un kadrs ir melns. Atribūti tieši elementā, atskaņo pēc metadatiem.
  useEffect(() => {
    const v = video.current;
    if (!v || !stream) return;
    v.muted = true;
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("autoplay", "");
    v.srcObject = stream;
    const start = () => {
      void v
        .play()
        .then(() => setNeedTap(false))
        .catch(() => setNeedTap(true));
    };
    if (v.readyState >= 1) start();
    else v.addEventListener("loadedmetadata", start, { once: true });
    return () => v.removeEventListener("loadedmetadata", start);
  }, [stream]);

  useEffect(() => () => pages.forEach((p) => URL.revokeObjectURL(p.url)), [pages]);

  async function addBlob(blob: Blob) {
    const small = await compressScanImage(blob);
    setPages((ps) => [...ps, { blob: small, url: URL.createObjectURL(small) }]);
  }

  async function shoot() {
    const v = video.current;
    // Kamera nav gatava (nav kadra) - telefona kamera (sinhroni, kamēr vēl ir pieskāriena žests).
    if (!stream || !v || !v.videoWidth || v.readyState < 2) {
      if (v && stream && v.paused) void v.play().catch(() => undefined);
      input.current?.click();
      return;
    }
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    ctx?.drawImage(v, 0, 0);
    if (!ctx || isBlackFrame(ctx, c.width, c.height)) {
      releaseCanvas(c);
      setError("Kamera atdeva melnu kadru - atveru telefona kameru.");
      input.current?.click();
      return;
    }
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    releaseCanvas(c);
    if (blob) {
      setError("");
      await addBlob(blob);
    }
  }

  /** Vispirms saglabā telefonā (bezsaistes rinda), tad aizver - augšupielāde notiek fonā pa vienam (F6b). */
  async function finish() {
    if (pages.length === 0) return;
    setBusy(0);
    setError("");
    try {
      await enqueueScan({ carId, target: target.target, invoiceId: target.invoiceId, title: target.title, pages: pages.map((p) => p.blob) });
    } catch {
      setBusy(null);
      setError("Neizdevās");
      return;
    }
    setBusy(null);
    onDone();
    onClose();
  }

  return (
    <div className="ap2-cam" role="dialog" aria-label={target.title}>
      <div className="ap2-camview">
        {stream && !noCamera ? <video ref={video} playsInline muted autoPlay /> : null}
        {needTap ? (
          <button type="button" className="ap2-camtap" onClick={() => void video.current?.play().then(() => setNeedTap(false)).catch(() => undefined)}>
            Pieskaries, lai ieslēgtu kameru
          </button>
        ) : null}
        <div className="ap2-camtop">
          {target.title}
          <small>{pages.length + 1}. lapa</small>
          {/* Rezerve, ja kameras skats nestrādā: tā pati telefona kamera kā failu izvēlē. */}
          <button type="button" className="ap2-camalt" onClick={() => input.current?.click()}>
            Telefona kamera
          </button>
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

/** iOS kanvu atmiņa ir ierobežota (~384 MB kopā): pēc lietošanas kanvu atbrīvo, citādi nākamie kadri ir melni. */
function releaseCanvas(c: HTMLCanvasElement) {
  c.width = 0;
  c.height = 0;
}

/** Kadrs ir melns, ja nevienā no 64 parauga punktiem nav gaismas (kamera vēl nedod attēlu). */
export function isBlackFrame(ctx: Pick<CanvasRenderingContext2D, "getImageData">, width: number, height: number): boolean {
  if (width < 1 || height < 1) return true;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const px = ctx.getImageData(Math.floor(((x + 0.5) * width) / 8), Math.floor(((y + 0.5) * height) / 8), 1, 1).data;
      if (px[0]! > 12 || px[1]! > 12 || px[2]! > 12) return false;
    }
  }
  return true;
}
