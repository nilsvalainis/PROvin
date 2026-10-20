"use client";

import { IrissRangeFromToField } from "@/components/admin/IrissRangeFromToField";
import type { IrissOrderRangeField, IrissOrderRangeView } from "@/lib/iriss-order-range-fields";

export const IRISS_DIAPAZONI_HINT = "* obligāti. + vismaz viens: nobraukums, tilpums vai jauda.";

export function IrissSpecDiapazoniBlock({
  ranges,
  onPatchRange,
  rangeError,
  inputClassName,
}: {
  ranges: IrissOrderRangeView;
  onPatchRange: (field: IrissOrderRangeField, value: string) => void;
  rangeError: (pair: "budget" | "year" | "mileage" | "cc" | "kw") => string | null;
  inputClassName: string;
}) {
  return (
    <div className="iriss-spec-diapazoni">
      <p className="iriss-spec-diapazoni-title">DIAPAZONI</p>
      <IrissRangeFromToField
        label="Cena"
        unit="EUR"
        phoneUnit="€"
        required
        from={ranges.budgetFrom}
        to={ranges.budgetTo}
        onFrom={(value) => onPatchRange("budgetFrom", value)}
        onTo={(value) => onPatchRange("budgetTo", value)}
        error={rangeError("budget")}
        inputClassName={inputClassName}
      />
      <IrissRangeFromToField
        label="Gadi"
        phoneUnit="g."
        required
        from={ranges.yearFrom}
        to={ranges.yearTo}
        onFrom={(value) => onPatchRange("yearFrom", value)}
        onTo={(value) => onPatchRange("yearTo", value)}
        error={rangeError("year")}
        inputMode="numeric"
        inputClassName={inputClassName}
      />
      <IrissRangeFromToField
        label="Nobraukums"
        unit="km"
        phoneUnit="km"
        from={ranges.mileageFrom}
        to={ranges.mileageTo}
        onFrom={(value) => onPatchRange("mileageFrom", value)}
        onTo={(value) => onPatchRange("mileageTo", value)}
        error={rangeError("mileage")}
        inputMode="numeric"
        inputClassName={inputClassName}
      />
      <IrissRangeFromToField
        label="Tilpums"
        unit="cm3"
        phoneUnit="cm³"
        from={ranges.ccFrom}
        to={ranges.ccTo}
        onFrom={(value) => onPatchRange("ccFrom", value)}
        onTo={(value) => onPatchRange("ccTo", value)}
        error={rangeError("cc")}
        inputClassName={inputClassName}
      />
      <IrissRangeFromToField
        label="Jauda"
        unit="kW"
        phoneUnit="kW"
        from={ranges.kwFrom}
        to={ranges.kwTo}
        onFrom={(value) => onPatchRange("kwFrom", value)}
        onTo={(value) => onPatchRange("kwTo", value)}
        error={rangeError("kw")}
        inputClassName={inputClassName}
      />
      <p className="iriss-spec-hint">{IRISS_DIAPAZONI_HINT}</p>
    </div>
  );
}
