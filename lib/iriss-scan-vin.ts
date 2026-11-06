import { isValidVin, normalizeVin } from "@/lib/order-field-validation";
import { irissCriteriaIsOperatorAuthored, parseIrissCriteriaV1 } from "@/lib/iriss-criteria-types";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export function irissScanVinFromQuery(raw: string | undefined): string {
  const v = normalizeVin(raw ?? "");
  return isValidVin(v) ? v : "";
}

export function irissScanHasOperatorContent(
  rec: Pick<IrissScanRecord, "brandModel" | "vin" | "listingLinkMobile" | "listingLinkAutobid" | "listingLinkOpenline" | "listingLinkAuto1" | "listingLinkEcarstrade" | "listingLinksOther"> &
    Partial<Pick<IrissScanRecord, "criteria">>,
): boolean {
  if (rec.brandModel.trim() || rec.vin.trim()) return true;
  // Operators aizpildīja kritērijus (marka, gadi...) vēl pirms nosaukuma.
  if (irissCriteriaIsOperatorAuthored(parseIrissCriteriaV1(rec.criteria))) return true;
  return [
    ...rec.listingLinkMobile,
    ...rec.listingLinkAutobid,
    ...rec.listingLinkOpenline,
    ...rec.listingLinkAuto1,
    ...rec.listingLinkEcarstrade,
    ...rec.listingLinksOther,
  ].some((s) => s.trim());
}
