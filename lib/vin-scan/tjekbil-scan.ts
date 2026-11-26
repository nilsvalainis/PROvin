/**
 * tjekbil.dk VIN SCAN rinda ar to pašu datu apjomu, ko pasūtījuma sēkla (`fetchTjekbil`):
 * nobraukuma žurnāls, apskates, meklēto TL vēsture un RAPEX. Līdz 26.11 VIN SCAN lasīja tikai DMR `basic`.
 * Tīra loģika (bez tīkla).
 */
import { asArray, asRecord, str } from "@/lib/vin-sources/dk-json";
import { mapTjekbilPayload, tjekbilLiens, type TjekbilDmrResponse } from "@/lib/vin-sources/tjekbil-map";
import type { TjekbilExtras } from "@/lib/vin-sources/tjekbil";
import type { VinScanParse, VinScanRecall } from "@/lib/vin-scan/types";

function rapexRecalls(rapex: unknown): VinScanRecall[] {
  return asArray(rapex).map((item) => {
    const r = asRecord(item);
    const title =
      str(r.title) || str(r.name) || str(r.product) || str(r.description) || str(r.reference) || "RAPEX brīdinājums";
    const date = str(r.date) || str(r.publicationDate) || str(r.created);
    return date ? { title, date } : { title };
  });
}

export function tjekbilScanWithExtras(base: VinScanParse, dmr: TjekbilDmrResponse, extras: TjekbilExtras): VinScanParse {
  if (base.status !== "found") return base;
  const mapped = mapTjekbilPayload({ dmr, mileagelogs: extras.mileagelogs, wanted: extras.wanted, rapex: extras.rapex });
  const wanted = (extras.wanted?.length ?? 0) > 0;
  const lien = tjekbilLiens(dmr).length > 0;
  const recalls = rapexRecalls(extras.rapex);
  const inspections = mapped.timeline
    .filter((row) => row.date && /apskate/i.test(row.event))
    .map((row) => ({
      date: row.date,
      result: row.event.includes(":") ? row.event.slice(row.event.indexOf(":") + 1).trim() : row.event,
      ...(row.odometer ? { odometer: row.odometer } : {}),
    }));
  const detail = [base.detail, mapped.ownersSummary, mapped.statusRecords, ...mapped.notes].filter(Boolean).join("\n");
  return {
    ...base,
    detail,
    mileage: mapped.mileage.map((row) => ({ date: row.date, odometer: row.odometer })),
    ...(inspections.length ? { inspections } : {}),
    ...(recalls.length ? { recalls } : {}),
    flags: {
      ...base.flags,
      registrationCountry: "DK",
      ...(wanted ? { wanted: true } : {}),
      ...(lien ? { lien: true } : {}),
      ...(recalls.length ? { recallCount: recalls.length } : {}),
    },
  };
}
