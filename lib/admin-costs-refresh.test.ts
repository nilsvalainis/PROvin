import { describe, expect, it } from "vitest";
import {
  authorizeCostSnapshotCron,
  COST_SNAPSHOT_CRON_UTC_SCHEDULE,
  isCostSnapshotRefreshSlot,
} from "@/lib/admin-costs-refresh";

describe("admin cost snapshot cron", () => {
  it("runs at 06:00 Europe/Riga in both DST offsets", () => {
    expect(COST_SNAPSHOT_CRON_UTC_SCHEDULE).toBe("0 3,4 * * *");
    expect(isCostSnapshotRefreshSlot(Date.parse("2026-10-20T03:00:00.000Z"))).toBe(true);
    expect(isCostSnapshotRefreshSlot(Date.parse("2026-10-20T04:00:00.000Z"))).toBe(false);
    expect(isCostSnapshotRefreshSlot(Date.parse("2026-01-15T04:00:00.000Z"))).toBe(true);
    expect(isCostSnapshotRefreshSlot(Date.parse("2026-01-15T03:00:00.000Z"))).toBe(false);
  });

  it("protects the cron with CRON_SECRET Bearer", () => {
    expect(authorizeCostSnapshotCron("Bearer secret", undefined)).toEqual({
      ok: false,
      status: 503,
      error: "missing_cron_secret",
    });
    expect(authorizeCostSnapshotCron(null, "secret")).toEqual({
      ok: false,
      status: 401,
      error: "missing_authorization",
    });
    expect(authorizeCostSnapshotCron("Bearer nope", "secret")).toEqual({
      ok: false,
      status: 403,
      error: "forbidden",
    });
    expect(authorizeCostSnapshotCron("Bearer secret", "secret")).toEqual({ ok: true });
  });
});
