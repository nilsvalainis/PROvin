import { TP5_AUDITS_SAMPLE_REPORT_HREF } from "@/lib/test-pricing-5-ui-copy";

export const SAMPLE_REPORT_IDS = ["fordGalaxy", "bmw525e61"] as const;

export type SampleReportId = (typeof SAMPLE_REPORT_IDS)[number];

export type SampleReportEntry = {
  id: SampleReportId;
  href: string;
  checkoutPlan: "audits";
};

const BMW_525_E61_SAMPLE_HREF = "/samples/provin-audits-bmw-525-e61.pdf";

/** Publiskie atskaites paraugi (`public/samples/…`). */
export const SAMPLE_REPORTS: readonly SampleReportEntry[] = [
  {
    id: "fordGalaxy",
    href: TP5_AUDITS_SAMPLE_REPORT_HREF,
    checkoutPlan: "audits",
  },
  {
    id: "bmw525e61",
    href: BMW_525_E61_SAMPLE_HREF,
    checkoutPlan: "audits",
  },
];

export function sampleReportAnchorId(id: SampleReportId): string {
  return `paraugs-${id}`;
}
