/**
 * JoJ lot/vehicle lauku etiķetes (LV) un vārdnīcas id → nosaukums.
 * Vērtības paliek no API / /usa/damages / /usa/titles; etiķetes ir latviski.
 */

export type JojNameDict = {
  damages: Record<string, string>;
  titles: Record<string, string>;
};

/** Strukturētie fakti IZSOĻU PORTĀLU ARHĪVAM (cc_vin), ne jaunam admin blokam. */
export type JojCcVinFacts = {
  vehicleLine: string;
  reportDate: string;
  sales: { date: string; venue: string; odometer: string; price: string; status: string }[];
  damages: { date: string; region: string; amount: string; description: string }[];
  titles: { date: string; region: string; odometer: string; note: string }[];
  insurance: { date: string; label: string; detail: string }[];
  mileage: { date: string; odometer: string; country: string }[];
  notes: string[];
};

export const EMPTY_JOJ_NAME_DICT: JojNameDict = { damages: {}, titles: {} };

export const JOJ_NONE_SUMMARY = "nav ierakstu";

export const JOJ_LV = {
  domain: "Izsole",
  lot: "Lots",
  status: "Statuss",
  auctionType: "Izsoles veids",
  saleDate: "Pārdošanas datums",
  saleDateUpdated: "Pārdošanas datums atjaunots",
  bid: "Piedāvājums",
  bidUpdated: "Piedāvājums atjaunots",
  finalBid: "Gala likme",
  finalBidUpdated: "Gala likme atjaunota",
  buyNow: "Buy Now",
  buyNowUpdated: "Buy Now atjaunots",
  sellerReserve: "Rezerves cena",
  sellerReserveUpdated: "Rezerves cena atjaunota",
  estimateRepair: "Remonta tāme",
  preAccident: "Cena pirms negadījuma",
  cleanWholesale: "Tīrā vairumtirdzniecības cena",
  actualCash: "Faktiskā naudas vērtība",
  odometer: "Odometrs",
  odometerStatus: "Odometra statuss",
  damageMain: "Bojājums (galvenais)",
  damageSecond: "Bojājums (papildu)",
  condition: "Stāvoklis",
  airbags: "Drošības spilveni",
  keys: "Atslēgas",
  gradeIaai: "IAAI pakāpe",
  title: "Title",
  detailedTitle: "Title (detalizēts)",
  note: "Piezīme",
  tags: "Birkas",
  seller: "Pārdevējs",
  sellerType: "Pārdevēja tips",
  sellerInsurance: "Apdrošinātājs",
  sellerRental: "Noma",
  sellerCredit: "Kredītiestāde",
  location: "Atrašanās vieta",
  sellingBranch: "Filiāle",
  priceHistory: "Cenu vēsture",
  video: "Video",
  details: "Papildu dati",
  archived: "Arhīvs",
  archivedAt: "Arhivēts",
  createdAt: "Izveidots",
  updatedAt: "Atjaunots",
  timedAuction: "Laika izsole",
  timedStartBid: "Sākuma likme",
  externalId: "Ārējais ID",
  line: "Līnija",
  youtube: "YouTube",
  postal: "Pasta indekss",
  coords: "Koordinātes",
  offsite: "Ārpus filiāles",
  branchLink: "Filiales saite",
  hp: "Jauda",
  engine: "Dzinējs",
  transmission: "Ātrumkārba",
  drive: "Piedziņa",
  fuel: "Degviela",
  color: "Krāsa",
  body: "Virsbūve",
  cylinders: "Cilindri",
  generation: "Paaudze",
  vehicleType: "Transportlīdzekļa veids",
  specs: "Specifikācija",
} as const;

const VALUE_LV: Record<string, string> = {
  sold: "pārdots",
  not_sold: "nav pārdots",
  run_and_drives: "brauc",
  starts: "iedarbojas",
  stationary: "nestartē",
  actual: "faktiskais",
  not_actual: "nav faktiskais",
  exempt: "atbrīvots",
  pure_sale: "tīrā izsole",
  minimum_bid: "minimālā likme",
  on_approval: "ar apstiprinājumu",
  yes: "jā",
  no: "nē",
  true: "jā",
  false: "nē",
};

export function jojValueLv(raw: string): string {
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  return VALUE_LV[key] || raw.trim();
}

export function jojDictName(dict: Record<string, string>, id: unknown, fallback = ""): string {
  if (id == null || id === "") return fallback;
  return dict[String(id)] || fallback;
}

export function jojYesNo(v: unknown): string {
  if (v === true) return "jā";
  if (v === false) return "nē";
  return "";
}
