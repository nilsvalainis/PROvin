import { describe, expect, it } from "vitest";
import { CargoStageIcon } from "@/components/admin/iriss-logistika/IrissLogistikaCargoPlan";
import { CabinetPhoneMapAndCard } from "@/components/admin/iriss-logistika/IrissLogistikaCarsTable";
import { renderHtml, renderText } from "@/lib/test-render";

describe("Loģistika telefonā (makets C1, Nils 27.10)", () => {
  it("katram posmam sava ikona: pulkstenis, kalendārs, kravas auto, māja", () => {
    const wait = renderHtml(<CargoStageIcon label="Gaida" />);
    const plan = renderHtml(<CargoStageIcon label="Ieplānots" />);
    const road = renderHtml(<CargoStageIcon label="Ceļā" />);
    const done = renderHtml(<CargoStageIcon label="Atvests" />);
    expect(new Set([wait, plan, road, done]).size).toBe(4);
    expect(wait).toContain('r="9"');
    expect(plan).toContain("M4 10h16");
    expect(road).toContain("M3 7h11v9H3z");
    expect(done).toContain("M9 15l2 2 4-4");
  });

  it("kabinetā telefonā ir «Rādīt kartē» slēdzis un Autoparka kartīte", () => {
    const html = renderHtml(<CabinetPhoneMapAndCard showOnMap inPlan onToggleMap={() => {}} cardHref="/admin/iriss/autoparks/x" />);
    const text = renderText(<CabinetPhoneMapAndCard showOnMap inPlan onToggleMap={() => {}} cardHref="/admin/iriss/autoparks/x" />);
    expect(text).toContain("Rādīt kartē");
    expect(text).toContain("Autoparka kartīte");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("md:hidden");
  });

  it("bez kravas un bez kartītes - nekā", () => {
    expect(renderHtml(<CabinetPhoneMapAndCard showOnMap inPlan={false} onToggleMap={() => {}} />)).toBe("");
  });
});
