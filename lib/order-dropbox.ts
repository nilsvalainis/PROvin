import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import { getOrderDraftBlobConfig, getOrderDraftStorageDir, isSafeOrderDraftSessionId, readOrderDraft } from "@/lib/admin-order-draft-store";
import { mergeSourceBlocksWithDefaults } from "@/lib/admin-source-blocks";
import { DropboxApiError, getDropboxClient, type DropboxClient } from "@/lib/dropbox-client";
import { sanitizeDropboxName } from "@/lib/iriss-autoparks-dropbox-path";
import {
  orderDropboxFolderName,
  orderDropboxParentPath,
  orderDropboxShouldRename,
  parseOrderDropboxRecord,
  type OrderDropboxCategory,
  type OrderDropboxRecord,
} from "@/lib/order-dropbox-folder";

/**
 * PROVIN pasūtījuma Dropbox mape (servera puse): izveide uzreiz pēc pasūtījuma, pārdēvēšana, kad zināma marka/modelis,
 * failu saglabāšana. Nekad neizmet kļūdu uz augšu - pasūtījums neapstājas; kļūda paliek ierakstā (admin rāda sarkanā).
 * Ieraksts: {draft dir|blob prefix}/order_dropbox/<sessionId>.json
 */

const LOG = "[order-dropbox]";
const DIR = "order_dropbox";

export async function readOrderDropboxRecord(sessionId: string): Promise<OrderDropboxRecord | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const file = `${DIR}/${sessionId}.json`;
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${file}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return parseOrderDropboxRecord(JSON.parse(await new Response(res.stream).text()));
    } catch {
      /* nav ieraksta */
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return parseOrderDropboxRecord(JSON.parse(await fs.readFile(path.join(dir, file), "utf8")));
    } catch {
      /* nav ieraksta */
    }
  }
  return null;
}

async function writeRecord(rec: OrderDropboxRecord): Promise<void> {
  const file = `${DIR}/${rec.sessionId}.json`;
  const body = JSON.stringify(rec);
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${file}`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return;
    } catch (e) {
      if (process.env.VERCEL === "1") throw e;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return;
  const fp = path.join(dir, file);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body, "utf8");
}

type CarParts = { make: string; model: string; plate: string; vin: string };

async function carFromDraft(sessionId: string, fallback: { vin?: string | null; plate?: string | null }): Promise<CarParts> {
  const draft = await readOrderDraft(sessionId).catch(() => null);
  const csdd = mergeSourceBlocksWithDefaults(draft?.workspace?.sourceBlocks ?? {}).csdd;
  const reg = csdd.registry?.data;
  const [makeFromForm, ...modelParts] = (csdd.makeModel ?? "").trim().split(/\s+/);
  const vinOrPlate = (fallback.vin ?? "").trim();
  return {
    make: (reg?.make || makeFromForm || "").trim(),
    model: (reg?.model || modelParts.join(" ") || "").trim(),
    plate: (reg?.registrationNumber || csdd.registrationNumber || draft?.orderEdits?.licensePlate || fallback.plate || vinOrPlate || "").trim(),
    vin: (reg?.vin || csdd.vin || draft?.orderEdits?.vin || vinOrPlate || "").trim(),
  };
}

function errCode(e: unknown): string {
  if (e instanceof DropboxApiError) return `dropbox_${e.status}${e.summary ? `:${e.summary.slice(0, 80)}` : ""}`;
  return e instanceof Error ? e.message.slice(0, 120) : "unknown";
}

/**
 * Izveido (vai atrod) pasūtījuma mapi un, ja parādījusies marka/modelis/VIN, pārdēvē to. Idempotenti.
 * `category` vajag pirmajā reizē (pēc tam ņem no ieraksta). Atgriež ierakstu vai null (nav kategorijas / Dropbox).
 */
export async function ensureOrderDropboxFolder(
  sessionId: string,
  opts: { category?: OrderDropboxCategory | null; createdMs?: number; vin?: string | null; plate?: string | null; client?: DropboxClient | null } = {},
): Promise<OrderDropboxRecord | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  const prev = await readOrderDropboxRecord(sessionId);
  const category = prev?.category ?? opts.category ?? null;
  if (!category) return null;
  const now = new Date().toISOString();
  const orderCreatedMs = prev?.orderCreatedMs ?? opts.createdMs ?? Date.now();
  const base: OrderDropboxRecord = {
    sessionId,
    category,
    state: prev?.state ?? "error",
    ...(prev?.folderId ? { folderId: prev.folderId } : {}),
    ...(prev?.path ? { path: prev.path } : {}),
    orderCreatedMs,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  const client = opts.client === undefined ? getDropboxClient() : opts.client;
  if (!client) {
    if (prev?.state === "ok") return prev;
    const rec = { ...base, state: "error" as const, error: "not_configured" };
    await writeRecord(rec).catch(() => undefined);
    return rec;
  }
  try {
    const car = await carFromDraft(sessionId, opts);
    const desiredName = orderDropboxFolderName({ sessionId, category, createdMs: orderCreatedMs, ...car });
    const parent = orderDropboxParentPath(category);
    if (prev?.state === "ok" && prev.folderId) {
      const meta = await client.getMetadata(prev.folderId);
      if (meta && meta.tag === "folder") {
        let current = meta.pathDisplay || prev.path || "";
        if (orderDropboxShouldRename(meta.name, desiredName)) {
          try {
            const moved = await client.move(current, `${parent}/${desiredName}`, { autorename: false });
            current = moved.pathDisplay || `${parent}/${desiredName}`;
          } catch (e) {
            // Ja tāda mape jau ir (cits pasūtījums ar to pašu auto un dienu) - paliek vecais nosaukums.
            console.warn(`${LOG} rename skipped`, { sessionId: sessionId.slice(-8), error: errCode(e) });
          }
        }
        if (current === prev.path) return prev;
        const rec = { ...base, state: "ok" as const, path: current };
        delete (rec as Partial<OrderDropboxRecord>).error;
        await writeRecord(rec);
        return rec;
      }
      // Mape izdzēsta vai pārvietota ārpus Dropbox - izveido no jauna.
    }
    const entry = await client.ensureFolder(`${parent}/${desiredName}`);
    const rec: OrderDropboxRecord = { ...base, state: "ok", folderId: entry.id || undefined, path: entry.pathDisplay || `${parent}/${desiredName}` };
    delete rec.error;
    await writeRecord(rec);
    return rec;
  } catch (e) {
    console.error(`${LOG} ensure failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    const rec = { ...base, state: prev?.state === "ok" ? ("ok" as const) : ("error" as const), error: errCode(e) };
    await writeRecord(rec).catch(() => undefined);
    return rec;
  }
}

/**
 * Fails pasūtījuma mapē. Tas pats nosaukums otrreiz netiek dublēts (`add` bez autorename -> konflikts = jau ir).
 * Atgriež Dropbox ceļu vai null (kļūda ierakstīta logā; pasūtījums neapstājas).
 */
export async function saveFileToOrderDropboxFolder(
  sessionId: string,
  fileName: string,
  bytes: Uint8Array,
): Promise<{ path: string; duplicate: boolean } | null> {
  const client = getDropboxClient();
  if (!client) return null;
  const rec = await ensureOrderDropboxFolder(sessionId, { client });
  if (!rec || rec.state !== "ok" || !rec.path) return null;
  const name = sanitizeDropboxName(fileName, 140) || "fails.pdf";
  const target = `${rec.path}/${name}`;
  try {
    const up = await client.upload(target, bytes, "add", { autorename: false });
    return { path: up.pathDisplay || target, duplicate: false };
  } catch (e) {
    if (e instanceof DropboxApiError && e.conflict) return { path: target, duplicate: true };
    console.error(`${LOG} upload failed`, { sessionId: sessionId.slice(-8), error: errCode(e) });
    return null;
  }
}

/** Pēc apmaksas / izveides: tikai fona solis, kļūda neaptur pasūtījumu. */
export function ensureOrderDropboxFolderSafe(
  sessionId: string,
  opts: Parameters<typeof ensureOrderDropboxFolder>[1],
): Promise<void> {
  return ensureOrderDropboxFolder(sessionId, opts).then(
    () => undefined,
    (e) => console.error(`${LOG} ensure crashed`, e instanceof Error ? e.message.slice(0, 120) : "unknown"),
  );
}
