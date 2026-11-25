import { describe, expect, it } from "vitest";

import {
  archiveCoverAllowed,
  archiveCoverCandidates,
  archiveDateSortKey,
  pickArchiveCoverPhotoId,
} from "@/lib/vendor-archive-cover";
import {
  archiveDropboxFileName,
  archiveDropboxFolders,
  archiveDropboxGroupFolder,
  planArchiveDropboxUploads,
} from "@/lib/vendor-archive-photos-dropbox-path";

const g = (date: string, ids: string[], source: "autodna" | "carvertical" = "autodna") => ({
  photos: ids.map((id) => ({ id })),
  archive: { source, date },
});

describe("archiveDateSortKey", () => {
  it("salīdzina AutoDNA un CarVertical datumus", () => {
    expect(archiveDateSortKey("12.11.2024")).toBe(20241112);
    expect(archiveDateSortKey("07.2020")).toBe(20200700);
    expect(archiveDateSortKey("2019")).toBe(20190000);
    expect(archiveDateSortKey("nav")).toBe(0);
    expect(archiveDateSortKey("12.11.2024")).toBeGreaterThan(archiveDateSortKey("07.2020"));
  });
});

describe("titulbilde no arhīva", () => {
  it("aizpilda tikai nekad neaizpildītu lauku (Nila izvēle / noņemšana paliek)", () => {
    expect(archiveCoverAllowed(undefined)).toBe(true);
    expect(archiveCoverAllowed(null)).toBe(false);
    expect(archiveCoverAllowed({ id: "la_ph_x" })).toBe(false);
  });

  it("jaunākā grupa pirmā, tajā pirmā horizontālā bilde", () => {
    const groups = [g("07.2020", ["a1", "a2"]), g("12.11.2024", ["b1", "b2", "b3", "b4"]), { photos: [{ id: "x" }] }];
    const c = archiveCoverCandidates(groups, ["autodna"]);
    expect(c.map((x) => x.photoId)).toEqual(["b1", "b2", "b3", "a1", "a2"]);
    const dims = new Map([
      ["b1", { width: 600, height: 800 }], // vertikāla - salons / detaļa
      ["b2", { width: 1024, height: 768 }],
      ["b3", { width: 1024, height: 768 }],
      ["a1", { width: 1024, height: 768 }],
    ]);
    expect(pickArchiveCoverPhotoId(c, dims)).toBe("b2");
  });

  it("ja nav horizontālas - grupas pirmā; citu avotu neņem", () => {
    const groups = [g("12.11.2024", ["b1", "b2"]), g("01.2025", ["c1"], "carvertical")];
    const c = archiveCoverCandidates(groups, ["autodna"]);
    expect(c.map((x) => x.photoId)).toEqual(["b1", "b2"]);
    expect(pickArchiveCoverPhotoId(c, new Map([["b1", { width: 500, height: 500 }], ["b2", { width: 400, height: 600 }]]))).toBe("b1");
    expect(pickArchiveCoverPhotoId(c, new Map())).toBeNull();
  });
});

describe("arhīva foto Dropbox plāns", () => {
  it("mapes un failu nosaukumi", () => {
    expect(archiveDropboxGroupFolder("autodna", "12.11.2024")).toBe("AutoDNA 12.11.2024");
    expect(archiveDropboxGroupFolder("carvertical", "07.2020")).toBe("CarVertical 07.2020");
    expect(archiveDropboxGroupFolder("autodna", "")).toBe("AutoDNA");
    expect(archiveDropboxFileName(0)).toBe("01.jpg");
    expect(archiveDropboxFileName(37)).toBe("38.jpg");
  });

  it("izlaiž jau esošos failus, pārraksta tikai aizstātās (pilnās) bildes", () => {
    const groups = [g("12.11.2024", ["p1", "p2", "p3"]), g("07.2020", ["q1"], "carvertical"), g("12.11.2024", ["p4"])];
    expect(archiveDropboxFolders(groups, "autodna")).toEqual(["AutoDNA 12.11.2024"]);
    const existing = new Map([["AutoDNA 12.11.2024", new Set(["01.jpg", "02.jpg"])]]);
    const plan = planArchiveDropboxUploads({ groups, source: "autodna", existing, upgraded: new Set(["p2"]) });
    expect(plan).toEqual([
      { folder: "AutoDNA 12.11.2024", name: "02.jpg", photoId: "p2", overwrite: true },
      { folder: "AutoDNA 12.11.2024", name: "03.jpg", photoId: "p3", overwrite: false },
      { folder: "AutoDNA 12.11.2024", name: "04.jpg", photoId: "p4", overwrite: false },
    ]);
    // Otrā palaišana - viss jau ir.
    const all = new Map([["AutoDNA 12.11.2024", new Set(["01.jpg", "02.jpg", "03.jpg", "04.jpg"])]]);
    expect(planArchiveDropboxUploads({ groups, source: "autodna", existing: all })).toEqual([]);
  });
});
