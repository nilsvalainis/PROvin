export const B2B_DEMO_ROLES = ["owner", "employee"] as const;
export type B2bDemoRole = (typeof B2B_DEMO_ROLES)[number];

export const B2B_DEMO_VAT_MODES = ["none", "standard", "margin"] as const;
export type B2bDemoVatMode = (typeof B2B_DEMO_VAT_MODES)[number];

export const B2B_DEMO_ORDER_STATUSES = ["active", "completed", "inactive"] as const;
export type B2bDemoOrderStatus = (typeof B2B_DEMO_ORDER_STATUSES)[number];

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

export type B2bDemoOrder = {
  tenantId: string;
  orderId: string;
  clientName: string;
  brandModel: string;
  vin: string;
  note: string;
  status: B2bDemoOrderStatus;
  createdAt: string;
  updatedAt: string;
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
  return value === "active" || value === "completed" || value === "inactive";
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
