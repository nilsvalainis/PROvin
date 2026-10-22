import { describe, expect, it } from "vitest";
import {
  applyTtrServerReport,
  emptyTtrControlDoc,
  parseTtrControlDoc,
  parseTtrServerReport,
  requestTtrVpnStop,
  ttrVpnStatus,
  ttrVpnStatusLabel,
} from "@/lib/iriss-ttr-control";
import {
  canStartVpn,
  decideVpnAction,
  extendLease,
  vpnIdleMinutes,
} from "@/scripts/iriss-ttr/vpn-lease.mjs";

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
