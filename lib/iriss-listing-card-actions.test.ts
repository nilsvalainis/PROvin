import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { IrissListingCardActions } from "@/components/admin/IrissListingCardActions";
import {
  IRISS_LISTING_CARD_ACTION_BTN_CLASS,
  IRISS_LISTING_CARD_ACTION_OFFER,
  IRISS_LISTING_CARD_ACTION_ORDER,
  IRISS_LISTING_CARD_ACTION_ORDER_MENU,
  IRISS_LISTING_CARD_ACTION_RADAR,
  IRISS_LISTING_CARD_ACTIONS_ROW_CLASS,
} from "@/lib/iriss-listing-card-actions";
import type { IrissListingVehicle } from "@/lib/iriss-listings-types";

const v = { id: "car-1", title: "Volvo XC60" } as IrissListingVehicle;
const card = readFileSync("components/admin/IrissListingVehicleCard.tsx", "utf8");
const actions = readFileSync("components/admin/IrissListingCardActions.tsx", "utf8");
const chips = readFileSync("components/admin/IrissListingOrderChips.tsx", "utf8");
const editor = readFileSync("components/admin/IrissScanEditor.tsx", "utf8");
const listClient = readFileSync("components/admin/IrissSludinajumiListClient.tsx", "utf8");

describe("listing card actions", () => {
  it("keeps Pasūtījuma detaļas and Nosūtīt klientam on one equal-height row", () => {
    const html = renderToStaticMarkup(
      createElement(IrissListingCardActions, {
        v,
        onPreviewDetails: () => undefined,
        onCreateRadar: () => undefined,
        onCreateOffer: () => undefined,
      }),
    );
    expect(html).toContain(IRISS_LISTING_CARD_ACTION_ORDER);
    expect(html).toContain(IRISS_LISTING_CARD_ACTION_OFFER);
    expect(html).not.toContain(IRISS_LISTING_CARD_ACTION_RADAR);
    expect(html).not.toContain("Pievienot radaram");
    expect(html).not.toContain(IRISS_LISTING_CARD_ACTION_ORDER_MENU);
    expect(html).toContain("data-iriss-listing-card-actions");
    expect(html).toContain("Vairāk darbību");
    expect(IRISS_LISTING_CARD_ACTIONS_ROW_CLASS).toContain("flex-nowrap");
    expect(IRISS_LISTING_CARD_ACTION_BTN_CLASS).toContain("h-11");
    expect(IRISS_LISTING_CARD_ACTION_BTN_CLASS).toContain("min-h-11");
    expect(IRISS_LISTING_CARD_ACTION_BTN_CLASS).toContain("flex-1");
    expect(html.match(/h-11 min-h-11 min-w-0 flex-1/g)?.length).toBe(2);
  });

  it("opens order details from the card button, send-to-client uses Mail, radar stays in the overflow menu", () => {
    expect(IRISS_LISTING_CARD_ACTION_ORDER).toBe("Pasūtījuma detaļas");
    expect(IRISS_LISTING_CARD_ACTION_OFFER).toBe("Nosūtīt klientam");
    expect(IRISS_LISTING_CARD_ACTION_ORDER_MENU).toBe("Izveidot radaru");
    expect(actions).toContain("IRISS_LISTING_CARD_ACTION_ORDER_MENU");
    expect(actions).toContain("ClipboardList");
    expect(actions).toContain("Mail");
    expect(actions).toContain("Plus");
    expect(actions).not.toMatch(/import \{[^}]*Radar[^}]*\} from "lucide-react"/);
    expect(actions).not.toContain("Tag");
    expect(actions).not.toMatch(/text-(red|blue|emerald|amber|orange|green|sky)-/);
    expect(card).toContain("IrissListingCardActions");
    expect(card).toContain("onPreviewDetails");
    expect(card).not.toMatch(/Izveidot pasūtījumu/);
    expect(card).not.toContain("onCreateOrder");
    expect(chips).toContain("IRISS_LISTING_CARD_ACTION_ORDER");
    expect(listClient).toContain("irissScanSeedFromListing");
    expect(listClient).toContain("/api/admin/iriss-scan");
    expect(listClient).toContain("onCreateRadar");
    expect(listClient).not.toContain("onCreateRadar={async (vehicle) => {\n              void fetch(\"/api/admin/marketplace");
  });
});

describe("Radars Izveidot", () => {
  it("adds the filter button next to each source group", () => {
    expect(editor).toContain("Izveidot");
    expect(editor).toContain("applyGeneratedScanSourceFilter");
    expect(editor).toContain("irissScanFilterTableRows");
    expect(editor.match(/>[\s]*Izveidot[\s]*</g)?.length).toBeGreaterThanOrEqual(1);
  });
});
