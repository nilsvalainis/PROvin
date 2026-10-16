/**
 * Kopīgs, tenant-agnostisks kritēriju adapteris.
 * To lieto IRISS pasūtījumi un B2B demo. Šeit nav tīkla, nav Blob un nav tenant id.
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
