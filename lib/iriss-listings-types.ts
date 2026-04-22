export type IrissListingSourcePlatform = "mobile" | "autobid" | "openline" | "auto1" | "other";

export type IrissListingSyncStatus = "ok" | "login_required" | "parse_failed" | "fetch_failed";

export type IrissListingPrice = {
  value: string;
  currency: string;
};

export type IrissListingAggregateItem = {
  id: string;
  aggregatedAt: string;
  sourcePlatform: IrissListingSourcePlatform;
  sourceUrl: string;
  sourceDomain: string;
  orderId: string;
  orderBrandModel: string;
  title: string;
  year: string;
  imageUrl: string;
  pricePrimary: IrissListingPrice | null;
  priceSecondary: IrissListingPrice | null;
  rawSnapshotRef: string;
  status: IrissListingSyncStatus;
  statusNote: string;
};

export type IrissListingSyncRunSummary = {
  startedAt: string;
  finishedAt: string;
  runId: string;
  totalSources: number;
  okCount: number;
  loginRequiredCount: number;
  parseFailedCount: number;
  fetchFailedCount: number;
};

export type IrissListingsLatestView = {
  version: 1;
  generatedAt: string;
  summary: IrissListingSyncRunSummary;
  items: IrissListingAggregateItem[];
};

export type IrissListingsSnapshot = {
  version: 1;
  generatedAt: string;
  summary: IrissListingSyncRunSummary;
  items: IrissListingAggregateItem[];
};

export type IrissListingsStorageState =
  | { enabled: false; reason: "explicit_off" | "vercel_blob_token_missing" }
  | { enabled: true; persistence: "filesystem"; path: string }
  | { enabled: true; persistence: "vercel_blob" };
