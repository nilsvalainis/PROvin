import { beforeEach, describe, expect, it, vi } from "vitest";

const actor = { kind: "admin" as string };
vi.mock("@/lib/staff-auth", () => ({
  requireIrissSectionApi: vi.fn(async () => ({ ok: true, actor })),
}));
vi.mock("@/lib/iriss-auction-link-read", () => ({ findIrissOrderRoomHitForAuctionLink: vi.fn(async () => null) }));
vi.mock("@/lib/iriss-auction-detail-relay", () => ({
  fetchIrissAuctionDetailViaRelay: vi.fn(async () => ({
    ok: true,
    detail: {
      platform: "auto1",
      key: "JD14299",
      url: "https://www.auto1.com/en/app/merchant/car/JD14299",
      title: "Test",
      fields: [["140 μm", "Front body"]],
      tables: [],
      lists: [],
      photos: [],
      paint: [
        ["front", "140 μm"],
        ["left", "110 μm"],
        ["left", "110 μm"],
        ["right", "250 μm"],
      ],
      text: "",
      jsonFields: [],
      item: null,
    },
  })),
}));

import { POST } from "@/app/api/admin/iriss-offer-seed/from-link/route";

const post = (mode: string) =>
  POST(
    new Request("https://www.provin.lv/api/admin/iriss-offer-seed/from-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://www.auto1.com/en/app/merchant/car/JD14299", mode }),
    }),
  );

describe("No saites diag: Auto1 krāsas mērījumi", () => {
  beforeEach(() => {
    actor.kind = "admin";
  });

  it("admin diag returns every paint chip the relay read, duplicates included", async () => {
    const res = await post("diag");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.paintCount).toBe(4);
    expect(body.paint).toEqual([
      ["front", "140 μm"],
      ["left", "110 μm"],
      ["left", "110 μm"],
      ["right", "250 μm"],
    ]);
  });

  it("a non-admin never gets diag (falls back to the listing answer)", async () => {
    actor.kind = "staff";
    const res = await post("diag");
    const body = await res.json();
    expect(body.paint).toBeUndefined();
    expect(body.error).toBe("not_in_listings");
  });
});
