"use client";

import { useAdminVinHandoff } from "@/components/admin/AdminVinHandoffContext";
import {
  CARVERTICAL_PURCHASE_CONFIRM_LV,
  purchaseCarVerticalReport,
} from "@/lib/carvertical-purchase";
import { isValidVin, normalizeVin } from "@/lib/order-field-validation";

type Props = {
  disabled?: boolean;
  readOnly?: boolean;
};

/**
 * Vienīgā admin poga, kas pēc apstiprinājuma atver CarVertical pirkumu.
 * MENU / VIN scan / AutoDNA virsraksts vairs nespied pirkuma pogu.
 */
export function AdminCarVerticalPurchaseButton({ disabled, readOnly }: Props) {
  const vin = normalizeVin(useAdminVinHandoff()?.vin ?? "");
  const ready = isValidVin(vin);

  const onBuy = () => {
    if (disabled || readOnly || !ready) return;
    if (!window.confirm(CARVERTICAL_PURCHASE_CONFIRM_LV)) return;
    const result = purchaseCarVerticalReport({ vin, explicitOperatorConfirm: true });
    if (!result.ok) return;
    const a = document.createElement("a");
    a.href = result.href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.dataset.provinHandoffVin = result.vin;
    a.dataset.provinCarverticalPurchase = "1";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        disabled={disabled || readOnly || !ready}
        onClick={onBuy}
        className="rounded-md border border-amber-300/80 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-950 transition hover:bg-amber-100 disabled:opacity-50"
      >
        Pirkt CarVertical atskaiti
      </button>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        Maksas. Tikai pēc apstiprinājuma. Bezmaksas paliek jau nopirktās atskaites
        pārbaude; VIN scan un AutoDNA to vairs nepērk.
      </p>
    </div>
  );
}
