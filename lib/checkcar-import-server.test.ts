import { beforeEach, describe, expect, it, vi } from "vitest";

const REAL = "VF1KT1H0E38762689";
const ORDER = "cs_live_plate_order";
const OTHER = "cs_live_other_order";

const state = vi.hoisted(() => ({
  rows: [] as Array<{ id: string; created: number; vin: string | null; checkoutLine?: string; isDemo?: boolean }>,
  index: [] as Array<{ sessionId: string; vin: string | null }>,
  drafts: new Map<string, unknown>(),
  search: [] as string[],
}));

vi.mock("@/lib/admin-orders", () => ({
  listAdminOrders: async () => ({ rows: state.rows, stripeError: null }),
  getCheckoutSessionDetail: async (id: string) => state.rows.find((r) => r.id === id) ?? null,
}));
vi.mock("@/lib/admin-dashboard-draft-index", () => ({
  listAllDashboardDraftIndexEntries: async () => state.index,
}));
vi.mock("@/lib/admin-order-draft-store", () => ({
  readOrderDraft: async (id: string) => state.drafts.get(id) ?? null,
  patchOrderDraft: async () => ({ ok: true }),
}));
vi.mock("@/lib/admin-global-search-load", () => ({
  loadAdminGlobalSearch: async () => [
    { kind: "pro-order", label: "", hits: state.search.map((id) => ({ kind: "pro-order", id, title: "", subtitle: "", href: "" })) },
  ],
}));
vi.mock("@/lib/listing-peek-store", () => ({ listListingPeeks: async () => [] }));
vi.mock("@/lib/quick-eval-store", () => ({ readQuickEval: async () => null, updateQuickEval: async () => null }));
vi.mock("@/lib/vin-memory-store", () => ({ readVinMemory: async () => null }));
vi.mock("@/lib/admin-cc-vin-photo-store", () => ({ readCcVinPhotoJpeg: async () => null, writeCcVinPhotoJpeg: async () => {} }));

import { findCheckcarTarget } from "@/lib/checkcar-import-server";

function plateDraft(vin: string) {
  return { orderEdits: { licensePlate: "AB1234" }, workspace: { sourceBlocks: { csdd: { vin } } }, vinScan: null };
}

beforeEach(() => {
  state.rows = [
    { id: OTHER, created: 2000, vin: "WVWZZZ1KZAW000001" },
    { id: ORDER, created: 1000, vin: "AB1234", checkoutLine: "dealer" },
  ];
  state.index = [];
  state.drafts = new Map<string, unknown>([[ORDER, plateDraft(REAL)]]);
  state.search = [];
});

describe("CheckCar imports: mērķis pēc VIN", () => {
  it("pasūtīts pēc numurzīmes, VIN tikai CSDD blokā - atrod bez atvērtas lapas", async () => {
    const r = await findCheckcarTarget(REAL);
    expect(r.target).toMatchObject({ kind: "order", id: ORDER });
    expect(r.hintMismatch).toBeUndefined();
  });

  it("atvērtā pasūtījuma lapa ar VIN CSDD blokā uzvar", async () => {
    const r = await findCheckcarTarget(REAL, { kind: "order", id: ORDER });
    expect(r.target?.id).toBe(ORDER);
  });

  it("admin meklēšanas indeksa trāpījums der arī tad, ja melnrakstā VIN nav", async () => {
    state.drafts = new Map();
    state.search = [ORDER];
    expect((await findCheckcarTarget(REAL)).target?.id).toBe(ORDER);
  });

  it("atvērtajā lapā cits VIN - brīdinājums; ar apstiprinājumu ieliek tur", async () => {
    state.drafts = new Map([[OTHER, { orderEdits: {}, workspace: null }]]);
    const warn = await findCheckcarTarget(REAL, { kind: "order", id: OTHER });
    expect(warn.target).toBeNull();
    expect(warn.hintMismatch).toEqual({ kind: "order", id: OTHER, vins: ["WVWZZZ1KZAW000001"] });
    const forced = await findCheckcarTarget(REAL, { kind: "order", id: OTHER }, { confirmHint: true });
    expect(forced.target).toMatchObject({ kind: "order", id: OTHER });
  });

  it("nav neviena avota ar šo VIN un nav lapas - nav mērķa", async () => {
    state.drafts = new Map();
    const r = await findCheckcarTarget(REAL);
    expect(r.target).toBeNull();
  });
});
