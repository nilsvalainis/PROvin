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
