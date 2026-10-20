import { describe, expect, it } from "vitest";
import {
  INCIDENT_MAX_PHOTOS,
  incidentPhotosFromUnknown,
  isIncidentPhotoId,
  mergeIncidentPhotoGroups,
  normalizeIncidentPhotoGroups,
  syncIncidentPhotoGroupsAndFlat,
} from "@/lib/incident-photo-types";

const ID_A = "inc_ph_aabbccddeeff001122334455";
const ID_B = "inc_ph_112233445566778899aabbcc";
const ID_C = "inc_ph_99887766554433221100aabb";
const GID_A = "inc_phg_aabbccddeeff001122334455";
const GID_B = "inc_phg_112233445566778899aabbcc";

describe("incident photo types", () => {
  it("allows up to 100 incident photos", () => {
    expect(INCIDENT_MAX_PHOTOS).toBe(100);
  });

  it("accepts incident photo ids", () => {
    expect(isIncidentPhotoId(ID_A)).toBe(true);
    expect(isIncidentPhotoId("la_ph_aabbccddeeff001122334455")).toBe(false);
  });

  it("keeps the longer photo list when merging", () => {
    const merged = mergeIncidentPhotoGroups(
      [],
      [],
      [{ id: GID_A, title: "", photos: [{ id: ID_A }, { id: ID_B }] }],
      [{ id: ID_A }, { id: ID_B }],
    );
    expect(normalizeIncidentPhotoGroups(merged).flatMap((g) => g.photos.map((p) => p.id))).toEqual([ID_A, ID_B]);
  });

  it("reads flat photos into persist fields", () => {
    const synced = incidentPhotosFromUnknown(undefined, [{ id: ID_A }]);
    expect(synced.incidentPhotos).toEqual([{ id: ID_A }]);
    expect(synced.incidentPhotoGroups).toHaveLength(1);
  });

  it("migrates a legacy flat list into the first group without dropping photos", () => {
    const groups = normalizeIncidentPhotoGroups(undefined, [{ id: ID_A }, { id: ID_B }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBe("");
    expect(groups[0]!.photos.map((p) => p.id)).toEqual([ID_A, ID_B]);
  });

  it("keeps legacy flat photos when groups exist only as empty titled shells", () => {
    const groups = normalizeIncidentPhotoGroups(
      [{ id: GID_A, title: "Arhīva fotogrāfijas 2026-10-20", photos: [] }],
      [{ id: ID_A }, { id: ID_B }],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe(GID_A);
    expect(groups[0]!.title).toBe("Arhīva fotogrāfijas 2026-10-20");
    expect(groups[0]!.photos.map((p) => p.id)).toEqual([ID_A, ID_B]);
  });

  it("keeps an existing single group as the first group on read", () => {
    const groups = normalizeIncidentPhotoGroups(
      [{ id: GID_A, title: "", photos: [{ id: ID_A }, { id: ID_B }] }],
      [{ id: ID_A }, { id: ID_B }],
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.id).toBe(GID_A);
    expect(groups[0]!.photos.map((p) => p.id)).toEqual([ID_A, ID_B]);
  });

  it("preserves multiple named groups and their order", () => {
    const groups = normalizeIncidentPhotoGroups([
      { id: GID_B, title: "Arhīva fotogrāfijas 2024-03-12", photos: [{ id: ID_B }] },
      { id: GID_A, title: "Arhīva fotogrāfijas 2021-06-01", photos: [{ id: ID_A }, { id: ID_C }] },
    ]);
    expect(groups.map((g) => g.title)).toEqual([
      "Arhīva fotogrāfijas 2024-03-12",
      "Arhīva fotogrāfijas 2021-06-01",
    ]);
    expect(groups.flatMap((g) => g.photos.map((p) => p.id))).toEqual([ID_B, ID_A, ID_C]);
  });

  it("syncs groups to a flat list without losing photos when splitting", () => {
    const synced = syncIncidentPhotoGroupsAndFlat([
      { id: GID_A, title: "A", photos: [{ id: ID_A }] },
      { id: GID_B, title: "B", photos: [{ id: ID_B }, { id: ID_C }] },
    ]);
    expect(synced.photoGroups).toHaveLength(2);
    expect(synced.photos.map((p) => p.id)).toEqual([ID_A, ID_B, ID_C]);
  });

  it("does not drop baseline photos if an incoming empty group list is shorter", () => {
    const merged = mergeIncidentPhotoGroups(
      [{ id: GID_A, title: "Jauna", photos: [{ id: ID_A }] }],
      [{ id: ID_A }],
      [
        { id: GID_A, title: "", photos: [{ id: ID_A }] },
        { id: GID_B, title: "Arhīvs", photos: [{ id: ID_B }, { id: ID_C }] },
      ],
      [{ id: ID_A }, { id: ID_B }, { id: ID_C }],
    );
    expect(merged.flatMap((g) => g.photos.map((p) => p.id))).toEqual([ID_A, ID_B, ID_C]);
  });
});
