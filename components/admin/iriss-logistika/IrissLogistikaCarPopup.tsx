"use client";

import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { CARGO_BUCKET_LV, logisticsCarTitle, logisticsCopyAllCarText, logisticsDriverShareText, moveCargoCar, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";
import { CABINET_PICKUP_STAGE_LV, type CabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import { formatLogisticsAddress, formatLogisticsDate, formatLogisticsEur, type LogisticsOrder } from "@/lib/iriss-logistics-types";

type Props = {
  order: LogisticsOrder;
  plan: CargoPlanState;
  stage: CabinetPickupStage;
  onClose: () => void;
  onPlanChange: (plan: CargoPlanState) => void;
};

export function IrissLogistikaCarPopup({ order, plan, stage, onClose, onPlanChange }: Props) {
  const cargo = plan.cars.find((c) => c.carId === order.id);
  const bucket = cargo?.bucket ?? "none";
  const phone = order.pickupSnapshot?.phone || order.sellerContact;
  const copyAll = logisticsCopyAllCarText(order, {
    cargoLv: CARGO_BUCKET_LV[bucket],
    stageLv: CABINET_PICKUP_STAGE_LV[stage],
  });
  const driver = logisticsDriverShareText(order);

  return (
    <div className="iriss-log-popup iriss-log-no-print">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[16px] font-semibold">{logisticsCarTitle(order)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--iriss-ink-2)]">
            {order.auction ? <IrissAuctionLogo name={order.auction} /> : null}
            <span className="iriss-log-status-chip">
              <i />
              {CABINET_PICKUP_STAGE_LV[stage]}
            </span>
          </p>
        </div>
        <button type="button" className="text-[13px] text-[var(--iriss-ink-2)]" onClick={onClose} aria-label="Aizvērt">
          ✕
        </button>
      </div>
      <p className="mt-2 font-mono text-[12px]">
        VIN{" "}
        <button
          type="button"
          className="font-mono font-semibold"
          onClick={() => {
            if (order.vin) void navigator.clipboard.writeText(order.vin);
          }}
        >
          {order.vin || "-"}
        </button>
      </p>
      <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-y-1 text-[13px]">
        <dt className="text-[var(--iriss-ink-2)]">Adrese</dt>
        <dd>{order.pickupAddress || formatLogisticsAddress(order.pickupSnapshot ?? {}) || "-"}</dd>
        <dt className="text-[var(--iriss-ink-2)]">Vieta</dt>
        <dd>{order.pickupSnapshot?.name || "-"}</dd>
        <dt className="text-[var(--iriss-ink-2)]">Laiks</dt>
        <dd>{order.pickupSnapshot?.hoursText || "-"}</dd>
        <dt className="text-[var(--iriss-ink-2)]">Pickup</dt>
        <dd>{order.pickupRef || "-"}</dd>
        <dt className="text-[var(--iriss-ink-2)]">Datums</dt>
        <dd>{formatLogisticsDate(order.pickupDate) || "-"}</dd>
        {order.priceEur != null ? (
          <>
            <dt className="text-[var(--iriss-ink-2)]">Transports</dt>
            <dd>{formatLogisticsEur(order.priceEur)}</dd>
          </>
        ) : null}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`iriss-log-btn-dark ${bucket === "next" ? "" : "opacity-70"}`} onClick={() => onPlanChange(moveCargoCar(plan, order.id, "next"))}>
          Nākošā krava
        </button>
        <button type="button" className={`iriss-log-btn-sec ${bucket === "after" ? "ring-2 ring-[var(--iriss-log-focus)]" : ""}`} onClick={() => onPlanChange(moveCargoCar(plan, order.id, "after"))}>
          Aiznākošā krava
        </button>
        <button
          type="button"
          className="iriss-log-btn-sec"
          onClick={() => {
            void navigator.clipboard.writeText(copyAll);
          }}
        >
          Kopēt visu
        </button>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[12px] font-medium">Sūtīt šoferim</span>
          <AdminWhatsAppOpenButton phone={phone} variant="pill" prefillMessage={driver} />
        </span>
      </div>
      <p className="mt-2 text-[11px] text-[var(--iriss-ink-2)]">Sūtīt šoferim atver wa.me. Nils sūta pats. Pases dati nav iekļauti.</p>
    </div>
  );
}
