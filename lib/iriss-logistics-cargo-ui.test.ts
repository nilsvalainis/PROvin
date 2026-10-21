import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterLogisticsOrdersByView } from "@/lib/iriss-logistics-archive";

const client = readFileSync("components/admin/iriss-logistika/IrissLogistikaClient.tsx", "utf8");
const css = readFileSync("app/admin/iriss/logistika/iriss-logistika.css", "utf8");
const plan = readFileSync("components/admin/iriss-logistika/IrissLogistikaCargoPlan.tsx", "utf8");
const table = readFileSync("components/admin/iriss-logistika/IrissLogistikaCarsTable.tsx", "utf8");
const popup = readFileSync("components/admin/iriss-logistika/IrissLogistikaCarPopup.tsx", "utf8");
const map = readFileSync("components/admin/iriss-logistika/IrissLogistikaMap.tsx", "utf8");

describe("IRISS Loģistika kravu plāns UI", () => {
  it("scopes cargo tokens to Loģistika and keeps statuses grey", () => {
    expect(css).toContain(".iriss-log-screen {");
    expect(css).toContain("--iriss-log-cargo-next: #1e9e57");
    expect(css).toContain("--krava-next2: #5e5ce6");
    expect(css).toContain("--iriss-log-cargo-none: #3a3a3c");
    expect(css).not.toContain("#0a7cff");
    expect(css).toContain("--iriss-log-cargo-after: var(--krava-next2)");
    expect(css).toContain("--btn-dark-bg:");
    expect(css).toContain("--iriss-log-status-chip-bg: #f2f2f7");
    expect(css).toContain("--iriss-log-focus: #2563eb");
    expect(css).not.toMatch(/--iriss-log-cargo-next:[^;]*#188038/);
    expect(table).toContain("iriss-log-stage");
    expect(css).toContain(".iriss-log-screen .iriss-log-stage button.on {");
    expect(table).not.toContain("#1e9e57");
    expect(plan).not.toContain("#1e9e57");
  });

  it("wires cargo plan, bounce, table and WhatsApp without touching Reisi as a status", () => {
    expect(client).toContain("IrissLogistikaCargoPlan");
    expect(client).toContain("IrissLogistikaCarsTable");
    expect(client).toContain("IrissLogistikaCarPopup");
    expect(client).toContain("IrissLogistikaRouteTemplatesPanel");
    expect(client).toContain("pinVariant");
    expect(client).toContain("setBounceId");
    expect(plan).toContain("Maršruts");
    expect(plan).toContain("Atvērt Google Maps");
    expect(plan).not.toContain("Kopēt maršrutu");
    expect(plan).toContain("Sastādīt maršrutu kartē");
    expect(table).toContain("Uz Autoparku");
    expect(popup).toContain("Sūtīt šoferim");
    expect(popup).toContain("AdminWhatsAppOpenButton");
    expect(popup).toContain("Kopēt visu");
    expect(map).toContain("makeCargoLayerOverlay");
    expect(map).toContain("iriss-log-pin-wrap");
    expect(client).not.toMatch(/\u2014/);
    expect(plan).not.toMatch(/\u2014/);
  });

  it("backs the Reisi list view with active cars", () => {
    expect(filterLogisticsOrdersByView([{ archived: false, status: "ready" } as never], "trips")).toHaveLength(1);
  });
});
