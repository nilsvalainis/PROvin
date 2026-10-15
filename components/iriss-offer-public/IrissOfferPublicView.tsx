import { IrissOfferPublicActions } from "@/components/iriss-offer-public/IrissOfferPublicActions";
import {
  IRISS_OFFER_PUBLIC_BRAND,
  IRISS_OFFER_PUBLIC_LABELS,
  IRISS_OFFER_PUBLIC_LEGAL,
  type IrissOfferPublicView,
} from "@/lib/iriss-offer-client-link";

function Row({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#eee] py-2 text-[15px] last:border-0">
      <span className="text-[#6e6e73]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function IrissOfferPublicView({ token, view }: { token: string; view: IrissOfferPublicView }) {
  const title = view.brandModel || view.title || IRISS_OFFER_PUBLIC_BRAND;
  const facts = [
    [IRISS_OFFER_PUBLIC_LABELS.year, view.firstRegistration],
    [IRISS_OFFER_PUBLIC_LABELS.odometer, view.odometer],
    [IRISS_OFFER_PUBLIC_LABELS.transmission, view.transmission],
    [IRISS_OFFER_PUBLIC_LABELS.location, view.location],
    [IRISS_OFFER_PUBLIC_LABELS.vin, view.vin],
  ] as const;

  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 pb-8 pt-6">
      <header className="flex items-center justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brands/dzintarzeme-iriss-offer-pdf-logo.png" alt={IRISS_OFFER_PUBLIC_BRAND} className="h-9 w-auto" />
        <p className="text-right text-[11px] leading-tight text-[#6e6e73]">
          {IRISS_OFFER_PUBLIC_BRAND}
          <br />
          {IRISS_OFFER_PUBLIC_LEGAL}
        </p>
      </header>
      <h1 className="mt-5 text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
      {view.photos.length > 0 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {view.photos.map((photo, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.id}
              src={`/p/${encodeURIComponent(token)}/photo/${encodeURIComponent(photo.id)}`}
              alt={index === 0 ? title : ""}
              className={`w-full rounded-2xl bg-[#e7e5e4] object-cover ${index === 0 ? "col-span-2 aspect-[16/10]" : "aspect-[4/3]"}`}
            />
          ))}
        </div>
      ) : null}
      <section className="mt-4 rounded-2xl bg-white px-4 py-1 shadow-sm">
        {facts.map(([label, value]) => (
          <Row key={label} label={label} value={value} />
        ))}
      </section>
      {view.checks.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {view.checks.map((item) => (
            <li key={item} className="rounded-full bg-white px-3 py-1 text-[13px] font-medium text-[#166534] shadow-sm">
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {view.notes ? (
        <section className="mt-4 whitespace-pre-wrap rounded-2xl bg-white px-4 py-3 text-[15px] leading-relaxed shadow-sm">
          {view.notes}
        </section>
      ) : null}
      {view.prices.length > 0 || view.total || view.validDays ? (
        <section className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm">
          {view.prices.map((row) => (
            <Row key={row.label} label={row.label} value={row.value} />
          ))}
          {view.total ? <Row label={IRISS_OFFER_PUBLIC_LABELS.total} value={view.total} /> : null}
          {view.validDays ? <Row label={IRISS_OFFER_PUBLIC_LABELS.valid} value={view.validDays} /> : null}
        </section>
      ) : null}
      <section className="mt-5">
        <IrissOfferPublicActions token={token} decision={view.decision} question={view.question} />
      </section>
      <footer className="mt-8 pb-4 text-center text-[10px] leading-relaxed text-[#a1a1aa]">
        <p>{IRISS_OFFER_PUBLIC_BRAND}</p>
        <p>{IRISS_OFFER_PUBLIC_LEGAL}</p>
      </footer>
    </main>
  );
}
