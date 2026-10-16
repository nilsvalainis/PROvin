/**
 * Kopīgs, tenant-agnostisks kritēriju adapteris.
 * Rezultāts ir atmiņā. To neraksta atpakaļ esošā pasūtījumā.
 * B2B demo to varēs saukt pēc tam, kad `B2bDemoOrder` dabūs `criteria?`.
 * Šeit nav tīkla, nav Blob, nav tenant id un nav importa no `lib/b2b-demo-*`.
 */

import { readIrissCriteria, type IrissCriteriaMigrationInput } from "@/lib/iriss-criteria-migrate";
import type { IrissCriteriaV1 } from "@/lib/iriss-criteria-types";

export {
  attachIrissCriteria,
  migrateIrissCriteria,
  readIrissCriteria,
  type IrissCriteriaMigrationInput,
} from "@/lib/iriss-criteria-migrate";
export { filterToSearchFilter } from "@/lib/iriss-criteria-shared/to-search-filter";
export {
  IRISS_CRITERIA_FILTER_FIELDS,
  IRISS_CRITERIA_MANDATORY_FIELDS,
  IRISS_CRITERIA_VERSION,
  emptyIrissCriteria,
  emptyIrissCriteriaFilter,
  irissCriteriaMandatoryGaps,
  parseIrissCriteriaV1,
  type IrissCriteriaFilter,
  type IrissCriteriaV1,
} from "@/lib/iriss-criteria-types";
export {
  confirmedNumericCodes,
  normalizeBody,
  normalizeDrive,
  normalizeEmission,
  normalizeFuel,
  normalizeGearbox,
  normalizePowerKw,
  type AuctionPlatform,
} from "@/lib/iriss-criteria-taxonomy";

/** Tas pats lasītājs abām pusēm. Nosaukums bez IRISS veikala. */
export function readSharedOrderCriteria(source: IrissCriteriaMigrationInput): IrissCriteriaV1 {
  return readIrissCriteria(source);
}

export function attachSharedOrderCriteria<T extends IrissCriteriaMigrationInput>(
  record: T,
): T & { criteria: IrissCriteriaV1 } {
  return { ...record, criteria: readIrissCriteria(record) };
}
