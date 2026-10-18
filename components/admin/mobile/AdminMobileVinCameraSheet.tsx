"use client";

import { useEffect, useRef, useState } from "react";
import { AdminMobileSheet } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileIcon } from "@/components/admin/mobile/AdminMobileIcon";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

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
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) return;
    let stop = false;
    setErr("");
    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
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

  return (
    <AdminMobileSheet open={open} title="VIN SCAN" subtitle="Novieto VIN rāmī" onClose={onClose}>
      <div className="relative overflow-hidden rounded-[18px] bg-black">
        <video ref={videoRef} className="h-[280px] w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-16 -translate-y-1/2 rounded-xl border-2 border-white/80" />
      </div>
      {err ? <p className="mt-2 text-[13px] text-[var(--am-ink2)]">{err}</p> : null}
      <label className="mt-3 block rounded-[14px] bg-[var(--am-s2)] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.045em] text-[var(--am-ink3)]">VIN</span>
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value.toUpperCase())}
          className="mt-1 w-full bg-transparent font-mono text-[16px] outline-none"
          placeholder="17 rakstzīmes"
          aria-label="VIN no kameras"
        />
      </label>
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
