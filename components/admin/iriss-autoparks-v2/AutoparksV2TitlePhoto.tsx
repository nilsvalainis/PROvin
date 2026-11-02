"use client";

import { useEffect } from "react";

/** Titulbildes (galvenās bildes) skatītājs - tas pats `.ap2-modal` / ×, kas failu logam un foto izvēlei. */
export function AutoparksV2TitlePhotoModal({
  src,
  onClose,
}: {
  src: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="ap2-modal" role="dialog" aria-label="Galvenā bilde" onClick={onClose}>
      <div className="ap2-mbox" onClick={(e) => e.stopPropagation()}>
        <div className="ap2-mh">
          <span className="t">Galvenā bilde</span>
          <button type="button" className="ap2-x" onClick={onClose} aria-label="Aizvērt">
            ×
          </button>
        </div>
        <div className="ap2-doc">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Galvenā bilde" />
        </div>
      </div>
    </div>
  );
}

export function titlePhotoSrc(carId: string, version = 0): string {
  return `/api/admin/iriss-autoparks-v2/pamatdati/${encodeURIComponent(carId)}/foto${version ? `?v=${version}` : ""}`;
}
