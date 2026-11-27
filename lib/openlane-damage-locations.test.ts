import { describe, expect, it } from "vitest";
import { buildThecarapiPdfModel } from "@/lib/thecarapi-pdf-model";
import {
  OPENLANE_DAMAGE_LOCATIONS,
  openlaneDamageKind,
  openlaneDamageLocation,
  translateOpenlaneDamageText,
} from "@/lib/openlane-damage-locations";
import type { ThecarapiAdminRecord } from "@/lib/vin-scan/thecarapi-fields";

describe("Openlane bojājumu vietu vārdnīca", () => {
  it("numuri pēc Openlane koda (vehicleDetails.damages.*)", () => {
    expect(openlaneDamageLocation("1")?.en).toBe("Front bumper");
    expect(openlaneDamageLocation(3)?.part).toBe("Motora pārsegs");
    expect(openlaneDamageLocation("13")?.en).toBe("Rear bumper");
    expect(openlaneDamageLocation("14")?.en).toBe("Tailgate");
    expect(openlaneDamageLocation("16")?.zone).toBe("Jumts");
    expect(openlaneDamageLocation("19")?.part).toBe("Labās aizmugurējās durvis");
    expect(openlaneDamageLocation("21")?.ru).toBe("Передняя правая дверь");
    expect(openlaneDamageLocation("6")?.zone).toBe("Kreisā puse");
  });
  it("nezināms vai ne-skaitlis - null", () => {
    expect(openlaneDamageLocation("25")).toBeNull();
    expect(openlaneDamageLocation("front")).toBeNull();
    expect(openlaneDamageLocation(null)).toBeNull();
  });
  it("katrai vietai visas 4 valodas un zona", () => {
    for (const l of Object.values(OPENLANE_DAMAGE_LOCATIONS)) {
      expect(l.lv && l.en && l.ru && l.de && l.zone).toBeTruthy();
      expect(`${l.lv}${l.en}${l.ru}${l.de}`).not.toMatch(/[—–]/);
    }
  });
  it("veidi (damagekind.*)", () => {
    expect(openlaneDamageKind(1)?.en).toBe("Chip");
    expect(openlaneDamageKind("3")?.lv).toBe("Iespiedums");
    expect(openlaneDamageKind(10)).toBeNull();
  });
  it("tulko tikai pilnu LV sakritību", () => {
    expect(translateOpenlaneDamageText("Kreisās priekšējās durvis", "de")).toBe("Tür vorne links");
    expect(translateOpenlaneDamageText("Labā puse", "en")).toBe("Right side");
    expect(translateOpenlaneDamageText("Kaut kas cits", "en")).toBeNull();
    expect(translateOpenlaneDamageText("Motora pārsegs", "lv")).toBe("Motora pārsegs");
  });
  it("Openlane bojājuma foto ar locationId saņem vietas birku", () => {
    const url = "https://images.openlane.eu/carimgs/1/damage/a.jpeg";
    const r = {
      site: "openlane",
      id: "1",
      date: "2026-11-12",
      venue: "Openlane",
      photoDate: "2026-11-12",
      fields: [],
      photoUrls: [],
      raw: null,
      rawHistory: null,
      rawDetail: { car_identification: { ImageUrls: [{ damageKindId: 3, index: 0, locationId: 13, thumbnail: url, type: "damage", url }] } },
      rawImages: null,
      photos: [],
    } as unknown as ThecarapiAdminRecord;
    expect(buildThecarapiPdfModel(r).photoCategories[url]).toBe("Bojājums: aizmugurējais buferis");
  });
});
