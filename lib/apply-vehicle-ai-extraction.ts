import {
  emptyCsddMileageRow,
  finalizeMileageHistory,
  type CsddFormFields,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { formatAutoRecordsDateForOutput } from "@/lib/auto-records-paste-parse";
import type { OrderDraftOrderEdits } from "@/lib/admin-order-draft-types";
import type { VehicleAIExtraction } from "@/lib/vehicle-ai-extraction-types";

export type ApplyVehicleAiInput = {
  sourceBlocks: WorkspaceSourceBlocks;
  orderEdits: OrderDraftOrderEdits;
  currentVin: string | null;
  extraction: VehicleAIExtraction;
};

export type ApplyVehicleAiResult = {
  sourceBlocks: WorkspaceSourceBlocks;
  orderEdits: OrderDraftOrderEdits;
  filledFields: string[];
};

function fillIfEmpty(current: string, next: string): { value: string; filled: boolean } {
  const n = next.trim();
  if (!n) return { value: current, filled: false };
  if (current.trim()) return { value: current, filled: false };
  return { value: n, filled: true };
}

function upsertLatestMileage(csdd: CsddFormFields, km: number, dateRaw: string | null): CsddFormFields {
  if (km <= 0) return csdd;
  const date =
    dateRaw?.trim() ?
      formatAutoRecordsDateForOutput(dateRaw.trim())
    : formatAutoRecordsDateForOutput(new Date().toISOString().slice(0, 10));
  const odometer = String(km);
  const rows = [...csdd.mileageHistory];
  const idx = rows.findIndex((r) => r.odometer.replace(/\D/g, "") === odometer && r.date === date);
  if (idx >= 0) return csdd;
  const nextRow = { date, odometer, country: "Latvija" };
  const merged = finalizeMileageHistory([nextRow, ...rows.filter((r) => r.date || r.odometer)]);
  return { ...csdd, mileageHistory: merged.length > 0 ? merged : [emptyCsddMileageRow()] };
}

/** Aizpilda tikai tukšos laukus; esošo operatora darbu nepārraksta. */
export function applyVehicleAiExtraction(input: ApplyVehicleAiInput): ApplyVehicleAiResult {
  const filledFields: string[] = [];
  const { extraction: e } = input;
  let csdd = { ...input.sourceBlocks.csdd };
  const orderEdits = { ...input.orderEdits };

  const vinNext = e.vehicle_metadata.vin.trim();
  if (vinNext.length >= 11) {
    const cur = (orderEdits.vin ?? input.currentVin ?? "").trim();
    if (!cur) {
      orderEdits.vin = vinNext;
      filledFields.push("VIN");
    }
  }

  const plate = fillIfEmpty(csdd.registrationNumber, e.vehicle_metadata.license_plate ?? "");
  if (plate.filled) {
    csdd.registrationNumber = plate.value;
    filledFields.push("Reģ. nr.");
  }

  const regDate =
    e.vehicle_metadata.first_registration_date ??
    (e.vehicle_metadata.manufacture_year ? String(e.vehicle_metadata.manufacture_year) : "");
  const firstReg = fillIfEmpty(csdd.firstRegistration, regDate);
  if (firstReg.filled) {
    csdd.firstRegistration = firstReg.value;
    filledFields.push("Pirmā reģistrācija");
  }

  const beforeMileage = csdd.mileageHistory.length;
  csdd = upsertLatestMileage(
    csdd,
    e.extracted_metrics.latest_calculated_mileage,
    e.extracted_metrics.latest_mileage_date,
  );
  if (e.extracted_metrics.latest_calculated_mileage > 0 && csdd.mileageHistory.length >= beforeMileage) {
    filledFields.push("Nobraukums (CSDD tabula)");
  }

  return {
    sourceBlocks: { ...input.sourceBlocks, csdd },
    orderEdits,
    filledFields,
  };
}
