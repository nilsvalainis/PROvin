import { describe, expect, it } from "vitest";

import { storeThecarapiGallery, thecarapiArchivePhotoSession } from "@/lib/thecarapi-photos";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

const VIN = "WBA5R1C00LFH42874";

function record(id: string, urls: string[]): ThecarapiAdminRecord {
  return {
    site: "auto1",
    id,
    date: "2024-03-15",
    venue: "AUTO1",
    photoDate: "2024-03-12",
    photoUrls: urls,
    fields: [],
    raw: null,
    rawHistory: null,
    rawDetail: null,
    rawImages: null,
    photos: [],
  };
}

describe("storeThecarapiGallery", () => {
  it("saglabā pasūtījuma un arhīva sesijā, dedup pēc URL un hash, paraksts ar avotu un datumu", async () => {
    const writes: { sessionId: string; photoId: string }[] = [];
    const fetched: string[][] = [];
    const front = "https://img-pa.auto1.com/img/front.jpg";
    const extra = "https://img-pa.auto1.com/img/extra.jpg";
    const same = "https://img-pa.auto1.com/img/same-bytes.jpg";
    const result = await storeThecarapiGallery({
      vin: VIN,
      sessionId: "orderSession1",
      records: [record("A1-100", [front, extra]), record("A1-200", [front, same])],
      fetchJpegs: async (urls) => {
        fetched.push([...urls]);
        return {
          ok: urls.map((url) => ({
            ok: true as const,
            url,
            jpeg: Buffer.from(url),
            contentHash: url === front || url === same ? "hash-front" : `hash-${url}`,
          })),
          failed: [],
        };
      },
      writeJpeg: async (sessionId, photoId) => {
        writes.push({ sessionId, photoId });
      },
    });
    expect(fetched).toEqual([[front, extra, same]]);
    const archive = thecarapiArchivePhotoSession(VIN);
    expect(archive).toBe(`tc${VIN}`);
    const sessions = new Set(writes.map((row) => row.sessionId));
    expect(sessions).toEqual(new Set([archive, "orderSession1"]));
    expect(writes.filter((row) => row.sessionId === archive)).toHaveLength(2);
    expect(writes.filter((row) => row.sessionId === "orderSession1")).toHaveLength(2);
    expect(result.records[0]?.photos).toHaveLength(2);
    expect(result.records[1]?.photos.map((photo) => photo.sourceUrl)).toEqual([front]);
    expect(result.records[0]?.photos[0]?.id).toBe(result.records[1]?.photos[0]?.id);
    expect(result.groups[0]?.title).toBe("TheCarApi · AUTO1 · 2024-03-12");
    expect(result.groups[0]?.photos[0]?.contentHash).toBe("hash-front");
  });
});
