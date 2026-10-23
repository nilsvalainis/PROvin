import { describe, expect, it, vi } from "vitest";
import {
  applyTtrServerReport,
  emptyTtrControlDoc,
  parseTtrControlDoc,
  parseTtrServerReport,
  requestTtrVpnStop,
  ttrVpnStatus,
  ttrVpnStatusLabel,
  applyTtrWorkerHeartbeat,
  waybillWorkerLive,
  workerHeartbeatNeedsWrite,
} from "@/lib/iriss-ttr-control";
import {
  canStartVpn,
  decideVpnAction,
  extendLease,
  externalDropReason,
  releaseLease,
  vpnHoldMode,
  vpnIdleMinutes,
} from "@/scripts/iriss-ttr/vpn-lease.mjs";
import { csddSyncMinutes, periodicPlateSync, vpnBusyForHuman } from "@/scripts/iriss-ttr/waybill-worker-core.mjs";

const NOW = Date.parse("2026-10-22T18:00:00.000Z");

describe("admin VPN stop request", () => {
  it("is pending until the server reports it handled", () => {
    let doc = requestTtrVpnStop(emptyTtrControlDoc(), "u1", new Date(NOW));
    expect(ttrVpnStatus(doc, NOW).stopPending).toBe(true);
    expect(ttrVpnStatusLabel(ttrVpnStatus(doc, NOW))).toBe("Serveris atslēdz VPN...");

    const report = parseTtrServerReport({
      vpn: "down",
      handledStopAt: doc.stopRequestedAt,
      lastStopReason: "manual",
    })!;
    doc = applyTtrServerReport(doc, report, new Date(NOW + 10_000));
    const status = ttrVpnStatus(doc, NOW + 11_000);
    expect(status.stopPending).toBe(false);
    expect(status.vpn).toBe("down");
    expect(ttrVpnStatusLabel(status)).toBe("VPN brīvs");
  });

  it("treats an old server report as unknown", () => {
    const doc = applyTtrServerReport(emptyTtrControlDoc(), parseTtrServerReport({ vpn: "up" })!, new Date(NOW));
    expect(ttrVpnStatus(doc, NOW + 60_000).vpn).toBe("up");
    expect(ttrVpnStatus(doc, NOW + 11 * 60_000).vpn).toBe("unknown");
  });

  it("drops junk from stored docs and reports", () => {
    expect(parseTtrServerReport("x")).toBeNull();
    const doc = parseTtrControlDoc({ stopRequestedAt: "nav datums", server: { vpn: "maybe", lastStopReason: "rm -rf" } });
    expect(doc.stopRequestedAt).toBe("");
    expect(doc.server.vpn).toBe("unknown");
    expect(doc.server.lastStopReason).toBe("");
  });
});

describe("server VPN lease (vpn-lease.mjs)", () => {
  it("clamps idle minutes to 15-30, default 20", () => {
    expect(vpnIdleMinutes(undefined)).toBe(20);
    expect(vpnIdleMinutes("5")).toBe(15);
    expect(vpnIdleMinutes("25")).toBe(25);
    expect(vpnIdleMinutes("90")).toBe(30);
  });

  it("a new job extends the lease but never shortens it", () => {
    expect(extendLease(NaN, NOW, 20)).toBe(NOW + 20 * 60_000);
    const far = NOW + 29 * 60_000;
    expect(extendLease(far, NOW, 20)).toBe(far);
    expect(extendLease(NOW + 60_000, NOW, 20)).toBe(NOW + 20 * 60_000);
  });

  it("stops at once on a new admin request, even inside the lease", () => {
    const d = decideVpnAction({
      vpnUp: true,
      leaseUntilMs: NOW + 10 * 60_000,
      nowMs: NOW,
      stopRequestedAt: "2026-10-22T17:59:58.000Z",
      handledStopAt: "",
    });
    expect(d).toEqual({ action: "stop", reason: "manual", handledStopAt: "2026-10-22T17:59:58.000Z" });
  });

  it("does not repeat an already handled request", () => {
    const d = decideVpnAction({
      vpnUp: true,
      leaseUntilMs: NOW + 60_000,
      nowMs: NOW,
      stopRequestedAt: "2026-10-22T17:00:00.000Z",
      handledStopAt: "2026-10-22T17:00:00.000Z",
    });
    expect(d.action).toBe("none");
  });

  it("idle-stops after the lease ends and leaves a down VPN alone", () => {
    expect(decideVpnAction({ vpnUp: true, leaseUntilMs: NOW - 1, nowMs: NOW, stopRequestedAt: "", handledStopAt: "" }).reason).toBe(
      "idle",
    );
    expect(decideVpnAction({ vpnUp: false, leaseUntilMs: NaN, nowMs: NOW, stopRequestedAt: "", handledStopAt: "" }).action).toBe(
      "none",
    );
  });

  it("does not reconnect for 30 min after Nils took the VPN", () => {
    expect(canStartVpn({ nowMs: NOW, lastManualStopMs: NaN })).toBe(true);
    expect(canStartVpn({ nowMs: NOW, lastManualStopMs: NOW - 5 * 60_000 })).toBe(false);
    expect(canStartVpn({ nowMs: NOW, lastManualStopMs: NOW - 31 * 60_000 })).toBe(true);
  });
});

describe("VPN release after each job", () => {
  it("shortens the lease to about a minute, never extends it, and keeps no lease as none", () => {
    expect(releaseLease(NOW + 20 * 60_000, NOW)).toBe(NOW + 60_000);
    expect(releaseLease(NOW + 10_000, NOW)).toBe(NOW + 10_000);
    expect(Number.isNaN(releaseLease(NaN, NOW))).toBe(true);
    // Pēc tam tick to atslēdz kā "idle".
    expect(decideVpnAction({ vpnUp: true, leaseUntilMs: releaseLease(NOW + 20 * 60_000, NOW), nowMs: NOW + 61_000, stopRequestedAt: "", handledStopAt: "" }).reason).toBe("idle");
  });
});

describe("waybill worker heartbeat (live vs dry-run)", () => {
  it("is live only with a fresh live heartbeat; dry-run or silence means test mode", () => {
    const empty = emptyTtrControlDoc();
    expect(waybillWorkerLive(empty, NOW)).toBe(false);
    const live = applyTtrWorkerHeartbeat(empty, true, new Date(NOW));
    expect(waybillWorkerLive(live, NOW + 60_000)).toBe(true);
    expect(waybillWorkerLive(live, NOW + 11 * 60_000)).toBe(false);
    expect(waybillWorkerLive(applyTtrWorkerHeartbeat(empty, false, new Date(NOW)), NOW)).toBe(false);
    // Parsē saglabāto dokumentu.
    expect(parseTtrControlDoc(JSON.parse(JSON.stringify(live))).worker).toEqual({ live: true, seenAt: new Date(NOW).toISOString() });
  });

  it("writes the document only when the mode changes or every 5 min", () => {
    const live = applyTtrWorkerHeartbeat(emptyTtrControlDoc(), true, new Date(NOW));
    expect(workerHeartbeatNeedsWrite(live, true, NOW + 10_000)).toBe(false);
    expect(workerHeartbeatNeedsWrite(live, false, NOW + 10_000)).toBe(true);
    expect(workerHeartbeatNeedsWrite(live, true, NOW + 5 * 60_000)).toBe(true);
  });
});

describe("j10: VPN tur pastāvīgi (hold), atlaiž tikai Nils; izmests - nepieslēdzas pats", () => {
  it("hold ir noklusējums; IRISS_VPN_HOLD=0 atgriež veco idle režīmu", () => {
    expect(vpnHoldMode(undefined)).toBe(true);
    expect(vpnHoldMode("1")).toBe(true);
    for (const v of ["0", "false", "no"]) expect(vpnHoldMode(v)).toBe(false);
  });

  it("hold: nav idle atslēgšanas, bet 'Man vajag VPN' atslēdz uzreiz", () => {
    const idle = { vpnUp: true, leaseUntilMs: NOW - 60 * 60_000, nowMs: NOW, stopRequestedAt: "", handledStopAt: "" };
    expect(decideVpnAction({ ...idle, hold: true }).action).toBe("none");
    expect(decideVpnAction({ ...idle, hold: false })).toMatchObject({ action: "stop", reason: "idle" });
    expect(decideVpnAction({ ...idle, hold: true, stopRequestedAt: new Date(NOW - 1000).toISOString() })).toMatchObject({
      action: "stop",
      reason: "manual",
    });
  });

  it("hold: darba beigas (/release) VPN neatlaiž", () => {
    expect(releaseLease(NOW + 20 * 60_000, NOW, true)).toBe(NOW + 20 * 60_000);
    expect(releaseLease(NOW + 20 * 60_000, NOW, false)).toBe(NOW + 60_000);
  });

  it("pēc izmešanas/atslēgšanas: pavadzīmes pieprasījums pieslēdz uzreiz, citi (nakts reģistrs) gaida 30 min", () => {
    const dropped = { nowMs: NOW, lastManualStopMs: NOW - 2 * 60_000 };
    expect(canStartVpn({ ...dropped, purpose: "waybill", hold: true })).toBe(true);
    expect(canStartVpn({ ...dropped, hold: true })).toBe(false);
    expect(canStartVpn({ ...dropped, purpose: "waybill", hold: false })).toBe(false);
  });

  it("ārēja apstāšanās: systemd success = apturēts ar roku, cits = izmests", () => {
    expect(externalDropReason("success")).toBe("external");
    expect(externalDropReason("exit-code")).toBe("kicked");
    expect(externalDropReason("")).toBe("kicked");
    expect(parseTtrServerReport({ vpn: "down", lastStopReason: "kicked" })?.lastStopReason).toBe("kicked");
  });

  it("worker: hold režīmā (blockedForWaybill=false) darbu ņem arī pēc izmešanas; vecais statuss - kā līdz šim", () => {
    expect(vpnBusyForHuman({ vpn: "down", blocked: true, blockedForWaybill: false })).toBe(false);
    expect(vpnBusyForHuman({ vpn: "down", blocked: true })).toBe(true);
    expect(vpnBusyForHuman({ vpn: "up", blocked: false, blockedForWaybill: true })).toBe(true);
    expect(vpnBusyForHuman(null)).toBe(true);
  });

  it("periodiskā sinhronizācija: tikai, ja VPN jau ieslēgts (pati neieslēdz); abas firmas -> viens momentuzņēmums", async () => {
    const mk = (vpn: string) => ({
      vpnStatus: vi.fn(async () => ({ vpn })),
      runScript: vi.fn(async (_step: string, input: { plates: string[] }) => ({
        ok: true,
        platesChecked: input.plates,
        plates: Object.fromEntries(input.plates.map((p) => [p, p === "B193-7" ? [{ waybillNo: "P02812", validUntil: "", brandModel: "" }] : []])),
      })),
      api: { plates: vi.fn(async () => {}) },
      now: () => NOW,
      log: vi.fn(),
    });
    const down = mk("down");
    expect(await periodicPlateSync(down)).toEqual({ outcome: "vpn_down" });
    expect(down.runScript).not.toHaveBeenCalled();
    expect(down.api.plates).not.toHaveBeenCalled();
    const up = mk("up");
    const res = await periodicPlateSync(up, { ctx1: ["P02811"] });
    expect(res.outcome).toBe("synced");
    expect(up.runScript.mock.calls.map((c) => c[0])).toEqual(["sync", "sync"]);
    expect(up.runScript.mock.calls[0][1]).toMatchObject({ ctx: 1, plates: ["B193-7", "B762-7"], known: ["P02811"] });
    expect(up.runScript.mock.calls[1][1]).toMatchObject({ ctx: 2, plates: ["B192-7"], known: [] });
    const snap = (up.api.plates.mock.calls[0] as unknown[])[0] as { plates: { plate: string; active: unknown[] }[] };
    expect(snap.plates.map((p) => p.plate)).toEqual(["B193-7", "B762-7", "B192-7"]);
    expect(snap.plates[0].active).toHaveLength(1);
  });

  it("sinhronizācijas biežums: 2-15 min (nokl. 5), 0 = izslēgts", () => {
    expect(csddSyncMinutes(undefined)).toBe(5);
    expect(csddSyncMinutes("1")).toBe(2);
    expect(csddSyncMinutes("3")).toBe(3);
    expect(csddSyncMinutes("60")).toBe(15);
    expect(csddSyncMinutes("0")).toBe(0);
  });
});
