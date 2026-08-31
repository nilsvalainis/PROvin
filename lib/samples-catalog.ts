export const SAMPLE_REPORT_IDS = ["bmw525e61"] as const;

export type SampleReportId = (typeof SAMPLE_REPORT_IDS)[number];

export type SampleReportEntry = {
  id: SampleReportId;
  href: string;
  checkoutPlan: "audits";
};

/** Publiskie atskaites paraugi (`public/samples/…`). */
export const SAMPLE_REPORTS: readonly SampleReportEntry[] = [
  {
    id: "bmw525e61",
    href: "/samples/provin-audits-bmw-525-e61.pdf",
    checkoutPlan: "audits",
  },
];

export function sampleReportAnchorId(id: SampleReportId): string {
  return `paraugs-${id}`;
}
