import { describe, expect, it } from "vitest";
import { IrissWaybillGaugeDetail } from "@/components/admin/IrissWaybillGaugeDetail";
import { IrissWaybillStopConfirm } from "@/components/admin/IrissWaybillStopConfirm";
import { renderHtml, renderText } from "@/lib/test-render";
import type { WaybillGauge } from "@/lib/iriss-waybill-gauges";

const gauge: WaybillGauge = {
  plate: "B193-7",
  busy: true,
  status: "ok",
  hoursLeft: 12,
  share: 0.5,
  brandModel: "VW Golf",
  validUntil: "2026-10-26T10:00:00.000Z",
  id: "wb_p02819",
  number: "P02819",
};

describe("Pavadzīmes pārtraukšanas logs", () => {
  it("asks to stop this number and plate; Jā is a click-only button", () => {
    const html = renderHtml(
      <IrissWaybillStopConfirm
        target={{ id: "wb_p02819", number: "P02819", plate: "B193-7" }}
        onYes={() => undefined}
        onNo={() => undefined}
      />,
    );
    const text = renderText(
      <IrissWaybillStopConfirm
        target={{ id: "wb_p02819", number: "P02819", plate: "B193-7" }}
        onYes={() => undefined}
        onNo={() => undefined}
      />,
    );
    expect(text).toContain("Pārtraukt pavadzīmi Nr. P02819 (B193-7)?");
    expect(text).toContain("Jā");
    expect(text).toContain("Nē");
    expect(text).not.toMatch(/anul/i);
    expect(html).toContain('type="button"');
    expect(html).not.toContain('type="submit"');
  });
});

describe("Apļa izvērsums", () => {
  it("shows PDF, Pagarināt and Pārtraukt for an active waybill", () => {
    const text = renderText(
      <IrissWaybillGaugeDetail active={gauge} now={new Date("2026-10-25T20:00:00.000Z")} onExtend={() => undefined} onStop={() => undefined} />,
    );
    expect(text).toContain("Atvērt PDF");
    expect(text).toContain("P02819");
    expect(text).toContain("Pagarināt");
    expect(text).toContain("Pārtraukt");
    expect(text).not.toMatch(/anul/i);
  });
});
