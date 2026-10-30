"use client";

import { useEffect, useState } from "react";
import { fmtDateLv } from "@/lib/iriss-autoparks-v2-format";

export type ModalFile = { id: string; title: string; date: string; contentType: string };

/** Bilde pēc tipa vai, ja Dropbox/serveris dod vispārīgu tipu, pēc faila nosaukuma (arī iPhone HEIC). */
export function isModalImage(f: Pick<ModalFile, "contentType" | "title">): boolean {
  if (f.contentType.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.title.trim());
}

/** iPhone/iPad Safari PDF iframe rāda tukšu vai tikai 1. lapu - tur PDF atver Safari skatītājā (Nils 27.10, iOS 18.3.1). */
export function isIosWebKit(ua: string, maxTouchPoints = 0): boolean {
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

/** Faila logs (D3): nosaukums · datums, "1 / N", LEJUPIELĀDĒT, ×; ‹ › starp failiem. Fails tikai caur servera API. */
export function FileModal({
  files,
  index,
  urlFor,
  onIndex,
  onClose,
}: {
  files: ModalFile[];
  index: number;
  urlFor: (f: ModalFile) => string;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const f = files[index];
  const [ios, setIos] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setIos(isIosWebKit(navigator.userAgent, navigator.maxTouchPoints)), []);
  useEffect(() => setImgFailed(false), [index]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && index < files.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [files.length, index, onClose, onIndex]);
  if (!f) return null;
  const url = urlFor(f);
  const isImg = isModalImage(f);
  return (
    <div className="ap2-modal" role="dialog" aria-label={f.title} onClick={onClose}>
      <div className="ap2-mbox" onClick={(e) => e.stopPropagation()}>
        <div className="ap2-mh">
          <span className="t">
            {f.title}
            {f.date ? ` · ${fmtDateLv(f.date)}` : ""}
          </span>
          {files.length > 1 ? (
            <span className="pgn">
              {index + 1} / {files.length}
            </span>
          ) : null}
          <a className="ap2-btn sec sm ap2-dlbtn" href={`${url}${url.includes("?") ? "&" : "?"}dl=1`}>
            LEJUPIELĀDĒT
          </a>
          <button type="button" className="ap2-x" onClick={onClose} aria-label="Aizvērt">
            ×
          </button>
        </div>
        <div className="ap2-doc">
          {index > 0 ? (
            <button type="button" className="ap2-nav l" onClick={() => onIndex(index - 1)} aria-label="Iepriekšējais">
              ‹
            </button>
          ) : null}
          {isImg && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={f.title} onError={() => setImgFailed(true)} />
          ) : isImg || ios ? (
            <div className="ap2-docopen">
              <p>{isImg ? "Šo bildi pārlūks nevar parādīt šeit." : "PDF šajā telefonā atveras Safari skatītājā."}</p>
              <a className="ap2-btn dark" href={url} target="_blank" rel="noopener">
                Atvērt
              </a>
            </div>
          ) : (
            <iframe src={url} title={f.title} />
          )}
          {index < files.length - 1 ? (
            <button type="button" className="ap2-nav r" onClick={() => onIndex(index + 1)} aria-label="Nākamais">
              ›
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function PdfIcon({ small = false }: { small?: boolean }) {
  return (
    <span className={`ap2-pdf ${small ? "s" : ""}`} aria-hidden>
      <i style={{ top: small ? 8 : 12 }} />
      <i style={{ top: small ? 15 : 22, right: 24 }} />
      <i style={{ top: small ? 22 : 32 }} />
      <em>PDF</em>
    </span>
  );
}

export function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <path d="M6.5 9.5l3-3" />
      <path d="M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1" />
      <path d="M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1" />
    </svg>
  );
}
