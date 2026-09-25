"use client";

import { useEffect, useRef, useState } from "react";
import { adminActionPillBase } from "@/components/admin/adminActionPill";
import {
  CHECKCAR_VIN_HOME_URL,
  buildCheckcarVinReportUrl,
  normalizeVinForServiceUrls,
} from "@/lib/admin-vin-urls";

type ProbeDetail = {
  vin?: string;
  count?: number;
  error?: string;
};

type Availability = "checking" | "yes" | "no" | "error";

const memoryKey = (vin: string) => `provin-cc-photo:${vin}`;

function readRemembered(vin: string): Availability | null {
  if (!vin || typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(memoryKey(vin));
  if (raw === "yes" || raw === "no") return raw;
  return null;
}

/**
 * Vispirms admin panelī parāda, vai Checkcar.vin ir fotogrāfijas.
 * Atskaite atveras fonā un nāk priekšplānā tikai pēc šīs indikācijas.
 */
export function AdminCcVinPhotoProbeButton({
  vin,
  askVin = false,
  variant = "pill",
}: {
  vin?: string;
  /** Ātrajos vērtējumos VIN nav saglabāts: īss lauks pie pogas. */
  askVin?: boolean;
  variant?: "pill" | "quiet";
}) {
  const [draft, setDraft] = useState(vin ?? "");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const probeWindowRef = useRef<Window | null>(null);
  const effective = normalizeVinForServiceUrls(askVin ? draft : (vin ?? ""));

  useEffect(() => {
    if (!askVin && vin) setDraft(vin);
  }, [askVin, vin]);

  useEffect(() => {
    setAvailability(readRemembered(effective));
    setErrorText(null);
  }, [effective]);

  useEffect(() => {
    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<ProbeDetail>).detail;
      if (!detail || normalizeVinForServiceUrls(detail.vin ?? "") !== effective) return;
      if (detail.error) {
        setAvailability("error");
        setErrorText(detail.error);
        return;
      }
      const yes = typeof detail.count === "number" && detail.count > 0;
      setAvailability(yes ? "yes" : "no");
      setErrorText(null);
      try {
        sessionStorage.setItem(memoryKey(effective), yes ? "yes" : "no");
      } catch {
        /* ignore */
      }
      if (!yes) return;
      const popup = probeWindowRef.current;
      window.setTimeout(() => {
        try {
          if (popup && !popup.closed) popup.focus();
        } catch {
          /* ignore */
        }
      }, 900);
    };
    document.addEventListener("provin-cc-photo", onResult);
    return () => document.removeEventListener("provin-cc-photo", onResult);
  }, [effective]);

  const buttonClass =
    variant === "pill"
      ? `${adminActionPillBase} bg-slate-800 hover:bg-slate-900 focus-visible:ring-slate-700`
      : "inline-flex h-7 items-center rounded-md border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  const href = buildCheckcarVinReportUrl(effective) ?? CHECKCAR_VIN_HOME_URL;
  const chipLabel =
    availability === "yes"
      ? "Ir foto"
      : availability === "no"
        ? "Nav foto"
        : availability === "checking"
          ? "Pārbauda…"
          : errorText || "Nav atbildes";
  const chipClass =
    availability === "yes"
      ? "bg-emerald-600 text-white"
      : availability === "no"
        ? "bg-rose-700 text-white"
        : availability === "checking"
          ? "bg-slate-200 text-slate-700"
          : "bg-amber-100 text-amber-950";

  return (
    <span className="inline-flex items-center gap-1">
      {askVin ? (
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setAvailability(null);
            setErrorText(null);
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
        title="Vispirms admin panelī: vai Checkcar.vin ir fotogrāfijas. Ja ir, atskaite atveras pēc tam."
        data-provin-cc-photo-probe="1"
        data-provin-handoff-vin={effective || undefined}
        onClick={(event) => {
          if (!effective || effective.length < 11) {
            event.preventDefault();
            return;
          }
          event.preventDefault();
          const popup = window.open(href, "_blank");
          probeWindowRef.current = popup;
          if (!popup) {
            setAvailability("error");
            setErrorText("Pārlūks bloķēja jauno cilni.");
            return;
          }
          try {
            popup.blur();
            window.focus();
          } catch {
            /* pārlūks var tomēr pārslēgt cilni */
          }
          const installed = document.documentElement.getAttribute("data-provin-userscript");
          if (!installed) {
            setAvailability("error");
            setErrorText("PROVIN skripts admin lapā nav ieslēgts.");
            return;
          }
          setAvailability("checking");
          setErrorText(null);
          window.setTimeout(() => {
            setAvailability((current) => (current === "checking" ? "error" : current));
          }, 65000);
        }}
      >
        CC foto
      </a>
      {availability ? (
        <span
          className={`inline-flex h-7 items-center rounded-md px-2 text-[10px] font-semibold max-md:h-10 ${chipClass}`}
          role="status"
        >
          {chipLabel}
        </span>
      ) : null}
    </span>
  );
}
