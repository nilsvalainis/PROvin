/**
 * Admin portfeļa faili pārlūkā — IndexedDB (daudz lielāka kvota nekā localStorage).
 * Tikai klienta vidē (importēt tikai no "use client" komponentēm).
 */

const DB_NAME = "provin-admin";
const DB_VERSION = 1;
const STORE = "portfolioBySession";

export type StoredPortfolioBlob = {
  id: string;
  name: string;
  size: number;
  mime: string;
  addedAt: string;
  buffer: ArrayBuffer;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function idbGetPortfolio(sessionId: string): Promise<StoredPortfolioBlob[] | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const r = tx.objectStore(STORE).get(sessionId);
    r.onsuccess = () => resolve(r.result as StoredPortfolioBlob[] | undefined);
    r.onerror = () => reject(r.error);
  });
}

export async function idbSetPortfolio(sessionId: string, entries: StoredPortfolioBlob[]): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entries, sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function idbDeletePortfolio(sessionId: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Vecais formāts: localStorage JSON ar data URL. Pārnes uz IDB un izdzēš atslēgu. */
const LEGACY_LS_KEY = (sessionId: string) => `provin-admin-portfolio-v1-${sessionId}`;

function dataUrlToBuffer(dataUrl: string): ArrayBuffer | null {
  const i = dataUrl.indexOf(",");
  if (i < 0) return null;
  const b64 = dataUrl.slice(i + 1);
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j);
    return bytes.buffer;
  } catch {
    return null;
  }
}

export async function migrateLegacyPortfolioFromLocalStorage(sessionId: string): Promise<void> {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(LEGACY_LS_KEY(sessionId));
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as {
      id: string;
      name: string;
      size: number;
      mime: string;
      addedAt: string;
      dataBase64: string;
    }[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem(LEGACY_LS_KEY(sessionId));
      return;
    }
    const existing = await idbGetPortfolio(sessionId);
    if (existing && existing.length > 0) {
      localStorage.removeItem(LEGACY_LS_KEY(sessionId));
      return;
    }
    const out: StoredPortfolioBlob[] = [];
    for (const p of parsed) {
      if (!p.dataBase64?.startsWith("data:")) continue;
      const buf = dataUrlToBuffer(p.dataBase64);
      if (!buf) continue;
      out.push({
        id: p.id,
        name: p.name,
        size: p.size,
        mime: p.mime,
        addedAt: p.addedAt,
        buffer: buf,
      });
    }
    if (out.length > 0) {
      await idbSetPortfolio(sessionId, out);
    }
    localStorage.removeItem(LEGACY_LS_KEY(sessionId));
  } catch {
    /* leave legacy; user can clear manually */
  }
}
