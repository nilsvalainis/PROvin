import "server-only";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  applyCsddPlatesReport,
  emptyCsddPlatesDoc,
  parseCsddPlatesDoc,
  type CsddPlateEntry,
  type CsddPlatesDoc,
} from "@/lib/iriss-waybill-csdd-plates";

const DOC_KEY = "plates";

const store = createJsonDocStore<CsddPlatesDoc>({
  blobPrefix: "iriss-waybill-csdd-plates/",
  dirName: "iriss-waybill-csdd-plates",
  isSafeKey: (key) => key === DOC_KEY,
  parse: parseCsddPlatesDoc,
  empty: emptyCsddPlatesDoc,
});

export async function readCsddPlatesDoc(): Promise<CsddPlatesDoc> {
  return store.read(DOC_KEY);
}

/** Nolasīšanas kļūda -> null (numuru stāvoklis tad tikai no indeksa, kā līdz šim). */
export async function readCsddPlatesDocSafe(): Promise<CsddPlatesDoc | null> {
  try {
    return await store.read(DOC_KEY);
  } catch (err) {
    console.error("[iriss-waybill] csdd_plates_read_failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function saveCsddPlatesReport(entries: CsddPlateEntry[]): Promise<CsddPlatesDoc> {
  return store.update(DOC_KEY, (doc) => {
    const next = applyCsddPlatesReport(doc, entries);
    return { value: next, next };
  });
}
