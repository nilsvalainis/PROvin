/**
 * J61: pildspalva Iegādes dokumentam tagad var mainīt tipu (ne tikai nosaukumu), lai Auto1 Car
 * Invoice/Pirkuma apstiprinājums, kas ielādēti ar roku un iekrituši "other", var tikt pārklasificēti -
 * tad Auto1 "Trūkst dokumenta" brīdinājums tīrās.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  gate: { ok: true as const, actor: { kind: "admin" as const, name: "Nils" }, perms: {}, actorId: "admin1", actorName: "Nils" },
  car: { id: "car1", orderId: "order1" } as Record<string, unknown>,
  doc: { id: "doc1", carId: "order1", type: "other", title: "Vecs nosaukums", dropboxPath: "", deletedAt: "" } as Record<string, unknown>,
  renameCalls: [] as { id: string; title: string }[],
  retypeCalls: [] as { id: string; type: string }[],
}));

vi.mock("@/lib/iriss-autoparks-v2-access", async (orig) => ({
  ...(await orig<typeof import("@/lib/iriss-autoparks-v2-access")>()),
  requireAutoparksV2Api: async () => state.gate,
}));
vi.mock("@/lib/iriss-autoparks-v2-store", () => ({
  readAutoparksV2Car: async (id: string) => (id === state.car.id ? { car: state.car, v2: {} } : null),
}));
vi.mock("@/lib/iriss-autoparks-v2-iegade", () => ({
  autoparksV2IegadeView: async () => ({ files: [] }),
  readAutoparksV2IegadeFile: async () => null,
}));
vi.mock("@/lib/iriss-autoparks-v2-iegade-dropbox", () => ({
  iegadeDocDropboxFileName: (title: string) => `${title}.pdf`,
  renameIegadeDocumentInStock: async () => null,
  deleteIegadeDocumentFromStock: async () => null,
}));
vi.mock("@/lib/iriss-logistics-cabinet-store", () => ({
  getCabinetDocument: async (id: string) => (id === state.doc.id ? { ...state.doc } : null),
  renameCabinetDocument: async (id: string, title: string) => {
    state.renameCalls.push({ id, title });
    state.doc = { ...state.doc, title };
    return { ...state.doc };
  },
  setCabinetDocumentType: async (id: string, type: string) => {
    state.retypeCalls.push({ id, type });
    state.doc = { ...state.doc, type };
    return { ...state.doc };
  },
  setCabinetDocumentDropboxPath: async () => null,
}));

import { PATCH } from "@/app/api/admin/iriss-autoparks-v2/iegade/[id]/faili/[fileId]/route";

function patchFile(body: Record<string, unknown>) {
  const req = new Request("http://x/api/admin/iriss-autoparks-v2/iegade/car1/faili/c:doc1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(req, { params: Promise.resolve({ id: "car1", fileId: "c:doc1" }) });
}

beforeEach(() => {
  state.renameCalls = [];
  state.retypeCalls = [];
  state.doc = { id: "doc1", carId: "order1", type: "other", title: "Vecs nosaukums", dropboxPath: "", deletedAt: "" };
});

describe("Iegādes dokumenta pārdēvēšana un tipa maiņa (J30 F1 + J61)", () => {
  it("tikai nosaukums - tips netiek skarts", async () => {
    const res = await patchFile({ title: "Jauns nosaukums" });
    expect(res.status).toBe(200);
    expect(state.renameCalls).toEqual([{ id: "doc1", title: "Jauns nosaukums" }]);
    expect(state.retypeCalls).toEqual([]);
  });

  it("tikai tips (bez nosaukuma) - ļauts, nosaukums netiek aiztikts", async () => {
    const res = await patchFile({ type: "purchase_confirm" });
    expect(res.status).toBe(200);
    expect(state.renameCalls).toEqual([]);
    expect(state.retypeCalls).toEqual([{ id: "doc1", type: "purchase_confirm" }]);
  });

  it("nosaukums + tips kopā", async () => {
    const res = await patchFile({ title: "Car Invoice 900123", type: "car_invoice" });
    expect(res.status).toBe(200);
    expect(state.renameCalls).toEqual([{ id: "doc1", title: "Car Invoice 900123" }]);
    expect(state.retypeCalls).toEqual([{ id: "doc1", type: "car_invoice" }]);
  });

  it("tips, kas sakrīt ar pašreizējo - lieks store izsaukums netiek veikts", async () => {
    state.doc.type = "car_invoice";
    const res = await patchFile({ title: "x", type: "car_invoice" });
    expect(res.status).toBe(200);
    expect(state.retypeCalls).toEqual([]);
  });

  it("nederīgs tips (ārpus IEGADE_DOC_TYPE_OPTIONS) - 400, store netiek aiztikts", async () => {
    const res = await patchFile({ type: "service_invoice" });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_type");
    expect(state.retypeCalls).toEqual([]);
  });

  it("nedz nosaukums, nedz tips - 400", async () => {
    const res = await patchFile({});
    expect(res.status).toBe(400);
  });
});
