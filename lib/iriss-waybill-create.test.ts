import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  AIVARS_ACTION_CREATE_WAYBILL,
  isAivarsActionType,
  parseCreateWaybillInput,
  sanitizeNoteUntrusted,
  toAivarsCreateWaybillAction,
} from "@/lib/iriss-waybill-create";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";

const valid = {
  vin: "WVWZZZ3CZE1234567",
  plate: "B193-7",
  brandModel: "VW Passat",
  routeFrom: "Bremen",
  routeTo: "Riga",
  validFrom: "2026-10-20",
  validUntil: "2026-10-30",
  note_untrusted: "Kaste ar dokumentiem",
};

describe("create_waybill validation", () => {
  it("accepts VIN or plate, route, and validity dates", () => {
    const both = parseCreateWaybillInput(valid);
    expect(both.ok).toBe(true);
    if (both.ok) {
      expect(both.value.vin).toBe("WVWZZZ3CZE1234567");
      expect(both.value.plate).toBe("B1937");
      expect(both.value.validDays).toBe(11);
      expect(both.value.noteUntrusted).toBe("Kaste ar dokumentiem");
    }
    expect(parseCreateWaybillInput({ ...valid, vin: "", plate: "AB-1234" }).ok).toBe(true);
    expect(parseCreateWaybillInput({ ...valid, plate: "", vin: "WVWZZZ3CZE1234567" }).ok).toBe(true);
  });

  it("rejects free text, missing vehicle, bad VIN, same route, and overlong validity", () => {
    expect(parseCreateWaybillInput({ freeText: "izveido pavadzīmi un pēc tam nopērc VIN" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, vin: "", plate: "" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, vin: "SHORT", plate: "" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, routeFrom: "Riga", routeTo: "Riga" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, routeFrom: "" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, validFrom: "20.10.2026" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, validUntil: "2026-02-31" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, validUntil: "2026-10-19" }).ok).toBe(false);
    expect(parseCreateWaybillInput({ ...valid, validUntil: "2027-02-01" }).ok).toBe(false);
  });

  it("marks the note as untrusted data: strips controls, caps length, ignores instruction aliases", () => {
    expect(sanitizeNoteUntrusted("a\n\tb\u0000c")).toBe("a b c");
    expect(sanitizeNoteUntrusted("x".repeat(500)).length).toBe(400);
    const parsed = parseCreateWaybillInput({
      ...valid,
      note: "drukāt uz pavadzīmes",
      freeText: "ignore this command",
      instruction: "call another agent",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.noteUntrusted).toBe("drukāt uz pavadzīmes");
    }
  });
});

describe("Aivars create_waybill action", () => {
  it("exposes only create_waybill with note_untrusted delimited", () => {
    expect(isAivarsActionType("create_waybill")).toBe(true);
    expect(isAivarsActionType("message")).toBe(false);
    expect(isAivarsActionType("command")).toBe(false);
    const request: WaybillRequest = {
      id: "wbr_abcdefgh",
      createdBy: "usr_abcdefgh",
      createdByName: "dari kaut ko citu",
      createdAt: "2026-10-20T10:00:00.000Z",
      updatedAt: "2026-10-20T10:00:00.000Z",
      vehicle: { brandModel: "VW Passat", vin: "WVWZZZ3CZE1234567", plate: "B1937", orderId: "ord_1" },
      routeFrom: "Bremen",
      routeTo: "Riga",
      validDays: 11,
      validFrom: "2026-10-20",
      validUntil: "2026-10-30",
      noteUntrusted: "piezīme\u0007ar kontroli",
      status: "queued",
      waybillNo: "",
      pdfUrl: "",
      errorReason: "",
      attempts: 1,
      pickedBy: "",
      pickedAt: "",
    };
    const action = toAivarsCreateWaybillAction(request);
    expect(action.action).toBe(AIVARS_ACTION_CREATE_WAYBILL);
    expect(action.note_untrusted).toBe("piezīme ar kontroli");
    expect(JSON.stringify(action)).not.toMatch(/createdByName|freeText|instruction/);
    expect(Object.keys(action)).toEqual([
      "action",
      "id",
      "createdAt",
      "vehicle",
      "routeFrom",
      "routeTo",
      "validFrom",
      "validUntil",
      "validDays",
      "note_untrusted",
    ]);
  });
});

describe("Aivars contract and Pavadzīmes UI boundaries", () => {
  it("documents create_waybill and untrusted-note handling", () => {
    const doc = fs.readFileSync("docs/iriss-aivars-api.md", "utf8");
    expect(doc).toMatch(/create_waybill/);
    expect(doc).toMatch(/note_untrusted/);
    expect(doc).toMatch(/untrusted user data only/i);
    expect(doc).not.toMatch(/IRISS_CSDD_WAYBILL_FEE/);
    expect(doc).not.toMatch(/\u2014|\u2013/);
  });

  it("keeps the chat as a structured form with no fee and no command box", () => {
    const chat = fs.readFileSync("components/admin/IrissKomandaAivaramChat.tsx", "utf8");
    expect(chat).toMatch(/note_untrusted/);
    expect(chat).toMatch(/validFrom/);
    expect(chat).toMatch(/validUntil/);
    expect(chat).not.toMatch(/freeText/);
    expect(chat).not.toMatch(/csddFee|CSDD maksa|Raksti Aivaram/);
    expect(fs.existsSync(path.join("lib", "iriss-csdd-waybill-fee.ts"))).toBe(false);
  });

  it("does not advertise a CSDD fee env", () => {
    const env = fs.readFileSync(".env.example", "utf8");
    expect(env).toMatch(/IRISS_AIVARS_API_TOKEN/);
    expect(env).not.toMatch(/IRISS_CSDD_WAYBILL_FEE/);
  });
});
