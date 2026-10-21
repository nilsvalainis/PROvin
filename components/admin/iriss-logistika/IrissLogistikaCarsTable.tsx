"use client";

import { useState } from "react";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { CARGO_BUCKET_LV, cargoCarMap, logisticsCarTitle, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";
import { CABINET_PICKUP_STAGE_LV, type CabinetPickup, type CabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import { formatLogisticsDate } from "@/lib/iriss-logistics-types";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

type Props = {
  orders: LogisticsOrder[];
  plan: CargoPlanState;
  pickups: CabinetPickup[];
  docCounts: Record<string, { have: number; expected: number }>;
  onOpenCabinet: (id: string) => void;
  onMoveToAutopark: (id: string) => void;
};

export function IrissLogistikaCarsTable({ orders, plan, pickups, docCounts, onOpenCabinet, onMoveToAutopark }: Props) {
  const cars = cargoCarMap(plan);
  const stages = new Map(pickups.map((p) => [p.carId, p.stage]));
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <section className="iriss-log-table-wrap iriss-log-no-print mt-3">
      <div className="flex items-center justify-between px-3.5 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Visi auto · {orders.length}</p>
        <p className="text-[12px] text-[#6e6e73]">Klikšķis uz rindas atver Auto kabinetu</p>
      </div>
      <table className="iriss-log-table">
        <thead>
          <tr>
            <th>Auto</th>
            <th>VIN</th>
            <th>Izsole</th>
            <th>Nopirkts</th>
            <th>Pickup</th>
            <th>Statuss</th>
            <th>Krava</th>
            <th>Dok.</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const cargo = cars.get(order.id);
            const bucket = cargo?.bucket ?? "none";
            const stage = (stages.get(order.id) ?? "waiting") as CabinetPickupStage;
            const docs = docCounts[order.id] ?? { have: 0, expected: 4 };
            return (
              <tr key={order.id} onClick={() => onOpenCabinet(order.id)} className="cursor-pointer">
                <td className="min-w-[12rem] font-semibold">{logisticsCarTitle(order)}</td>
                <td className="whitespace-nowrap font-mono text-[12px]">{order.vin}</td>
                <td>{order.auction ? <IrissAuctionLogo name={order.auction} /> : "Privāts"}</td>
                <td>{formatLogisticsDate(order.createdAt.slice(0, 10)) || formatLogisticsDate(order.pickupDate)}</td>
                <td>{formatLogisticsDate(order.pickupDate) || "-"}</td>
                <td>
                  <span className="iriss-log-status-chip whitespace-nowrap">
                    <i />
                    {CABINET_PICKUP_STAGE_LV[stage]}
                  </span>
                </td>
                <td>
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                    <span className="iriss-log-cargo-dot" style={{ background: `var(--iriss-log-cargo-${bucket})` }} />
                    {CARGO_BUCKET_LV[bucket]}
                  </span>
                </td>
                <td className="tabular-nums">
                  {docs.have} / {docs.expected}
                </td>
                <td className="relative text-right">
                  <button
                    type="button"
                    className="iriss-log-btn-sec h-8 whitespace-nowrap px-2.5 text-[12px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmId(order.id);
                    }}
                  >
                    Pārvietot uz Autoparku
                  </button>
                  {confirmId === order.id ? (
                    <div className="iriss-log-confirm right-0 top-10" onClick={(e) => e.stopPropagation()}>
                      <p className="text-[13px] font-medium">
                        Pārvietot {logisticsCarTitle(order)} uz Autoparku? Auto pazūd no Loģistikas.
                      </p>
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" className="iriss-log-btn-sec h-8 px-2.5 text-[12px]" onClick={() => setConfirmId(null)}>
                          Atcelt
                        </button>
                        <button
                          type="button"
                          className="iriss-log-btn-dark h-8 px-2.5 text-[12px]"
                          onClick={() => {
                            setConfirmId(null);
                            onMoveToAutopark(order.id);
                          }}
                        >
                          Pārvietot
                        </button>
                      </div>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-6 text-center text-[#6e6e73]">
                Nav aktīvu auto. Piegādātie ir arhīvā.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
