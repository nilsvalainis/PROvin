import { describe, expect, it } from "vitest";
import {
  IRISS_ADVANCE_NOT_RECEIVED,
  IRISS_ADVANCE_RECEIVED,
  IRISS_DEAL_WORKFLOW_STATUSES,
  IRISS_OVERVIEW_ADD,
  formatIrissOverviewFinancingChip,
  formatIrissOverviewPlatformsLine,
  formatIrissOverviewSavedCapsule,
  irissDealWorkflowStatusOf,
  irissOverviewAdvanceReceived,
  irissOverviewEmailDisplay,
  parseIrissDealWorkflowStatus,
} from "@/lib/iriss-order-overview-view";

describe("iriss order overview view", () => {
  it("keeps deal workflow labels and display helpers", () => {
    expect(IRISS_DEAL_WORKFLOW_STATUSES.map((s) => s.label)).toEqual([
      "Jauns",
      "Meklējam",
      "Piedāvāts",
      "Avanss saņemts",
      "Nopirkts",
      "Transportā",
      "Nodots",
      "Atcelts",
    ]);
    expect(parseIrissDealWorkflowStatus("meklejam")).toBe("meklejam");
    expect(parseIrissDealWorkflowStatus("nope")).toBeUndefined();
    expect(irissDealWorkflowStatusOf(undefined)).toBe("jauns");
    expect(formatIrissOverviewSavedCapsule("18:30")).toBe("Saglabāts 18:30");
    expect(irissOverviewEmailDisplay("")).toBe(IRISS_OVERVIEW_ADD);
    expect(irissOverviewEmailDisplay("a@b.lv")).toBe("a@b.lv");
    expect(formatIrissOverviewFinancingChip(100, "2026-09-17")).toBe("Klienta finansējums 100% · 17.09");
    expect(formatIrissOverviewFinancingChip(0, "2026-09-17")).toBeNull();
    expect(irissOverviewAdvanceReceived("2026-09-17")).toBe(true);
    expect(irissOverviewAdvanceReceived("")).toBe(false);
    expect(IRISS_ADVANCE_RECEIVED).toBe("Saņemts");
    expect(IRISS_ADVANCE_NOT_RECEIVED).toBe("Nav saņemts");
    expect(formatIrissOverviewPlatformsLine(["mobile.de", "AutoScout24"])).toBe(
      "Platformas: mobile.de, AutoScout24",
    );
  });
});
