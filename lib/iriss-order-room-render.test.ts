import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Barlow: () => ({ className: "font-barlow", style: { fontFamily: "Barlow" } }),
}));
import { IrissOrderMatchBoundary, IrissOrderMatchFallback } from "@/components/admin/IrissOrderMatchBoundary";
import { IrissOrderRoom } from "@/components/admin/IrissOrderRoom";
import { orderRoomMatchProps } from "@/lib/iriss-listing-match-store";
import { normalizeIrissListingMatchState } from "@/lib/iriss-listing-match";
import {
  coerceIrissDuplicatesByListing,
  coerceIrissHitStatusMap,
  irissHitStatusIsUnset,
  irissHitStatusOf,
} from "@/lib/iriss-order-room-match-props";
import type { IrissOrderRoomHit } from "@/lib/iriss-order-room";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { duplicateMapForListings, type IrissVinAnchor } from "@/lib/iriss-vin-duplicates";

const fixtures = JSON.parse(readFileSync(path.join(process.cwd(), "lib/iriss-order-room-render.fixtures.json"), "utf8")) as {
  listingMatches: Record<string, unknown>;
  vinAnchors: Record<string, unknown>;
};

const VIN = "WBA12345678901234";

function hit(partial: Partial<IrissOrderRoomHit> & Pick<IrissOrderRoomHit, "id">): IrissOrderRoomHit {
  return {
    platform: "auto1",
    externalId: partial.id,
    detailUrl: "",
    orderIds: ["order-1"],
    title: "Audi A6",
    year: "2014",
    firstRegistration: "2014-05",
    mileageKm: 180000,
    fuel: "diesel",
    transmission: "automatic",
    powerKw: "230",
    color: "melna",
    bodyType: "avant",
    imageUrl: "",
    imageUrls: [],
    imageCount: 0,
    vin: VIN,
    price: 14900,
    priceStart: null,
    priceMinimal: null,
    priceCurrent: null,
    priceBuyNow: null,
    priceEstimate: null,
    priceTotal: null,
    stockNumber: "",
    auctionId: "",
    auctionStage: "",
    auctionStartAt: "",
    auctionEndAt: "",
    countryCode: "",
    vatNote: "",
    change: "unchanged",
    firstSeenAt: "",
    location: "",
    ...partial,
  };
}

/** Tā pati izvēle kā `parseAnchors` failā `_vin-anchors.json`. Vecs masīvs un tukšs href paliek ārā. */
function anchorsFromFile(raw: unknown): IrissVinAnchor[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const anchors = (raw as { anchors?: unknown }).anchors;
  if (!Array.isArray(anchors)) return [];
  const out: IrissVinAnchor[] = [];
  for (const item of anchors) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const vin = typeof row.vin === "string" ? row.vin.trim() : "";
    const orderId = typeof row.orderId === "string" ? row.orderId.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const href = typeof row.href === "string" ? row.href.trim() : "";
    const kind = row.kind === "offer" || row.kind === "order" ? row.kind : null;
    if (!vin || !orderId || !label || !kind) continue;
    const offerId = typeof row.offerId === "string" ? row.offerId.trim() : "";
    out.push({ vin, kind, orderId, label, href, ...(offerId ? { offerId } : {}) });
  }
  return out;
}

function room(extra: Record<string, unknown> = {}) {
  const rec = {
    ...emptyIrissPasutijums("order-1", "2026-10-15T11:31:00.000Z"),
    brandModel: "Audi A6",
    phone: "+37120000000",
    transmission: "automatic",
  };
  return createElement(IrissOrderRoom, {
    rec,
    hits: [hit({ id: "listing-1" })],
    dismissedHitIds: [],
    listingsCache: "on",
    busy: false,
    orderPdfBusy: false,
    saveMsg: null,
    orderPdfRetryOpen: false,
    phoneWarning: null,
    vinWarning: null,
    canCall: true,
    canEmail: true,
    conflict: null,
    deleted: false,
    onPatch: () => {},
    onPatchRecord: () => {},
    onInactiveReason: () => {},
    onSetStatus: () => {},
    onSave: async () => ({ ok: true as const }),
    onSaveCriteria: async () => ({ ok: true as const }),
    onPdf: () => {},
    onRetryPdf: () => {},
    onDismissPdfRetry: () => {},
    onCall: () => {},
    onWhatsappText: () => {},
    onAppendNote: () => {},
    onCreateOffer: () => {},
    onEditOffer: () => {},
    onPrepareOffer: () => {},
    onOpenOfferPdf: () => {},
    onRestore: () => {},
    onDeleteOrder: () => {},
    initialTab: "search",
    ...extra,
  } as never);
}

async function renderHtml(node: ReactNode): Promise<{ html: string; errors: unknown[] }> {
  const errors: unknown[] = [];
  const stream = await renderToReadableStream(node, {
    onError(error) {
      errors.push(error);
    },
  });
  await stream.allReady;
  return { html: await new Response(stream).text(), errors };
}

function assertOrderStaysOpen(html: string) {
  expect(html).toContain('data-iriss-order-room="1"');
  expect(html).toContain("Zvanīt");
  expect(html).toContain("WhatsApp");
  expect(html).toContain("Sagatavot piedāvājumu");
}

describe("iriss match props", () => {
  it("does not use `in` on a null status map", () => {
    const hitStatus = null;
    expect(() => {
      "listing-1" in (hitStatus as unknown as object);
    }).toThrow(TypeError);
    expect(irissHitStatusIsUnset(null, "listing-1")).toBe(true);
    expect(irissHitStatusIsUnset(undefined, "listing-1")).toBe(true);
    expect(irissHitStatusOf(null, "listing-1")).toBe("skatits");
    expect(coerceIrissHitStatusMap(null)).toEqual({});
    expect(coerceIrissDuplicatesByListing(null)).toEqual({});
    expect(coerceIrissDuplicatesByListing(undefined)).toEqual({});
  });

  it("drops empty duplicate keys and hrefs", () => {
    const links = coerceIrissDuplicatesByListing({
      "listing-1": [
        { key: "", href: "", label: "tukšs", kind: "listing" },
        null,
        { key: "", href: "/admin/iriss/pasutijumi/order-9", label: "Cits", kind: "order", orderId: "order-9" },
      ],
    });
    expect(links["listing-1"]).toEqual([
      {
        key: "/admin/iriss/pasutijumi/order-9",
        kind: "order",
        label: "Cits",
        href: "/admin/iriss/pasutijumi/order-9",
        orderId: "order-9",
      },
    ]);
  });
});

describe("IrissOrderRoom render", () => {
  it("opens the search tab when match props are null", async () => {
    const { html, errors } = await renderHtml(
      room({
        initialHitStatus: null,
        duplicatesByListing: null,
        initialTab: "search",
      }),
    );
    expect(errors).toEqual([]);
    assertOrderStaysOpen(html);
  });

  it("keeps a valid duplicate and drops an empty href", async () => {
    const { html, errors } = await renderHtml(
      room({
        duplicatesByListing: {
          "listing-1": [
            { key: "", href: "", label: "tukšs", kind: "listing" },
            { key: "", href: "/admin/iriss/pasutijumi/order-9", label: "Cits", kind: "order" },
          ],
        },
      }),
    );
    expect(errors).toEqual([]);
    assertOrderStaysOpen(html);
    expect(html).toContain("dublikāts");
    expect(html).toContain("Cits");
    expect(html).toContain('href="/admin/iriss/pasutijumi/order-9"');
    expect(html).not.toContain('href=""');
    expect(html).not.toContain("tukšs");
  });

  it.each(["valid", "empty", "partial", "old"] as const)("renders listing-matches and vin-anchors shape %s", async (name) => {
    const state = normalizeIrissListingMatchState(fixtures.listingMatches[name]);
    const anchors = anchorsFromFile(fixtures.vinAnchors[name]);
    const duplicatesByListing = duplicateMapForListings(
      [{ id: "listing-1", vin: VIN, title: "Audi A6", platform: "auto1" }],
      anchors,
      "order-1",
    );
    const props = orderRoomMatchProps(state, "order-1", duplicatesByListing);
    if (name === "valid") {
      expect(props.hitStatus["listing-1"]).toBe("jauns");
      expect(props.duplicates["listing-1"]?.some((link) => link.label === "Cits klients: Audi A6")).toBe(true);
    } else {
      expect(props.hitStatus).toEqual({});
      expect(props.duplicates).toEqual({});
    }
    const { html, errors } = await renderHtml(
      room({
        initialHitStatus: props.hitStatus,
        duplicatesByListing: props.duplicates,
        initialTab: "search",
      }),
    );
    expect(errors).toEqual([]);
    assertOrderStaysOpen(html);
    if (name === "valid") {
      expect(html).toContain("Cits klients: Audi A6");
      expect(html).toContain("dublikāts");
      expect(html).toContain("bg-sky-50");
    } else {
      expect(html).not.toContain("Cits klients");
      expect(html).not.toContain("bg-sky-50");
    }
  });

  it("treats raw empty, partial and old JSON as empty maps", async () => {
    for (const name of ["empty", "partial", "old"] as const) {
      const { html, errors } = await renderHtml(
        room({
          initialHitStatus: fixtures.listingMatches[name],
          duplicatesByListing: fixtures.vinAnchors[name],
          hits: null,
          initialTab: "search",
        }),
      );
      expect(errors).toEqual([]);
      expect(html).toContain('data-iriss-order-room="1"');
      expect(html).toContain("Zvanīt");
      expect(html).toContain("WhatsApp");
      expect(html).toContain("Šajā statusā nav sludinājumu.");
    }
  });

  it("shows the match fallback when a hit field is not a string", async () => {
    const { html, errors } = await renderHtml(
      room({
        hits: [hit({ id: "listing-1", transmission: 12 as unknown as string })],
        initialHitStatus: { "listing-1": "jauns" },
        initialTab: "search",
      }),
    );
    expect(errors).toEqual([]);
    assertOrderStaysOpen(html);
    expect(html).toContain("Atbilstības dati nav pieejami.");
  });

  it("switches the match boundary to the safe fallback", async () => {
    expect(IrissOrderMatchBoundary.getDerivedStateFromError(new TypeError("in"))).toEqual({ failed: true });
    const failed = IrissOrderMatchBoundary.prototype.render.call({
      state: { failed: true },
      props: { children: createElement("span", null, "secret-match") },
    });
    const open = IrissOrderMatchBoundary.prototype.render.call({
      state: { failed: false },
      props: { children: createElement("span", null, "match-ok") },
    });
    const failedHtml = await renderHtml(
      createElement(
        "div",
        null,
        createElement("button", { type: "button" }, "Zvanīt"),
        createElement("button", { type: "button" }, "WhatsApp"),
        failed,
        createElement("button", { type: "button" }, "Sagatavot piedāvājumu"),
      ),
    );
    expect(failedHtml.errors).toEqual([]);
    expect(failedHtml.html).toContain("Atbilstības dati nav pieejami.");
    expect(failedHtml.html).not.toContain("secret-match");
    expect(failedHtml.html).toContain("Zvanīt");
    expect(failedHtml.html).toContain("WhatsApp");
    expect(failedHtml.html).toContain("Sagatavot piedāvājumu");
    const openHtml = await renderHtml(open);
    expect(openHtml.html).toContain("match-ok");
    const fallback = await renderHtml(createElement(IrissOrderMatchFallback));
    expect(fallback.html).toContain("Atbilstības dati nav pieejami.");
  });
});
