"use client";

import { useState } from "react";
import { AdminWhatsAppOpenButton } from "@/components/admin/AdminWhatsAppOpenButton";
import { IrissAuctionLogo } from "@/components/admin/iriss-logistika/IrissAuctionLogo";
import { cargoBucketLabel, cargoRouteBuckets, logisticsCarTitle, logisticsCopyAllCarText, logisticsDriverShareText, moveCargoCar, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";
import type { CabinetPickupStage } from "@/lib/iriss-logistics-cabinet";
import { isLogisticsOrderArchived } from "@/lib/iriss-logistics-archive";
import { LOGISTICS_STEP_SHORT_LV, logisticsStepOf } from "@/lib/iriss-logistics-steps";
import { formatLogisticsAddress, formatLogisticsDate, formatLogisticsEur, type LogisticsOrder } from "@/lib/iriss-logistics-types";

type Props = {
  order: LogisticsOrder;
  plan: CargoPlanState;
  stage: CabinetPickupStage;
  onClose: () => void;
  onPlanChange: (plan: CargoPlanState) => void;
  /** Datorā (makets A/B, Nils 27.10): kartīte virs kartes ved uz auto kabinetu. */
  onOpenCabinet?: () => void;
  /** Nils 19.11 (A): «Piegādāts - uz Autoparku» - tā pati darbība kā kabineta «Atvests» un kravas «Uz Autoparku». */
  onMoveToAutopark?: (orderId: string) => Promise<boolean>;
  /** Tās pašas tiesības kā kabinetā (rakstīt drīkst admins, Loģistika, Serviss). */
  canMoveToAutopark?: boolean;
};

/** Poga tikai, ja auto vēl nav atvests/Autoparkā un lietotājam ir rakstīšanas tiesības. */
export function carPopupCanDeliver(
  order: Pick<LogisticsOrder, "status" | "archived">,
  stage: CabinetPickupStage,
  canMoveToAutopark: boolean,
): boolean {
  if (!canMoveToAutopark) return false;
  if (isLogisticsOrderArchived(order)) return false;
  return logisticsStepOf(order.status, stage) !== "arrived";
}

export function IrissLogistikaCarPopup({ order, plan, stage, onClose, onPlanChange, onOpenCabinet, onMoveToAutopark, canMoveToAutopark = false }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const canDeliver = Boolean(onMoveToAutopark) && carPopupCanDeliver(order, stage, canMoveToAutopark);
  const cargo = plan.cars.find((c) => c.carId === order.id);
  const bucket = cargo?.bucket ?? "none";
  const phone = order.pickupSnapshot?.phone || order.sellerContact;
  const copyAll = logisticsCopyAllCarText(order, {
    cargoLv: cargoBucketLabel(plan, bucket),
    stageLv: LOGISTICS_STEP_SHORT_LV[logisticsStepOf(order.status, stage)],
  });
  const driver = logisticsDriverShareText(order);
  const stepLv = LOGISTICS_STEP_SHORT_LV[logisticsStepOf(order.status, stage)];

  return (
    <div className="iriss-log-popup iriss-log-no-print">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[16px] font-semibold">{logisticsCarTitle(order)}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--iriss-ink-2)]">
            {order.auction ? <IrissAuctionLogo name={order.auction} /> : null}
            <span className="iriss-log-status-chip">
              <i />
              {stepLv}
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
            <dt className="text-[var(--iriss-ink-2)]">Pirkuma cena</dt>
            <dd>{formatLogisticsEur(order.priceEur)}</dd>
          </>
        ) : null}
      </dl>
      {canDeliver && confirming ? (
        <div className="iriss-log-deliver-confirm mt-3" role="alertdialog" aria-label="Apstiprināt piegādi">
          <p className="text-[14px] font-semibold">Piegādāts - uz Autoparku?</p>
          <p className="mt-0.5 text-[13px]">
            {logisticsCarTitle(order)}
            {order.vin ? <span className="font-mono"> · {order.vin}</span> : null}
          </p>
          {failed ? <p className="mt-1 text-[13px] text-[var(--iriss-log-bad)]">Neizdevās. Mēģini vēlreiz.</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="iriss-log-btn-brand iriss-log-btn-touch"
              disabled={busy}
              onClick={async () => {
                if (!onMoveToAutopark) return;
                setBusy(true);
                setFailed(false);
                const ok = await onMoveToAutopark(order.id).catch(() => false);
                setBusy(false);
                if (ok) setConfirming(false);
                else setFailed(true);
              }}
            >
              {busy ? "Liek…" : "Jā, uz Autoparku"}
            </button>
            <button
              type="button"
              className="iriss-log-btn-sec iriss-log-btn-touch"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                setFailed(false);
              }}
            >
              Atcelt
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canDeliver && !confirming ? (
          <button type="button" className="iriss-log-btn-brand iriss-log-btn-touch" onClick={() => setConfirming(true)}>
            Piegādāts - uz Autoparku
          </button>
        ) : null}
        {onOpenCabinet ? (
          <button type="button" className="iriss-log-btn-brand" onClick={onOpenCabinet}>
            Kabinets
          </button>
        ) : null}
        {cargoRouteBuckets(plan).map((b) => (
          <button
            key={b}
            type="button"
            className={b === "next" ? `iriss-log-btn-dark ${bucket === b ? "" : "opacity-70"}` : `iriss-log-btn-sec ${bucket === b ? "ring-2 ring-[var(--iriss-log-focus)]" : ""}`}
            onClick={() => onPlanChange(moveCargoCar(plan, order.id, b))}
          >
            {cargoBucketLabel(plan, b)}
          </button>
        ))}
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
