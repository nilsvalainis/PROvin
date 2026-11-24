/** 24.11 (Nils, prod): Opel Vivaro VXEVFAHKKM7805359 - «DW10FE» / «DW10» nav pretruna garajam ielādētajam laukam. */
import { describe, expect, it } from "vitest";
import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { emptyOutvinDealerReport } from "@/lib/outvin-dealer-types";
import { findPowertrainContradictions, extractLoadedPowertrainIdentity } from "@/lib/comment-powertrain-guard";
import { checkSourceConsistency, criticalSourceIssues } from "@/lib/source-consistency";

const CODE = "(10 DY3M 4074562) DIESEL DW10FE FAP 90KW";
const RISKS =
  "AdBlue un Eolys sistēma DW10FE dzinējam prasa regulāru apkopi. Dzinēja saime DW10 ir izplatīta komercauto.";
const OIL = "(DW10FE) Intervālu dinamika: dzinēja eļļa mainīta 4 reizes. Dzinējs DW10FE ar FAP filtru prasa regulāru apkopi.";

function blocks() {
  const b = createDefaultSourceBlocks();
  const report = emptyOutvinDealerReport();
  report.vehicleInfo = { ...report.vehicleInfo, engineCode: CODE, fuel: "Diesel" };
  b.auto_records = { ...b.auto_records, outvinReport: report };
  b.csdd = { ...b.csdd, fuelType: "Dīzeļdegviela" };
  return b;
}

describe("Vivaro DW10FE - nav viltus kritiskas pretrunas", () => {
  it("findPowertrainContradictions: DW10FE un DW10 atbilst", () => {
    const id = extractLoadedPowertrainIdentity(blocks(), { vin: "VXEVFAHKKM7805359" });
    expect(findPowertrainContradictions(`${RISKS} ${OIL}`, id)).toEqual([]);
  });
  it("source-consistency (sūtīšanas dialoga kritiskās): nav ai_powertrain", () => {
    const issues = checkSourceConsistency({
      vin: "VXEVFAHKKM7805359",
      sourceBlocks: blocks(),
      texts: [
        { label: "Risku analīze", text: RISKS },
        { label: "Eļļas maiņas intervāli", text: OIL },
      ],
    });
    expect(criticalSourceIssues(issues).filter((i) => i.kind === "ai_powertrain")).toEqual([]);
  });
});

describe("Kritisko pretrunu bloks - skaidras krāsas (portālā tumšā tēma nemaina)", () => {
  it("virsraksts #dc2626, teksts #1f2937, fons gaišs", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const { CriticalSourceIssuesAlert } = await import("@/components/admin/AdminSourceConsistencyBar");
    const html = renderToStaticMarkup(
      createElement(CriticalSourceIssuesAlert, {
        issues: [{ id: "x", kind: "make", severity: "critical", title: "Marka nesakrīt", values: [{ source: "CSDD", value: "OPEL" }] }],
      }),
    );
    expect(html).toContain("color:#dc2626");
    expect(html).toContain("color:#1f2937");
    expect(html).toContain("background-color:#fef2f2");
  });
});
