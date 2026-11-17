import { describe, expect, it } from "vitest";

import { markThecarapiArchived, thecarapiArchiveInputs } from "@/lib/thecarapi-archive";
import { mergeObservations } from "@/lib/vin-memory";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const VIN = "WBA2M11090VB64724";

function record(id: string, site = "auto1"): ThecarapiAdminRecord {
  return {
    site,
    id,
    date: "2026-10-31",
    venue: "AUTO1",
    photoDate: "2026-10-31",
    photoUrls: [],
    fields: [
      { key: "mileage", label: "Nobraukums", value: "77 387 km" },
      { key: "public_price_eur", label: "Cena EUR", value: "12268" },
      { key: "seller", label: "Pārdevējs", value: "AUTO1 GmbH" },
    ],
    raw: { auction_id: id, mystery: "keep" },
    rawHistory: null,
    rawDetail: null,
    rawImages: null,
    photos: [
      {
        id: "ih_ph_0123456789abcdef01234567",
        sourceUrl: "https://img-pa.auto1.com/img/front.jpg",
        contentHash: "abc",
        date: "2026-10-31",
        venue: "AUTO1",
        caption: "TheCarApi · AUTO1 · 2026-10-31",
      },
    ],
  };
}

describe("thecarapiArchiveInputs", () => {
  it("reālie lauki: clean_make, model_display, pirmā reģistrācija", () => {
    const real: ThecarapiAdminRecord = {
      ...record("1326383403"),
      fields: [
        { key: "mileage", label: "Nobraukums", value: "226760" },
        { key: "public_price_eur", label: "Cena EUR", value: "11379" },
        { key: "clean_make", label: "clean_make", value: "BMW" },
        { key: "clean_model", label: "clean_model", value: "2-Series" },
        { key: "model_display", label: "model_display", value: "2er 220d Gran Tourer Sport Line" },
        { key: "date_first_registration", label: "date_first_registration", value: "2022-11-23T01:00:00" },
      ],
    };
    const [obs] = thecarapiArchiveInputs("WBA6X310305V99966", [real]);
    expect(obs).toMatchObject({
      auctionId: "1326383403",
      source: "auto1",
      km: 226760,
      model: "BMW 2er 220d Gran Tourer Sport Line",
      firstRegistration: "2022-11-23",
    });
  });


  it("liek AUTO1 arhīvā un dedupē to pašu izsoles ID", () => {
    const inputs = thecarapiArchiveInputs(VIN, [record("A-9"), record("A-9"), record("B-1", "bca")]);
    expect(inputs.map((row) => `${row.platform}:${row.auctionId}`)).toEqual(["auto1:A-9", "bca:B-1"]);
    expect(inputs[0]).toMatchObject({ source: "auto1", km: 77387, venue: "AUTO1" });
    expect(inputs[1]).toMatchObject({ source: "thecarapi", platform: "bca" });
    const merged = mergeObservations({}, inputs, new Date("2026-11-17T00:00:00Z"));
    const again = mergeObservations(merged.table, inputs, new Date("2026-11-17T00:00:00Z"));
    expect(merged.added).toBe(2);
    expect(again.added).toBe(0);
    expect(again.updated).toBe(0);
    expect(merged.table[VIN].observations[0].raw).toEqual({ auction_id: "A-9", mystery: "keep" });
    expect(merged.table[VIN].observations[0].photos?.[0]?.caption).toContain("2026-10-31");
  });

  it("pēc saglabāšanas rāda Arhīvā: jā", () => {
    const marked = markThecarapiArchived([record("A-9")]);
    expect(marked[0]?.fields[0]).toEqual({ key: "provin_archive", label: "Arhīvā", value: "jā" });
    const inputs = thecarapiArchiveInputs(VIN, marked);
    const savedFields = inputs[0]?.fields;
    expect(Array.isArray(savedFields) ? savedFields[0] : null).toMatchObject({ label: "Arhīvā", value: "jā" });
    expect(markThecarapiArchived(marked)[0]?.fields.filter((field) => field.key === "provin_archive")).toHaveLength(1);
    const stamped = markThecarapiArchived([record("A-9")], "2026-11-17T18:20:00.000Z");
    expect(stamped[0]?.fields.find((field) => field.key === "archived_at")).toEqual({
      key: "archived_at",
      label: "Ielikts arhīvā",
      value: "2026-11-17T18:20:00.000Z",
    });
    const saved = thecarapiArchiveInputs(VIN, stamped);
    expect(saved[0]?.archivedAt).toBe("2026-11-17T18:20:00.000Z");
    const table = mergeObservations({}, saved, new Date("2026-11-17T18:20:00.000Z"));
    expect(table.table[VIN]?.observations[0]?.archivedAt).toBe("2026-11-17T18:20:00.000Z");
  });
});
