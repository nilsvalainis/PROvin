import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
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
export async function noteWaybillWorkerHeartbeat(live: boolean): Promise<void> {
  try {
    const current = await store.read(DOC_KEY);
    if (!workerHeartbeatNeedsWrite(current, live)) return;
    await store.update(DOC_KEY, (doc) => {
      const next = stamp(applyTtrWorkerHeartbeat(doc, live));
      return { value: next, next };
    });
  } catch (err) {
    console.error("[iriss-ttr] worker_heartbeat_failed", err instanceof Error ? err.message : err);
  }
}
