import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  applyWaybillPageSeen,
  waybillPageSeenNeedsWrite,
  applyTtrServerReport,
  applyTtrWorkerHeartbeat,
  workerHeartbeatNeedsWrite,
  emptyTtrControlDoc,
  parseTtrControlDoc,
  requestTtrVpnStop,
  type TtrControlDoc,
  type TtrServerReport,
} from "@/lib/iriss-ttr-control";

const DOC_KEY = "control";

const store = createJsonDocStore<TtrControlDoc>({
  blobPrefix: "iriss-ttr-control/",
  dirName: "iriss-ttr-control",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseTtrControlDoc,
  empty: emptyTtrControlDoc,
});

function stamp(doc: TtrControlDoc): TtrControlDoc {
  return { ...doc, updatedAt: new Date().toISOString() };
}

export async function readTtrControlDoc(): Promise<TtrControlDoc> {
  return store.read(DOC_KEY);
}

export async function requestTtrVpnStopStored(by: string): Promise<TtrControlDoc> {
  return store.update(DOC_KEY, (doc) => {
    const next = stamp(requestTtrVpnStop(doc, by));
    return { value: next, next };
  });
}

export async function saveTtrServerReport(report: TtrServerReport): Promise<TtrControlDoc> {
  return store.update(DOC_KEY, (doc) => {
    const next = stamp(applyTtrServerReport(doc, report));
    return { value: next, next };
  });
}

/** Pavadzīmju worker sirdspuksts (no `GET waybill-requests?scope=auto&live=0|1`). Kļūda neaptur worker poll. */
export async function noteWaybillWorkerHeartbeat(live: boolean, preloaded?: TtrControlDoc | null): Promise<void> {
  try {
    // 20.11: GET jau nolasīja dokumentu (pollMs aprēķinam) - otrreiz nelasa.
    const current = preloaded ?? (await store.read(DOC_KEY));
    if (!workerHeartbeatNeedsWrite(current, live)) return;
    await store.update(DOC_KEY, (doc) => {
      const next = stamp(applyTtrWorkerHeartbeat(doc, live));
      return { value: next, next };
    });
  } catch (err) {
    console.error("[iriss-ttr] worker_heartbeat_failed", err instanceof Error ? err.message : err);
  }
}

/**
 * Pavadzīmju lapa atvērta (admin GET): worker tad aptaujā ik 2 s. Raksta ne biežāk kā reizi 3 min; kļūda netraucē lapai.
 */
export async function noteWaybillPageSeen(): Promise<void> {
  try {
    const current = await store.read(DOC_KEY);
    if (!waybillPageSeenNeedsWrite(current)) return;
    await store.update(DOC_KEY, (doc) => {
      if (!waybillPageSeenNeedsWrite(doc)) return { value: doc };
      const next = stamp(applyWaybillPageSeen(doc));
      return { value: next, next };
    });
  } catch (err) {
    console.error("[iriss-ttr] page_seen_failed", err instanceof Error ? err.message : err);
  }
}
