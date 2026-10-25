/** FABLE 25.10: IRISS / B2B pasūtījuma PDF rādīja datumu ISO formā "2026-10-25". */
import { describe, expect, it } from "vitest";
import { formatYmdLv } from "@/lib/date-ymd-lv";
import { buildIrissPasutijumsPrintHtml } from "@/lib/iriss-pasutijums-pdf-html";
import { collectIrissPasutijumsOverview } from "@/lib/iriss-pasutijumi-list-overview";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";

describe("pasūtījuma datums LV formātā", () => {
  it("formatYmdLv", () => {
    expect(formatYmdLv("2026-10-25")).toBe("25.10.2026");
    expect(formatYmdLv(" 2026-01-05 ")).toBe("05.01.2026");
    expect(formatYmdLv("25.10.2026")).toBe("25.10.2026");
    expect(formatYmdLv("")).toBe("");
    expect(formatYmdLv(undefined)).toBe("");
  });

  it("IRISS pasūtījuma drukas HTML un saraksta pārskats", () => {
    const rec = emptyIrissPasutijums("ord_fable_date", "2026-10-25T10:00:00.000Z");
    rec.clientFirstName = "Jānis";
    rec.orderDate = "2026-10-25";
    const html = buildIrissPasutijumsPrintHtml(rec, "25.10.2026 12:00");
    expect(html).toContain("25.10.2026");
    expect(html).not.toContain("2026-10-25");
    const ov = collectIrissPasutijumsOverview(rec);
    expect(ov.clientLines.join("\n")).toContain("Pasūtījuma datums: 25.10.2026");
  });
});
