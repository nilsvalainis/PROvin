/** FABLE 25.10: admin skati rādīja `iso.slice(0, 16)` - UTC laiks kā vietējais. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatRigaIsoShort } from "@/lib/riga-datetime";

describe("formatRigaIsoShort", () => {
  it("UTC ISO -> Rīgas laiks (arī ap pusnakti un vasaras laikā)", () => {
    expect(formatRigaIsoShort("2026-10-24T22:30:00.000Z")).toBe("25.10.2026 01:30");
    expect(formatRigaIsoShort("2026-07-01T09:05:00.000Z")).toBe("01.07.2026 12:05");
  });

  it("tukšs / nederīgs - nekrīt", () => {
    expect(formatRigaIsoShort("")).toBe("");
    expect(formatRigaIsoShort(undefined)).toBe("");
    expect(formatRigaIsoShort("nav")).toBe("nav");
  });

  it("admin komponentēs vairs nav UTC `slice(0, 16)` laika", () => {
    for (const f of [
      "components/admin/IrissCabinetAccessPanel.tsx",
      "components/admin/IrissPasutijumsEditor.tsx",
      "components/admin/AdminDealerDataJobStrip.tsx",
      "components/admin/AdminOneautoIngestBar.tsx",
    ]) {
      expect(readFileSync(f, "utf8"), f).not.toContain('.slice(0, 16).replace("T", " ")');
    }
  });
});
