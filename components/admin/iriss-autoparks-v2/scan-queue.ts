"use client";

/**
 * Bezsaistes skenēšanas rinda (T9): skenējums vispirms tiek saglabāts telefonā (IndexedDB), tad augšupielādēts
 * pa vienam. Lokālo kopiju dzēš TIKAI pēc veiksmīgas atbildes (200, vai 409 - jau saglabāts).
 * Kļūda (nav tīkla, 503) -> paliek rindā ar "Neizdevās" un pogu "VĒLREIZ"; tīklam atgriežoties - automātiski.
 */
import { uploadScanPages, type ScanTarget, type ScanUploadResult } from "./scan-upload";

export type QueuedScan = {
  id: string;
  carId: string;
  target: ScanTarget;
  invoiceId?: string;
  title: string;
  pages: Blob[];
  createdAt: string;
  state: "waiting" | "uploading" | "failed";
  progress: number;
};

export type QueueStore = {
  all(): Promise<QueuedScan[]>;
  put(item: QueuedScan): Promise<void>;
  remove(id: string): Promise<void>;
};

type Uploader = (item: QueuedScan, onProgress: (p: number) => void) => Promise<ScanUploadResult>;

/** 409 = tas pats skenējums jau ir serverī -> arī drīkst dzēst lokāli. */
export function uploadSucceeded(res: ScanUploadResult): boolean {
  return res.ok || res.status === 409;
}

let draining: Promise<number> | null = null;

/**
 * Augšupielādē rindu pa vienam (vecākie pirmie). `onlyFailed=false` - arī "Neizdevās" ierakstus (VĒLREIZ / tīkls atpakaļ).
 * Atgriež, cik augšupielādēja. Paralēli izsaukumi gaida to pašu darbu (nav dubultas augšupielādes).
 */
export function drainScanQueue(store: QueueStore, upload: Uploader, onChange: () => void): Promise<number> {
  if (draining) return draining;
  draining = (async () => {
    let done = 0;
    const items = (await store.all()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of items) {
      const cur: QueuedScan = { ...item, state: "uploading", progress: 0 };
      await store.put(cur);
      onChange();
      let res: ScanUploadResult;
      try {
        res = await upload(cur, (p) => {
          cur.progress = p;
          void store.put({ ...cur }).then(onChange);
        });
      } catch {
        res = { ok: false, status: 0 };
      }
      if (uploadSucceeded(res)) {
        await store.remove(item.id);
        done += 1;
      } else {
        await store.put({ ...cur, state: "failed", progress: 0 });
      }
      onChange();
    }
    return done;
  })().finally(() => {
    draining = null;
  });
  return draining;
}

export const defaultUploader: Uploader = (item, onProgress) =>
  uploadScanPages(item.carId, item.target, item.pages, { invoiceId: item.invoiceId, onProgress });

const DB = "provin-autoparks-v2";
const STORE = "scan-queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
}

/** IndexedDB krātuve (telefonā paliek arī pēc lapas aizvēršanas). */
export const idbQueueStore: QueueStore = {
  all: () => tx("readonly", (s) => s.getAll() as IDBRequest<QueuedScan[]>),
  put: (item) => tx("readwrite", (s) => s.put(item)).then(() => undefined),
  remove: (id) => tx("readwrite", (s) => s.delete(id)).then(() => undefined),
};

export async function enqueueScan(item: Omit<QueuedScan, "id" | "createdAt" | "state" | "progress">, store: QueueStore = idbQueueStore): Promise<QueuedScan> {
  const q: QueuedScan = {
    ...item,
    id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    state: "waiting",
    progress: 0,
  };
  await store.put(q);
  return q;
}
