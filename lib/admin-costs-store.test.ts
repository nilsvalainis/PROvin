import { describe, expect, it } from "vitest";
import { parseCostEvent, parseCostLimit, parseCostMetaDoc, parseCostSnapshot } from "@/lib/admin-costs-store";

describe("admin cost store parse", () => {
  it("accepts event, limit and snapshot rows", () => {
    expect(
      parseCostEvent({
        id: "evt_1",
        source: "autodna",
        sku: "",
        units: 1,
        usd: 8.5,
        ref: "VIN1",
        createdAt: "2026-10-02T12:00:00.000Z",
      }),
    ).toMatchObject({ source: "autodna", usd: 8.5, units: 1, ref: "VIN1" });
    expect(parseCostEvent({ source: "nope", createdAt: "2026-10-02T12:00:00.000Z" })).toBeNull();
    expect(
      parseCostLimit({
        source: "apify",
        period: "month",
        limit_usd: 4.5,
        hard: true,
        source_of_limit: "account",
        read_at: "2026-10-20T06:00:00.000Z",
      }),
    ).toMatchObject({ source: "apify", limitUsd: 4.5, hard: true, sourceOfLimit: "account" });
    expect(
      parseCostSnapshot({
        source: "vercel",
        period: "2026-10",
        usd: 20,
        units: 0,
        fetched_at: "2026-10-20T06:00:00.000Z",
        origin: "api",
      }),
    ).toMatchObject({ source: "vercel", usd: 20, origin: "api" });
    expect(parseCostMetaDoc({ version: 1, limits: [{}], snapshots: [{}] })).toEqual({ version: 1, limits: [], snapshots: [] });
  });
});
