/**
 * IRISS admin — pasūtījumu ieraksti (JSON uz disku, neatkarīgi no PROVIN Stripe pasūtījumiem).
 */

export type IrissOfferAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

export type IrissOfferRecord = {
  id: string;
  title: string;
  brandModel: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  year: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  mileage: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  priceGermany: string;
  /** Legacy lauks (saglabājam atpakaļsaderībai). */
  comment: string;
  /** Pamatinformācija (jaunā struktūra). */
  firstRegistration: string;
  odometerReading: string;
  transmission: string;
  location: string;
  /** Vispārējais novērtējums — checkbox lauki. */
  hasFullServiceHistory: boolean;
  hasFactoryPaint: boolean;
  hasNoRustBody: boolean;
  hasSecondWheelSet: boolean;
  specialNotes: string;
  visualAssessment: string;
  technicalAssessment: string;
  summary: string;
  /** Cenu bloks. */
  carPrice: string;
  deliveryPrice: string;
  commissionFee: string;
  offerValidDays: string;
  attachments: IrissOfferAttachment[];
  createdAt: string;
  updatedAt: string;
};

export type IrissPasutijumsRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
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
  /** Sludinājumu platformu saites (kopētas no PRO audita portfeļa plūsmas). */
  listingLinkMobile: string;
  listingLinkAutobid: string;
  listingLinkOpenline: string;
  listingLinkAuto1: string;
  /** „Citi” — vairākas rindas; tukšās pirms saglabāšanas var apvienot. */
  listingLinksOther: string[];
  /** Piedāvājumi klientam (var būt vairāki). */
  offers: IrissOfferRecord[];
};

export type IrissPasutijumsListRow = {
  id: string;
  createdAt: string;
  updatedAt: string;
  pinnedAt: string;
  brandModel: string;
  totalBudget: string;
  phone: string;
  listingLinkMobile: string;
  listingLinkAutobid: string;
  listingLinkOpenline: string;
  listingLinkAuto1: string;
  listingLinksOther: string[];
};

/** Saraksta kārtība (Blob/FS JSON) — piespraustie un pārējie atsevišķi. */
export type IrissPasutijumiListOrder = { pinnedOrder: string[]; unpinnedOrder: string[] };

export function emptyIrissPasutijums(id: string, nowIso: string): IrissPasutijumsRecord {
  const d = nowIso.slice(0, 10);
  return {
    id,
    createdAt: nowIso,
    updatedAt: nowIso,
    pinnedAt: "",
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
    listingLinkMobile: "",
    listingLinkAutobid: "",
    listingLinkOpenline: "",
    listingLinkAuto1: "",
    listingLinksOther: [""],
    offers: [],
  };
}
