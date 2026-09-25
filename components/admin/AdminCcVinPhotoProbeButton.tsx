"use client";

import { useEffect, useState } from "react";
import { adminActionPillBase } from "@/components/admin/adminActionPill";
import { CHECKCAR_VIN_HOME_URL, normalizeVinForServiceUrls } from "@/lib/admin-vin-urls";

type ProbeDetail = {
  vin?: string;
  count?: number;
  error?: string;
};

/**
 * Atver Checkcar.vin. PROVIN Tampermonkey skripts ievada VIN, nospiež Check VIN
 * un atgriež fotogrāfiju skaitu ar `provin-cc-photo`.
 */
export function AdminCcVinPhotoProbeButton({
  vin,
  askVin = false,
  variant = "pill",
}: {
  vin?: string;
  /** Ātrajos vērtējumos VIN nav saglabāts — īss lauks pie pogas. */
  askVin?: boolean;
  variant?: "pill" | "quiet";
}) {
  const [draft, setDraft] = useState(vin ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const effective = normalizeVinForServiceUrls(askVin ? draft : (vin ?? ""));

  useEffect(() => {
    if (!askVin && vin) setDraft(vin);
  }, [askVin, vin]);

  useEffect(() => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<ProbeDetail>).detail;
      if (!detail || normalizeVinForServiceUrls(detail.vin ?? "") !== effective) return;
      if (detail.error) {
        setStatus(detail.error);
        return;
      }
      const count = typeof detail.count === "number" ? detail.count : 0;
      setStatus(count > 0 ? `${count} foto` : "Nav foto");
    };
    document.addEventListener("provin-cc-photo", onResult);
    return () => document.removeEventListener("provin-cc-photo", onResult);
  }, [effective]);

  const buttonClass =
    variant === "pill"
      ? `${adminActionPillBase} bg-slate-800 hover:bg-slate-900 focus-visible:ring-slate-700`
      : "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  const href =
    effective.length >= 11
      ? `${CHECKCAR_VIN_HOME_URL}?vin=${encodeURIComponent(effective)}&provin_probe=1`
      : CHECKCAR_VIN_HOME_URL;

  return (
    <span className="inline-flex items-center gap-1">
      {askVin ? (
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setStatus(null);
          }}
          placeholder="VIN"
          aria-label="VIN Checkcar fotogrāfijām"
          spellCheck={false}
          className="h-[28px] w-[8.6rem] rounded-md border border-slate-200 bg-white px-2 font-mono text-[11px] uppercase text-[var(--color-apple-text)] outline-none focus:border-[var(--color-provin-accent)] max-md:h-10"
        />
      ) : null}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!effective || effective.length < 11}
        className={`${buttonClass} ${!effective || effective.length < 11 ? "pointer-events-none opacity-40" : ""}`}
        title="Checkcar.vin: vai šim VIN ir fotogrāfijas, un cik. Ja nestrādā, atvērtajā Checkcar cilnē pārbaudi DevTools konsoli (rindas ar 'PROVIN')."
        data-provin-cc-photo-probe="1"
        data-provin-handoff-vin={effective || undefined}
        onClick={(event) => {
          if (!effective || effective.length < 11) {
            event.preventDefault();
            return;
          }
          setStatus("Skaita…");
          window.setTimeout(() => {
            setStatus((current) =>
              current === "Skaita…" ? "Nav atbildes. Skat. konsoli Checkcar cilnē." : current,
            );
          }, 65000);
        }}
      >
        {status ?? "CC foto"}
      </a>
    </span>
  );
}
