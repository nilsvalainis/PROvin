import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shouldExcludeIrissListing } from "@/lib/iriss-listings-exclude-rules";
import {
  decodeEcarstradeCardHtml,
  ecarstradeApiUrl,
  ecarstradeDetailUrl,
  ecarstradePageStart,
  parseEcarstradeApiPage,
  parseEcarstradeCard,
  readEcarstradeAuth,
  splitConcatenatedJsonObjects,
} from "@/lib/iriss-listings-ecarstrade";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__", "iriss-ecarstrade");

function card(name: string): string {
  return readFileSync(join(FIX, name), "utf8");
}

function apiBody(cards: Array<{ id: string; html: string; maxBid?: string | null; close?: string }>): string {
  const parts = ["{}"];
  for (const c of cards) {
    parts.push(
      JSON.stringify({
        status: "101",
        car_id: c.id,
        data: { id: c.id, max_bid: c.maxBid ?? null, close_date: c.close ?? "14 Oct 2026 09:10" },
        result: Buffer.from(c.html, "utf8").toString("base64"),
      }),
    );
  }
  return parts.join("");
}

describe("eCarsTrade parser", () => {
  it("reads title, kW, km, country, VAT and bid from a public card", () => {
    const v = parseEcarstradeCard(card("card-volvo.html"), {
      id: "7672194",
      max_bid: "25500",
      close_date: "14 Oct 2026 09:10",
    });
    expect(v).toMatchObject({
      externalId: "7672194",
      manufacturer: "Volvo",
      countryCode: "BE",
      powerKw: "200",
      mileageKm: 8388,
      fuel: "Electric",
      transmission: "Automatic",
      year: "2025",
      firstRegistration: "12/2025",
      priceCurrent: 25500,
      taxDeduction: true,
      vatNote: "VAT deductible",
      auctionId: "120004",
      auctionStage: "BLIND_AUCTION",
    });
    expect(v?.title).toMatch(/VOLVO EX30/i);
    expect(v?.detailUrl).toBe("https://ecarstrade.com/cars/7672194");
    expect(v?.imageUrl).toContain("7672194");
    expect(v?.location).toMatch(/Belgium/i);
    expect(v?.auctionEndAt).toBe("2026-10-14T07:10:00.000Z");
  });

  it("keeps a Volvo 110 kW card for the exclude-rules layer and drops France in the API page", () => {
    const volvo110 = parseEcarstradeCard(card("card-volvo-110.html"), { id: "1100001", max_bid: "4000" });
    expect(volvo110?.countryCode).toBe("DE");
    expect(volvo110?.powerKw).toBe("110");
    expect(shouldExcludeIrissListing({ manufacturer: volvo110?.manufacturer, title: volvo110?.title, powerKw: volvo110?.powerKw })).toBe(
      true,
    );
    const page = parseEcarstradeApiPage(
      apiBody([
        { id: "7672194", html: card("card-volvo.html"), maxBid: "25500" },
        { id: "8800001", html: card("card-france.html"), maxBid: "9000" },
      ]),
    );
    expect(page?.vehicles.map((v) => v.externalId)).toEqual(["7672194"]);
  });

  it("splits concatenated JSON and decodes base64 cards", () => {
    const raw = apiBody([{ id: "1", html: "<div>ok</div>" }]);
    const objs = splitConcatenatedJsonObjects(raw);
    expect(objs).toHaveLength(1);
    expect(decodeEcarstradeCardHtml(objs[0]!.result)).toBe("<div>ok</div>");
  });

  it("forces BE/NL/LU/DE on the API URL and keeps mark/model from the search link", () => {
    const url = ecarstradeApiUrl("https://ecarstrade.com/search?mark[]=68&country[]=FRA&country[]=ESP&sort=price", 20, 20);
    const u = new URL(url);
    expect(u.pathname).toBe("/future_api.php");
    expect(u.searchParams.get("request_type")).toBe("cars");
    expect(u.searchParams.get("start")).toBe("20");
    expect(u.searchParams.get("mark[]")).toBe("68");
    expect(u.searchParams.getAll("country[]")).toEqual(["BEL", "NET", "LUX", "GER"]);
    expect(u.searchParams.get("sort")).toBe("price.asc");
    expect(ecarstradePageStart(1)).toBe(0);
    expect(ecarstradePageStart(2, 20)).toBe(20);
    expect(ecarstradeDetailUrl("7672194")).toBe("https://ecarstrade.com/cars/7672194");
  });

  it("reads credentials only from env and never invents a default user", () => {
    expect(readEcarstradeAuth({})).toBeNull();
    expect(readEcarstradeAuth({ ECARSTRADE_USER: "sia-iriss@inbox.lv" })).toBeNull();
    expect(readEcarstradeAuth({ ECARSTRADE_USER: "sia-iriss@inbox.lv", ECARSTRADE_PASS: "secret" })).toEqual({
      username: "sia-iriss@inbox.lv",
      password: "secret",
    });
  });
});
