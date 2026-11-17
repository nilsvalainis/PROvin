// Pavadzīmju pieprasījumu rindas tīrīšanas plāns (bez IO), testi: lib/iriss-waybill-cleanup.test.ts.
// NEKAD nedzēš: izdotu pavadzīmi (status "issued" vai ir waybillNo - arī beigušos, tā ir vēsture ar PDF),
// darbu, kas šobrīd notiek (Izveido, vēl nav novecojis), un kļūdu "Pārbaudi CSDD" (pavadzīme CSDD var būt izveidota).
// Dzēš: Gaida (arī ar beigušos termiņu), Atcelts, Kļūda, novecojis Izveido bez numura + to notikumus un bāreņu notikumus.

export const IN_PROGRESS_STALE_MS = 30 * 60 * 1000;

function str(v) {
  return typeof v === "string" ? v : "";
}

function isIssued(r) {
  return r.status === "issued" || Boolean(str(r.waybillNo).trim());
}

function needsCsddCheck(r) {
  return r.status === "error" && /pārbaudi csdd/i.test(str(r.errorReason));
}

function staleInProgress(r, nowMs) {
  if (r.status !== "in_progress") return false;
  const t = Date.parse(str(r.pickedAt) || str(r.updatedAt));
  return !Number.isFinite(t) || nowMs - t > IN_PROGRESS_STALE_MS;
}

/** Kāpēc ierakstu dzēst (vai "" = paturēt). */
export function cleanupReason(r, nowMs) {
  if (!r || typeof r !== "object") return "";
  if (isIssued(r)) return "";
  if (needsCsddCheck(r)) return "";
  if (r.status === "queued") {
    const until = Date.parse(str(r.validUntil));
    return Number.isFinite(until) && until <= nowMs ? "gaida, termiņš beidzies" : "gaida";
  }
  if (r.status === "cancelled") return "atcelts";
  if (r.status === "error") return "kļūda";
  if (staleInProgress(r, nowMs)) return "novecojis izveido";
  return "";
}

/**
 * @param {{ requests?: unknown[], events?: unknown[] }} doc
 * @returns {{ next: { requests: any[], events: any[] } & Record<string, unknown>, removed: Array<{id: string, status: string, plate: string, brandModel: string, reason: string}>, removedEvents: number, kept: number }}
 */
export function planWaybillCleanup(doc, nowMs = Date.now()) {
  const requests = Array.isArray(doc?.requests) ? doc.requests : [];
  const events = Array.isArray(doc?.events) ? doc.events : [];
  const removed = [];
  const keep = [];
  for (const r of requests) {
    const reason = cleanupReason(r, nowMs);
    if (reason) {
      removed.push({
        id: str(r.id),
        status: str(r.status),
        plate: str(r.vehicle?.plate),
        brandModel: str(r.vehicle?.brandModel),
        reason,
      });
    } else keep.push(r);
  }
  const keptIds = new Set(keep.map((r) => str(r.id)));
  const keptEvents = events.filter((e) => e && keptIds.has(str(e.requestId)));
  return {
    next: { ...doc, requests: keep, events: keptEvents },
    removed,
    removedEvents: events.length - keptEvents.length,
    kept: keep.length,
  };
}
