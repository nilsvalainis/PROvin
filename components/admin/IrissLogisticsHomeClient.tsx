"use client";

import { useEffect, useState } from "react";
import type { LogisticsPointView, LogisticsTripView } from "@/lib/staff-data-filter";

export function IrissLogisticsHomeClient({
  viewerName,
  canEnableTotp,
}: {
  viewerName: string;
  canEnableTotp: boolean;
}) {
  const [trips, setTrips] = useState<LogisticsTripView[]>([]);
  const [points, setPoints] = useState<LogisticsPointView[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/iriss/logistika/trips", { credentials: "include", cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/iriss/logistika/points", { credentials: "include", cache: "no-store" }).then((r) => r.json()),
    ]).then(([t, p]) => {
      if (Array.isArray(t.trips)) setTrips(t.trips);
      if (Array.isArray(p.points)) setPoints(p.points);
    });
  }, []);

  async function post(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : "{}",
    });
    return res;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-3 lg:flex-row">
      <section className="min-h-[320px] flex-1 rounded-[22px] border border-[#E5E7EB] bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">Karte</p>
          <button
            type="button"
            className="rounded-full border border-[#E5E7EB] px-3 py-1 text-[12px] text-[#4b5563]"
            onClick={() => setNotice("Iepriekš izmantotie punkti: " + (points.length ? points.map((p) => p.name).join(", ") : "pagaidām nav"))}
          >
            Iepriekš izmantotie punkti
          </button>
        </div>
        <div className="flex min-h-[240px] items-center justify-center rounded-2xl bg-[#EEF2F6] text-center text-[13px] text-[#6b7280]">
          Karte un punkti tiks pievienoti. Šoferis un auto reisā ir redzami; cenas un klienti nav.
        </div>
      </section>
      <section className="w-full rounded-[22px] border border-[#E5E7EB] bg-white p-3 shadow-sm lg:max-w-[360px] sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9aa3b2]">Pickup saraksts</p>
        <ul className="mt-3 space-y-2">
          {trips.length === 0 ? (
            <li className="rounded-xl bg-[#F8FAFC] px-3 py-3 text-[13px] text-[#6b7280]">
              Reišu vēl nav. {viewerName}, atzīmē punktus, kad karte ir gatava.
            </li>
          ) : (
            trips.map((trip) => (
              <li key={trip.id}>
                <label className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-2 hover:bg-[#F8FAFC]">
                  <input
                    type="checkbox"
                    checked={selected.includes(trip.id)}
                    onChange={() =>
                      setSelected((cur) => (cur.includes(trip.id) ? cur.filter((id) => id !== trip.id) : [...cur, trip.id]))
                    }
                  />
                  <span>
                    <span className="block text-[14px] font-medium text-[#111827]">{trip.vehicleTitle}</span>
                    <span className="block text-[12px] text-[#6b7280]">
                      {trip.pointName}
                      {trip.hours ? ` · ${trip.hours}` : ""}
                      {trip.driverName ? ` · ${trip.driverName}` : ""}
                      {trip.vehiclePlate ? ` · ${trip.vehiclePlate}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
        <p className="mt-4 text-[11px] leading-relaxed text-[#9aa3b2]">
          Cenas, klientu dati un šofera personas dokumenti šajā lomā nav redzami.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-[#E5E7EB] px-3 py-2 text-[13px]"
            onClick={() => void post("/api/admin/iriss/logistika/print")}
          >
            Drukāt karti
          </button>
          <button
            type="button"
            className="rounded-full bg-[#111827] px-3 py-2 text-[13px] font-medium text-white"
            onClick={() => void post("/api/admin/iriss/logistika/route")}
          >
            Sastādīt maršrutu
          </button>
        </div>
        {canEnableTotp ? (
          <div className="mt-5 rounded-2xl bg-[#F8FAFC] p-3">
            <p className="text-[13px] font-medium">2FA (pēc izvēles)</p>
            {totpSecret ? (
              <div className="mt-2 space-y-2">
                <p className="break-all font-mono text-[11px] text-[#4b5563]">{totpSecret}</p>
                <input
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full rounded-xl border border-[#E5E7EB] px-3 py-2 text-[16px]"
                  placeholder="6 ciparu kods"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="rounded-full bg-[#111827] px-3 py-1.5 text-[12px] text-white"
                  onClick={async () => {
                    const res = await post("/api/admin/iriss/logistika/totp", { action: "confirm", code: totpCode });
                    setNotice(res.ok ? "2FA ieslēgta." : "Kods nederīgs.");
                  }}
                >
                  Apstiprināt
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="mt-2 rounded-full border border-[#E5E7EB] px-3 py-1.5 text-[12px]"
                onClick={async () => {
                  const res = await post("/api/admin/iriss/logistika/totp", { action: "start" });
                  const data = (await res.json()) as { secret?: string };
                  setTotpSecret(data.secret ?? null);
                }}
              >
                Ieslēgt 2FA
              </button>
            )}
          </div>
        ) : null}
        {notice ? <p className="mt-3 text-[12px] text-[#4b5563]">{notice}</p> : null}
      </section>
    </div>
  );
}
