import { describe, expect, it } from "vitest";
import { AUTO_WAYBILL_GRACE_MS } from "@/lib/iriss-waybill-auto";
import { dueWaybillReminders, dueWaybillStuckHandoffs } from "@/lib/iriss-waybill-push";
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

describe("j31: iestrēgušu darbu rezerve - pamodina Aivaru ar roku", () => {
  const createdAt = "2026-10-23T10:00:00.000Z";
  const graceOver = at(createdAt) + AUTO_WAYBILL_GRACE_MS + 1000;

  it("queued, nav paņemts, ilgāk par grace periodu - pamodina vienreiz, atkārtots mēģinājums - vēlreiz", () => {
    const q = req({ status: "queued", waybillNo: "", createdAt, updatedAt: createdAt, validUntil: "2026-10-23T22:00:00.000Z" });
    expect(dueWaybillStuckHandoffs([q], {}, at(createdAt) + AUTO_WAYBILL_GRACE_MS - 1000)).toEqual([]);
    expect(dueWaybillStuckHandoffs([q], {}, graceOver)).toEqual([{ key: "handoff:wbr_a:1", requestId: "wbr_a" }]);
    expect(dueWaybillStuckHandoffs([q], { "handoff:wbr_a:1": "x" }, graceOver)).toEqual([]);
    expect(dueWaybillStuckHandoffs([{ ...q, attempts: 2 }], { "handoff:wbr_a:1": "x" }, graceOver)).toEqual([
      { key: "handoff:wbr_a:2", requestId: "wbr_a" },
    ]);
  });

  it("jau paņemts (pickedAt), beidzies termiņš, atcelts vai novecojis (24 h) - nē", () => {
    const picked = req({ status: "queued", pickedAt: "x", createdAt, updatedAt: createdAt, validUntil: "2026-10-23T22:00:00.000Z" });
    expect(dueWaybillStuckHandoffs([picked], {}, graceOver)).toEqual([]);
    const expired = req({ status: "queued", createdAt, updatedAt: createdAt, validUntil: "2026-10-23T10:01:00.000Z" });
    expect(dueWaybillStuckHandoffs([expired], {}, graceOver)).toEqual([]);
    const cancelled = req({ status: "cancelled", createdAt, updatedAt: createdAt });
    expect(dueWaybillStuckHandoffs([cancelled], {}, graceOver)).toEqual([]);
    const stale = req({ status: "queued", createdAt, updatedAt: createdAt, validUntil: "2026-10-25T10:00:00.000Z" });
    expect(dueWaybillStuckHandoffs([stale], {}, at(createdAt) + 25 * 3_600_000)).toEqual([]);
  });

  it("worker paņēmis darbā (in_progress), bet nokritis vidū (novecojis) - pamodina pēc pickedAt", () => {
    const stuck = req({ status: "in_progress", pickedBy: "auto", pickedAt: "2026-10-23T10:00:30.000Z", createdAt, updatedAt: "2026-10-23T10:00:30.000Z" });
    expect(dueWaybillStuckHandoffs([stuck], {}, at("2026-10-23T10:20:00.000Z"))).toEqual([]);
    const [handoff] = dueWaybillStuckHandoffs([stuck], {}, at("2026-10-23T10:35:00.000Z"));
    expect(handoff).toEqual({ key: "handoff:wbr_a:2026-10-23T10:00:30.000Z", requestId: "wbr_a" });
    expect(dueWaybillStuckHandoffs([stuck], { [handoff.key]: "x" }, at("2026-10-23T10:35:00.000Z"))).toEqual([]);
  });
});

describe("j47: nodots Aivaram - cron pamodina vēlreiz", () => {
  it("automātikas nodots darbs (handoffAt) saņem jaunu pamodināšanas atslēgu, pat ja šis mēģinājums jau bija modināts", () => {
    const base = req({ status: "queued", waybillNo: "", validUntil: "2026-10-26T10:00:00.000Z", createdAt: "2026-10-24T10:00:00.000Z", updatedAt: "2026-10-24T10:20:00.000Z" });
    const nowMs = at("2026-10-24T10:30:00.000Z");
    expect(dueWaybillStuckHandoffs([base], {}, nowMs)).toEqual([{ key: "handoff:wbr_a:1", requestId: "wbr_a" }]);
    const handed = { ...base, autoDisabled: true, handoffAt: "2026-10-24T10:20:00.000Z" };
    expect(dueWaybillStuckHandoffs([handed], { "handoff:wbr_a:1": "x" }, nowMs)).toEqual([
      { key: "handoff:wbr_a:1:2026-10-24T10:20:00.000Z", requestId: "wbr_a" },
    ]);
  });
});
