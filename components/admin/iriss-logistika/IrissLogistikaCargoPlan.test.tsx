import { describe, expect, it } from "vitest";
import { IrissLogistikaCargoPlan } from "@/components/admin/iriss-logistika/IrissLogistikaCargoPlan";
import { emptyCargoPlan, ensureCargoCars, moveCargoCar } from "@/lib/iriss-logistics-cargo-plan";
import type { ReadinessKind } from "@/lib/iriss-logistics-readiness";
import type { LogisticsOrder } from "@/lib/iriss-logistics-types";
import { renderHtml, renderText } from "@/lib/test-render";

function order(id: string, make: string, model: string): LogisticsOrder {
  return {
    id,
    workspace: "iriss",
    source: "auction",
    auction: "Openlane",
    auctionUrl: "",
    listingUrl: "",
    listingParsed: null,
    make,
    model,
    vin: "",
    title: `${make} ${model}`,
    priceEur: null,
    mileageKm: null,
    pickupPointId: "",
    pickupSnapshot: null,
    pickupRef: "",
    pickupAddress: "Lille",
    pickupLat: 50.6,
    pickupLng: 3.06,
    geocodeStatus: "ok",
    pickupDate: "",
    stockNo: "",
    freeParkingUntil: "",
    transportCostEur: null,
    transportCostAuto: false,
    status: "ready",
    archived: false,
    archivedAt: "",
    previousStatus: "",
    statusNote: "",
    nextAction: "",
    sellerContact: "",
    notes: "",
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  };
}

const orders = [
  order("a", "BMW", "320d"),
  order("b", "Audi", "A6"),
  order("c", "VW", "Passat"),
  order("d", "Škoda", "Superb"),
  order("e", "Volvo", "V90"),
];
let plan = ensureCargoCars(emptyCargoPlan("t0"), orders.map((o) => o.id), "t0");
for (const id of ["a", "b", "c", "d"]) plan = moveCargoCar(plan, id, "next", undefined, "t1");
plan = moveCargoCar(plan, "e", "after", undefined, "t1");

const readiness = new Map<string, ReadinessKind>([
  ["a", "unpaid"],
  ["b", "no_pickup"],
  ["c", "paid"],
  ["d", "client"],
]);

function render(readinessOn: boolean) {
  const el = (
    <IrissLogistikaCargoPlan
      orders={orders}
      plan={plan}
      templates={[]}
      bounceId={null}
      hoverId={null}
      onPlanChange={() => undefined}
      onRowClick={() => undefined}
      onRowHover={() => undefined}
      onRefreshDirections={() => undefined}
      readinessOn={readinessOn}
      onToggleReadiness={() => undefined}
      readinessByCarId={readiness}
    />
  );
  return { html: renderHtml(el), text: renderText(el) };
}

describe("Kravu plāns - slēdzis «Gatavība» (renderēts)", () => {
  it("ON: Nākošajā kravā čipi ar Lielo burtu un gatavības krāsas punktos", () => {
    const { html, text } = render(true);
    expect(html).toMatch(/aria-checked="true" data-testid="toggle-readiness-colors"/);
    expect(text).toMatch(/BMW 320d .*Nav apmaksāts/);
    expect(text).toMatch(/Audi A6 .*Nav pickup/);
    expect(text).toMatch(/VW Passat .*Apmaksāts/);
    expect(text).toMatch(/Škoda Superb .*Klients/);
    expect(html).toContain("background:#ea4335");
    expect(html).toContain("background:#f9ab00");
    expect(html).toContain("background:#34c759");
    // Aiznākošajai kravai gatavība netiek rādīta.
    expect(html.match(/data-readiness=/g)?.length).toBe(4);
  });

  it("OFF: nav čipu un nākošās kravas punkti paliek viļņa krāsā", () => {
    const { html, text } = render(false);
    expect(html).toMatch(/aria-checked="false" data-testid="toggle-readiness-colors"/);
    expect(html).not.toContain("data-readiness=");
    expect(text).not.toContain("Nav apmaksāts");
    expect(text).not.toContain("Nav pickup");
    expect(html).not.toContain("background:#f9ab00");
    expect(html).not.toContain("background:#34c759");
    expect(html).toContain("var(--iriss-log-cargo-next)");
  });

  it("slēdzis «Gatavība» ir tikai Nākošās kravas galvenē blakus «Maršruts»", () => {
    const { html, text } = render(true);
    expect(html.match(/data-testid="toggle-readiness-colors"/g)?.length).toBe(1);
    expect(text).toMatch(/Nākošā krava 4 Maršruts Gatavība/);
    // Nav atsevišķu gatavības filtru čekboksu.
    expect(html).not.toMatch(/type="checkbox"[^>]*(apmaks|pickup)/i);
  });
});

describe("Kravu rinda -> Autoparka auto kartīte", () => {
  it("rāda saiti Kartīte tikai auto, kam ir Autoparka ieraksts", () => {
    const el = (
      <IrissLogistikaCargoPlan
        orders={orders}
        plan={plan}
        templates={[]}
        bounceId={null}
        hoverId={null}
        onPlanChange={() => undefined}
        onRowClick={() => undefined}
        onRowHover={() => undefined}
        onRefreshDirections={() => undefined}
        readinessOn={false}
        onToggleReadiness={() => undefined}
        cardHrefByCarId={{ a: "ap-1" }}
      />
    );
    const html = renderHtml(el);
    expect(html).toContain('href="/admin/iriss/autoparks-v2/ap-1"');
    expect(html.match(/>Kartīte</g)?.length).toBe(1);
  });
});

describe("Kravu rinda - posma žetons (aizstāj tabulu «Visi auto»)", () => {
  const base = {
    orders,
    plan,
    templates: [],
    bounceId: null,
    hoverId: null,
    onPlanChange: () => undefined,
    onRowClick: () => undefined,
    onRowHover: () => undefined,
    onRefreshDirections: () => undefined,
    readinessOn: false,
    onToggleReadiness: () => undefined,
  };

  it("katrai rindai rāda posmu, ja ir kabineta atvēršana", () => {
    const labels = { a: "Gaida", b: "Ceļā", c: "Gaida", d: "Gaida", e: "Atvests" };
    const html = renderHtml(<IrissLogistikaCargoPlan {...base} stageLabelByCarId={labels} onOpenCabinet={() => undefined} />);
    expect(html.match(/class="iriss-log-stage-chip"/g)?.length).toBe(5);
    expect(renderText(<IrissLogistikaCargoPlan {...base} stageLabelByCarId={labels} onOpenCabinet={() => undefined} />)).toMatch(/Volvo V90.*Atvests/);
  });

  it("bez kabineta atvēršanas (piem., drukai) žetonu nav", () => {
    const html = renderHtml(<IrissLogistikaCargoPlan {...base} stageLabelByCarId={{ a: "Gaida" }} />);
    expect(html).not.toContain("iriss-log-stage-chip");
  });
});
