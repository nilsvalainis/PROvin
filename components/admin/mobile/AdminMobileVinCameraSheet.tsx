"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { normalizeVin } from "@/lib/order-field-validation";
import {
  CAMERA_SHEET_FRESH,
  cameraObjectCoverCrop,
  cameraScanControlState,
  isCameraBlackFrame,
  jpegDataUrlToBlob,
  pickVinFromBarcodeValues,
} from "@/lib/vin-scan/camera-frame";
import {
  cameraVinDecision,
  cameraVinFieldValue,
  vinScanHistoryInfo,
  type CameraScanMode,
} from "@/lib/vin-scan/camera-vin";

/** Cik reizes pēc kārtas mēģina automātiski, pirms lūdz pietuvināt vai nofotografēt. */
const AUTO_ATTEMPTS = 12;
const AUTO_PAUSE_MS = 350;
/** Viena kadra OCR pieprasījuma griesti; pēc tiem nākamais kadrs (serveris aizņemto worker pārstartē). */
const FRAME_TIMEOUT_MS = 12_000;
/** «Nofotografēt»: vairāki kadri pēc kārtas; pietiek ar 1 derīgu VIN. */
const SNAP_FRAMES = 3;
const TO_BLOB_MS = 400;

type OcrResult = { vin: string; checkDigitOk: boolean; alts: string[] };

function releaseCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (b: Blob | null) => {
      if (done) return;
      done = true;
      resolve(b && b.size > 32 ? b : null);
    };
    const fallback = () => {
      try {
        finish(jpegDataUrlToBlob(canvas.toDataURL("image/jpeg", 0.88)));
      } catch {
        finish(null);
      }
    };
    const timer = window.setTimeout(fallback, TO_BLOB_MS);
    try {
      canvas.toBlob((b) => {
        window.clearTimeout(timer);
        if (b && b.size > 32) finish(b);
        else fallback();
      }, "image/jpeg", 0.88);
    } catch {
      window.clearTimeout(timer);
      fallback();
    }
  });
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const rvfc = (
      video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
    ).requestVideoFrameCallback;
    if (typeof rvfc === "function") {
      rvfc.call(video, done);
      window.setTimeout(done, 280);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(done));
  });
}

/** Izgriež rāmja joslu no video (object-cover). iOS: toBlob noildze → toDataURL; melnu kadru nesūta. */
async function grabFrame(video: HTMLVideoElement, whole: boolean): Promise<Blob | null> {
  if (video.readyState < 2) await waitForVideoFrame(video);
  const crop = cameraObjectCoverCrop({
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    elementWidth: video.clientWidth || video.getBoundingClientRect().width,
    elementHeight: video.clientHeight || video.getBoundingClientRect().height,
    whole,
  });
  if (!crop) return null;
  const out = Math.min(1600, Math.max(1000, crop.sw));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(out);
  canvas.height = Math.max(1, Math.round((crop.sh / crop.sw) * out));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    releaseCanvas(canvas);
    return null;
  }
  ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  if (isCameraBlackFrame(ctx, canvas.width, canvas.height)) {
    releaseCanvas(canvas);
    return null;
  }
  const blob = await canvasToJpegBlob(canvas);
  releaseCanvas(canvas);
  return blob;
}

async function postFrame(blob: Blob, signal: AbortSignal): Promise<OcrResult | null> {
  // Nils 01.11: noildzis pieprasījums vairs neaptur visu skenēšanu - tikai šo kadru.
  const own = new AbortController();
  const timer = setTimeout(() => own.abort(), FRAME_TIMEOUT_MS);
  const onAbort = () => own.abort();
  signal.addEventListener("abort", onAbort);
  try {
    const res = await fetch("/api/admin/vin-scan/camera-ocr", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "image/jpeg" },
      body: blob,
      signal: own.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as OcrResult | null;
    return data && typeof data.vin === "string" ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

async function blobAsJpeg(blob: Blob): Promise<Blob | null> {
  if (blob.type === "image/jpeg" && blob.size > 500) return blob;
  try {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close();
      releaseCanvas(canvas);
      return blob.size > 500 ? blob : null;
    }
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const jpeg = await canvasToJpegBlob(canvas);
    releaseCanvas(canvas);
    return jpeg;
  } catch {
    return blob.size > 500 ? blob : null;
  }
}

type BarcodeDetectorLike = new (opts?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

async function detectBarcodeVin(video: HTMLVideoElement): Promise<string | null> {
  const BD = (globalThis as { BarcodeDetector?: BarcodeDetectorLike & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    let formats = ["code_128", "code_39", "qr_code", "data_matrix", "pdf417"];
    if (typeof BD.getSupportedFormats === "function") {
      const supported = await BD.getSupportedFormats();
      formats = formats.filter((f) => supported.includes(f));
    }
    if (formats.length === 0) return null;
    const codes = await new BD({ formats }).detect(video);
    return pickVinFromBarcodeValues(codes.map((c) => c.rawValue ?? ""));
  } catch {
    return null;
  }
}

function streamLive(stream: MediaStream | null): boolean {
  return Boolean(stream?.getVideoTracks().some((t) => t.readyState === "live"));
}

function prepareVideoEl(el: HTMLVideoElement) {
  el.muted = true;
  el.playsInline = true;
  el.setAttribute("muted", "");
  el.setAttribute("playsinline", "");
  el.setAttribute("webkit-playsinline", "");
  el.setAttribute("autoplay", "");
}

export function AdminMobileVinCameraSheet({
  open,
  onClose,
  onVin,
}: {
  open: boolean;
  onClose: () => void;
  onVin: (vin: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const nativeInputRef = useRef<HTMLInputElement | null>(null);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "found" | "miss">("idle");
  const [found, setFound] = useState<OcrResult | null>(null);
  const [round, setRound] = useState(0);
  const [cameraKey, setCameraKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  /** Pašreizējā skenēšana (automātiskā vai «Nofotografēt») - jaunā vienmēr aptur iepriekšējo. */
  const scanRef = useRef<AbortController | null>(null);

  // Nils 01.11: kamera var būt gatava pirms video elements parādās logā - piesaista, tiklīdz tas ir.
  // Nils 27.10 (IRISS skeneris): React neieliek muted/playsinline DOM - bez tiem iOS 18 canvas ir melns.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (!el) return;
    prepareVideoEl(el);
    const stream = streamRef.current;
    if (stream && el.srcObject !== stream) {
      el.srcObject = stream;
      const start = () => void el.play().catch(() => undefined);
      if (el.readyState >= 1) start();
      else el.addEventListener("loadedmetadata", start, { once: true });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    // Nakts 07.11: katra atvēršana sākas tukša - iepriekšējā auto VIN nepaliek laukā ar aktīvu «Izmantot VIN».
    setErr("");
    setReady(CAMERA_SHEET_FRESH.ready);
    setFound(null);
    setStatus(CAMERA_SHEET_FRESH.status);
    setManual(CAMERA_SHEET_FRESH.vin);
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stop) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          prepareVideoEl(el);
          el.srcObject = stream;
          const start = () => void el.play().catch(() => undefined);
          if (el.readyState >= 1) start();
          else el.addEventListener("loadedmetadata", start, { once: true });
        }
        setReady(true);
      } catch {
        setErr("Kamera nav pieejama. Ievadi VIN zemāk.");
        setStatus("idle");
      }
    })();
    return () => {
      stop = true;
      // Citādi nākamajā atvēršanā auto skenēšana sākas ar veco «gatavs» pirms kameras un iesprūst «Nolasa VIN… (1)».
      setReady(false);
      scanRef.current?.abort();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, cameraKey]);

  /** Kadri pēc kārtas. Auto pieņem pēc 2 kadriem; Nofotografēt - pēc 1. Lauks aizpildās ar pirmo VIN. */
  const scan = useCallback(async (frames: number, whole: boolean, pauseMs: number, mode: CameraScanMode) => {
    scanRef.current?.abort();
    const ac = new AbortController();
    scanRef.current = ac;
    setStatus("reading");
    setProgress(0);
    const picks: string[] = [];
    let last: OcrResult | null = null;
    let sawFrame = false;
    for (let i = 0; i < frames && !ac.signal.aborted; i++) {
      setProgress(i + 1);
      const video = videoRef.current;
      if (video && video.paused) await video.play().catch(() => undefined);
      if (video) {
        const barcode = await detectBarcodeVin(video);
        if (ac.signal.aborted) return;
        if (barcode) {
          picks.push(barcode);
          last = { vin: barcode, checkDigitOk: true, alts: [] };
          const field = cameraVinFieldValue(picks);
          if (field) setManual(field);
          const decided = cameraVinDecision(picks, "barcode");
          if (decided) {
            setFound({ vin: decided.vin, checkDigitOk: decided.checkDigitOk, alts: [] });
            setManual(decided.vin);
            setStatus("found");
            return;
          }
        }
      }
      const blob = video ? await grabFrame(video, whole).catch(() => null) : null;
      if (blob) {
        sawFrame = true;
        const r = await postFrame(blob, ac.signal);
        if (ac.signal.aborted) return;
        if (r?.vin) {
          last = r;
          picks.push(r.vin);
          const field = cameraVinFieldValue(picks);
          if (field) setManual(field);
          const c = cameraVinDecision(picks, mode);
          if (c) {
            setFound({ vin: c.vin, checkDigitOk: c.checkDigitOk, alts: r.alts.filter((a) => a !== c.vin) });
            setManual(c.vin);
            setStatus("found");
            return;
          }
        }
      }
      if (pauseMs > 0) await new Promise((res) => setTimeout(res, pauseMs));
    }
    if (ac.signal.aborted) return;
    const guess = cameraVinFieldValue(picks);
    if (guess && last) {
      setFound({
        vin: guess,
        checkDigitOk: false,
        alts: [...new Set([...picks, ...last.alts])].filter((a) => a !== guess).slice(0, 3),
      });
      setManual(guess);
      setStatus("found");
      return;
    }
    setStatus("miss");
    if (mode === "snap" && !sawFrame) nativeInputRef.current?.click();
  }, []);

  // Automātiska nolasīšana: kadrs pēc kadra, līdz kadri vienojas par VIN vai beidzas mēģinājumi.
  useEffect(() => {
    if (!open || !ready) return;
    void scan(AUTO_ATTEMPTS, false, AUTO_PAUSE_MS, "auto");
    return () => scanRef.current?.abort();
  }, [open, ready, round, scan]);

  function snapWhole() {
    void scan(SNAP_FRAMES, true, 150, "snap");
  }

  function rescan() {
    setFound(null);
    setManual("");
    // Ja kamera apstājusies (iOS pēc fona, cits logs), startē no jauna; citādi tikai jauna kārta.
    if (!streamLive(streamRef.current)) setCameraKey((n) => n + 1);
    else setRound((n) => n + 1);
  }

  async function onNativePhoto(file: File) {
    scanRef.current?.abort();
    const jpeg = await blobAsJpeg(file);
    if (!jpeg) {
      setStatus("miss");
      return;
    }
    setStatus("reading");
    setProgress(1);
    const ac = new AbortController();
    scanRef.current = ac;
    const r = await postFrame(jpeg, ac.signal);
    if (ac.signal.aborted) return;
    if (r?.vin) {
      setFound(r);
      setManual(r.vin);
      setStatus("found");
    } else {
      setStatus("miss");
    }
  }

  const controls = cameraScanControlState({ ready, status, vin: manual });
  const statusText =
    status === "reading"
      ? `Nolasa VIN… ${progress > 0 ? `(${progress})` : ""}`.trim()
      : status === "found" && found
        ? found.checkDigitOk
          ? `Atrasts · ${vinScanHistoryInfo(found.vin)}`
          : `Atrasts, pārbaudi rakstzīmes · ${vinScanHistoryInfo(found.vin)}`
        : status === "miss"
          ? "Neizdevās nolasīt. Pietuvini, noturi taisni vai nofotografē."
          : "";

  return (
    <AdminMobileSheet open={open} title="VIN SCAN" subtitle="Novieto VIN rāmī" onClose={onClose}>
      <div className="relative overflow-hidden rounded-[18px] bg-black">
        <video ref={attachVideo} className="h-[280px] w-full object-cover" playsInline muted autoPlay />
        <div
          className={`pointer-events-none absolute inset-x-6 top-1/2 h-[88px] -translate-y-1/2 rounded-xl border-2 ${
            status === "found" ? "border-emerald-400" : "border-white/80"
          }`}
        />
      </div>
      {err ? <p className="mt-2 text-[13px] text-[var(--am-ink2)]">{err}</p> : null}
      {statusText ? <p className="mt-2 text-[13px] leading-snug text-[var(--am-ink2)]">{statusText}</p> : null}
      {!err ? (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="am-press flex h-10 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--am-s2)] text-[14px] font-semibold text-[var(--am-ink)] disabled:opacity-40"
            disabled={!controls.photoEnabled}
            onClick={snapWhole}
          >
            <AdminMobileIcon name="kamera" className="h-4 w-4" />
            Nofotografēt
          </button>
          {controls.showRescan ? (
            <button
              type="button"
              className="am-press flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--am-s2)] text-[14px] font-semibold text-[var(--am-ink)]"
              onClick={rescan}
            >
              Skenēt vēlreiz
            </button>
          ) : null}
        </div>
      ) : null}
      <label className="mt-3 block">
        <span className="text-[11px] font-semibold uppercase tracking-[0.045em] text-[var(--am-ink3)]">VIN</span>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value.toUpperCase())}
          className="mt-1 h-11 w-full px-3 font-mono text-[16px] outline-none"
          placeholder="17 rakstzīmes"
          aria-label="VIN no kameras"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {found && found.alts.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {found.alts.map((a) => (
            <button
              key={a}
              type="button"
              className="rounded-full bg-[var(--am-s2)] px-2.5 py-1 font-mono text-[12px] text-[var(--am-ink2)]"
              onClick={() => setManual(a)}
            >
              {a}
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="am-press mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--am-ink)] text-[15px] font-semibold text-[var(--am-s1)] disabled:opacity-40"
        disabled={!controls.useVinEnabled}
        onClick={() => onVin(normalizeVin(manual))}
      >
        <AdminMobileIcon name="atzime" className="h-4 w-4" />
        Izmantot VIN
      </button>
      <input
        ref={nativeInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onNativePhoto(file);
        }}
      />
    </AdminMobileSheet>
  );
}
