import { TP5_AUDITS_SAMPLE_REPORT_HREF } from "@/lib/test-pricing-5-ui-copy";

export const SAMPLE_REPORT_IDS = ["fordGalaxy"] as const;

export type SampleReportId = (typeof SAMPLE_REPORT_IDS)[number];

export type SampleReportEntry = {
  id: SampleReportId;
  href: string;
  checkoutPlan: "audits";
};

/** Publiskie atskaites paraugi (`public/samples/…`). */
export const SAMPLE_REPORTS: readonly SampleReportEntry[] = [
  {
    id: "fordGalaxy",
    href: TP5_AUDITS_SAMPLE_REPORT_HREF,
    checkoutPlan: "audits",
  },
];

export function sampleReportAnchorId(id: SampleReportId): string {
  return `paraugs-${id}`;
}
