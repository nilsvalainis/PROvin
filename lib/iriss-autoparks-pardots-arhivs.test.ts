import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTOPARKS_ARCHIVE_RESTORED_TEXT,
  AUTOPARKS_ARCHIVE_SOLD_TEXT,
  autoparksArchiveOnStatusChange,
  autoparksCarArchived,
  autoparksCarArchivedManually,
  normalizeAutoparksState,
  type AutoparksCar,
} from "@/lib/iriss-autoparks";
import { isTradeAcceptedCar, listWaybillCandidateCars } from "@/lib/iriss-autoparks-registry";
import { autoparksV2ListRows, autoparksV2OwnerCounts, filterAutoparksV2Rows } from "@/lib/iriss-autoparks-v2-list";
import { normalizeAutoparksV2State } from "@/lib/iriss-autoparks-v2";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => null,
}));

const NOW = "2026-11-20T10:00:00.000Z";

function car(over: Partial<AutoparksCar> = {}): AutoparksCar {
  return {
    id: "ap-1",
    orderId: "",
    vin: "WVWZZZ3CZKE012345",
    make: "VW",
    model: "Passat",
    year: "2019",
    plate: "",
    color: "",
    mileageKm: null,
    status: "for_sale",
    statusChangedAt: "",
    location: "",
    purchasePriceEur: null,
    salePriceEur: null,
    arrivedAt: "",
    archivedAt: "",
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

const accepted = { tradeActNo: "123", tradeActDate: "2026-10-01", status: "Tirdzniecībā", removedAt: "" } as AutoparksCar["registry"];

describe("Pārdots -> arhīvs (Nils 20.11): noteikums", () => {
  it("uz «Pārdots» - archivedAt + archiveReason sold + vēstures teksts", () => {
    const out = autoparksArchiveOnStatusChange(car(), "sold", NOW);
    expect(out?.car.archivedAt).toBe(NOW);
    expect(out?.car.archiveReason).toBe("sold");
    expect(out?.text).toBe(AUTOPARKS_ARCHIVE_SOLD_TEXT);
    expect(AUTOPARKS_ARCHIVE_SOLD_TEXT).toBe("Pārdots - pārcelts uz arhīvu");
  });

  it("no «Pārdots» uz citu - arhīvs noņemts", () => {
    const out = autoparksArchiveOnStatusChange(car({ status: "sold", archivedAt: NOW, archiveReason: "sold" }), "for_sale", NOW);
    expect(out?.car.archivedAt).toBe("");
    expect(out?.car).not.toHaveProperty("archiveReason");
    expect(out?.text).toBe(AUTOPARKS_ARCHIVE_RESTORED_TEXT);
  });

  it("citas maiņas un jau ar roku arhivēts - nekas", () => {
    expect(autoparksArchiveOnStatusChange(car(), "reserved", NOW)).toBeNull();
    expect(autoparksArchiveOnStatusChange(car({ archivedAt: NOW }), "sold", NOW)).toBeNull();
    // vecs pārdotais bez archivedAt: maiņa uz citu - nav ko noņemt (atvasinātais arhīvs pazūd pats).
    expect(autoparksArchiveOnStatusChange(car({ status: "sold" }), "for_sale", NOW)).toBeNull();
  });

  it("atvasināts arhīvs: vecs «Pārdots» bez archivedAt ir arhīvā, dati nemainās", () => {
    const old = car({ status: "sold" });
    expect(autoparksCarArchived(old)).toBe(true);
    expect(old.archivedAt).toBe("");
    expect(autoparksCarArchived(car())).toBe(false);
    expect(autoparksCarArchived(car({ archivedAt: NOW }))).toBe(true);
  });

  it("normalizācija saglabā archiveReason tikai ar archivedAt", () => {
    const s = normalizeAutoparksState({
      cars: [
        { ...car({ id: "a" }), status: "sold", archivedAt: NOW, archiveReason: "sold" },
        { ...car({ id: "b" }), archiveReason: "sold" },
      ],
    });
    expect(s.cars[0]!.archiveReason).toBe("sold");
    expect(s.cars[1]).not.toHaveProperty("archiveReason");
  });
});

describe("Autoparka saraksts", () => {
  const v2 = normalizeAutoparksV2State({});
  const cars = [
    car({ id: "live" }),
    car({ id: "sold-old", status: "sold" }),
    car({ id: "sold-new", status: "sold", archivedAt: NOW, archiveReason: "sold" }),
    car({ id: "manual", archivedAt: NOW }),
  ];
  const rows = autoparksV2ListRows(cars, v2);

  it("galvenajā sarakstā tikai aktīvie; «Arhīvs» - pārdotie (arī vecie) un arhivētie", () => {
    expect(filterAutoparksV2Rows(rows, { owner: "all" }).map((r) => r.id)).toEqual(["live"]);
    expect(filterAutoparksV2Rows(rows, { owner: "archive" }).map((r) => r.id)).toEqual(["sold-old", "sold-new", "manual"]);
    expect(autoparksV2OwnerCounts(rows).all).toBe(1);
  });
});

describe("Pavadzīmes (#1060): pārdots, bet reģistrā pieņemts - joprojām pieejams", () => {
  it("automātiskais «Pārdots» arhīvs neizslēdz; arhīvs ar roku izslēdz", () => {
    expect(isTradeAcceptedCar(car({ status: "sold", archivedAt: NOW, archiveReason: "sold", registry: accepted }))).toBe(true);
    expect(isTradeAcceptedCar(car({ status: "sold", registry: accepted }))).toBe(true);
    expect(isTradeAcceptedCar(car({ archivedAt: NOW, registry: accepted }))).toBe(false);
    expect(isTradeAcceptedCar(car({ status: "sold", archivedAt: NOW, archiveReason: "sold", registry: { ...accepted!, removedAt: NOW } }))).toBe(false);
    expect(autoparksCarArchivedManually(car({ archivedAt: NOW, archiveReason: "sold" }))).toBe(false);
  });

  it("kamēr reģistrs nav nolasīts - pārdotos nerāda (kā līdz šim)", () => {
    const res = listWaybillCandidateCars([car({ id: "a" }), car({ id: "b", status: "sold", archivedAt: NOW, archiveReason: "sold" })]);
    expect(res.source).toBe("autoparks");
    expect(res.cars.map((c) => c.id)).toEqual(["a"]);
  });
});

describe("Krātuve: visi statusa maiņas ceļi", () => {
  const actor = { id: "u1", name: "Nils" };
  let dir = "";

  async function load() {
    vi.resetModules();
    return {
      v1: await import("@/lib/iriss-autoparks-store"),
      v2: await import("@/lib/iriss-autoparks-v2-store"),
    };
  }

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "autoparks-sold-test-"));
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", dir);
    vi.stubEnv("VERCEL", "");
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("kabineta/saraksta statuss (v2 API): «Pārdots» arhivē ar vēsturi; atsaukšana un maiņa atpakaļ atjauno", async () => {
    const { v1, v2 } = await load();
    const c = await v1.createAutoparksCar({ make: "Audi", model: "A6", status: "for_sale" }, actor);
    const res = await v2.changeAutoparksStatusV2(c.id, "sold", actor);
    if (!res.ok) throw new Error("status");
    expect(res.archived).toBe(true);
    let saved = (await v1.readAutoparksState()).cars[0]!;
    expect(saved.archivedAt).not.toBe("");
    expect(saved.archiveReason).toBe("sold");
    const hist = await v2.listAutoparksV2History(c.id);
    expect(hist.some((h) => h.field === "archive" && h.to === AUTOPARKS_ARCHIVE_SOLD_TEXT)).toBe(true);
    expect((await v1.readAutoparksState()).events.some((e) => e.text === AUTOPARKS_ARCHIVE_SOLD_TEXT)).toBe(true);

    // atsaukšana 5 s laikā -> atpakaļ sarakstā
    expect(await v2.undoAutoparksStatusV2(c.id, res.historyId, actor)).toEqual({ ok: true, status: "for_sale" });
    saved = (await v1.readAutoparksState()).cars[0]!;
    expect(saved.archivedAt).toBe("");
    expect(saved).not.toHaveProperty("archiveReason");

    await v2.changeAutoparksStatusV2(c.id, "sold", actor);
    const back = await v2.changeAutoparksStatusV2(c.id, "reserved", actor);
    expect(back.ok && back.archived).toBe(false);
    expect((await v1.readAutoparksState()).cars[0]!.archivedAt).toBe("");
  });

  it("«Atjaunot no arhīva»: pārdotais -> «Pārdošanā», vēsturē ieraksts; nearhivētam - not_archived", async () => {
    const { v1, v2 } = await load();
    const c = await v1.createAutoparksCar({ make: "BMW", model: "530", status: "reserved" }, actor);
    expect(await v2.restoreAutoparksCarV2(c.id, actor)).toEqual({ ok: false, reason: "not_archived" });
    await v2.changeAutoparksStatusV2(c.id, "sold", actor);
    expect(await v2.restoreAutoparksCarV2(c.id, actor)).toEqual({ ok: true, status: "for_sale" });
    const saved = (await v1.readAutoparksState()).cars[0]!;
    expect(saved.status).toBe("for_sale");
    expect(autoparksCarArchived(saved)).toBe(false);
    const hist = await v2.listAutoparksV2History(c.id);
    expect(hist.some((h) => h.field === "archive" && h.to === AUTOPARKS_ARCHIVE_RESTORED_TEXT)).toBe(true);
    expect(await v2.restoreAutoparksCarV2("nav", actor)).toEqual({ ok: false, reason: "not_found" });
  });

  it("vecais v1 PATCH ceļš (statuss un archived:false) un jauns auto ar «Pārdots» - tas pats noteikums", async () => {
    const { v1 } = await load();
    const c = await v1.createAutoparksCar({ make: "Skoda", model: "Superb" }, actor);
    await v1.patchAutoparksCar(c.id, { status: "sold" }, actor);
    expect((await v1.readAutoparksState()).cars[0]!.archiveReason).toBe("sold");
    await v1.setAutoparksArchived(c.id, false, actor);
    const restored = (await v1.readAutoparksState()).cars[0]!;
    expect(restored.status).toBe("for_sale");
    expect(restored.archivedAt).toBe("");

    const sold = await v1.createAutoparksCar({ make: "Volvo", model: "XC60", status: "sold" }, actor);
    expect(sold.archivedAt).not.toBe("");
    expect(sold.archiveReason).toBe("sold");
  });

  it("vecs pārdotais bez archivedAt (atvasināti arhīvā) - atjaunošana maina statusu, citus datus neaiztiek", async () => {
    const { v1 } = await load();
    const c = await v1.createAutoparksCar({ make: "Opel", model: "Insignia" }, actor);
    // simulē vecu ierakstu: statuss «Pārdots», archivedAt tukšs
    const file = path.join(dir, "autoparks.json");
    const raw = JSON.parse(await fs.readFile(file, "utf8")) as { cars: Array<Record<string, unknown>> };
    raw.cars[0]!.status = "sold";
    await fs.writeFile(file, JSON.stringify(raw));
    const res = await v1.restoreAutoparksCarFromArchive(c.id, actor);
    expect(res?.changed).toBe(true);
    expect(res?.car.status).toBe("for_sale");
    expect(res?.car.make).toBe("Opel");
  });
});
