import type { ReactNode } from "react";
import { IrissOfferProvinBusinessTile } from "@/components/iriss-offer-public/IrissOfferProvinBusinessTile";
import {
  IrissOfferPublicBrandHeader,
  IrissOfferPublicFooter,
  IrissOfferPublicSectionTitle,
  IrissOfferPublicShell,
  IrissOfferPublicSpecCell,
  irissOfferPublicCardClass,
} from "@/components/iriss-offer-public/IrissOfferPublicChrome";
import { IrissOfferPublicGallery, type IrissOfferPublicGalleryUrlMap } from "@/components/iriss-offer-public/IrissOfferPublicGallery";
import { PdClientContent } from "@/components/iriss-piedavajumi/PdClientContent";
import { PdOfferExtraSections } from "@/components/iriss-piedavajumi/PdOfferExtraSections";
import { IRISS_OFFER_PUBLIC_LABELS } from "@/lib/iriss-offer-client-link";
import { irissPdFactValue, irissPdSubtitle, type IrissPdPublicView, type IrissPdViewMode } from "@/lib/iriss-piedavajumi";

/** Galerijas URL kā vienkāršas virknes (galerija ir klienta komponente - funkcijas tai nodot nedrīkst). */
export function pdGalleryUrlMap(
  photoCount: number,
  photoSrc: (index: number, size: "thumb" | "full") => string,
): IrissOfferPublicGalleryUrlMap {
  const thumb: Record<string, string> = {};
  const full: Record<string, string> = {};
  for (let i = 0; i < photoCount; i += 1) {
    thumb[String(i)] = photoSrc(i, "thumb");
    full[String(i)] = photoSrc(i, "full");
  }
  return { thumb, full };
}

/**
 * Klienta skats (`/p/d/<token>` un admina preview). Tā pati vizuālā bāze kā `/p/` IrissOfferPublic.
 * Auto1 ir datu avots: papildu kartītes tikai tad, kad ir ko rādīt.
 * j75: starp Parametriem un Auto1 - Aprīkojums / Stāvoklis / Kopsavilkums (`PdClientContent`).
 */
export function PdClientView({
  view,
  mode,
  photoSrc,
  token = "",
  embedded = false,
  hiddenLabels = [],
  showHiddenNote = false,
  children,
}: {
  view: IrissPdPublicView;
  mode: IrissPdViewMode;
  photoSrc: (index: number, size: "thumb" | "full") => string;
  token?: string;
  embedded?: boolean;
  hiddenLabels?: string[];
  showHiddenNote?: boolean;
  children?: ReactNode;
}) {
  const title = view.title || "Auto";
  const subtitle = irissPdSubtitle(view.facts);
  const vin = irissPdFactValue(view.facts, "VIN");
  const year = irissPdFactValue(view.facts, "Pirmā reģistrācija") || irissPdFactValue(view.facts, "Gads");
  const specs = [
    [IRISS_OFFER_PUBLIC_LABELS.odometer, irissPdFactValue(view.facts, "Nobraukums")],
    [IRISS_OFFER_PUBLIC_LABELS.year, year],
    [IRISS_OFFER_PUBLIC_LABELS.transmission, irissPdFactValue(view.facts, "Ātrumkārba")],
    [IRISS_OFFER_PUBLIC_LABELS.fuel, irissPdFactValue(view.facts, "Degviela")],
    [IRISS_OFFER_PUBLIC_LABELS.bodyType, irissPdFactValue(view.facts, "Virsbūve")],
    ["Jauda", irissPdFactValue(view.facts, "Jauda")],
    ["Tilpums", irissPdFactValue(view.facts, "Tilpums")],
    ["Krāsa", irissPdFactValue(view.facts, "Krāsa")],
  ] as const;
  const hasParametri = vin.length > 0 || specs.some(([, v]) => v);
  const photos = Array.from({ length: view.photoCount }, (_, i) => ({ id: String(i) }));
  const hasPhotos = photos.length > 0;
  const pathHint = token ? `provin.lv/p/d/${token.slice(0, 8)}…` : "";

  return (
    <IrissOfferPublicShell embedded={embedded}>
      <IrissOfferPublicBrandHeader />

      <h1 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-[13px] text-[#52525b]">{subtitle}</p> : null}

      {hasPhotos ? (
        <IrissOfferPublicGallery
          token={token || "preview"}
          title={title}
          photos={photos}
          urlMap={pdGalleryUrlMap(view.photoCount, photoSrc)}
        />
      ) : null}

      {view.price ? (
        <section className={irissOfferPublicCardClass(hasPhotos ? "" : "mt-4")}>
          <p className="text-[32px] font-bold tracking-[-0.02em]">{view.price}</p>
          <p className="mt-1.5 text-[12px] text-[#52525b]">
            {IRISS_OFFER_PUBLIC_LABELS.total} · piedāvājums sagatavots personīgi jums
            {view.validUntilLabel ? ` · ${IRISS_OFFER_PUBLIC_LABELS.valid} līdz ${view.validUntilLabel}` : ""}
          </p>
        </section>
      ) : null}

      {hasParametri ? (
        <section className={irissOfferPublicCardClass()}>
          <IrissOfferPublicSectionTitle>Parametri</IrissOfferPublicSectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {vin ? (
              <>
                <IrissOfferPublicSpecCell
                  label={IRISS_OFFER_PUBLIC_LABELS.vin}
                  value={vin}
                  className="sm:col-span-2"
                  valueClassName="font-mono text-[12px] font-semibold tracking-wide break-all sm:text-[13px]"
                />
                <IrissOfferProvinBusinessTile vin={vin} />
              </>
            ) : null}
            {specs.map(([label, value]) => (
              <IrissOfferPublicSpecCell key={label} label={label} value={value} />
            ))}
          </div>
        </section>
      ) : null}

      <PdClientContent content={view.content} />

      {view.auto1 ? <PdOfferExtraSections blocks={view.auto1} show={view.blocks} expandAll={mode === "pdf"} /> : null}

      {showHiddenNote ? (
        <p className="mt-3 text-center text-[11px] leading-relaxed text-[#a1a1aa]">
          {hiddenLabels.length ? `Paslēpts (${mode === "pdf" ? "PDF" : "saite"}=OFF): ${hiddenLabels.join(", ")}. ` : ""}
          Nekad: avots, saite, iepirkuma cena, iekšējās piezīmes.
        </p>
      ) : null}

      {children ? <section className="mt-5 border-t border-[#e4e4e7] pt-4">{children}</section> : null}

      {view.state === "approved" && !children ? (
        <section className="mt-5 border-t border-[#e4e4e7] pt-4">
          <div className="rounded-2xl bg-[#ecfdf3] px-4 py-5 text-center" role="status">
            <p className="text-[17px] font-bold text-[#047857]">Piedāvājums apstiprināts</p>
            <p className="mt-1 text-[13px] text-[#52525b]">Sazināsimies ar Jums</p>
          </div>
        </section>
      ) : null}

      <IrissOfferPublicFooter pathHint={pathHint} />
    </IrissOfferPublicShell>
  );
}
