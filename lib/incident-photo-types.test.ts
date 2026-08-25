import { describe, expect, it } from "vitest";
import {
  incidentPhotosFromUnknown,
  isIncidentPhotoId,
  mergeIncidentPhotoGroups,
  normalizeIncidentPhotoGroups,
} from "@/lib/incident-photo-types";

const ID_A = "inc_ph_aabbccddeeff001122334455";
const ID_B = "inc_ph_112233445566778899aabbcc";

describe("incident photo types", () => {
  it("accepts incident photo ids", () => {
    expect(isIncidentPhotoId(ID_A)).toBe(true);
    expect(isIncidentPhotoId("la_ph_aabbccddeeff001122334455")).toBe(false);
  });

  it("keeps the longer photo list when merging", () => {
    const merged = mergeIncidentPhotoGroups(
      [],
      [],
      [{ id: "inc_phg_aabbccddeeff001122334455", title: "", photos: [{ id: ID_A }, { id: ID_B }] }],
      [{ id: ID_A }, { id: ID_B }],
    );
    expect(normalizeIncidentPhotoGroups(merged).flatMap((g) => g.photos.map((p) => p.id))).toEqual([ID_A, ID_B]);
  });

  it("reads flat photos into persist fields", () => {
    const synced = incidentPhotosFromUnknown(undefined, [{ id: ID_A }]);
    expect(synced.incidentPhotos).toEqual([{ id: ID_A }]);
    expect(synced.incidentPhotoGroups).toHaveLength(1);
  });
});
