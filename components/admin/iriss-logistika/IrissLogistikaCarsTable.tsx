"use client";

import { useState } from "react";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { CARGO_BUCKET_LV, CARGO_BUCKETS, cargoCarMap, logisticsCarTitle, type CargoBucket, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";
import { CABINET_PICKUP_STAGE_LV, CABINET_PICKUP_STAGES, type CabinetPickup, type CabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import { formatLogisticsDate } from "@/lib/iriss-logistics-types";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";

type Props = {
  orders: LogisticsOrder[];
  plan: CargoPlanState;
  pickups: CabinetPickup[];
  docCounts: Record<string, { have: number; expected: number }>;
  onOpenCabinet: (id: string) => void;
  onMoveToAutopark: (id: string) => void;
  onSetStage: (id: string, stage: CabinetPickupStage) => void;
  onSetBucket: (id: string, bucket: CargoBucket) => void;
  onDeleteManual: (id: string) => void;
};

/** Ar roku ievadīts cita klienta auto: pēc atvešanas vienkārši dzēš (uz Autoparku neiet). */
function DeleteManual({ order, onDelete }: { order: LogisticsOrder; onDelete: (id: string) => void }) {
  return (
    <button
      type="button"
      className="iriss-log-btn-sec h-8 min-h-8 whitespace-nowrap px-2.5 text-[12px]"
      onClick={(e) => {
        e.stopPropagation();
        if (window.confirm(`Dzēst ${logisticsCarTitle(order)}? Cita klienta auto pazudīs no Loģistikas.`)) onDelete(order.id);
      }}
    >
      Dzēst
    </button>
  );
}

/** Statuss ar vienu klikšķi: visi 4 posmi redzami uzreiz, aktīvais tumšs. */
function StageSwitch({
  stage,
  onChange,
  full = false,
}: {
  stage: CabinetPickupStage;
  onChange: (stage: CabinetPickupStage) => void;
  full?: boolean;
}) {
  return (
    <div className={`iriss-log-stage ${full ? "full" : ""}`} role="radiogroup" aria-label="Statuss" onClick={(e) => e.stopPropagation()}>
      {CABINET_PICKUP_STAGES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={stage === s}
          className={stage === s ? "on" : ""}
          onClick={() => {
            if (stage !== s) onChange(s);
          }}
        >
          {CABINET_PICKUP_STAGE_LV[s]}
        </button>
      ))}
    </div>
  );
}

function BucketDots({ bucket, onChange }: { bucket: CargoBucket; onChange: (bucket: CargoBucket) => void }) {
  return (
    <div className="iriss-log-bucket-dots" role="radiogroup" aria-label="Krava" onClick={(e) => e.stopPropagation()}>
      {CARGO_BUCKETS.map((b) => (
        <button
          key={b}
          type="button"
          role="radio"
          aria-checked={bucket === b}
          aria-label={CARGO_BUCKET_LV[b]}
          title={CARGO_BUCKET_LV[b]}
          className={bucket === b ? "on" : ""}
          onClick={() => {
            if (bucket !== b) onChange(b);
          }}
        >
          <span style={{ background: `var(--iriss-log-cargo-${b})` }} />
        </button>
      ))}
    </div>
  );
}

function MoveToAutopark({
  order,
  arrived,
  open,
  onOpen,
  onClose,
  onConfirm,
}: {
  order: LogisticsOrder;
  arrived: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={`${arrived ? "iriss-log-btn-dark" : "iriss-log-btn-sec"} h-8 min-h-8 whitespace-nowrap px-2.5 text-[12px]`}
        onClick={onOpen}
      >
        Uz Autoparku
      </button>
      {open ? (
        <div className="iriss-log-confirm right-0 top-10">
          <p className="text-[13px] font-medium">
            Pārvietot {logisticsCarTitle(order)} uz Autoparku? Loģistikā auto aiziet uz arhīvu.
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="iriss-log-btn-sec h-8 min-h-8 px-2.5 text-[12px]" onClick={onClose}>
              Atcelt
            </button>
            <button
              type="button"
              className="iriss-log-btn-dark h-8 min-h-8 px-2.5 text-[12px]"
              onClick={() => {
                onClose();
                onConfirm();
              }}
            >
              Pārvietot
            </button>
          </div>
        </div>
      ) : null}
    </span>
  );
}

export function IrissLogistikaCarsTable({
  orders,
  plan,
  pickups,
  docCounts,
  onOpenCabinet,
  onMoveToAutopark,
  onSetStage,
  onSetBucket,
  onDeleteManual,
}: Props) {
  const cars = cargoCarMap(plan);
  const stages = new Map(pickups.map((p) => [p.carId, p.stage]));
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <section className="iriss-log-table-wrap iriss-log-no-print mt-3">
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6e6e73]">Visi auto · {orders.length}</p>
        <p className="text-right text-[12px] text-[#6e6e73]">Statusu maini ar klikšķi. Rinda atver Auto kabinetu</p>
      </div>
      <table className="iriss-log-table max-xl:hidden">
        <thead>
          <tr>
            <th>Auto</th>
            <th>Izsole</th>
            <th>Pickup</th>
            <th>Statuss</th>
            <th>Krava</th>
            <th>Dok.</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const bucket = cars.get(order.id)?.bucket ?? "none";
            const stage = (stages.get(order.id) ?? "waiting") as CabinetPickupStage;
            const docs = docCounts[order.id] ?? { have: 0, expected: 4 };
            return (
              <tr key={order.id} onClick={() => onOpenCabinet(order.id)} className="cursor-pointer">
                <td className="min-w-[11rem]">
                  <span className="block font-semibold leading-snug">{logisticsCarTitle(order)}</span>
                  <span className="block font-mono text-[11.5px] text-[#6e6e73]">{order.vin || "-"}</span>
                </td>
                <td>{order.source === "manual" ? <span className="iriss-log-manual-chip">Cits klients</span> : order.auction ? <IrissAuctionLogo name={order.auction} /> : "Privāts"}</td>
                <td className="whitespace-nowrap">{formatLogisticsDate(order.pickupDate) || "-"}</td>
                <td>
                  <StageSwitch stage={stage} onChange={(s) => onSetStage(order.id, s)} />
                </td>
                <td>
                  <BucketDots bucket={bucket} onChange={(b) => onSetBucket(order.id, b)} />
                </td>
                <td className="tabular-nums">
                  {docs.have} / {docs.expected}
                </td>
                <td className="text-right">
                  {order.source === "manual" ? (
                    <DeleteManual order={order} onDelete={onDeleteManual} />
                  ) : (
                  <MoveToAutopark
                    order={order}
                    arrived={stage === "arrived"}
                    open={confirmId === order.id}
                    onOpen={() => setConfirmId(order.id)}
                    onClose={() => setConfirmId(null)}
                    onConfirm={() => onMoveToAutopark(order.id)}
                  />
                  )}
                </td>
              </tr>
            );
          })}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center text-[#6e6e73]">
                Nav aktīvu auto. Piegādātie ir arhīvā.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {/* Telefonā un šaurā logā kartītes: statusa slēdzis pa visu platumu, bez horizontālas ritināšanas. */}
      <ul className="iriss-log-car-cards xl:hidden">
        {orders.map((order) => {
          const bucket = cars.get(order.id)?.bucket ?? "none";
          const stage = (stages.get(order.id) ?? "waiting") as CabinetPickupStage;
          const docs = docCounts[order.id] ?? { have: 0, expected: 4 };
          return (
            <li key={order.id}>
              <button type="button" className="flex w-full items-start gap-2 text-left" onClick={() => onOpenCabinet(order.id)}>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-snug">{logisticsCarTitle(order)}</span>
                  <span className="block truncate font-mono text-[12px] text-[#6e6e73]">{order.vin || "-"}</span>
                </span>
                <span className="shrink-0 pt-0.5">
                  {order.source === "manual" ? <span className="iriss-log-manual-chip">Cits klients</span> : order.auction ? <IrissAuctionLogo name={order.auction} /> : null}
                </span>
              </button>
              <div className="mt-2.5">
                <StageSwitch full stage={stage} onChange={(s) => onSetStage(order.id, s)} />
              </div>
              <div className="mt-2.5 flex items-center gap-2 text-[12px] text-[#6e6e73]">
                <BucketDots bucket={bucket} onChange={(b) => onSetBucket(order.id, b)} />
                <span className="min-w-0 truncate whitespace-nowrap">{CARGO_BUCKET_LV[bucket]}</span>
                <span className="ml-auto shrink-0 whitespace-nowrap tabular-nums">Dok. {docs.have}/{docs.expected}</span>
                {order.source === "manual" ? (
                  <DeleteManual order={order} onDelete={onDeleteManual} />
                ) : (
                <MoveToAutopark
                  order={order}
                  arrived={stage === "arrived"}
                  open={confirmId === order.id}
                  onOpen={() => setConfirmId(order.id)}
                  onClose={() => setConfirmId(null)}
                  onConfirm={() => onMoveToAutopark(order.id)}
                />
                )}
              </div>
            </li>
          );
        })}
        {orders.length === 0 ? <li className="py-6 text-center text-[13px] text-[#6e6e73]">Nav aktīvu auto. Piegādātie ir arhīvā.</li> : null}
      </ul>
    </section>
  );
}
