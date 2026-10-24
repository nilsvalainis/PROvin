import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const client = {
  listAll: vi.fn(async () => ({
    entries: [
      { tag: "file", id: "id:photo0001", name: "IMG_2.jpg", serverModified: "" },
      { tag: "file", id: "id:photo0002", name: "IMG_1.jpg", serverModified: "" },
      { tag: "file", id: "id:docs00001", name: "rekins.pdf", serverModified: "" },
      { tag: "folder", id: "id:auction01", name: "izsole", serverModified: "" },
    ],
    cursor: "",
  })),
  getThumbnail: vi.fn(async (id: string) => Buffer.from(`full:${id}`)),
  getThumbnailBatch: vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, Buffer.from(`thumb:${id}`)]))),
};
vi.mock("@/lib/dropbox-client", () => ({ getDropboxClient: () => client }));
vi.mock("@/lib/iriss-autoparks-store", () => ({
  readAutoparksState: async () => ({ cars: [{ id: "car1", vin: "WBA00000000A12345", orderId: "ord1", dropboxFolderId: "id:folder1" }] }),
}));
vi.mock("@/lib/iriss-autoparks-v2-store", () => ({ readAutoparksV2Car: async () => null }));
vi.mock("@/lib/iriss-autoparks-files", () => ({
  resolveAutoparksCarFolder: vi.fn(async (_c: unknown, car: { dropboxFolderId?: string }) =>
    car.dropboxFolderId ? { id: car.dropboxFolderId, path: "/STOCK/BMW - A12345" } : null,
  ),
}));
vi.mock("@/lib/iriss-logistics-store", () => ({
  getLogisticsOrder: async (id: string) =>
    id === "ord1" ? { id: "ord1", vin: "WBA00000000A12345", make: "BMW", model: "X5" } : id === "ord2" ? { id: "ord2", vin: "", make: "", model: "" } : null,
}));

import {
  fetchOfferSourcePhotosForSave,
  listOfferSourcePhotos,
  readOfferSourcePhoto,
  resetOfferSourceCachesForTest,
} from "@/lib/iriss-offer-source";

describe("offer source photos", () => {
  beforeEach(() => {
    resetOfferSourceCachesForTest();
    vi.clearAllMocks();
  });

  it("lists only first-level photos of the car folder, in name order", async () => {
    const photos = await listOfferSourcePhotos({ kind: "autoparks", id: "car1" });
    expect(photos.map((p) => p.name)).toEqual(["IMG_1.jpg", "IMG_2.jpg"]);
    expect(client.listAll).toHaveBeenCalledWith("/STOCK/BMW - A12345", { recursive: false });
  });

  it("finds a Logistics car through Autoparks, and opens without photos when there is no folder", async () => {
    expect(await listOfferSourcePhotos({ kind: "logistics", id: "ord1" })).toHaveLength(2);
    expect(await listOfferSourcePhotos({ kind: "logistics", id: "ord2" })).toEqual([]);
    expect(await listOfferSourcePhotos({ kind: "logistics", id: "missing" })).toEqual([]);
  });

  it("refuses Dropbox files that are not in this car's folder", async () => {
    const ref = { kind: "autoparks" as const, id: "car1" };
    expect(await readOfferSourcePhoto(ref, "id:docs00001", "thumb")).toBeNull();
    expect(await readOfferSourcePhoto(ref, "id:someoneelse", "full")).toBeNull();
    expect(client.getThumbnail).not.toHaveBeenCalled();
    expect(client.getThumbnailBatch).not.toHaveBeenCalled();
  });

  it("batches thumbnails and caches them", async () => {
    const ref = { kind: "autoparks" as const, id: "car1" };
    expect((await readOfferSourcePhoto(ref, "id:photo0002", "thumb"))?.toString()).toBe("thumb:id:photo0002");
    expect(client.getThumbnailBatch).toHaveBeenCalledWith(["id:photo0002", "id:photo0001"], "w256h256");
    expect((await readOfferSourcePhoto(ref, "id:photo0001", "thumb"))?.toString()).toBe("thumb:id:photo0001");
    expect(client.getThumbnailBatch).toHaveBeenCalledTimes(1);
    expect((await readOfferSourcePhoto(ref, "id:photo0001", "full"))?.toString()).toBe("full:id:photo0001");
    expect(client.getThumbnail).toHaveBeenCalledWith("id:photo0001", "w2048h1536");
  });

  it("downloads only allowed photos for saving", async () => {
    const got = await fetchOfferSourcePhotosForSave({ kind: "autoparks", id: "car1" }, ["id:photo0001", "id:evil00001"]);
    expect([...got.keys()]).toEqual(["id:photo0001"]);
  });
});
