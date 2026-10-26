import type { ReactNode } from "react";
import { PdAuto1Blocks } from "@/components/iriss-piedavajumi/PdAuto1Blocks";
import { PdClientContent } from "@/components/iriss-piedavajumi/PdClientContent";
import type { IrissPdPublicView, IrissPdViewMode } from "@/lib/iriss-piedavajumi";
import { IRISS_PD_BLOCK_IDS, IRISS_PD_BLOCK_LV } from "@/lib/iriss-piedavajumi-types";

/**
 * Tas, ko klients redz (publiskā saite / PDF). Tikai `IrissPdPublicView` - nekādu iekšējo lauku.
 * Bildes caur `photoSrc` (klientam `/p/d/<token>/foto/<n>`).
 */
export function PdClientView({
  view,
  mode,
  photoSrc,
  compact = false,
  showHiddenNote = false,
  children,
}: {
  view: IrissPdPublicView;
  mode: IrissPdViewMode;
  photoSrc: (index: number, size: "thumb" | "full") => string;
  compact?: boolean;
  /** Admina priekšskatījumā: kuri bloki paslēpti. */
  showHiddenNote?: boolean;
  children?: ReactNode;
}) {
  const hidden = view.auto1 ? IRISS_PD_BLOCK_IDS.filter((id) => !view.blocks[id]).map((id) => IRISS_PD_BLOCK_LV[id]) : [];
  const thumbs = compact ? 0 : Math.min(view.photoCount, 24);
  return (
    <div className="pdc">
      {view.photoCount > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="pdc-hero" src={photoSrc(0, "full")} alt={view.title || "Auto"} />
      ) : (
        <div className="pdc-hero" aria-hidden="true" />
      )}
      {thumbs > 1 ? (
        <div className="pdc-strip">
          {Array.from({ length: thumbs - 1 }, (_, i) => (
            <a key={i} href={photoSrc(i + 1, "full")} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(i + 1, "thumb")} alt={`Foto ${i + 2}`} loading="lazy" />
            </a>
          ))}
        </div>
      ) : null}
      <b className="pdc-title">{view.title || "Auto"}</b>
      <div className="pdc-price">
        <b>{view.price || "Cena pēc vienošanās"}</b>
        {view.validUntilLabel ? <span className="pd-mu" style={{ fontSize: 12 }}>līdz {view.validUntilLabel}</span> : null}
      </div>
      {view.facts.length ? (
        <>
          <div className="pdc-sec">Auto dati</div>
          <div className="pd-zt2">
            {(compact ? view.facts.slice(0, 4) : view.facts).map((f) => (
              <div key={f.label}>
                <span>{f.label}:</span>
                {f.value}
              </div>
            ))}
          </div>
        </>
      ) : null}
      <PdClientContent content={view.content} />
      {view.auto1 ? (
        <div style={{ marginTop: 12 }}>
          <PdAuto1Blocks blocks={view.auto1} show={view.blocks} compact={compact} expandAll={mode === "pdf"} />
        </div>
      ) : null}
      {showHiddenNote ? (
        <p className="pdc-foot">
          {hidden.length ? `Paslēpts (${mode === "pdf" ? "PDF" : "saite"}=OFF): ${hidden.join(", ")}. ` : ""}Nekad: avots, saite, iepirkuma cena, iekšējās piezīmes.
        </p>
      ) : null}
      {children}
    </div>
  );
}
