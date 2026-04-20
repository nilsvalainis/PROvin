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
  year: string;
  mileage: string;
  priceGermany: string;
  comment: string;
  attachments: IrissOfferAttachment[];
  createdAt: string;
  updatedAt: string;
};

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
  brandModel: string;
  totalBudget: string;
  phone: string;
  listingLinkMobile: string;
  listingLinkAutobid: string;
  listingLinkOpenline: string;
  listingLinkAuto1: string;
  listingLinksOther: string[];
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
    listingLinkMobile: "",
    listingLinkAutobid: "",
    listingLinkOpenline: "",
    listingLinkAuto1: "",
    listingLinksOther: [""],
    offers: [],
  };
}
