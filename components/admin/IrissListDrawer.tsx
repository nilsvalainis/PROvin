"use client";

import { useEffect, useMemo, useState } from "react";
import { classifyListingDamage, highlightListingDamage } from "@/lib/iriss-listings-damage";
import { DEFAULT_LISTING_COSTS, listingBidPrice, listingExtrasI, listingMaxBid, listingRealCost, type ListingCostParts, type ListingTaxKind } from "@/lib/iriss-listings-cost";
import { listingOfferLeaks, listingOfferText } from "@/lib/iriss-listings-offer";
import { countryFlagLabel } from "@/lib/iriss-listings-country-flag";
import { listingCostsFor, type IrissListPrefs, type ListingTaxOverride } from "@/lib/iriss-listings-operator-prefs";
import { listingTaxLabel, listingTaxResolved, taxFromVehicle } from "@/lib/iriss-listings-vat";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

function eur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "-";
  return `${Math.round(n).toLocaleString("lv-LV")} €`;
}
function eur2(n: number): string {
  return `${n.toLocaleString("lv-LV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function IrissListDrawer({
  v,
  prefs,
  onClose,
  onPrefs,
}: {
  v: IrissListingVehicle;
  prefs: IrissListPrefs;
  onClose: () => void;
  onPrefs: (next: IrissListPrefs) => void;
}) {
  const detected = taxFromVehicle(v);
  const ov = prefs.taxOv[v.id];
  const tax = listingTaxResolved(v, ov);
  const costs = listingCostsFor(prefs, v.id);
  const extras = listingExtrasI(costs);
  const bid0 = listingBidPrice(v);
  const [bid, setBid] = useState(bid0 ?? 0);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerTxt, setOfferTxt] = useState(() => listingOfferText({ ...v, platform: v.platform, stockNumber: v.stockNumber }));
  const [zipMsg, setZipMsg] = useState("");
  const [lvMsg, setLvMsg] = useState("");
  const dmg = classifyListingDamage(v.damageRaw);
  const lv = prefs.damageLv[v.id] ?? "";
  const real = bid0 == null ? null : listingRealCost(tax.kind, tax.rate ?? 0, bid, extras);
  const mb = prefs.budget != null ? listingMaxBid(tax.kind, tax.rate ?? 0, prefs.budget, extras) : null;
  const flag = countryFlagLabel(v.countryCode);
  const photos = [v.imageUrl, ...(v.imageUrls ?? [])].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);

  useEffect(() => {
    setBid(listingBidPrice(v) ?? 0);
    setOfferTxt(listingOfferText({ ...v, platform: v.platform, stockNumber: v.stockNumber }));
  }, [v]);

  const leaks = useMemo(() => listingOfferLeaks(offerTxt, { ...v, platform: v.platform, stockNumber: v.stockNumber }), [offerTxt, v]);

  function setNote(text: string) {
    onPrefs({ ...prefs, notes: { ...prefs.notes, [v.id]: text } });
  }
  function setTax(next: ListingTaxOverride | null) {
    const taxOv = { ...prefs.taxOv };
    if (!next) delete taxOv[v.id];
    else taxOv[v.id] = next;
    onPrefs({ ...prefs, taxOv });
  }
  function setCost(part: keyof ListingCostParts, value: number) {
    const cur = { ...(prefs.costOv[v.id] ?? {}), [part]: value };
    const clean = { ...cur };
    for (const k of Object.keys(clean) as (keyof ListingCostParts)[]) {
      if (clean[k] === prefs.costs[k]) delete clean[k];
    }
    const costOv = { ...prefs.costOv };
    if (Object.keys(clean).length === 0) delete costOv[v.id];
    else costOv[v.id] = clean;
    onPrefs({ ...prefs, costOv });
  }

  async function translate() {
    if (!v.damageRaw?.trim()) return;
    setLvMsg("Tulko...");
    try {
      const res = await fetch("/api/admin/iriss-listings/damage-translate", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: v.damageRaw }),
      });
      const body = (await res.json()) as { lv?: string; error?: string };
      if (!res.ok || !body.lv) {
        setLvMsg(body.error ?? "Tulkojums neizdevās.");
        return;
      }
      onPrefs({ ...prefs, damageLv: { ...prefs.damageLv, [v.id]: body.lv } });
      setLvMsg("");
    } catch (e) {
      setLvMsg(e instanceof Error ? e.message : "Tīkla kļūda.");
    }
  }

  async function downloadZip() {
    setZipMsg("Veido ZIP...");
    try {
      const res = await fetch("/api/admin/iriss-listings/photos-zip", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls: photos, title: v.title, year: v.year }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setZipMsg(body.error ?? "ZIP neizdevās.");
        return;
      }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${v.year || "auto"}-bildes.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      setZipMsg("ZIP lejupielādēts.");
    } catch (e) {
      setZipMsg(e instanceof Error ? e.message : "Tīkla kļūda.");
    }
  }

  function shareWa() {
    window.open(`https://wa.me/?text=${encodeURIComponent(offerTxt)}`, "_blank", "noopener");
  }

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[600px] flex-col overflow-auto border-l border-[#E5E7EB] bg-white p-4 shadow-[-10px_0_30px_rgb(0_0_0_/_0.1)]">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{v.platform}</span>
        {flag ? <span title={flag.title}>{flag.flag}</span> : null}
        <span className="grow" />
        <button
          type="button"
          className={`grid h-8 w-8 place-items-center rounded-lg border ${prefs.fav.includes(v.id) ? "border-amber-300 bg-amber-50 text-amber-500" : "border-[#E5E7EB]"}`}
          title={prefs.fav.includes(v.id) ? "Noņemt no favorītiem" : "Favorīts"}
          onClick={() => {
            const fav = prefs.fav.includes(v.id) ? prefs.fav.filter((x) => x !== v.id) : [...prefs.fav, v.id];
            onPrefs({ ...prefs, fav });
          }}
        >
          {prefs.fav.includes(v.id) ? "★" : "☆"}
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[#E5E7EB]"
          title={prefs.hidden.includes(v.id) ? "Rādīt atkal" : "Nav interesanti"}
          onClick={() => {
            const hidden = prefs.hidden.includes(v.id) ? prefs.hidden.filter((x) => x !== v.id) : [...prefs.hidden, v.id];
            onPrefs({ ...prefs, hidden });
          }}
        >
          {prefs.hidden.includes(v.id) ? "↺" : "✕"}
        </button>
        {v.detailUrl ? (
          <a href={v.detailUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-[#E5E7EB] px-3 py-1 text-[12px] font-semibold">
            Atvērt avotu
          </a>
        ) : null}
        <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg border border-[#E5E7EB]" aria-label="Aizvērt">
          ✕
        </button>
      </div>
      <h2 className="mt-2 text-[18px] font-semibold text-[var(--color-apple-text)]">{v.title}</h2>
      <p className="text-[12px] text-slate-500">
        {[v.year, v.mileageKm != null ? `${v.mileageKm.toLocaleString("lv-LV")} km` : "", v.fuel, v.transmission, v.location].filter(Boolean).join(" · ")}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pašreizējā cena</div>
          <div className="text-[22px] font-extrabold tabular-nums">{eur(listingBidPrice(v))}</div>
          <span className="text-[10px] font-extrabold" title={tax.raw}>
            {listingTaxLabel(tax)}
          </span>
          {v.priceBuyNow != null ? <div className="text-[11px] text-slate-500">pirkt uzreiz {eur(v.priceBuyNow)}</div> : null}
        </div>
        <div className="rounded-xl border border-[#E5E7EB] p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pie šīs cenas</div>
          {prefs.budget == null ? (
            <p className="text-[12px] font-semibold text-amber-800">Budžets nav norādīts</p>
          ) : real ? (
            <>
              <div className="text-[12px]">Budžets <b className="tabular-nums">{eur(prefs.budget)}</b></div>
              <div className="text-[12px]">Gala <b className="tabular-nums">{eur2(real.total)}</b></div>
              <div className={`text-[11px] font-extrabold ${real.total <= prefs.budget ? "text-emerald-700" : "text-red-700"}`}>
                {real.total <= prefs.budget ? `+${eur(prefs.budget - real.total)} zem budžeta` : `-${eur(real.total - prefs.budget)} pārsniegts`}
              </div>
              <div className="text-[11px] text-slate-500">Maks. solījums {eur(mb)}</div>
            </>
          ) : (
            <p className="text-[12px] text-slate-500">Cenas nav</p>
          )}
        </div>
        <div className="rounded-xl border border-[#E5E7EB] p-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Izsole</div>
          <div className="text-[13px] font-bold">{v.auctionEndAt ? new Date(v.auctionEndAt).toLocaleString("lv-LV") : "Beigu laiks nav zināms"}</div>
          {v.bidCount != null ? <div className="text-[11px] text-slate-500">{v.bidCount} solījumi</div> : null}
        </div>
      </div>

      <button type="button" onClick={() => setOfferOpen((x) => !x)} className="mt-3 self-start rounded-full bg-[var(--color-provin-accent)] px-3 py-1.5 text-[12px] font-semibold text-white">
        Sagatavot piedāvājumu
      </button>
      {offerOpen ? (
        <div className="mt-2 rounded-xl border border-[#E5E7EB] p-3">
          <textarea value={offerTxt} onChange={(e) => setOfferTxt(e.target.value)} className="min-h-[160px] w-full rounded-lg border border-[#E5E7EB] p-2 text-[13px]" />
          <p className="mt-1 text-[11px]">{leaks.length ? `Tekstā ir: ${leaks.join(", ")}.` : "Teksts tīrs: bez cenām, ID, platformas, saitēm un bojājumiem."}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="rounded-full border px-3 py-1 text-[12px] font-semibold" onClick={() => void navigator.clipboard?.writeText(offerTxt)}>
              Kopēt
            </button>
            <button type="button" className="rounded-full border px-3 py-1 text-[12px] font-semibold" onClick={() => void downloadZip()}>
              Bildes ZIP
            </button>
            <button type="button" className="rounded-full bg-emerald-600 px-3 py-1 text-[12px] font-semibold text-white" onClick={shareWa}>
              WhatsApp
            </button>
          </div>
          {zipMsg ? <p className="mt-1 text-[11px] text-slate-500">{zipMsg}</p> : null}
        </div>
      ) : null}

      <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        Piezīme
        <textarea value={prefs.notes[v.id] ?? ""} onChange={(e) => setNote(e.target.value)} placeholder="Piezīme (tikai adminam)" className="mt-1 min-h-[64px] w-full rounded-lg border border-[#E5E7EB] p-2 text-[13px] font-normal normal-case tracking-normal" />
      </label>

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tehniskais stāvoklis</h3>
      {dmg.status === "nodata" ? (
        <p className="rounded-lg bg-slate-50 p-2 text-[13px] text-slate-500">Nav datu. Detaļu lapā stāvokļa teksta nav.</p>
      ) : (
        <>
          <div className="rounded-lg border border-[#E5E7EB] bg-slate-50 p-2 text-[13px]" dangerouslySetInnerHTML={{ __html: highlightListingDamage(v.damageRaw ?? "", dmg.spans) }} />
          <div className="mt-1 flex flex-wrap gap-1">
            {dmg.status === "none" ? <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">Tehn. bojājumi nav norādīti</span> : null}
            {dmg.cats.map((c) => (
              <span key={c.name} className="rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                ⚠ {c.name}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[13px]"><b>LV:</b> {lv || "tulkojums vēl nav ģenerēts"}</p>
          <button type="button" className="mt-1 rounded-full border px-3 py-1 text-[12px] font-semibold" onClick={() => void translate()}>
            Ģenerēt LV tulkojumu
          </button>
          {lvMsg ? <p className="text-[11px] text-slate-500">{lvMsg}</p> : null}
        </>
      )}

      {photos[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photos[0]} alt="" referrerPolicy={v.platform === "openline" ? "no-referrer" : undefined} className="mt-3 w-full rounded-xl border object-cover" />
      ) : null}

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Cenu vēsture</h3>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-[10px] uppercase text-slate-500">
            <th className="py-1">Laiks</th>
            <th>Lauks</th>
            <th className="text-right">No</th>
            <th className="text-right">Uz</th>
          </tr>
        </thead>
        <tbody>
          {v.priceHistory.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-2 text-slate-500">
                Izmaiņu nav. Pirmo reizi {new Date(v.firstSeenAt).toLocaleString("lv-LV")}
              </td>
            </tr>
          ) : (
            v.priceHistory.map((h, i) => (
              <tr key={`${h.at}-${i}`} className="border-t border-slate-100">
                <td className="py-1">{new Date(h.at).toLocaleString("lv-LV")}</td>
                <td>{h.field === "buy_now" ? "Pirkt uzreiz" : h.field === "start" ? "Sākuma" : h.field === "minimal" ? "Minimālā" : "Pašreizējā"}</td>
                <td className="text-right tabular-nums">{eur(h.from)}</td>
                <td className={`text-right tabular-nums font-semibold ${h.from != null && h.to != null && h.to > h.from ? "text-red-600" : "text-emerald-700"}`}>{eur(h.to)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">PVN režīms</h3>
      <div className="flex gap-2">
        <select
          value={ov?.kind ?? ""}
          onChange={(e) => {
            const k = e.target.value as ListingTaxKind | "";
            if (!k) setTax(null);
            else setTax({ kind: k, rate: k === "gross" ? (ov?.rate ?? detected.rate ?? 19) : null });
          }}
          className="rounded-lg border border-[#E5E7EB] px-2 py-1 text-[13px]"
        >
          <option value="">Automātiski: {listingTaxLabel(detected)}</option>
          <option value="net">NETO</option>
          <option value="margin">MARŽA</option>
          <option value="gross">AR PVN x %</option>
        </select>
        {ov?.kind === "gross" ? (
          <input type="number" value={ov.rate ?? ""} onChange={(e) => setTax({ kind: "gross", rate: Number(e.target.value) || null })} className="w-24 rounded-lg border px-2 py-1 text-[13px]" placeholder="%" />
        ) : null}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">Avota lauks: {detected.raw}</p>

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Izmaksas šim auto (neto)</h3>
      <div className="grid grid-cols-2 gap-2">
        {([
          ["fee", "Izsoles komisija"],
          ["transport", "Transports"],
          ["commission", "Dzintarzeme Auto komisija"],
          ["unplanned", "Neplānotie"],
        ] as const).map(([k, l]) => (
          <label key={k} className="text-[10px] font-semibold text-slate-500">
            {l}
            <input type="number" value={costs[k]} onChange={(e) => setCost(k, Number(e.target.value) || 0)} className="mt-0.5 w-full rounded-lg border px-2 py-1 text-[13px] font-normal" />
          </label>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-slate-500">I = {eur(extras)} (noklusējums {eur(listingExtrasI(DEFAULT_LISTING_COSTS))})</p>

      <h3 className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Kalkulators</h3>
      <div className="flex items-center gap-2">
        <span className="text-[12px] text-slate-500">Ja nosolām par</span>
        <input type="range" min={Math.round((bid0 ?? 5000) * 0.7)} max={Math.round((bid0 ?? 5000) * 1.4)} step={100} value={bid} onChange={(e) => setBid(Number(e.target.value))} className="grow" />
        <b className="w-20 text-right tabular-nums">{eur(bid)}</b>
      </div>
      {real ? (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-[12px] tabular-nums">
          <dt>Solījums {listingTaxLabel(tax)}</dt>
          <dd>{eur2(bid)}</dd>
          {tax.kind === "gross" ? (
            <>
              <dt className="pl-3 text-slate-500">bez ārvalstu PVN {tax.rate} %</dt>
              <dd>{eur2(real.base)}</dd>
            </>
          ) : null}
          <dt>Izmaksas I</dt>
          <dd>{eur2(extras)}</dd>
          <dt>PVN 21 % no {tax.kind === "margin" ? "izdevumiem" : "solījuma un I"}</dt>
          <dd>{eur2(real.vat)}</dd>
          <dt className="border-t pt-1 font-extrabold">Plānotā gala cena</dt>
          <dd className="border-t pt-1 font-extrabold">{eur2(real.total)}</dd>
        </dl>
      ) : null}
    </aside>
  );
}
