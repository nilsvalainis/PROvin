import { describe, expect, it } from "vitest";

import { createDefaultSourceBlocks } from "@/lib/admin-source-blocks";
import { mergeDealerDataJobPatch } from "@/lib/dealer-data-job-merge";
import {
  dealerDataJobSuggestsRefund,
  describeDealerDataJob,
  normalizeDealerDataJob,
} from "@/lib/dealer-data-job-types";
import { countDealerRowsInAutoRecords, dealerJobPatchForDraftData } from "@/lib/dealer-manual-data";

const VIN = "VF1RCB00270004859";

function ar(extra: Record<string, unknown> = {}) {
  return { ...createDefaultSourceBlocks().auto_records, ...extra };
}

const noData = normalizeDealerDataJob(
  { vin: VIN, status: "no_data", attempts: 1, serviceEventCount: 0, trigger: "webhook", paidOutcomes: { oe_service_history: "no_data" } },
  "s",
)!;

describe("«Datu nav», bet dīlera dati ievadīti manuāli (BF 27.11, S7)", () => {
  it("servisa tabulas rindas -> «Ielasīts», atmaksas ieteikums pazūd", () => {
    const block = ar({
      serviceWorks: [
        { date: "07.11.2025", odometer: "120432", location: "Renault dīleris", works: "Salona filtra maiņa" },
        { date: "06.10.2023", odometer: "15566", location: "Renault dīleris", works: "Tehniskā operācija 0E22" },
      ],
      comments: "<strong>Dīlera ierakstos fiksēti ražotāja segti remonti</strong>",
    });
    expect(countDealerRowsInAutoRecords(block)).toBe(2);
    const patch = dealerJobPatchForDraftData(noData, block, "2026-11-27T10:00:00.000Z");
    expect(patch).toMatchObject({ status: "done", serviceEventCount: 2, trigger: "manual", aiGenerated: true });
    const next = normalizeDealerDataJob(mergeDealerDataJobPatch("s", noData, patch!), "s")!;
    expect(next.status).toBe("done");
    expect(dealerDataJobSuggestsRefund(next)).toBe(false);
    expect(describeDealerDataJob(next)).toBe("Ielasīts: 2 servisa ieraksti");
    expect(describeDealerDataJob(next)).not.toContain("atmaksas");
    // Maksas iznākums saglabājas («datu nav» no OneAuto) - atkārtota ielase to nepirks vēlreiz.
    expect(next.paidOutcomes?.oe_service_history).toBe("no_data");
  });

  it("tikai nobraukuma rindas (serviceHistory) arī ir dati", () => {
    const block = ar({ serviceHistory: [{ date: "07.11.2025", odometer: "120432", country: "" }] });
    expect(dealerJobPatchForDraftData(noData, block)).toMatchObject({ status: "done", serviceEventCount: 1 });
  });

  it("tukšs melnraksts, atmaksāts vai atmaksa ceļā, cits statuss - nekas nemainās", () => {
    const rows = ar({ serviceWorks: [{ date: "07.11.2025", odometer: "120432", location: "", works: "Apkope" }] });
    expect(dealerJobPatchForDraftData(noData, ar())).toBeNull();
    expect(
      dealerJobPatchForDraftData(
        { ...noData, refund: { at: "x", amountCents: 2499, stripeRefundId: "re_1", by: "a", reason: "r", kind: "stripe" } },
        rows,
      ),
    ).toBeNull();
    expect(dealerJobPatchForDraftData({ ...noData, refundPendingAt: new Date().toISOString() }, rows)).toBeNull();
    expect(dealerJobPatchForDraftData({ ...noData, status: "failed" }, rows)).toBeNull();
    expect(dealerJobPatchForDraftData(null, rows)).toBeNull();
  });

  it("bez komentāra teksta aiGenerated netiek uzstādīts", () => {
    const rows = ar({ serviceWorks: [{ date: "07.11.2025", odometer: "120432", location: "", works: "Bremžu kluči" }] });
    expect(dealerJobPatchForDraftData(noData, rows)).not.toHaveProperty("aiGenerated");
  });
});
