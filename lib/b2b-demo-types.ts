import type { IrissCriteriaV1 } from "@/lib/iriss-criteria-types";

export const B2B_DEMO_ROLES = ["owner", "employee"] as const;
export type B2bDemoRole = (typeof B2B_DEMO_ROLES)[number];

export const B2B_DEMO_VAT_MODES = ["none", "standard", "margin"] as const;
export type B2bDemoVatMode = (typeof B2B_DEMO_VAT_MODES)[number];

export const B2B_DEMO_ORDER_STATUSES = [
  "active",
  "searching",
  "offered",
  "reserved",
  "completed",
  "inactive",
] as const;
export type B2bDemoOrderStatus = (typeof B2B_DEMO_ORDER_STATUSES)[number];

export const B2B_DEMO_ORDER_STATUS_LV: Record<B2bDemoOrderStatus, string> = {
  active: "Aktīvs",
  searching: "Meklē",
  offered: "Piedāvāts",
  reserved: "Rezervēts",
  completed: "Izpildīts",
  inactive: "Neaktīvs",
};

export const B2B_DEMO_DEAL_DETAIL_OPTIONS = [
  { key: "dealLeasingOrCredit", label: "Līzings, kredīts" },
  { key: "dealClientFinancing100", label: "Klienta finansējums 100%" },
  { key: "dealClientFinancing20", label: "Klienta finansējums 20%" },
  { key: "dealVat21Required", label: "Obligāta cena ar PVN 21%" },
  { key: "dealServiceStartDeposit", label: "Depozīts (pakalpojuma uzsākšanai)" },
  { key: "dealEkki", label: "EKKI" },
] as const;

export const B2B_DEMO_AUCTION_PLATFORMS = ["openlane", "auto1", "autobid"] as const;
export type B2bDemoAuctionPlatform = (typeof B2B_DEMO_AUCTION_PLATFORMS)[number];

export type B2bDemoTenant = {
  tenantId: string;
  slug: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type B2bDemoUser = {
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  role: B2bDemoRole;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
};

export type B2bDemoUserPublic = Omit<B2bDemoUser, "passwordHash">;

export type B2bDemoSettings = {
  tenantId: string;
  logoUrl: string;
  companyName: string;
  companyReg: string;
  vatNumber: string;
  bank: string;
  address: string;
  phone: string;
  email: string;
  commissionEur: number;
  transportEur: number;
  auctionFeeEur: number;
  unexpectedEur: number;
  vatMode: B2bDemoVatMode;
  pdfFooterText: string;
  pdfTermsText: string;
  pdfDepositText: string;
  updatedAt: string;
};

export type B2bDemoOffer = {
  offerId: string;
  title: string;
  brandModel: string;
  vin: string;
  firstRegistration: string;
  odometerReading: string;
  transmission: string;
  location: string;
  hasFullServiceHistory: boolean;
  hasFactoryPaint: boolean;
  hasNoRustBody: boolean;
  hasSecondWheelSet: boolean;
  specialNotes: string;
  visualAssessment: string;
  technicalAssessment: string;
  summary: string;
  carPrice: string;
  deliveryPrice: string;
  commissionFee: string;
  offerValidDays: string;
  validUntil: string;
  createdAt: string;
  updatedAt: string;
};

export type B2bDemoOrder = {
  tenantId: string;
  orderId: string;
  clientName: string;
  clientFirstName: string;
  clientLastName: string;
  phone: string;
  email: string;
  orderDate: string;
  brandModel: string;
  vin: string;
  productionYears: string;
  totalBudget: string;
  engineType: string;
  transmission: string;
  bodyType: string;
  driveType: string;
  seatCount: string;
  maxMileage: string;
  preferredColors: string;
  nonPreferredColors: string;
  interiorFinish: string;
  dealLeasingOrCredit: boolean;
  dealClientFinancing100: boolean;
  dealClientFinancing20: boolean;
  dealVat21Required: boolean;
  dealServiceStartDeposit: boolean;
  dealEkki: boolean;
  equipmentRequired: string;
  equipmentDesired: string;
  note: string;
  status: B2bDemoOrderStatus;
  offers: B2bDemoOffer[];
  /**
   * Tā pati shēma kā IRISS. Vecs JSON šo lauku nesatur.
   * Migrācija to neraksta. Teksta lauki paliek.
   */
  criteria?: IrissCriteriaV1;
  createdAt: string;
  updatedAt: string;
};

/** Light list row. Never includes offers or long notes. */
export type B2bDemoOrderListRow = {
  tenantId: string;
  orderId: string;
  clientName: string;
  brandModel: string;
  vin: string;
  phone: string;
  orderDate: string;
  totalBudget: string;
  status: B2bDemoOrderStatus;
  offerCount: number;
  latestOfferValidUntil: string;
  createdAt: string;
  updatedAt: string;
};

export type B2bDemoOrdersIndex = {
  version: 1;
  tenantId: string;
  updatedAt: string;
  rows: B2bDemoOrderListRow[];
};

export type B2bDemoOrderListPage = {
  tenantId: string;
  page: number;
  limit: number;
  total: number;
  rows: B2bDemoOrderListRow[];
};

/** Encrypted auction browser session. Never contains a password field. */
export type B2bDemoEncryptedAuctionSession = {
  tenantId: string;
  platform: B2bDemoAuctionPlatform;
  ciphertext: string;
  iv: string;
  authTag: string;
  wrappedDek: string;
  wrapIv: string;
  wrapAuthTag: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type B2bDemoAuctionSessionStatus = {
  tenantId: string;
  platform: B2bDemoAuctionPlatform;
  connected: boolean;
  updatedAt: string | null;
  expiresAt: string | null;
};

export type B2bDemoTenantDocument = {
  version: 1;
  tenant: B2bDemoTenant;
  users: B2bDemoUser[];
  settings: B2bDemoSettings;
  orders: B2bDemoOrder[];
  auctionSessions: B2bDemoEncryptedAuctionSession[];
};

export type B2bDemoIndexTenant = {
  tenantId: string;
  slug: string;
  name: string;
};

export type B2bDemoEmailIndexEntry = {
  tenantId: string;
  userId: string;
};

export type B2bDemoIndex = {
  version: 1;
  updatedAt: string;
  tenants: B2bDemoIndexTenant[];
  emailIndex: Record<string, B2bDemoEmailIndexEntry>;
};

export type B2bDemoAdminTenantRow = {
  tenantId: string;
  slug: string;
  name: string;
  createdAt: string | null;
  updatedAt: string | null;
  users: B2bDemoUserPublic[];
};

export type B2bDemoSession = {
  tenantId: string;
  userId: string;
  email: string;
  role: B2bDemoRole;
};

export function isB2bDemoRole(value: unknown): value is B2bDemoRole {
  return value === "owner" || value === "employee";
}

export function isB2bDemoVatMode(value: unknown): value is B2bDemoVatMode {
  return value === "none" || value === "standard" || value === "margin";
}

export function isB2bDemoOrderStatus(value: unknown): value is B2bDemoOrderStatus {
  return typeof value === "string" && (B2B_DEMO_ORDER_STATUSES as readonly string[]).includes(value);
}

export function isB2bDemoAuctionPlatform(value: unknown): value is B2bDemoAuctionPlatform {
  return value === "openlane" || value === "auto1" || value === "autobid";
}

export function toPublicB2bDemoUser(user: B2bDemoUser): B2bDemoUserPublic {
  return {
    tenantId: user.tenantId,
    userId: user.userId,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
