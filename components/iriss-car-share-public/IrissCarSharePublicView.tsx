import { IRISS_CAR_SHARE_PUBLIC_BRAND, IRISS_CAR_SHARE_PUBLIC_LEGAL, type IrissCarSharePublicView } from "@/lib/iriss-car-share";

export function IrissCarSharePublicUnavailable() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="text-[13px] font-semibold tracking-[0.12em] text-[#9a3412]">{IRISS_CAR_SHARE_PUBLIC_BRAND}</p>
      <h1 className="mt-6 text-[26px] font-semibold tracking-tight">Saite nav pieejama</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#6e6e73]">Šī saite nav derīga. Sazinieties ar Dzintarzeme Auto.</p>
      <p className="mt-8 text-[10px] leading-relaxed text-[#c7c7cc]">
        {IRISS_CAR_SHARE_PUBLIC_BRAND}
        <br />
        {IRISS_CAR_SHARE_PUBLIC_LEGAL}
      </p>
    </main>
  );
}

export function IrissCarSharePublicView({ token, view }: { token: string; view: IrissCarSharePublicView }) {
  const meta = [view.year, view.color, view.mileage].filter(Boolean).join(" · ");
  return (
    <main className="mx-auto min-h-dvh max-w-md px-4 py-8">
      <p className="text-[13px] font-semibold tracking-[0.12em] text-[#9a3412]">{view.brand}</p>
      <h1 className="mt-4 text-[28px] font-semibold tracking-tight">{view.title}</h1>
      {meta ? <p className="mt-1 text-[15px] text-[#6e6e73]">{meta}</p> : null}
      {view.hasPhoto ? (
        <img className="mt-5 h-48 w-full rounded-[22px] object-cover" src={`/a/${encodeURIComponent(token)}/foto`} alt="" />
      ) : (
        <div className="mt-5 h-48 rounded-[22px] bg-[#d9dbe0]" />
      )}
      {view.vin ? <p className="mt-4 font-mono text-[13px] text-[#6e6e73]">{view.vin}</p> : null}
      <p className="mt-6 text-[13px] leading-relaxed text-[#6e6e73]">Pamatdati bez cenas. Jautājumiem sazinieties ar Dzintarzeme Auto.</p>
      <p className="mt-10 text-[10px] leading-relaxed text-[#c7c7cc]">
        {view.brand}
        <br />
        {view.legalName}
      </p>
    </main>
  );
}
