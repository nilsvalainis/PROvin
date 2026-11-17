import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import { addDismissedWaybillId, parseDismissedWaybillDoc } from "@/lib/iriss-waybill-requests";

/**
 * "Dzēst" pavadzīmju sarakstā (j22): katram lietotājam savs paslēpto pieprasījumu ID saraksts.
 * Atsevišķa krātuve - pavadzīmju rinda, izdotās pavadzīmes, PDF, Dropbox un Arhīvs netiek aiztikti.
 */
const store = createJsonDocStore<{ version: 1; ids: string[] }>({
  blobPrefix: "iriss-waybill-dismissed/",
  dirName: "iriss-waybill-dismissed",
  isSafeKey: (key) => /^[a-z0-9_-]{1,64}$/i.test(key),
  parse: parseDismissedWaybillDoc,
  empty: () => ({ version: 1, ids: [] }),
});

function keyFor(actorId: string): string | null {
  const key = actorId.replace(/[^a-z0-9_-]/gi, "_").slice(0, 64);
  return key ? key : null;
}

export async function readDismissedWaybillIds(actorId: string): Promise<string[]> {
  const key = keyFor(actorId);
  if (!key) return [];
  return (await store.read(key)).ids;
}

export async function dismissWaybillRequestForActor(actorId: string, requestId: string): Promise<string[]> {
  const key = keyFor(actorId);
  if (!key) return [];
  return store.update(key, (doc) => {
    const ids = addDismissedWaybillId(doc.ids, requestId);
    return { value: ids, next: { version: 1, ids } };
  });
}
