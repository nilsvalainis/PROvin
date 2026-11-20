/**
 * Nils 20.11 (pabeigtības audits, lēmumi 1-4): «Atcelt darījumu», klienta lapās nav iekšējo statusu,
 * auto «Pārdots» -> pasūtījums «Izpildīts» (un atpakaļ), PD notikumi «Komunikācija» laika joslā.
 * Krātuves - pagaidu mapes; paziņojumi aizstāti (nekas netiek sūtīts).
 */
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));
vi.mock("@/lib/dropbox-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/dropbox-client")>()),
  getDropboxClient: () => null,
}));
vi.mock("@/lib/iriss-offer-notify", () => ({
  notifyIrissOfferDecision: async () => ({ email: true, push: 1 }),
  notifyIrissOfferQuestion: async () => ({ email: true, push: 1 }),
}));
vi.mock("next/server", async (orig) => {
  const mod = await orig<typeof import("next/server")>();
  return { ...mod, after: () => undefined };
});
const gate = vi.hoisted(() => ({ as: "admin" as "admin" | "staff" }));
vi.mock("@/lib/staff-auth", async () => {
  const { NextResponse } = await import("next/server");
  return {
    requireAdminOnlyApi: async () =>
      gate.as === "admin" ? { ok: true, actor: { kind: "admin", name: "Nils" } } : { ok: false, response: NextResponse.json({}, { status: 403 }) },
    requireIrissSectionApi: async () =>
      gate.as === "admin"
        ? { ok: true, actor: { kind: "admin", name: "Nils" } }
        : { ok: true, actor: { kind: "staff", user: { id: "usr_a", name: "Toms", sections: ["pasutijumi"] }, sessionId: "ses_x" } },
  };
});

import { AUTOPARKS_STATUS_LV } from "@/lib/iriss-autoparks";
import {
  irissPdCommunicationEvents,
  IRISS_PD_COMM_CLIENT_ACTOR,
  timelineFromPasutijums,
} from "@/lib/iriss-communication-timeline";
import { IRISS_PASUTIJUMS_LIST_STATUS_LV, emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import {
  applyIrissPdCancel,
  buildIrissPdPublicView,
  canCancelIrissPd,
  canRebaseIrissPd,
  findIrissPdTakenConflict,
  irissPdAvailableActions,
  irissPdReservedCar,
  irissPdToListRow,
  IRISS_PD_CAR_RESERVED_TEXT,
  IRISS_PD_CLIENT_ACTOR,
} from "@/lib/iriss-piedavajumi";
import { emptyIrissPiedavajums, IRISS_PD_STATUS_LV, IRISS_PD_TAKEN_STATUSES, type IrissPiedavajums } from "@/lib/iriss-piedavajumi-types";
import { irissCarIsSold, irissPdMatchCar, irissPdPublicNotCurrent } from "@/lib/iriss-public-availability";
import {
  irissOrderCompleteOnSold,
  irissOrderLinkedToCar,
  irissOrderRevertOnUnsold,
  irissSoldCandidateOrderIds,
  irissSoldTransition,
} from "@/lib/iriss-autoparks-sold-orders";
import { IrissCarSharePublicSold, IrissCarSharePublicView } from "@/components/iriss-car-share-public/IrissCarSharePublicView";

const AT = "2026-11-20T10:00:00.000Z";

function pd(over: Partial<IrissPiedavajums> = {}): IrissPiedavajums {
  const r = emptyIrissPiedavajums("pd-1", AT);
  return { ...r, number: 7, ...over, vehicle: { ...r.vehicle, title: "TESTS Škoda Octavia", vin: "TMBJJ7NE0K0123456", ...(over.vehicle ?? {}) } };
}

/* Visi iekšējie statusi, ko klients nekad nedrīkst redzēt. */
const INTERNAL_STATUS_WORDS = [
  ...Object.values(AUTOPARKS_STATUS_LV),
  ...Object.values(IRISS_PD_STATUS_LV),
  ...Object.values(IRISS_PASUTIJUMS_LIST_STATUS_LV),
].filter((w) => w.length > 3);

describe("1. «Atcelt darījumu» (tīrā daļa)", () => {
  it("tikai apstiprinātam; -> «Atcelts» ar iemeslu, vēsturē; vairs nebloķē jaunu PD; var «Jauns uz šī bāzes»", () => {
    expect(canCancelIrissPd("approved")).toBe(true);
    for (const st of ["requested", "draft", "sent", "declined", "expired", "cancelled"] as const) expect(canCancelIrissPd(st)).toBe(false);
    const res = applyIrissPdCancel(pd({ status: "approved", sourceRef: "autoparks:car1" }), { by: "Nils", at: AT, reason: "Klients pārdomāja" });
    if (!res.ok) throw new Error(res.error);
    expect(res.record.status).toBe("cancelled");
    expect(res.record.cancelledAt).toBe(AT);
    expect(res.record.cancelReason).toBe("Klients pārdomāja");
    expect(res.record.history.at(-1)?.text).toBe("Darījums atcelts: Klients pārdomāja");
    expect(IRISS_PD_TAKEN_STATUSES).not.toContain("cancelled");
    const row = irissPdToListRow(res.record);
    expect(findIrissPdTakenConflict([row], { sourceRef: "autoparks:car1", vin: "TMBJJ7NE0K0123456" })).toBeNull();
    expect(canRebaseIrissPd("cancelled")).toBe(true);
    expect(irissPdAvailableActions("cancelled")).toEqual([]);
    expect(applyIrissPdCancel(pd({ status: "sent" }), { by: "Nils", at: AT }).ok).toBe(false);
  });

  it("klienta saitē atcelts = slēgts (bez statusa vārda)", () => {
    const view = buildIrissPdPublicView(pd({ status: "cancelled", linkToken: "x".repeat(32) }), "link", Date.parse(AT));
    expect(view.state).toBe("closed");
    expect(irissPdPublicNotCurrent({ status: "cancelled" }, false)).toBe(true);
  });

  it("auto rezervāciju pēc PD vēstures: rezervēja -> jā, pēc atgriešanas -> nē", () => {
    expect(irissPdReservedCar(pd())).toBe(false);
    const r = pd({ history: [{ at: AT, by: "Sistēma", text: IRISS_PD_CAR_RESERVED_TEXT }] });
    expect(irissPdReservedCar(r)).toBe(true);
    expect(irissPdReservedCar({ history: [...r.history, { at: AT, by: "Nils", text: "Autoparka auto atgriezts «Pārdošanā»" }] })).toBe(false);
  });
});

describe("2. Klienta lapas: pārdots auto - neitrāli, bez iekšējiem statusiem", () => {
  it("pārdots = statuss «Pārdots» vai arhīvs ar iemeslu sold; arhīvs ar roku - nē", () => {
    expect(irissCarIsSold({ status: "sold" })).toBe(true);
    expect(irissCarIsSold({ status: "for_sale", archivedAt: AT, archiveReason: "sold" })).toBe(true);
    expect(irissCarIsSold({ status: "for_sale", archivedAt: AT })).toBe(false);
    expect(irissCarIsSold({ status: "reserved" })).toBe(false);
    expect(irissCarIsSold(null)).toBe(false);
  });

  it("PD saite: pārdots citam -> nav aktuāls; apstiprinātajam - paliek", () => {
    expect(irissPdPublicNotCurrent({ status: "sent" }, true)).toBe(true);
    expect(irissPdPublicNotCurrent({ status: "declined" }, true)).toBe(true);
    expect(irissPdPublicNotCurrent({ status: "approved" }, true)).toBe(false);
    expect(irissPdPublicNotCurrent({ status: "sent" }, false)).toBe(false);
    const cars = [{ id: "c1", vin: "AAA" }, { id: "c2", vin: "TMBJJ7NE0K0123456" }];
    expect(irissPdMatchCar(pd({ sourceRef: "autoparks:c1" }), cars)?.id).toBe("c1");
    expect(irissPdMatchCar(pd({ sourceRef: "" }), cars)?.id).toBe("c2");
    expect(irissPdMatchCar(pd({ sourceRef: "", vehicle: { vin: "" } as IrissPiedavajums["vehicle"] }), cars)).toBeNull();
  });

  it("/a/ lapa (parasta un pārdota) nesatur nevienu iekšējo statusu; pārdotā - tikai neitrāls teksts + kontakti", () => {
    const normal = renderToStaticMarkup(
      <IrissCarSharePublicView
        token="tok12345"
        view={{ brand: "Dzintarzeme Auto", legalName: "SIA ĪRISS", title: "TESTS Škoda Octavia", year: "2019", color: "Pelēka", vin: "TMBJJ7NE0K0123456", mileage: "120 000 km", hasPhoto: false }}
      />,
    );
    const sold = renderToStaticMarkup(<IrissCarSharePublicSold />);
    for (const html of [normal, sold]) for (const w of INTERNAL_STATUS_WORDS) expect(html).not.toContain(w);
    expect(sold).toContain("Šis auto vairs nav pieejams");
    expect(sold).toContain("info@dzintarzemeauto.lv");
    expect(sold).not.toContain("Škoda");
  });
});

describe("3. «Pārdots» -> pasūtījums «Izpildīts» (tīrā daļa)", () => {
  const order = (over = {}) => ({ ...emptyIrissPasutijums("ord-1", AT), listStatus: "reserved" as const, ...over });

  it("pāreja: tikai uz/no «Pārdots»", () => {
    expect(irissSoldTransition("reserved", "sold")).toBe("sold");
    expect(irissSoldTransition("sold", "for_sale")).toBe("unsold");
    expect(irissSoldTransition("for_sale", "reserved")).toBeNull();
    expect(irissSoldTransition("sold", "sold")).toBeNull();
  });

  it("rezervēts/aktīvs -> izpildīts ar marķieri; atsaukšana atjauno iepriekšējo; ar roku mainītu neaiztiek", () => {
    const done = irissOrderCompleteOnSold(order(), { carId: "car1", at: AT })!;
    expect(done.listStatus).toBe("completed");
    expect(done.statusHistory?.at(-1)).toMatchObject({ from: "reserved", to: "completed", autoparksCarId: "car1" });
    const back = irissOrderRevertOnUnsold(done, { carId: "car1", at: AT })!;
    expect(back.listStatus).toBe("reserved");
    expect(irissOrderRevertOnUnsold(done, { carId: "cits", at: AT })).toBeNull();
    expect(irissOrderRevertOnUnsold(order({ listStatus: "completed" }), { carId: "car1", at: AT })).toBeNull();
    expect(irissOrderCompleteOnSold(order({ listStatus: "inactive" }), { carId: "car1", at: AT })).toBeNull();
    expect(irissOrderCompleteOnSold(order({ listStatus: "active" }), { carId: "car1", at: AT })?.listStatus).toBe("completed");
  });

  it("piesaiste: apstiprināts PD, VIN vai vecā piedāvājuma avots; rezervēts bez saites - nē", () => {
    const car = { id: "car1", vin: "TMBJJ7NE0K0123456" };
    expect(irissOrderLinkedToCar(order({ id: "o1", vin: "" }), car, new Set(["o1"]))).toBe(true);
    expect(irissOrderLinkedToCar(order({ vin: "tmbjj7ne0k0123456" }), car, new Set())).toBe(true);
    expect(irissOrderLinkedToCar(order({ vin: "" }), car, new Set())).toBe(false);
    const ids = irissSoldCandidateOrderIds({
      car,
      pdRows: [
        { status: "approved", sourceRef: "autoparks:car1", vin: "", approvedOrderId: "o-pd" },
        { status: "cancelled", sourceRef: "autoparks:car1", vin: "", approvedOrderId: "o-cancel" },
      ],
      orderRows: [],
      mode: "sold",
      nowMs: Date.parse(AT),
    });
    expect(ids).toEqual(["o-pd"]);
  });
});

describe("4. PD notikumi «Komunikācija» laika joslā", () => {
  it("izveidots, nosūtīts, atvērts, jautājums, apstiprināts, noraidīts, atcelts - bez cenām", () => {
    expect(IRISS_PD_COMM_CLIENT_ACTOR).toBe(IRISS_PD_CLIENT_ACTOR);
    const rec = pd({
      price: "12750",
      history: [
        { at: "2026-11-20T10:01:00.000Z", by: "Nils", text: "Nosūtīts klientam TESTS (līdz 30.11.2026)" },
        { at: "2026-11-20T10:03:00.000Z", by: IRISS_PD_CLIENT_ACTOR, text: "Klienta jautājums: Vai ir servisa grāmata?" },
        { at: "2026-11-20T10:04:00.000Z", by: IRISS_PD_CLIENT_ACTOR, text: "Apstiprināts" },
        { at: "2026-11-20T10:05:00.000Z", by: "Nils", text: "Atzīmēts kā noraidīts" },
        { at: "2026-11-20T10:06:00.000Z", by: IRISS_PD_CLIENT_ACTOR, text: "Klients noraidīja: Par dārgu" },
        { at: "2026-11-20T10:07:00.000Z", by: "Nils", text: "Darījums atcelts: Klients pārdomāja" },
      ],
      messages: [{ id: "m1", at: "2026-11-20T10:03:00.000Z", from: "client", kind: "question", by: IRISS_PD_CLIENT_ACTOR, text: "Vai ir servisa grāmata?" }],
    });
    const events = irissPdCommunicationEvents(rec, { firstViewedAt: "2026-11-20T10:02:00.000Z" });
    const titles = events.map((e) => e.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "PD-0007 izveidots",
        "PD-0007 nosūtīts klientam",
        "PD-0007 klients atvēra saiti",
        "PD-0007 klienta jautājums",
        "PD-0007 apstiprināts",
        "PD-0007 noraidīts",
        "PD-0007 klients noraidīja",
        "PD-0007 darījums atcelts",
      ]),
    );
    expect(titles.filter((t) => t.includes("jautājums"))).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain("12750");
    const order = { ...emptyIrissPasutijums("ord-1", AT) };
    const timeline = timelineFromPasutijums(order, [], events);
    expect(timeline.filter((i) => i.kind === "offer").length).toBe(events.length);
    expect(timeline[0]?.title).toBe("PD-0007 darījums atcelts");
  });
});

describe("Integrācija: atcelšana un «Pārdots» krātuvēs", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
    dirs.length = 0;
    gate.as = "admin";
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function setup() {
    const pasDir = mkdtempSync(path.join(os.tmpdir(), "iriss-lem-pas-"));
    const logDir = mkdtempSync(path.join(os.tmpdir(), "iriss-lem-log-"));
    dirs.push(pasDir, logDir);
    vi.stubEnv("ADMIN_IRISS_PASUTIJUMI_DIR", pasDir);
    vi.stubEnv("ADMIN_IRISS_LOGISTICS_DIR", logDir);
    vi.stubEnv("VERCEL", "");
    vi.resetModules();
    const v1 = await import("@/lib/iriss-autoparks-store");
    const v2 = await import("@/lib/iriss-autoparks-v2-store");
    const pdStore = await import("@/lib/iriss-piedavajumi-store");
    const pasStore = await import("@/lib/iriss-pasutijumi-store");
    const avail = await import("@/lib/iriss-public-availability");
    const admin = await import("@/app/api/admin/iriss-piedavajumi/[id]/route");
    const actor = { id: "u1", name: "Nils" };
    const car = await v1.createAutoparksCar({ make: "Škoda", model: "Octavia", vin: "TMBJJ7NE0K0123456", plate: "", location: "Tukums" }, actor);
    await v2.changeAutoparksStatusV2(car.id, "for_sale", actor);
    const mkPd = async (over: Partial<IrissPiedavajums> = {}) => {
      const created = await pdStore.createIrissPd((n) => {
        const r = emptyIrissPiedavajums(crypto.randomUUID(), AT);
        return {
          ...r,
          number: n,
          status: "sent",
          validUntil: "2099-12-31",
          linkToken: pdStore.newIrissPdToken(),
          source: "autoparks",
          sourceRef: `autoparks:${car.id}`,
          vehicle: { ...r.vehicle, title: "TESTS Škoda Octavia", vin: "TMBJJ7NE0K0123456" },
          client: { name: "TESTS Klients", phone: "+37120000000", email: "", orderId: "" },
          ...over,
        };
      });
      if (!created.ok) throw new Error("create");
      return created.record;
    };
    const post = async (id: string, body: unknown) => {
      const res = await admin.POST(
        new Request(`http://localhost/api/admin/iriss-piedavajumi/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
        { params: Promise.resolve({ id }) },
      );
      return { status: res.status, data: (await res.json()) as { ok?: boolean; record?: IrissPiedavajums; message?: string } };
    };
    const carStatus = async () => (await v1.readAutoparksState()).cars.find((c) => c.id === car.id)!.status;
    return { v1, v2, pdStore, pasStore, avail, actor, car, mkPd, post, carStatus };
  }

  it("apstiprināts -> «Atcelt darījumu»: PD atcelts, auto «Pārdošanā», pasūtījums «Aktīvs»; darbiniekam aizliegts; jauns PD atļauts", async () => {
    const t = await setup();
    const rec = await t.mkPd();
    expect((await t.post(rec.id, { action: "approve" })).data.ok).toBe(true);
    expect(await t.carStatus()).toBe("reserved");
    const approved = (await t.pdStore.readIrissPd(rec.id))!;
    const orderId = approved.approvedOrderId;
    expect((await t.pasStore.readIrissPasutijums(orderId))!.listStatus).toBe("reserved");

    gate.as = "staff";
    expect((await t.post(rec.id, { action: "cancel" })).status).toBe(403);
    gate.as = "admin";

    const res = await t.post(rec.id, { action: "cancel", text: "Klients pārdomāja" });
    expect(res.data.ok).toBe(true);
    expect(res.data.record?.status).toBe("cancelled");
    expect(await t.carStatus()).toBe("for_sale");
    const order = (await t.pasStore.readIrissPasutijums(orderId))!;
    expect(order.listStatus).toBe("active");
    expect(order.statusHistory?.at(-1)).toMatchObject({ from: "reserved", to: "active" });
    const texts = res.data.record!.history.map((h) => h.text);
    expect(texts).toEqual(expect.arrayContaining(["Darījums atcelts: Klients pārdomāja", "Pasūtījums atgriezts «Aktīvs»", "Autoparka auto atgriezts «Pārdošanā»"]));
    // Atcelts PD vairs nebloķē jaunu PD šim auto.
    const rows = await t.pdStore.listIrissPdRows();
    const { findIrissPdTakenConflict: conflict } = await import("@/lib/iriss-piedavajumi");
    expect(conflict(rows, { sourceRef: `autoparks:${t.car.id}` })).toBeNull();
    expect(await t.avail.irissPdPublicNotCurrentFor(res.data.record!)).toBe(true);
  });

  it("auto «Pārdots» -> pasūtījums «Izpildīts», vēsture abos; citam PD saite nav aktuāla; «Atjaunot no arhīva» -> atpakaļ «Rezervēts»", async () => {
    const t = await setup();
    const rec = await t.mkPd();
    const other = await t.mkPd({ sourceRef: "", source: "manual", client: { name: "Cits", phone: "", email: "", orderId: "" } });
    await t.post(rec.id, { action: "approve" });
    const orderId = (await t.pdStore.readIrissPd(rec.id))!.approvedOrderId;
    expect(await t.avail.irissPdPublicNotCurrentFor((await t.pdStore.readIrissPd(other.id))!)).toBe(false);

    expect((await t.v2.changeAutoparksStatusV2(t.car.id, "sold", t.actor)).ok).toBe(true);
    const done = (await t.pasStore.readIrissPasutijums(orderId))!;
    expect(done.listStatus).toBe("completed");
    expect(done.statusHistory?.at(-1)).toMatchObject({ from: "reserved", to: "completed", autoparksCarId: t.car.id });
    const hist = await t.v2.listAutoparksV2History(t.car.id);
    expect(hist.some((h) => h.field === "clientOrder" && h.to === "Pārdots")).toBe(true);
    // Apstiprinātajam klientam saite paliek; citam (pēc VIN) - «nav aktuāls».
    expect(await t.avail.irissPdPublicNotCurrentFor((await t.pdStore.readIrissPd(rec.id))!)).toBe(false);
    expect(await t.avail.irissPdPublicNotCurrentFor((await t.pdStore.readIrissPd(other.id))!)).toBe(true);
    // /a/ saite
    const { ensureIrissCarShare } = await import("@/lib/iriss-car-share-store");
    const share = await ensureIrissCarShare({ autoparksCarId: t.car.id, vin: t.car.vin });
    expect(await t.avail.irissCarShareTokenSold(share.token)).toBe(true);

    expect((await t.v2.restoreAutoparksCarV2(t.car.id, t.actor)).ok).toBe(true);
    expect((await t.pasStore.readIrissPasutijums(orderId))!.listStatus).toBe("reserved");
    expect(await t.avail.irissCarShareTokenSold(share.token)).toBe(false);
  });

  it("v1 PATCH ceļš (patchAutoparksCar) arī sinhronizē; ar roku mainītu pasūtījumu atsaukšana neaiztiek", async () => {
    const t = await setup();
    const rec = await t.mkPd();
    await t.post(rec.id, { action: "approve" });
    const orderId = (await t.pdStore.readIrissPd(rec.id))!.approvedOrderId;
    await t.v1.patchAutoparksCar(t.car.id, { status: "sold" }, t.actor);
    expect((await t.pasStore.readIrissPasutijums(orderId))!.listStatus).toBe("completed");
    // Cilvēks pēc tam pasūtījumu pārliek «Neaktīvs» - atsaukšana to nemaina.
    const o = (await t.pasStore.readIrissPasutijums(orderId))!;
    const { appendIrissStatusHistory } = await import("@/lib/iriss-pasutijumi-audit-fields");
    await t.pasStore.writeIrissPasutijums(appendIrissStatusHistory(o, "inactive", { at: new Date().toISOString(), by: "Nils" }));
    await t.v1.patchAutoparksCar(t.car.id, { status: "for_sale" }, t.actor);
    expect((await t.pasStore.readIrissPasutijums(orderId))!.listStatus).toBe("inactive");
  });
});
