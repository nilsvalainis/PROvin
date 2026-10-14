import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { mergePdfVisibility } from "@/lib/pdf-visibility";

describe("OneAuto PDF slēdzis", () => {
  it("slēdzis maina tikai esošo pdfVisibility.oneauto (PDF loģika nemainās)", () => {
    expect(mergePdfVisibility({ oneauto: false }).oneauto).toBe(false);
    expect(mergePdfVisibility({ oneauto: true }).oneauto).toBe(true);
    const off = mergePdfVisibility({ oneauto: false });
    const on = mergePdfVisibility({ oneauto: true });
    const { oneauto: _a, ...restOff } = off;
    const { oneauto: _b, ...restOn } = on;
    expect(restOff).toEqual(restOn);
  });
  it("pasūtījuma skatā Auto Records blokam pievienots OneAuto PDF slēdzis", () => {
    const ws = fs.readFileSync(path.join(process.cwd(), "components/admin/OrderDetailWorkspace.tsx"), "utf8");
    expect(ws).toContain("onPdfIncludeOneautoChange={(next) => onPdfVisibilityChange({ oneauto: next })}");
    const blk = fs.readFileSync(path.join(process.cwd(), "components/admin/AdminAutoRecordsSourceBlock.tsx"), "utf8");
    expect(blk).toContain('label="OneAuto PDF"');
  });
});
