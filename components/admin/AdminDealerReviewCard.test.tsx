import { describe, expect, it } from "vitest";
import {
  AdminDealerReviewCard,
  AdminDealerReviewGlassCard,
  AdminDealerReviewIndicator,
} from "@/components/admin/AdminDealerReviewCard";
import { MobileDealerOrderPanelView } from "@/components/admin/mobile/MobileDealerOrderPanel";
import { adminIngestFromDealerJob } from "@/lib/admin-mobile-ingest";
import { scoreDealerReview, type DealerReviewScoreInput } from "@/lib/dealer-review-score";
import { renderHtml, renderText } from "@/lib/test-render";

const noop = () => undefined;

const TAXI: DealerReviewScoreInput = {
  dataState: "data",
  refunded: false,
  recordCount: 8,
  firstDate: "15.06.2010",
  lastDate: "22.11.2018",
  orderDateMs: Date.parse("2026-11-22T12:00:00Z"),
  majorWorks: [],
  odometerDrops: [],
  campaignsDone: false,
  oilCoveragePct: 76,
  paintSigns: [],
  taxiSignals: [
    { kind: "taxi", text: "965 ELECTR. PROVISION FOR HIRED CARS / TAXICAB" },
    { kind: "taxi", text: "937 REINFORCEMENT PACKAGE" },
  ],
  annualKm: null,
  totalLoss: false,
  auditsPurchased: false,
  shadowVerdict: "would_send",
};
const NO_DATA: DealerReviewScoreInput = { ...TAXI, dataState: "no_data", recordCount: 0, taxiSignals: [], refunded: true };

describe("AdminDealerReviewCard (dators)", () => {
  it("TAXI: augsta 74/100, lūgt tagad, AUDITS maz ticams, atrunājošs atradums", () => {
    const review = scoreDealerReview(TAXI);
    const html = renderHtml(<AdminDealerReviewCard review={review} orderDate="22.11.2026" />);
    expect(html).toContain('data-dealer-review="high"');
    const text = renderText(<AdminDealerReviewCard review={review} orderDate="22.11.2026" />);
    for (const t of [
      "Atsauksme un AUDITS",
      "pasūtīts 22.11.2026",
      "Augsta",
      "74/100",
      "Lūgt tagad, kopā ar PDF e-pastu",
      "Maz ticams",
      "Atrunājošs atradums:",
      "Taxi kodi 965 + 937 rūpnīcas komplektācijā",
      "8 ieraksti",
      "20/25",
    ]) {
      expect(text).toContain(t);
    }
  });

  it("datu nav: Nelūgt bez punktiem", () => {
    const text = renderText(<AdminDealerReviewCard review={scoreDealerReview(NO_DATA)} />);
    expect(text).toContain("Nelūgt");
    expect(text).toContain("Nav vērtēts");
    expect(text).not.toContain("/100");
  });
});

describe("AdminDealerReviewGlassCard (telefons)", () => {
  it("rāda līmeni, AUDITS un 5 iemeslus + «Vēl N iemesli»", () => {
    const review = scoreDealerReview(TAXI);
    const text = renderText(<AdminDealerReviewGlassCard review={review} />);
    expect(text).toContain("Atsauksme un AUDITS");
    expect(text).toContain("lūgt tagad · 74");
    expect(text).toContain("TAXI");
    expect(text).toContain(`Vēl ${review.reasons.length - 5} iemesli`);
  });

  it("B1 skatā kartīte zem darbību režģa, pogas paliek", () => {
    const text = renderText(
      <MobileDealerOrderPanelView
        ingest={adminIngestFromDealerJob({ status: "done", serviceEventCount: 8 }, false)}
        statusSub=""
        sentLabel="Nav nosūtīts"
        records={[]}
        aiFields={[]}
        busy={null}
        pdfDisabled={false}
        sendDisabled={false}
        refundEnabled={false}
        refundLabel="Atmaksa"
        rerunEnabled
        rerunLabel="Ielasīt vēlreiz"
        notice={null}
        onPdf={noop}
        onSend={noop}
        onRefund={noop}
        onRerun={noop}
        onShowAllRecords={noop}
        onEditAi={noop}
        review={scoreDealerReview(TAXI)}
      />,
    );
    expect(text.indexOf("Ielasīt vēlreiz")).toBeLessThan(text.indexOf("Atsauksme un AUDITS"));
    expect(text.indexOf("Atsauksme un AUDITS")).toBeLessThan(text.indexOf("Pārbaude"));
  });
});

describe("AdminDealerReviewIndicator (sūtīšanas forma)", () => {
  it("mazs indikators: līmenis, punkti, ieteikums, AUDITS", () => {
    const text = renderText(<AdminDealerReviewIndicator review={scoreDealerReview(TAXI)} />);
    expect(text).toContain("augsta · 74");
    expect(text).toContain("Lūgt tagad · AUDITS: maz ticams");
  });
});
