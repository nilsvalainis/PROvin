import { describe, expect, it } from "vitest";

import { AdminThecarapiRecords } from "@/components/admin/AdminThecarapiRecords";
import { renderHtml } from "@/lib/test-render";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const VIN = "WBA5R1C00LFH42875";

const record: ThecarapiAdminRecord = {
  site: "auto1",
  id: "A1-100",
  date: "2024-03-15",
  venue: "AUTO1",
  photoDate: "2024-03-12",
  photoUrls: [],
  fields: [
    { key: "seller", label: "Pārdevējs", value: "AUTO1 GmbH" },
    { key: "mystery_flag", label: "mystery_flag", value: "keep-me" },
  ],
  raw: { mystery_flag: "keep-me" },
  rawHistory: null,
  rawDetail: null,
  rawImages: null,
  photos: [
    {
      id: "ih_ph_0123456789abcdef01234567",
      sourceUrl: "https://img-pa.auto1.com/img/front.jpg",
      contentHash: "abc",
      date: "2024-03-12",
      venue: "AUTO1",
      caption: "TheCarApi · AUTO1 · 2024-03-12",
    },
  ],
};

describe("AdminThecarapiRecords", () => {
  it("rāda latvisko nosaukumu, nezināmo atslēgu, JSON un bildes parakstu", () => {
    const text = renderHtml(<AdminThecarapiRecords vin={VIN} records={[record]} />);
    expect(text).toContain("Pārdevējs");
    expect(text).toContain("AUTO1 GmbH");
    expect(text).toContain("mystery_flag");
    expect(text).toContain("keep-me");
    expect(text).toContain("TheCarApi · AUTO1 · 2024-03-12");
    expect(text).toContain("ih_ph_0123456789abcdef01234567");
    expect(text).toContain("/api/admin/sources/thecarapi/photo?vin=");
  });
});
