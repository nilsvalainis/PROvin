import { IRISS_PD_STATUS_LV, type IrissPdStatus } from "@/lib/iriss-piedavajumi-types";

/** Statusa čips (maketi 04): krāsa + punkts, teksts vienmēr redzams. */
export function PdStatusChip({ status }: { status: IrissPdStatus }) {
  return (
    <span className={`pd-chip st-${status}`} data-status={status}>
      <i aria-hidden="true" />
      {IRISS_PD_STATUS_LV[status]}
    </span>
  );
}

/** Nils 07.11: sarakstā blakus statusam - klientam ir neatbildēts jautājums. */
export function PdQuestionTag({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="pd-chip pd-q" data-testid="pd-question-tag" title="Klientam ir neatbildēts jautājums">
      {count > 1 ? `Jautājumi: ${count}` : "Jautājums"}
    </span>
  );
}
