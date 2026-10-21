"use client";

import { useEffect, useRef, useState } from "react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { vinScanHistoryInfo } from "@/lib/vin-scan/camera-vin";

/** Cik reizes pēc kārtas mēģina automātiski, pirms lūdz pietuvināt vai nofotografēt. */
const AUTO_ATTEMPTS = 10;
const AUTO_PAUSE_MS = 500;
/** Rāmis video elementā (px), tāds pats kā zīmētais. */
const FRAME_INSET_X = 24;
const FRAME_H = 88;

type OcrResult = { vin: string; checkDigitOk: boolean; alts: string[] };

/** Izgriež rāmja joslu no video (object-cover), ar rezervi augšā un apakšā. */
function grabFrame(video: HTMLVideoElement, whole: boolean): Promise<Blob | null> {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const ew = video.clientWidth;
  const eh = video.clientHeight;
  if (!vw || !vh || !ew || !eh) return Promise.resolve(null);
  const scale = Math.max(ew / vw, eh / vh);
  const sx0 = (vw - ew / scale) / 2;
  const sy0 = (vh - eh / scale) / 2;
  const band = whole ? eh : FRAME_H * 1.6;
  const x = whole ? 0 : FRAME_INSET_X / 2;
  const y = (eh - band) / 2;
  const sx = sx0 + x / scale;
  const sy = sy0 + Math.max(0, y) / scale;
  const sw = (ew - 2 * x) / scale;
  const sh = Math.min(eh, band) / scale;
  const out = Math.min(1600, Math.max(1000, sw));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(out);
  canvas.height = Math.round((sh / sw) * out);
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88));
}

async function postFrame(blob: Blob, signal: AbortSignal): Promise<OcrResult | null> {
  const res = await fetch("/api/admin/vin-scan/camera-ocr", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "image/jpeg" },
    body: blob,
    signal,
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as OcrResult | null;
  return data && typeof data.vin === "string" ? data : null;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<"idle" | "reading" | "found" | "miss">("idle");
  const [found, setFound] = useState<OcrResult | null>(null);
  const [round, setRound] = useState(0);
  const [ready, setReady] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    setErr("");
    setReady(false);
    setFound(null);
    setStatus("idle");
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
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setReady(true);
        }
      } catch {
        setErr("Kamera nav pieejama. Ievadi VIN zemāk.");
      }
    })();
    return () => {
      stop = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  // Automātiska nolasīšana: kadrs pēc kadra, līdz atrasts VIN vai beidzas mēģinājumi.
  useEffect(() => {
    if (!open || !ready) return;
    const ac = new AbortController();
    void (async () => {
      setStatus("reading");
      for (let i = 0; i < AUTO_ATTEMPTS && !ac.signal.aborted; i++) {
        const video = videoRef.current;
        const blob = video ? await grabFrame(video, false) : null;
        if (blob) {
          const r = await postFrame(blob, ac.signal).catch(() => null);
          if (ac.signal.aborted) return;
          if (r?.vin) {
            setFound(r);
            setManual(r.vin);
            setStatus("found");
            return;
          }
        }
        await new Promise((res) => setTimeout(res, AUTO_PAUSE_MS));
      }
      if (!ac.signal.aborted) setStatus("miss");
    })();
    return () => ac.abort();
  }, [open, ready, round]);

  async function snapWhole() {
    const video = videoRef.current;
    if (!video) return;
    setStatus("reading");
    const blob = await grabFrame(video, true);
    const r = blob ? await postFrame(blob, new AbortController().signal).catch(() => null) : null;
    if (r?.vin) {
      setFound(r);
      setManual(r.vin);
      setStatus("found");
    } else {
      setStatus("miss");
    }
  }

  const statusText =
    status === "reading"
      ? "Nolasa VIN…"
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
        <video ref={videoRef} className="h-[280px] w-full object-cover" playsInline muted autoPlay />
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
            disabled={!ready || status === "reading"}
            onClick={() => void snapWhole()}
          >
            <AdminMobileIcon name="kamera" className="h-4 w-4" />
            Nofotografēt
          </button>
          {status === "found" || status === "miss" ? (
            <button
              type="button"
              className="am-press flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--am-s2)] text-[14px] font-semibold text-[var(--am-ink)]"
              onClick={() => {
                setFound(null);
                setRound((n) => n + 1);
              }}
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
        disabled={!isValidVin(normalizeVin(manual))}
        onClick={() => onVin(normalizeVin(manual))}
      >
        <AdminMobileIcon name="atzime" className="h-4 w-4" />
        Izmantot VIN
      </button>
    </AdminMobileSheet>
  );
}
