"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { cameraVinConsensus, vinScanHistoryInfo } from "@/lib/vin-scan/camera-vin";

/** Cik reizes pēc kārtas mēģina automātiski, pirms lūdz pietuvināt vai nofotografēt. */
const AUTO_ATTEMPTS = 12;
const AUTO_PAUSE_MS = 350;
/** Viena kadra OCR pieprasījuma griesti; pēc tiem nākamais kadrs (serveris aizņemto worker pārstartē). */
const FRAME_TIMEOUT_MS = 12_000;
/** «Nofotografēt»: vairāki kadri pēc kārtas, lai vienotos par rakstzīmēm. */
const SNAP_FRAMES = 3;
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

function streamLive(stream: MediaStream | null): boolean {
  return Boolean(stream?.getVideoTracks().some((t) => t.readyState === "live"));
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
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    const stream = streamRef.current;
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      void el.play().catch(() => undefined);
    }
  }, []);

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
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        setErr("Kamera nav pieejama. Ievadi VIN zemāk.");
      }
    })();
    return () => {
      stop = true;
      scanRef.current?.abort();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [open, cameraKey]);

  /** Kadri pēc kārtas; VIN pieņem tikai, kad vismaz 2 kadri vienojas par katru rakstzīmi. */
  const scan = useCallback(async (frames: number, whole: boolean, pauseMs: number) => {
    scanRef.current?.abort();
    const ac = new AbortController();
    scanRef.current = ac;
    setStatus("reading");
    setProgress(0);
    const picks: string[] = [];
    let last: OcrResult | null = null;
    for (let i = 0; i < frames && !ac.signal.aborted; i++) {
      setProgress(i + 1);
      const video = videoRef.current;
      if (video && video.paused) await video.play().catch(() => undefined);
      const blob = video ? await grabFrame(video, whole).catch(() => null) : null;
      if (blob) {
        const r = await postFrame(blob, ac.signal);
        if (ac.signal.aborted) return;
        if (r?.vin) {
          last = r;
          picks.push(r.vin);
          const c = cameraVinConsensus(picks);
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
    // Nav vienošanās: labāko minējumu ieliek laukā pārbaudei, bet kā «pārbaudi rakstzīmes».
    const guess = cameraVinConsensus(picks, 1);
    if (guess && last) {
      setFound({ vin: guess.vin, checkDigitOk: false, alts: [...new Set([...picks, ...last.alts])].filter((a) => a !== guess.vin).slice(0, 3) });
      setManual(guess.vin);
      setStatus("found");
    } else {
      setStatus("miss");
    }
  }, []);

  // Automātiska nolasīšana: kadrs pēc kadra, līdz kadri vienojas par VIN vai beidzas mēģinājumi.
  useEffect(() => {
    if (!open || !ready) return;
    void scan(AUTO_ATTEMPTS, false, AUTO_PAUSE_MS);
    return () => scanRef.current?.abort();
  }, [open, ready, round, scan]);

  function snapWhole() {
    void scan(SNAP_FRAMES, true, 150);
  }

  function rescan() {
    setFound(null);
    // Ja kamera apstājusies (iOS pēc fona, cits logs), startē no jauna; citādi tikai jauna kārta.
    if (!streamLive(streamRef.current)) setCameraKey((n) => n + 1);
    else setRound((n) => n + 1);
  }

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
            disabled={!ready || status === "reading"}
            onClick={snapWhole}
          >
            <AdminMobileIcon name="kamera" className="h-4 w-4" />
            Nofotografēt
          </button>
          {status === "found" || status === "miss" ? (
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
        disabled={!isValidVin(normalizeVin(manual))}
        onClick={() => onVin(normalizeVin(manual))}
      >
        <AdminMobileIcon name="atzime" className="h-4 w-4" />
        Izmantot VIN
      </button>
    </AdminMobileSheet>
  );
}
