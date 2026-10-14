import type { SpeckrCompactLine, SpeckrLoadOutcome, SpeckrLoadResult } from "@/lib/speckr-api";

export type SpeckrOrderSnapshot = {
  vin: string;
  fetchedAt: string;
  result: SpeckrLoadResult;
};

export function emptySpeckrOrderSnapshot(): SpeckrOrderSnapshot | undefined {
  return undefined;
}

function parseLine(raw: unknown): SpeckrCompactLine | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = typeof o.label === "string" ? o.label.trim().slice(0, 120) : "";
  const value = typeof o.value === "string" ? o.value.trim().slice(0, 500) : "";
  if (!label || !value) return null;
  return { label, value };
}

const OUTCOMES = new Set<SpeckrLoadOutcome>(["ok", "no_data", "needs_payment", "not_configured", "error"]);

export function parseSpeckrOrderSnapshotRaw(raw: unknown): SpeckrOrderSnapshot | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const vin = typeof o.vin === "string" ? o.vin.trim().slice(0, 24) : "";
  const fetchedAt = typeof o.fetchedAt === "string" ? o.fetchedAt.slice(0, 40) : "";
  const r = o.result;
  if (!vin || !fetchedAt || !r || typeof r !== "object") return undefined;
  const ro = r as Record<string, unknown>;
  const outcomeRaw = typeof ro.outcome === "string" ? ro.outcome : "error";
  const outcome = OUTCOMES.has(outcomeRaw as SpeckrLoadOutcome) ? (outcomeRaw as SpeckrLoadOutcome) : "error";
  const summary = typeof ro.summary === "string" ? ro.summary.slice(0, 500) : "";
  const lines = Array.isArray(ro.lines) ? ro.lines.map(parseLine).filter(Boolean) as SpeckrCompactLine[] : [];
  const openUrl = typeof ro.openUrl === "string" ? ro.openUrl.slice(0, 500) : undefined;
  const errorCode = typeof ro.errorCode === "string" ? ro.errorCode.slice(0, 80) : undefined;
  let vehicle: SpeckrLoadResult["vehicle"];
  if (ro.vehicle && typeof ro.vehicle === "object") {
    const v = ro.vehicle as Record<string, unknown>;
    vehicle = {
      year: typeof v.year === "string" ? v.year.slice(0, 8) : "",
      make: typeof v.make === "string" ? v.make.slice(0, 80) : "",
      model: typeof v.model === "string" ? v.model.slice(0, 120) : "",
    };
    if (!vehicle.year && !vehicle.make && !vehicle.model) vehicle = undefined;
  }
  return {
    vin,
    fetchedAt,
    result: { outcome, summary, lines, openUrl, vehicle, errorCode },
  };
}

export function speckrOrderSnapshotHasData(snap: SpeckrOrderSnapshot | undefined): boolean {
  if (!snap?.fetchedAt) return false;
  return snap.result.outcome === "ok" || Boolean(snap.result.summary.trim());
}
