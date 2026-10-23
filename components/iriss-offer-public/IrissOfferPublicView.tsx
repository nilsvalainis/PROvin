import { DzintarzemeOfferBrandLogo } from "@/components/iriss-offer-public/DzintarzemeOfferBrandLogo";
import { IrissOfferProvinBusinessTile } from "@/components/iriss-offer-public/IrissOfferProvinBusinessTile";
import { IrissOfferPublicActions } from "@/components/iriss-offer-public/IrissOfferPublicActions";
import {
  IRISS_OFFER_PUBLIC_BRAND,
  IRISS_OFFER_PUBLIC_LABELS,
  IRISS_OFFER_PUBLIC_LEGAL,
  type IrissOfferPublicView as IrissOfferPublicViewModel,
} from "@/lib/iriss-offer-client-link";

function cardClassName(extra = "") {
  return `mt-3.5 rounded-2xl border border-[#e4e4e7] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${extra}`.trim();
}

function sectionTitle(children: string) {
  return (
    <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[#52525b]">{children}</h2>
  );
}

function SpecCell({
  label,
  value,
  className = "",
  valueClassName = "",
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
}) {
  if (!value.trim()) return null;
  return (
    <div className={`rounded-xl border border-[#e4e4e7] bg-[#fafafa] p-2.5 ${className}`.trim()}>
      <b className="block text-[10px] font-medium text-[#52525b]">{label}</b>
      <span className={`mt-1 block text-[13px] font-semibold leading-snug text-[#111827] ${valueClassName}`.trim()}>
        {value}
      </span>
    </div>
  );
}

function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  if (!value.trim()) return null;
  return (
    <div
      className={`flex items-baseline justify-between gap-3 border-b border-[#e4e4e7] py-2.5 text-[14px] last:border-0 ${
        strong ? "border-0 pt-1 text-[16px] font-bold" : ""
      }`}
    >
      <span className={strong ? "text-[#111827]" : "text-[#52525b]"}>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

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
  const heroId = view.photos[0]?.id;
  const thumbIds = view.photos.slice(1, 7);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[720px] px-4 pb-10 pt-7 text-[#111827] sm:px-7">
      <div className="flex items-start justify-between gap-3">
        <DzintarzemeOfferBrandLogo />
        <p className="text-right text-[11px] leading-tight text-[#6e6e73]">
          {IRISS_OFFER_PUBLIC_BRAND}
          <br />
          {IRISS_OFFER_PUBLIC_LEGAL}
        </p>
      </div>

      <h1 className="mt-4 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-[13px] text-[#52525b]">{subtitle}</p> : null}

      {hasPhotos && heroId ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#e4e4e7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/p/${encodeURIComponent(token)}/photo/${encodeURIComponent(heroId)}`}
            alt={title}
            className="aspect-[16/10] w-full bg-[#e4e4e7] object-cover"
          />
          {thumbIds.length > 0 ? (
            <div className="grid grid-cols-3 gap-1.5 bg-white p-2 sm:grid-cols-6">
              {thumbIds.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photo.id}
                  src={`/p/${encodeURIComponent(token)}/photo/${encodeURIComponent(photo.id)}`}
                  alt=""
                  className="aspect-[4/3] w-full rounded-lg border border-[#e4e4e7] bg-[#f4f4f5] object-cover"
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {view.total ? (
        <section className={cardClassName(hasPhotos ? "" : "mt-4")}>
          <p className="text-[32px] font-bold tracking-[-0.02em]">{view.total}</p>
          <p className="mt-1.5 text-[12px] text-[#52525b]">
            {IRISS_OFFER_PUBLIC_LABELS.total} · piedāvājums sagatavots personīgi jums
            {view.validDays ? ` · ${IRISS_OFFER_PUBLIC_LABELS.valid} ${view.validDays}` : ""}
          </p>
        </section>
      ) : null}

      {hasParametri ? (
        <section className={cardClassName()}>
          {sectionTitle("Parametri")}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {vin ? (
              <>
                <SpecCell
                  label={IRISS_OFFER_PUBLIC_LABELS.vin}
                  value={vin}
                  className="sm:col-span-2"
                  valueClassName="font-mono text-[12px] font-semibold tracking-wide break-all sm:text-[13px]"
                />
                <IrissOfferProvinBusinessTile vin={vin} />
              </>
            ) : null}
            {specs.map(([label, value]) => (
              <SpecCell key={label} label={label} value={value} />
            ))}
          </div>
        </section>
      ) : null}

      {view.checks.length > 0 || view.notes ? (
        <section className={cardClassName()}>
          {sectionTitle("Stāvoklis")}
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
        <section className={cardClassName()}>
          {sectionTitle("Izmaksas")}
          {view.prices.map((row) => (
            <PriceRow key={row.label} label={row.label} value={row.value} />
          ))}
          {view.total ? <PriceRow label={IRISS_OFFER_PUBLIC_LABELS.total} value={view.total} strong /> : null}
        </section>
      ) : null}

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

      <footer className="mt-6 text-center text-[10px] leading-relaxed text-[#a1a1aa]">
        <p>{IRISS_OFFER_PUBLIC_BRAND} · {IRISS_OFFER_PUBLIC_LEGAL}</p>
        <p className="mt-0.5 truncate">provin.lv/p/{token.slice(0, 8)}…</p>
      </footer>
    </main>
  );
}
