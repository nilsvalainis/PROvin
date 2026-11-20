/**
 * Bugfix 20.11: Loģistikas pasūtījuma arhivēšana («Uz Autoparku») un citi izveides ceļi neveido Autoparka dublikātus
 * (17.11 XC90/XC60/Brenderup gadījumi: VIN tikai piezīmēs, VIN tikai v2, saīsināts VIN).
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bestOrderVin, extractVinsFromText, findAutoparksDuplicate, orderVinCandidates } from "@/lib/iriss-autoparks-dedup";
import { applyRegistryFileToState } from "@/lib/iriss-autoparks-registry-apply";
import { normalizeAutoparksState } from "@/lib/iriss-autoparks";
import { emptyCarV2 } from "@/lib/iriss-autoparks-v2";

vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => null,
}));

const XC90 = "YV1CZ9156A1234567";
const XC60 = "YV1DZ8256C2345678";
const BRENDERUP_FULL = "XUH120001825NB06060X";
const BRENDERUP_SHORT = "XUH120001825NB060";

const car = (id: string, extra: Partial<{ orderId: string; vin: string; archivedAt: string }> = {}) => ({
  id,
  orderId: extra.orderId ?? "",
  vin: extra.vin ?? "",
  archivedAt: extra.archivedAt ?? "",
});
const v2With = (entries: Record<string, { vin?: string; auctionNo?: string }>) => ({
  cars: Object.fromEntries(
    Object.entries(entries).map(([id, e]) => {
      const c = emptyCarV2();
      c.fields.vin = e.vin ?? "";
      c.purchase.auctionNo = e.auctionNo ?? "";
      return [id, c];
    }),
  ),
});

describe("VIN no pasūtījuma", () => {
  it("piezīmes: «VIN:», VIN6 un atsevišķs 17 zīmju VIN", () => {
    expect(extractVinsFromText(`Pickup kods 4411. VIN: ${XC90.toLowerCase()} tel 29502039`)).toEqual([XC90]);
    expect(extractVinsFromText("VIN6: 234567")).toEqual(["234567"]);
    expect(extractVinsFromText(`Auto ${XC60} gatavs`)).toEqual([XC60]);
    expect(extractVinsFromText("Tikai teksts 29502039 bez VIN")).toEqual([]);
  });

  it("kandidāti: lauks, sludinājums, piezīmes; labākais - lauks, citādi garākais", () => {
    const order = { vin: "", notes: `VIN ${XC90}`, title: "Volvo XC90 2010", listingParsed: null };
    expect(orderVinCandidates(order)).toEqual([XC90]);
    expect(bestOrderVin(order)).toBe(XC90);
    expect(bestOrderVin({ vin: BRENDERUP_SHORT, notes: "", title: "" })).toBe(BRENDERUP_SHORT);
  });
});

describe("findAutoparksDuplicate", () => {
  it("orderId, tad precīzs efektīvais VIN (v2 || v1)", () => {
    const cars = [car("a", { orderId: "o1" }), car("b", { vin: XC60 }), car("c")];
    const v2 = v2With({ c: { vin: XC90 } });
    expect(findAutoparksDuplicate(cars, v2, { orderId: "o1", vins: [XC90] })).toMatchObject({ car: { id: "a" }, by: "order" });
    expect(findAutoparksDuplicate(cars, v2, { orderId: "o9", vins: [XC90] })).toMatchObject({ car: { id: "c" }, by: "vin" });
    expect(findAutoparksDuplicate(cars, v2, { vins: [XC60.toLowerCase()] })).toMatchObject({ car: { id: "b" }, by: "vin" });
    expect(findAutoparksDuplicate(cars, v2, { vins: ["WVWZZZ3CZKE012345"] })).toBeNull();
  });

  it("saīsināts VIN (Brenderup): prefikss abos virzienos", () => {
    const cars = [car("trailer", { vin: BRENDERUP_FULL }), car("other", { vin: XC90 })];
    expect(findAutoparksDuplicate(cars, null, { vins: [BRENDERUP_SHORT] })).toMatchObject({ car: { id: "trailer" }, by: "vin_prefix" });
    const short = [car("t2", { vin: BRENDERUP_SHORT })];
    expect(findAutoparksDuplicate(short, null, { vins: [BRENDERUP_FULL] })).toMatchObject({ car: { id: "t2" }, by: "vin_prefix" });
  });

  it("VIN6 / VIN beigas - tikai, ja atbilst viens auto", () => {
    const cars = [car("x", { vin: XC90 }), car("y", { vin: XC60 })];
    expect(findAutoparksDuplicate(cars, null, { vins: ["234567"] })).toMatchObject({ car: { id: "x" }, by: "vin_suffix" });
    const twin = [car("x", { vin: XC90 }), car("z", { vin: "YV1CZ9156A9234567" })];
    expect(findAutoparksDuplicate(twin, null, { vins: ["234567"] })).toBeNull();
    // Divi pilni, atšķirīgi VIN ar vienādām beigām nav dublikāts.
    expect(findAutoparksDuplicate([car("x", { vin: XC90 })], null, { vins: ["YV1CZ9156A9234567"] })).toBeNull();
  });

  it("īss kopīgs prefikss (<13) nav atbilstība", () => {
    expect(findAutoparksDuplicate([car("x", { vin: XC90 })], null, { vins: [XC90.slice(0, 11)] })).toBeNull();
  });

  it("stock nr., ja VIN nav; ar atšķirīgu pilnu VIN - nē", () => {
    const cars = [car("s")];
    const v2 = v2With({ s: { auctionNo: "AB-12345" } });
    expect(findAutoparksDuplicate(cars, v2, { stockNo: "ab12345" })).toMatchObject({ car: { id: "s" }, by: "stock" });
    const withVin = [car("s", { vin: XC90 })];
    expect(findAutoparksDuplicate(withVin, v2, { stockNo: "AB12345", vins: [XC60] })).toBeNull();
  });

  it("aktīvs auto priekšroka pār arhīva; arhīva auto arī tiek atrasts", () => {
    const cars = [car("old", { vin: XC90, archivedAt: "2026-10-01" }), car("live", { vin: XC90 })];
    expect(findAutoparksDuplicate(cars, null, { vins: [XC90] })?.car.id).toBe("live");
    expect(findAutoparksDuplicate([cars[0]!], null, { vins: [XC90] })?.car.id).toBe("old");
  });
});

describe("krātuve: izveides ceļi bez dublikātiem", () => {
  const actor = { id: "u1", name: "Tests" };
  let dir = "";
  async function loadStore() {
    vi.resetModules();
    return import("@/lib/iriss-autoparks-store");
  }
  async function writeV2(entries: Record<string, { vin?: string; auctionNo?: string }>) {
    await fs.writeFile(path.join(dir, "autoparks-v2.json"), JSON.stringify({ version: 1, cars: v2With(entries).cars, history: [] }));
  }
  const order = (extra: Record<string, unknown> = {}) =>
    ({ id: "lo-1", vin: "", title: "Volvo XC90 2010", make: "Volvo", model: "XC90", mileageKm: 210000, notes: "", stockNo: "", listingParsed: null, ...extra }) as never;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-dedup-"));
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
    vi.stubEnv("VERCEL", "");
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("XC90: esošajam VIN tikai v2, pasūtījumam VIN tikai piezīmēs -> esošais, sasaistīts, bez dublikāta", async () => {
    const store = await loadStore();
    const existing = await store.createAutoparksCar({ make: "Volvo", model: "XC90", status: "prep_waiting" }, actor);
    await writeV2({ [existing.id]: { vin: XC90 } });
    const res = await store.ensureAutoparksCarFromOrder(order({ notes: `VIN: ${XC90}` }), actor);
    expect(res).toMatchObject({ created: false, matchedBy: "vin" });
    expect(res.car.id).toBe(existing.id);
    const state = await store.readAutoparksState();
    expect(state.cars).toHaveLength(1);
    // v1 VIN netiek aizpildīts, jo v2 jau ir (efektīvais); saite uz pasūtījumu - jā.
    expect(state.cars[0]).toMatchObject({ orderId: "lo-1", vin: "" });
  });

  it("Brenderup: pasūtījumā saīsināts VIN -> esošais auto ar pilno VIN, VIN nepārraksta", async () => {
    const store = await loadStore();
    const existing = await store.createAutoparksCar({ make: "Brenderup", vin: BRENDERUP_FULL }, actor);
    const res = await store.ensureAutoparksCarFromOrder(order({ id: "lo-2", vin: BRENDERUP_SHORT, title: "Brenderup", make: "Brenderup", model: "" }), actor);
    expect(res).toMatchObject({ created: false, matchedBy: "vin_prefix" });
    const state = await store.readAutoparksState();
    expect(state.cars).toHaveLength(1);
    expect(state.cars[0]).toMatchObject({ id: existing.id, vin: BRENDERUP_FULL, orderId: "lo-2" });
  });

  it("tukšie lauki tiek aizpildīti, aizpildītie - nē", async () => {
    const store = await loadStore();
    const existing = await store.createAutoparksCar({ model: "XC60", year: "2012" }, actor);
    await writeV2({ [existing.id]: { auctionNo: "778899" } });
    const res = await store.ensureAutoparksCarFromOrder(order({ id: "lo-3", stockNo: "778899", notes: "", title: "Volvo XC60 2013", model: "XC60 D5" }), actor);
    expect(res).toMatchObject({ created: false, matchedBy: "stock" });
    const c = (await store.readAutoparksState()).cars[0]!;
    expect(c).toMatchObject({ make: "Volvo", model: "XC60", year: "2012", mileageKm: 210000, orderId: "lo-3" });
  });

  it("jauns auto: VIN no piezīmēm tiek ierakstīts jaunajā ierakstā", async () => {
    const store = await loadStore();
    const res = await store.ensureAutoparksCarFromOrder(order({ notes: `VIN ${XC60}` }), actor);
    expect(res.created).toBe(true);
    expect(res.car.vin).toBe(XC60);
    // Atkārtoti - tas pats auto.
    const again = await store.ensureAutoparksCarFromOrder(order({ notes: `VIN ${XC60}` }), actor);
    expect(again).toMatchObject({ created: false });
    expect((await store.readAutoparksState()).cars).toHaveLength(1);
  });

  it("ar roku «+ Auto» ar esoša auto VIN (arī v2) atgriež esošo", async () => {
    const store = await loadStore();
    const existing = await store.createAutoparksCar({ make: "Volvo" }, actor);
    await writeV2({ [existing.id]: { vin: XC90 } });
    const res = await store.createAutoparksCarDedup({ make: "Volvo", vin: XC90.toLowerCase() }, actor);
    expect(res).toMatchObject({ created: false, matchedBy: "vin" });
    expect(res.car.id).toBe(existing.id);
    const other = await store.createAutoparksCarDedup({ make: "Volvo", vin: XC60 }, actor);
    expect(other.created).toBe(true);
    expect((await store.readAutoparksState()).cars).toHaveLength(2);
  });

  it("Loģistikas «archive» atrod auto pēc piezīmju VIN un v2 VIN", async () => {
    const store = await loadStore();
    const existing = await store.createAutoparksCar({ make: "Volvo", status: "in_transit" }, actor);
    await writeV2({ [existing.id]: { vin: XC90 } });
    const out = await store.syncAutoparksCarWithLogisticsAction({ id: "lo-9", vin: "", notes: `VIN: ${XC90}` }, "archive", actor);
    expect(out).toMatchObject({ id: existing.id, status: "prep_waiting" });
  });
});

describe("CSDD reģistrs: saīsināta VIN auto netiek dublēts", () => {
  it("pilns nolasījums ar pilno VIN, Autoparkā saīsināts -> nav jaunas kartītes", () => {
    const state = normalizeAutoparksState({
      cars: [
        {
          id: "ap-t",
          orderId: "",
          vin: BRENDERUP_SHORT,
          make: "Brenderup",
          model: "",
          year: "",
          plate: "",
          color: "",
          mileageKm: null,
          status: "prep_waiting",
          statusChangedAt: "2026-11-01T00:00:00Z",
          location: "",
          purchasePriceEur: null,
          salePriceEur: null,
          arrivedAt: "",
          archivedAt: "",
          createdAt: "2026-11-01T00:00:00Z",
          updatedAt: "2026-11-01T00:00:00Z",
        },
      ],
      events: [],
    });
    const file = {
      generatedAt: "2026-11-20T08:00:00Z",
      snapshot: { complete: true, owners: ["IRISS"] },
      vehicles: [{ vin: BRENDERUP_FULL, owner: "IRISS", values: { status: "Pieņemts tirdzniecībā", makeModel: "BRENDERUP", tradeActNo: "1" } }],
    } as never;
    const { result } = applyRegistryFileToState(state, file, "t.json", "2026-11-20T08:00:00Z");
    expect(result.added).toBe(0);
    expect(result.unmatched).toEqual([BRENDERUP_FULL]);
    expect(state.cars).toHaveLength(1);
    // Kontrole: bez esošā auto tas pats fails pievieno jaunu kartīti.
    const empty = normalizeAutoparksState({ cars: [], events: [] });
    expect(applyRegistryFileToState(empty, file, "t.json", "2026-11-20T08:00:00Z").result.added).toBe(1);
  });
});
