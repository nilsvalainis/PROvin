"use client";

import { IrissRangeFromToField } from "@/components/admin/IrissRangeFromToField";
import type { IrissOrderRangeField, IrissOrderRangeView } from "@/lib/iriss-order-range-fields";

export const IRISS_DIAPAZONI_HINT = "* filtrē Meklētāju. Cena un Gadi obligāti.";

export const IRISS_DIAPAZONI_CALC_NOTE =
  "Aprēķinos ņemts augstākais skaitlis. Diapazons paliek tikai grāmatzīmēm.";

export function IrissSpecDiapazoniBlock({
  ranges,
  onPatchRange,
  rangeError,
  inputClassName,
  only,
}: {
  ranges: IrissOrderRangeView;
  onPatchRange: (field: IrissOrderRangeField, value: string) => void;
  rangeError: (pair: "budget" | "year" | "mileage" | "cc" | "kw") => string | null;
  inputClassName: string;
  /** Pasūtījuma soļi (Nils 28.10): budžets 2. solī, pārējie 3. solī. Nav - visi (kā līdz šim). */
  only?: ReadonlyArray<"budget" | "year" | "mileage" | "cc" | "kw">;
}) {
  const show = (pair: "budget" | "year" | "mileage" | "cc" | "kw") => !only || only.includes(pair);
  return (
    <div className="iriss-spec-diapazoni">
      {only ? null : <p className="iriss-spec-diapazoni-title">DIAPAZONI</p>}
      {show("budget") ? (
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
      ) : null}
      {show("year") ? (
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
      ) : null}
      {show("mileage") ? (
        <IrissRangeFromToField
          label="Nobraukums"
          unit="km"
          phoneUnit="km"
          filterMark
          from={ranges.mileageFrom}
          to={ranges.mileageTo}
          onFrom={(value) => onPatchRange("mileageFrom", value)}
          onTo={(value) => onPatchRange("mileageTo", value)}
          error={rangeError("mileage")}
          inputMode="numeric"
          inputClassName={inputClassName}
        />
      ) : null}
      {show("cc") ? (
        <IrissRangeFromToField
          label="Tilpums"
          unit="cm3"
          phoneUnit="cm³"
          from={ranges.ccFrom}
          to={ranges.ccTo}
          onFrom={(value) => onPatchRange("ccFrom", value)}
          onTo={(value) => onPatchRange("ccTo", value)}
          error={rangeError("cc")}
          inputMode="numeric"
          inputClassName={inputClassName}
        />
      ) : null}
      {show("kw") ? (
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
      ) : null}
      {show("year") ? <p className="iriss-spec-hint">{IRISS_DIAPAZONI_HINT}</p> : null}
      {show("year") ? <p className="iriss-spec-calc-note">{IRISS_DIAPAZONI_CALC_NOTE}</p> : null}
    </div>
  );
}
