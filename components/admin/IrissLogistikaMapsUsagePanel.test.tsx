import { describe, expect, it } from "vitest";
import { IrissLogistikaMapsUsagePanel } from "@/components/admin/IrissLogistikaMapsUsagePanel";
import { renderHtml } from "@/lib/test-render";

describe("Google Maps limitu panelis", () => {
  it("atsevišķi rāda savu kartīti ar virsrakstu bez vecā nosaukuma Pārvaldība", () => {
    const html = renderHtml(<IrissLogistikaMapsUsagePanel />);
    expect(html).toContain("<h2");
    expect(html).toContain("Google Maps");
    expect(html).not.toContain("Pārvaldība");
  });

  it("Iestatījumu akordeonā bez savas kartītes un virsraksta", () => {
    const html = renderHtml(<IrissLogistikaMapsUsagePanel embedded />);
    expect(html).not.toContain("<h2");
    expect(html).not.toContain("rounded-[22px]");
    expect(html).toContain("Directions");
  });
});
