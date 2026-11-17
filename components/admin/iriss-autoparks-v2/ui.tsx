"use client";

import { useEffect, useState } from "react";

/** VIN ar kopēšanas ikonu (bez vārda "Kopēt"); kopē vienmēr PILNU VIN. */
export function VinCopy({ vin, className = "" }: { vin: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!vin) return null;
  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(vin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* pārlūks neatļauj - nekas */
    }
  }
  return (
    <button type="button" className={`ap2-vin ${copied ? "copied" : ""} ${className}`} onClick={copy} aria-label={`${vin} - kopēt VIN`}>
      <span>{vin}</span>
      <CopyIcon />
    </button>
  );
}

export function CopyIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="5.5" y="5.5" width="8" height="8" rx="2" />
      <path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5" />
    </svg>
  );
}

/** Auto vietturis (kā maketā), kamēr nav /STOCK bildes. */
export function CarPlaceholder() {
  return (
    <svg viewBox="0 0 120 90" aria-hidden>
      <rect x="0" y="0" width="120" height="90" fill="#dfe3ea" />
      <rect x="0" y="66" width="120" height="24" fill="rgba(0,0,0,.06)" />
      <path d="M30 40 L38 24 Q40 20 46 20 L74 20 Q80 20 82 24 L90 40 Z" fill="#8a93a3" opacity=".85" />
      <path d="M36 38 L42 26 Q43 24 47 24 L73 24 Q77 24 78 26 L84 38 Z" fill="#2b3240" opacity=".75" />
      <rect x="22" y="38" width="76" height="22" rx="7" fill="#8a93a3" />
      <rect x="27" y="43" width="14" height="6" rx="3" fill="#f5f5f0" />
      <rect x="79" y="43" width="14" height="6" rx="3" fill="#f5f5f0" />
      <rect x="46" y="44" width="28" height="9" rx="3" fill="#2b3240" opacity=".8" />
      <rect x="50" y="55" width="20" height="5" rx="1" fill="#fff" />
      <rect x="26" y="58" width="12" height="8" rx="2" fill="#1f2430" />
      <rect x="82" y="58" width="12" height="8" rx="2" fill="#1f2430" />
    </svg>
  );
}

/**
 * Galvenā bilde no /STOCK (API to atrod pirmajā pieprasījumā) virs vietturā; ja bildes nav - paliek vietturis.
 * `onEditPhoto` (J29 B): ja dots, rāda kameras pogu stūrī "Mainīt galveno bildi" izvēlei. `version` - atjaunina
 * `<img>` src pēc izvēles, lai pārlūks neizmanto vecā attēla kešu.
 * `onOpenPhoto` (LAW 30.10): klikšķis uz bildes atver titulbildes popup (kameras poga paliek atsevišķa).
 */
export function CarImg({
  carId,
  className = "ap2-img",
  onEditPhoto,
  onOpenPhoto,
  version = 0,
}: {
  carId: string;
  className?: string;
  onEditPhoto?: () => void;
  onOpenPhoto?: () => void;
  version?: number;
}) {
  const [failed, setFailed] = useState(false);
  // Tikai pēc hidratācijas: citādi 404 notiek pirms React un onError nenostrādā (salauztas bildes ikona).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => setFailed(false), [version]);
  const src = `/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(carId)}/foto${version ? `?v=${version}` : ""}`;
  const photo = mounted && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
  ) : null;
  return (
    <span className={className} style={{ position: "relative" }}>
      <CarPlaceholder />
      {onOpenPhoto && !failed ? (
        <button type="button" className="ap2-img-open" onClick={onOpenPhoto} aria-label="Atvērt galveno bildi">
          {photo}
        </button>
      ) : (
        photo
      )}
      {onEditPhoto ? (
        <button type="button" className="ap2-cambtn" onClick={onEditPhoto} aria-label="Mainīt galveno bildi">
          <CameraIcon />
        </button>
      ) : null}
    </span>
  );
}

export function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function yearColor(year: string, color: string): string {
  return [year, color].filter(Boolean).join(" · ");
}
