import { createDefaultSourceBlocks, type CsddFormFields } from "@/lib/admin-source-blocks";
import type { CsddTechDataResult } from "@/lib/csdd-tech-data";
import { normalizePlateNumber } from "@/lib/order-field-validation";
import { parseEcsddRawToCsdd } from "@/lib/vin-scan/ecsdd-facts";

/**
 * VIN SCAN v4 (`vs_<vin>`): CSDD konteksts LTAB lēmumam bez pasūtījuma.
 *
 * 26.11 (Nils: «LTAB ir pretruna!»): `POST /api/admin/vin-scan/smartid` LTAB padeva tikai VIN + numuru bez
 * CSDD statusa un bez API momentuzņēmuma, tāpēc `resolveLtabQueryTarget` atgrieza «Auto nav reģistrēts
 * Latvijā», lai gan CSDD API 1. solī rādīja LV numuru, TA un OCTA. Tagad LTAB saņem:
 *  - CSDD API atbildi (`registry`) - numurs, VIN sakritība;
 *  - e.csdd tekstu, ja jau ielasīts («Reģistrācijas statuss: Uzskaitē», numurs).
 * Numuru LTAB ņem no CSDD, ja lauks bija tukšs (skenēts tikai pēc VIN).
 */
export function vinScanLtabCsddContext(input: {
  vin: string;
  plate: string;
  api?: CsddTechDataResult | null;
  ecsddRawText?: string | null;
  now?: Date;
}): { csdd: CsddFormFields; plate: string } {
  const base: CsddFormFields = { ...createDefaultSourceBlocks().csdd, vin: input.vin };
  let plate = normalizePlateNumber(input.plate ?? "");
  let status = "";
  const raw = String(input.ecsddRawText ?? "").trim();
  if (raw) {
    const e = parseEcsddRawToCsdd(raw);
    status = String(e.registrationStatus ?? "").trim();
    if (!plate) plate = normalizePlateNumber(e.registrationNumber ?? "");
  }
  const api = input.api?.found ? input.api.data : null;
  if (api && !plate) plate = normalizePlateNumber(api.registrationNumber ?? "");
  const csdd: CsddFormFields = {
    ...base,
    registrationNumber: plate,
    ...(status ? { registrationStatus: status } : {}),
    ...(api
      ? { registry: { nr1: input.vin, fetchedAt: (input.now ?? new Date()).toISOString(), data: { ...api } } }
      : {}),
  };
  return { csdd, plate };
}
