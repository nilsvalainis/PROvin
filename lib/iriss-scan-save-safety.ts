/**
 * IRISS SCAN (Radars) revīzija + 409, analogiski pasūtījumu workspaceRevision.
 */

import {
  IRISS_STALE_REVISION,
  irissRevisionMatches,
  irissWorkspaceRevision,
  nextIrissWorkspaceRevision,
  parseExpectedIrissRevision,
} from "@/lib/iriss-pasutijumi-save-safety";
import type { IrissScanRecord } from "@/lib/iriss-scan-types";

export { IRISS_STALE_REVISION, irissRevisionMatches, parseExpectedIrissRevision };

export function irissScanWorkspaceRevision(rec: Pick<IrissScanRecord, "workspaceRevision"> | null | undefined): number {
  return irissWorkspaceRevision(rec);
}

export function nextIrissScanWorkspaceRevision(existing: number): number {
  return nextIrissWorkspaceRevision(existing);
}

function preferFilled(local: string, server: string): string {
  return local.trim() ? local : server;
}

function mergeScanLinks(local: string[], server: string[]): string[] {
  const filled = local.filter((s) => s.trim());
  return filled.length > 0 ? local : server;
}

/** Drošā apvienošana pēc 409: aizpildītais uzvar tukšo. */
export function mergeIrissScanRecords(server: IrissScanRecord, local: IrissScanRecord): IrissScanRecord {
  return {
    ...server,
    ...local,
    id: server.id,
    createdAt: server.createdAt || local.createdAt,
    workspaceRevision: irissScanWorkspaceRevision(server),
    brandModel: preferFilled(local.brandModel, server.brandModel),
    vin: preferFilled(local.vin, server.vin),
    productionYears: preferFilled(local.productionYears, server.productionYears),
    engineType: preferFilled(local.engineType, server.engineType),
    transmission: preferFilled(local.transmission, server.transmission),
    bodyType: preferFilled(local.bodyType, server.bodyType),
    vehicleCategory: local.vehicleCategory || server.vehicleCategory,
    apifyMobiledeEnabled: local.apifyMobiledeEnabled,
    apifyAutoscout24Enabled: local.apifyAutoscout24Enabled,
    listingLinkMobile: mergeScanLinks(local.listingLinkMobile, server.listingLinkMobile),
    listingLinkAutobid: mergeScanLinks(local.listingLinkAutobid, server.listingLinkAutobid),
    listingLinkOpenline: mergeScanLinks(local.listingLinkOpenline, server.listingLinkOpenline),
    listingLinkAuto1: mergeScanLinks(local.listingLinkAuto1, server.listingLinkAuto1),
    listingLinkEcarstrade: mergeScanLinks(local.listingLinkEcarstrade, server.listingLinkEcarstrade),
    listingLinksOther: mergeScanLinks(local.listingLinksOther, server.listingLinksOther),
  };
}

export type PrepareIrissScanWriteResult =
  | { ok: true; record: IrissScanRecord }
  | { ok: false; error: typeof IRISS_STALE_REVISION; record: IrissScanRecord };

export function prepareIrissScanWrite(
  existing: IrissScanRecord | null,
  incoming: IrissScanRecord,
  expected: number | null,
  nowIso: string,
): PrepareIrissScanWriteResult {
  const existingRev = irissScanWorkspaceRevision(existing);
  if (existing && !irissRevisionMatches(existingRev, expected)) {
    return { ok: false, error: IRISS_STALE_REVISION, record: existing };
  }
  return {
    ok: true,
    record: {
      ...incoming,
      id: existing?.id ?? incoming.id,
      createdAt: existing?.createdAt ?? incoming.createdAt ?? nowIso,
      updatedAt: nowIso,
      workspaceRevision: nextIrissScanWorkspaceRevision(existingRev),
    },
  };
}
