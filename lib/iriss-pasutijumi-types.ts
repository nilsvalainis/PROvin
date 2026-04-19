/**
 * IRISS admin — pasūtījumu ieraksti (JSON uz disku, neatkarīgi no PROVIN Stripe pasūtījumiem).
 */

export type IrissPasutijumsRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  clientFirstName: string;
  clientLastName: string;
  phone: string;
  email: string;
  orderDate: string;
  brandModel: string;
  productionYears: string;
  totalBudget: string;
  engineType: string;
  transmission: string;
  maxMileage: string;
  preferredColors: string;
  nonPreferredColors: string;
  interiorFinish: string;
  equipmentRequired: string;
  equipmentDesired: string;
  notes: string;
};

export type IrissPasutijumsListRow = {
  id: string;
  updatedAt: string;
  brandModel: string;
  totalBudget: string;
  phone: string;
};

export function emptyIrissPasutijums(id: string, nowIso: string): IrissPasutijumsRecord {
  const d = nowIso.slice(0, 10);
  return {
    id,
    createdAt: nowIso,
    updatedAt: nowIso,
    clientFirstName: "",
    clientLastName: "",
    phone: "",
    email: "",
    orderDate: d,
    brandModel: "",
    productionYears: "",
    totalBudget: "",
    engineType: "",
    transmission: "",
    maxMileage: "",
    preferredColors: "",
    nonPreferredColors: "",
    interiorFinish: "",
    equipmentRequired: "",
    equipmentDesired: "",
    notes: "",
  };
}
