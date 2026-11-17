import { IrissOfferProvinBusinessTile } from "@/components/iriss-offer-public/IrissOfferProvinBusinessTile";
import { IrissOfferPublicActions } from "@/components/iriss-offer-public/IrissOfferPublicActions";
import {
  IrissOfferPublicBrandHeader,
  IrissOfferPublicFooter,
  IrissOfferPublicKvRow,
  IrissOfferPublicSectionTitle,
  IrissOfferPublicShell,
  IrissOfferPublicSpecCell,
  irissOfferPublicCardClass,
} from "@/components/iriss-offer-public/IrissOfferPublicChrome";
import { IrissOfferPublicGallery } from "@/components/iriss-offer-public/IrissOfferPublicGallery";
import {
  IRISS_OFFER_PUBLIC_BRAND,
  IRISS_OFFER_PUBLIC_LABELS,
  type IrissOfferPublicView as IrissOfferPublicViewModel,
} from "@/lib/iriss-offer-client-link";

function subtitleParts(view: IrissOfferPublicViewModel): string {
  return [
    view.firstRegistration ? `${IRISS_OFFER_PUBLIC_LABELS.year} ${view.firstRegistration}` : "",
    view.odometer,
    view.transmission,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function IrissOfferPublicView({ token, view }: { token: string; view: IrissOfferPublicViewModel }) {
  const title = view.brandModel || view.title || IRISS_OFFER_PUBLIC_BRAND;
  const subtitle = subtitleParts(view);
  const vin = view.vin.trim();
  const specs = [
    [IRISS_OFFER_PUBLIC_LABELS.location, view.location],
    [IRISS_OFFER_PUBLIC_LABELS.odometer, view.odometer],
    [IRISS_OFFER_PUBLIC_LABELS.year, view.firstRegistration],
    [IRISS_OFFER_PUBLIC_LABELS.transmission, view.transmission],
    [IRISS_OFFER_PUBLIC_LABELS.fuel, view.fuel],
    [IRISS_OFFER_PUBLIC_LABELS.bodyType, view.bodyType],
  ] as const;
  const hasParametri = vin.length > 0 || specs.some(([, v]) => v.trim());

  const hasPhotos = view.photos.length > 0;

  return (
    <IrissOfferPublicShell>
      <IrissOfferPublicBrandHeader />

      <h1 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-[13px] text-[#52525b]">{subtitle}</p> : null}

      {hasPhotos ? <IrissOfferPublicGallery token={token} title={title} photos={view.photos} /> : null}

      {view.total ? (
        <section className={irissOfferPublicCardClass(hasPhotos ? "" : "mt-4")}>
          <p className="text-[32px] font-bold tracking-[-0.02em]">{view.total}</p>
          <p className="mt-1.5 text-[12px] text-[#52525b]">
            {IRISS_OFFER_PUBLIC_LABELS.total} · piedāvājums sagatavots personīgi jums
            {view.validDays ? ` · ${IRISS_OFFER_PUBLIC_LABELS.valid} ${view.validDays}` : ""}
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

      {view.specialNotes ? (
        <section className={irissOfferPublicCardClass()}>
          <IrissOfferPublicSectionTitle>Īpašas atzīmes</IrissOfferPublicSectionTitle>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#52525b]">{view.specialNotes}</p>
        </section>
      ) : null}

      {view.visualAssessment ? (
        <section className={irissOfferPublicCardClass()}>
          <IrissOfferPublicSectionTitle>Vizuālais novērtējums</IrissOfferPublicSectionTitle>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#52525b]">{view.visualAssessment}</p>
        </section>
      ) : null}

      {view.technicalAssessment ? (
        <section className={irissOfferPublicCardClass()}>
          <IrissOfferPublicSectionTitle>Tehniskais novērtējums</IrissOfferPublicSectionTitle>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#52525b]">{view.technicalAssessment}</p>
        </section>
      ) : null}

      {view.checks.length > 0 || view.notes ? (
        <section className={irissOfferPublicCardClass()}>
          <IrissOfferPublicSectionTitle>Stāvoklis</IrissOfferPublicSectionTitle>
          {view.checks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {view.checks.map((item) => (
                <span
                  key={item}
                  className="inline-block rounded-full border border-[#e4e4e7] bg-[#f4f4f5] px-2.5 py-1 text-[11px] font-semibold text-[#52525b]"
                >
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          {view.notes ? (
            <p className={`whitespace-pre-wrap text-[13px] leading-relaxed text-[#52525b] ${view.checks.length > 0 ? "mt-3" : ""}`}>
              {view.notes}
            </p>
          ) : null}
        </section>
      ) : null}

      {view.prices.length > 0 ? (
        <section className={irissOfferPublicCardClass()}>
          <IrissOfferPublicSectionTitle>Izmaksas</IrissOfferPublicSectionTitle>
          {view.prices.map((row) => (
            <IrissOfferPublicKvRow key={row.label} label={row.label} value={row.value} />
          ))}
          {view.total ? <IrissOfferPublicKvRow label={IRISS_OFFER_PUBLIC_LABELS.total} value={view.total} strong /> : null}
        </section>
      ) : null}

      {view.customBlocks.map((block) => (
        <section key={block.id} className={irissOfferPublicCardClass()}>
          <IrissOfferPublicSectionTitle>{block.title || (block.kind === "table" ? "Tabula" : "Teksts")}</IrissOfferPublicSectionTitle>
          {block.kind === "table" ? (
            <div className="space-y-2">
              {block.rows.map((row, i) => (
                <div key={i} className="flex items-baseline justify-between gap-3 border-b border-[#e4e4e7] py-1.5 text-[13px] last:border-0">
                  <span className="text-[#52525b]">{row.label}</span>
                  <span className="text-right font-semibold text-[#111827]">{row.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#52525b]">{block.html}</p>
          )}
        </section>
      ))}

      <section className="mt-5 border-t border-[#e4e4e7] pt-4">
        <IrissOfferPublicActions
          token={token}
          decision={view.decision}
          decidedAt={view.decidedAt}
          question={view.question}
          deadlineAt={view.deadlineAt}
          serverNow={view.serverNow}
          vehicle={title}
          total={view.total}
        />
      </section>

      <IrissOfferPublicFooter pathHint={`provin.lv/p/${token.slice(0, 8)}…`} />
    </IrissOfferPublicShell>
  );
}
