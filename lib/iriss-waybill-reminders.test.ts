import { describe, expect, it } from "vitest";
import { dueWaybillReminders } from "@/lib/iriss-waybill-push";
import type { WaybillRequest } from "@/lib/iriss-waybill-requests";

function req(over: Partial<WaybillRequest>): WaybillRequest {
  return {
    id: "wbr_a",
    createdBy: "u1",
    createdByName: "",
    createdAt: "2026-10-22T10:00:00.000Z",
    updatedAt: "2026-10-22T10:00:00.000Z",
    vehicle: { brandModel: "BMW 216d", vin: "", plate: "B1937", orderId: "" },
    routeFrom: "",
    routeTo: "",
    validDays: 2,
    validHours: 48,
    validFrom: "2026-10-22T10:00:00.000Z",
    validUntil: "2026-10-24T10:00:00.000Z",
    noteUntrusted: "",
    status: "issued",
    waybillNo: "P1",
    pdfUrl: "",
    errorReason: "",
    lastReplyText: "",
    attempts: 1,
    pickedBy: "",
    pickedAt: "",
    plateBusyAtCreate: false,
    autoDisabled: false,
    tradeAct: false,
    representative: "",
    stage: "",
    stageAt: "",
    ...over,
  };
}

const at = (iso: string) => Date.parse(iso);

describe("pavadzīmju push atgādinājumi (PN-SOON, PN-EXPIRED, PN-LONGWAIT)", () => {
  it("drīz beigsies: 24 h pirms beigām, tikai pieprasītājam, vienreiz", () => {
    const r = req({});
    expect(dueWaybillReminders([r], {}, at("2026-10-23T09:00:00.000Z"))).toEqual([]);
    const [soon] = dueWaybillReminders([r], {}, at("2026-10-23T10:30:00.000Z"));
    expect(soon).toMatchObject({ kind: "soon", key: "soon:wbr_a", requestId: "wbr_a", userKey: "staff:u1" });
    expect(soon?.message).toMatchObject({ title: "Pavadzīme drīz beigsies", url: "/admin/iriss/pavadzimes", audience: "iriss" });
    expect(soon?.message.body).toMatch(/^B193-7 · BMW 216d: beidzas rīt, \d\d:00\. Pagarini, ja vajag\.$/);
    expect(dueWaybillReminders([r], { "soon:wbr_a": "x" }, at("2026-10-23T10:30:00.000Z"))).toEqual([]);
    // Admins (env-admin) saņem savās ierīcēs.
    expect(dueWaybillReminders([req({ createdBy: "env-admin" })], {}, at("2026-10-23T10:30:00.000Z"))[0]?.userKey).toBe("admin");
  });

  it("īsai pavadzīmei (1 h, 12 h) 'drīz beigsies' nesūta, bet 'beigusies' sūta", () => {
    const short = req({ validHours: 12, validFrom: "2026-10-23T08:00:00.000Z", validUntil: "2026-10-23T20:00:00.000Z" });
    expect(dueWaybillReminders([short], {}, at("2026-10-23T19:00:00.000Z"))).toEqual([]);
    const [ended] = dueWaybillReminders([short], {}, at("2026-10-23T20:05:00.000Z"));
    expect(ended).toMatchObject({ kind: "expired", key: "expired:wbr_a" });
    expect(ended?.message).toMatchObject({ title: "Pavadzīme beigusies", body: "B193-7 · BMW 216d: vairs nav derīga. Numurs atkal ir brīvs." });
  });

  it("beigusies: tikai svaigi (6 h), vecas ziņas nesūta", () => {
    expect(dueWaybillReminders([req({})], {}, at("2026-10-24T17:00:00.000Z"))).toEqual([]);
  });

  it("pagarināta/aizstāta pavadzīme (jaunāka tam pašam numuram) neziņo par veco", () => {
    const old = req({ id: "wbr_old" });
    const newer = req({ id: "wbr_new", createdAt: "2026-10-23T09:00:00.000Z", validFrom: "2026-10-23T09:00:00.000Z", validUntil: "2026-10-25T09:00:00.000Z" });
    const due = dueWaybillReminders([old, newer], {}, at("2026-10-23T10:30:00.000Z"));
    expect(due.map((d) => d.requestId)).toEqual([]);
    // Cits numurs netiek uzskatīts par aizstājēju.
    const other = { ...newer, vehicle: { ...newer.vehicle, plate: "B7627" } };
    expect(dueWaybillReminders([old, other], {}, at("2026-10-23T10:30:00.000Z")).map((d) => d.requestId)).toEqual(["wbr_old"]);
  });

  it("vēl gaida: Gaida > 15 min; atkārtojums var ziņot vēlreiz; beigušies, atcelti un novecojuši - nē", () => {
    const q = req({ status: "queued", waybillNo: "", createdAt: "2026-10-23T10:00:00.000Z", updatedAt: "2026-10-23T10:00:00.000Z", validUntil: "2026-10-23T22:00:00.000Z" });
    expect(dueWaybillReminders([q], {}, at("2026-10-23T10:14:00.000Z"))).toEqual([]);
    const [wait] = dueWaybillReminders([q], {}, at("2026-10-23T10:16:00.000Z"));
    expect(wait).toMatchObject({ kind: "longwait", key: "longwait:wbr_a:1" });
    expect(wait?.message).toMatchObject({ title: "Pavadzīme vēl gaida", body: "BMW 216d · B193-7: Aivars vēl nav sācis. Atver, lai atkārtotu." });
    expect(dueWaybillReminders([q], { "longwait:wbr_a:1": "x" }, at("2026-10-23T10:30:00.000Z"))).toEqual([]);
    expect(dueWaybillReminders([{ ...q, attempts: 2 }], { "longwait:wbr_a:1": "x" }, at("2026-10-23T10:30:00.000Z"))[0]?.key).toBe("longwait:wbr_a:2");
    expect(dueWaybillReminders([{ ...q, validUntil: "2026-10-23T10:10:00.000Z" }], {}, at("2026-10-23T10:30:00.000Z"))).toEqual([]);
    expect(dueWaybillReminders([{ ...q, status: "cancelled" }], {}, at("2026-10-23T10:30:00.000Z"))).toEqual([]);
    expect(dueWaybillReminders([q], {}, at("2026-10-24T11:00:00.000Z"))).toEqual([]);
  });

  it("dati netiek mainīti", () => {
    const r = req({});
    const frozen = JSON.stringify(r);
    dueWaybillReminders([r], {}, at("2026-10-23T10:30:00.000Z"));
    expect(JSON.stringify(r)).toBe(frozen);
  });
});
