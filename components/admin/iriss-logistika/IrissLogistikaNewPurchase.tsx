"use client";

import { useEffect, useRef, useState } from "react";
import type { LogisticsAuction, LogisticsOrder, LogisticsPoint } from "@/lib/iriss-logistics-types";
import { LOGISTICS_AUCTIONS } from "@/lib/iriss-logistics-types";
import { formatLogisticsEur, formatLogisticsKm } from "@/lib/iriss-logistics-types";

type Parsed = {
  ok?: boolean;
  make?: string;
  model?: string;
  vin?: string;
  priceEur?: number | null;
  mileageKm?: number | null;
  address?: string;
  title?: string;
  source?: string;
  note?: string;
};

type Props = {
  open: boolean;
  points: LogisticsPoint[];
  onClose: () => void;
  onCreated: (order: LogisticsOrder) => void;
  onPreviewCoords: (lat: number, lng: number) => void;
};

export function IrissLogistikaNewPurchase({ open, points, onClose, onCreated, onPreviewCoords }: Props) {
  const [source, setSource] = useState<"auction" | "private">("private");
  const [auction, setAuction] = useState<LogisticsAuction>("cits");
  const [link, setLink] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [parseBusy, setParseBusy] = useState(false);
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vin, setVin] = useState("");
  const [price, setPrice] = useState("");
  const [km, setKm] = useState("");
  const [address, setAddress] = useState("");
  const [geoNotice, setGeoNotice] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geocodeStatus, setGeocodeStatus] = useState("pending");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const geoTimer = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    window.clearTimeout(geoTimer.current);
    const q = address.trim();
    if (q.length < 6) return;
    geoTimer.current = window.setTimeout(() => {
      void geocode(q);
    }, 600);
    return () => window.clearTimeout(geoTimer.current);
  }, [address, open]);

  async function geocode(q: string) {
    setGeoNotice("");
    try {
      const res = await fetch("/api/admin/iriss-logistics/geocode", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: q }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        lat?: number;
        lng?: number;
        status?: string;
        formatted?: string;
        notice?: string;
        limited?: boolean;
      };
      if (!body.ok) {
        setGeoNotice(body.notice || "Adresi neizdevās ģeokodēt.");
        return;
      }
      setLat(body.lat ?? null);
      setLng(body.lng ?? null);
      setGeocodeStatus(body.status || "ok");
      if (body.lat != null && body.lng != null) onPreviewCoords(body.lat, body.lng);
      if (body.status === "neprecizs") setGeoNotice("Precizitāte ir pilsētas līmenī - punktu var pārvietot pēc saglabāšanas.");
    } catch {
      setGeoNotice("Ģeokodēšana neizdevās.");
    }
  }

  async function onLinkBlur() {
    const url = link.trim();
    if (!url.startsWith("http")) return;
    setParseBusy(true);
    try {
      const res = await fetch("/api/admin/iriss-logistics/parse-listing", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as { parsed?: Parsed };
      const p = body.parsed ?? {};
      setParsed(p);
      if (p.make) setMake(p.make);
      if (p.model) setModel(p.model);
      if (p.vin) setVin(p.vin);
      if (p.priceEur != null) setPrice(String(p.priceEur));
      if (p.mileageKm != null) setKm(String(p.mileageKm));
      if (p.address) setAddress(p.address);
    } finally {
      setParseBusy(false);
    }
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/iriss-logistics/orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          auction: source === "auction" ? auction : "cits",
          auctionUrl: source === "auction" ? link.trim() : "",
          listingUrl: source === "private" ? link.trim() : "",
          make,
          model,
          vin,
          title: [make, model].filter(Boolean).join(" "),
          priceEur: price ? Number.parseFloat(price.replace(",", ".")) : null,
          mileageKm: km ? Number.parseInt(km.replace(/\s/g, ""), 10) : null,
          pickupAddress: address,
          pickupLat: lat,
          pickupLng: lng,
          geocodeStatus,
          listingParsed: parsed
            ? {
                make: parsed.make ?? "",
                model: parsed.model ?? "",
                vin: parsed.vin ?? "",
                priceEur: parsed.priceEur ?? null,
                mileageKm: parsed.mileageKm ?? null,
                address: parsed.address ?? "",
                source: parsed.source ?? "",
                parsedAt: new Date().toISOString(),
              }
            : null,
          status: "organize_pickup",
          archived: false,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; order?: LogisticsOrder; error?: string };
      if (!res.ok || !body.order) {
        setErr(body.error || "Neizdevās saglabāt.");
        setBusy(false);
        return;
      }
      onCreated(body.order);
    } catch {
      setErr("Neizdevās saglabāt.");
      setBusy(false);
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-0 md:items-center md:p-6" role="dialog" aria-modal="true" aria-label="Nopirkts">
      <div className="flex max-h-[92dvh] w-full max-w-[720px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[#eee] px-4 py-3">
          <div>
            <p className="text-[15px] font-semibold">Nopirkts · jauns ieraksts</p>
            <div className="mt-2 inline-flex rounded-full bg-[#f3f4f6] p-0.5 text-[12px] font-semibold">
              <button type="button" className={`rounded-full px-3 py-1 ${source === "auction" ? "bg-white shadow-sm" : "text-[#6b7280]"}`} onClick={() => setSource("auction")}>
                Izsole
              </button>
              <button type="button" className={`rounded-full px-3 py-1 ${source === "private" ? "bg-white shadow-sm" : "text-[#6b7280]"}`} onClick={() => setSource("private")}>
                Privāts
              </button>
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-[#6b7280]" aria-label="Aizvērt">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <label className="block text-[12px] font-medium text-[#6b7280]">Saite uz sludinājumu</label>
          <div className="mt-1 flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => void onLinkBlur()}
              placeholder="https://suchen.mobile.de/..."
              className="h-10 min-w-0 flex-1 rounded-xl border border-[#e5e7eb] px-3 text-[13px]"
            />
            <button type="button" onClick={() => void onLinkBlur()} className="h-10 rounded-xl border border-[#e5e7eb] px-3 text-[12px] font-semibold">
              {parseBusy ? "…" : "Atpazīt"}
            </button>
          </div>
          {parsed?.ok ? (
            <div className="mt-3 rounded-xl border border-[#c7d2fe] bg-[#eef2ff] p-3 text-[13px]">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--acc)]">Atpazīts no sludinājuma{parsed.source ? ` · ${parsed.source}` : ""}</p>
              <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1">
                <dt className="text-[#6b7280]">Marka</dt>
                <dd>
                  <input value={make} onChange={(e) => setMake(e.target.value)} className="w-full bg-transparent" />
                </dd>
                <dt className="text-[#6b7280]">Modelis</dt>
                <dd>
                  <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-transparent" />
                </dd>
                <dt className="text-[#6b7280]">VIN</dt>
                <dd>
                  <input value={vin} onChange={(e) => setVin(e.target.value)} className="w-full bg-transparent font-mono text-[12px]" />
                </dd>
                <dt className="text-[#6b7280]">Cena</dt>
                <dd>
                  <input value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-transparent" />
                  {parsed.priceEur != null ? <span className="text-[11px] text-[#6b7280]"> {formatLogisticsEur(parsed.priceEur)}</span> : null}
                </dd>
                <dt className="text-[#6b7280]">Nobraukums</dt>
                <dd>
                  <input value={km} onChange={(e) => setKm(e.target.value)} className="w-full bg-transparent" />
                  {parsed.mileageKm != null ? <span className="text-[11px] text-[#6b7280]"> {formatLogisticsKm(parsed.mileageKm)}</span> : null}
                </dd>
              </dl>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {source === "auction" ? (
                <label className="col-span-2 text-[12px]">
                  Izsole
                  <select value={auction} onChange={(e) => setAuction(e.target.value as LogisticsAuction)} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-2">
                    {LOGISTICS_AUCTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-[12px]">
                Marka
                <input value={make} onChange={(e) => setMake(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-3" />
              </label>
              <label className="text-[12px]">
                Modelis
                <input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-3" />
              </label>
            </div>
          )}
          <label className="mt-3 block text-[12px] font-medium text-[#6b7280]">Adrese</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Musterweg 7, 21000 Lüneburg, DE"
            className="mt-1 h-10 w-full rounded-xl border border-[#e5e7eb] px-3 text-[13px]"
          />
          {geoNotice ? <p className="mt-1 text-[12px] text-[var(--warn)]">{geoNotice}</p> : null}
          {lat != null && lng != null ? (
            <p className="mt-1 text-[12px] text-[#6b7280]">
              Punkts kartē: {lat.toFixed(4)}, {lng.toFixed(4)}
            </p>
          ) : null}
          {points.length ? (
            <p className="mt-2 text-[11px] text-[#9aa1ad]">Adrese tiek ģeokodēta un punkts parādās kartē. Privātu adresi vēlāk var saglabāt punktu datubāzē.</p>
          ) : null}
          {err ? <p className="mt-2 text-[12px] text-[#b91c1c]">{err}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eee] px-4 py-3">
          <button type="button" onClick={onClose} className="h-10 rounded-full bg-[#f3f4f6] px-4 text-[13px] font-semibold">
            Atcelt
          </button>
          <button type="button" onClick={() => void save()} disabled={busy || !make} className="h-10 rounded-full bg-[var(--ink)] px-4 text-[13px] font-semibold text-white disabled:opacity-40">
            {busy ? "Saglabā…" : "Saglabāt ierakstu"}
          </button>
        </div>
      </div>
    </div>
  );
}
