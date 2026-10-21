import type { Metadata } from "next";
import { isLogisticsOrderActive } from "@/lib/iriss-logistics-archive";
import { formatCargoDuration, formatCargoKm } from "@/lib/iriss-logistics-cargo-plan";
import { loadCargoPlanForActiveOrders } from "@/lib/iriss-logistics-cargo-store";
import { buildDriverRouteView } from "@/lib/iriss-logistics-driver-link";
import { findDriverLink } from "@/lib/iriss-logistics-driver-link-store";
import { listLogisticsOrders } from "@/lib/iriss-logistics-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maršruts",
  robots: { index: false, follow: false },
};

const card = "rounded-[18px] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)]";
const navBtn =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-[#1a73e8] px-4 text-[15px] font-semibold text-white";

/** Šoferim: tikai lasāms kravas maršruts. Dati ir dzīvi, tāpēc secības maiņa redzama uzreiz. */
export default async function DriverRoutePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await findDriverLink(token).catch(() => null);
  if (!link) {
    return (
      <main className="mx-auto max-w-[560px] px-4 py-16 text-center">
        <h1 className="text-[22px] font-semibold">Saite nav derīga</h1>
        <p className="mt-2 text-[15px] text-[#6e6e73]">Tā ir beigusies vai atsaukta. Palūdz jaunu saiti.</p>
      </main>
    );
  }
  const [plan, orders] = await Promise.all([loadCargoPlanForActiveOrders(), listLogisticsOrders()]);
  const view = buildDriverRouteView(plan, orders.filter(isLogisticsOrderActive), link.bucket);
  const km = formatCargoKm(view.distanceKm);
  const dur = formatCargoDuration(view.durationMin);

  return (
    <main className="mx-auto max-w-[560px] px-4 pb-16 pt-[calc(env(safe-area-inset-top)+20px)]">
      <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-[#6e6e73]">IRISS · Loģistika</p>
      <h1 className="mt-1 text-[28px] font-bold tracking-tight">{view.title}</h1>
      <p className="mt-1 text-[15px] text-[#6e6e73]">
        {view.stops.length} auto{km ? ` · ${km}` : ""}
        {dur ? ` · ${dur}` : ""}
      </p>
      {view.fullNavUrl ? (
        <a href={view.fullNavUrl} target="_blank" rel="noreferrer" className={`${navBtn} mt-4 w-full`}>
          Atvērt visu maršrutu Google Maps
        </a>
      ) : null}

      <ol className="mt-5 space-y-3">
        {view.start ? (
          <li className={card}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6e6e73]">Sākums</p>
            <p className="mt-1 text-[16px] font-semibold">{view.start.label}</p>
            <p className="text-[14px] text-[#3a3a3c]">{view.start.address}</p>
          </li>
        ) : null}
        {view.stops.map((s) => (
          <li key={s.id} className={card}>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ea4335] text-[15px] font-bold text-white">
                {s.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold">{s.car}</p>
                {s.vin ? <p className="font-mono text-[13px] text-[#3a3a3c]">{s.vin}</p> : null}
                {s.place ? <p className="mt-1 text-[15px] font-medium">{s.place}</p> : null}
                {s.address ? <p className="text-[14px] text-[#3a3a3c]">{s.address}</p> : null}
                {s.hours ? <p className="mt-1 text-[13px] text-[#6e6e73]">Darba laiks: {s.hours}</p> : null}
                {s.pickupRef ? <p className="text-[13px] text-[#6e6e73]">Izņemšanas nr.: {s.pickupRef}</p> : null}
                {s.pickupDate ? <p className="text-[13px] text-[#6e6e73]">Datums: {s.pickupDate}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {s.navUrl ? (
                    <a href={s.navUrl} target="_blank" rel="noreferrer" className={navBtn}>
                      Navigēt
                    </a>
                  ) : null}
                  {s.phone ? (
                    <a
                      href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}
                      className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f2f2f7] px-4 text-[15px] font-semibold text-[#1d1d1f]"
                    >
                      Zvanīt {s.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
        {view.end ? (
          <li className={card}>
            <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#6e6e73]">Beigas</p>
            <p className="mt-1 text-[16px] font-semibold">{view.end.label}</p>
            <p className="text-[14px] text-[#3a3a3c]">{view.end.address}</p>
          </li>
        ) : null}
      </ol>
      {view.stops.length === 0 ? <p className="mt-6 text-center text-[15px] text-[#6e6e73]">Šajā kravā vēl nav auto.</p> : null}
    </main>
  );
}
