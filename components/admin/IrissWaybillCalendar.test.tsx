import { describe, expect, it } from "vitest";
import { IrissWaybillCalendar } from "@/components/admin/IrissWaybillCalendar";
import type { IrissPavadzimeListRow } from "@/lib/iriss-pavadzimes-types";
import { renderHtml, renderText } from "@/lib/test-render";

const H = 3_600_000;
const now = new Date(2026, 9, 22, 12, 0, 0).getTime();
const row = (id: string, plate: string, from: number, to: number) =>
  ({
    id,
    number: `TP${id}`,
    brandModel: id === "a" ? "BMW 320d" : "Audi A4",
    plate,
    vin: "",
    issuedAt: new Date(from).toISOString(),
    validUntil: new Date(to).toISOString(),
  }) as unknown as IrissPavadzimeListRow;

describe("pavadzīmju kalendārs (renderēts)", () => {
  it("joslas pēc numura, šodiena, leģenda", () => {
    const text = renderText(
      <IrissWaybillCalendar rows={[row("a", "BA 1234", now - 2 * H, now + 30 * H), row("b", "BC 99", now - H, now + 5 * H)]} nowMs={now} onOpen={() => undefined} />,
    );
    expect(text).toContain("Šodien");
    expect(text).toContain("BA1234");
    expect(text).toContain("BC99");
    expect(text).toContain("BMW 320d");
    expect(text).toContain("beidzas 24 h laikā");
  });

  it("tukšs: paskaidrojums", () => {
    expect(renderHtml(<IrissWaybillCalendar rows={[]} nowMs={now} onOpen={() => undefined} />)).toContain("Nākamajās 7 dienās nav pavadzīmju.");
  });
});
