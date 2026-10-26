import { carsInCargoBucket, type CargoPlanState } from "@/lib/iriss-logistics-cargo-plan";

export type IrissHomeLogisticsPinId = "next" | "after" | "wait";
export type IrissHomeLogisticsPinTone = "ok" | "soon" | "wait";

export type IrissHomeLogisticsPin = {
  id: IrissHomeLogisticsPinId;
  label: string;
  count: number;
  tone: IrissHomeLogisticsPinTone;
};

/** Nākošā / Aiznākošā / Gaida pin-i sākuma hero (bez vietas/laika rindas). */
export function irissHomeLogisticsPins(plan: CargoPlanState): IrissHomeLogisticsPin[] {
  return [
    { id: "next", label: "Nākošā", count: carsInCargoBucket(plan, "next").length, tone: "ok" },
    { id: "after", label: "Aiznākošā", count: carsInCargoBucket(plan, "after").length, tone: "soon" },
    { id: "wait", label: "Gaida", count: carsInCargoBucket(plan, "none").length, tone: "wait" },
  ];
}
