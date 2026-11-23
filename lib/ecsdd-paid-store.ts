import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import { parseAutoSmsRecord, type EcsddAutoSmsRecord } from "@/lib/ecsdd-paid-logic";

/**
 * Pēdējais "Sūtīt automātiski" pieprasījums (viens fails): pret dubultklikšķi (tas pats `id` -> otrs e-pasts netiek sūtīts)
 * un Īsceļa "Iegūt URL saturu" variantam (paņem vienreiz, tad `consumedAt`).
 * Ceļš: {dir|blobPrefix}/ecsdd_paid/auto-sms.json
 */

const FILE = "ecsdd_paid/auto-sms.json";

export async function readAutoSms(): Promise<EcsddAutoSmsRecord | null> {
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${FILE}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return parseAutoSmsRecord(JSON.parse(await new Response(res.stream).text()));
    } catch {
      /* nav faila */
    }
  }
  const dir = getOrderDraftStorageDir();
  if (dir && process.env.VERCEL !== "1") {
    try {
      return parseAutoSmsRecord(JSON.parse(await fs.readFile(path.join(dir, FILE), "utf8")));
    } catch {
      /* nav faila */
    }
  }
  return null;
}

export async function writeAutoSms(rec: EcsddAutoSmsRecord): Promise<boolean> {
  const body = JSON.stringify(rec);
  const blob = getOrderDraftBlobConfig();
  if (blob) {
    try {
      await put(`${blob.prefix}${FILE}`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return true;
    } catch {
      if (process.env.VERCEL === "1") return false;
    }
  }
  const dir = getOrderDraftStorageDir();
  if (!dir || process.env.VERCEL === "1") return false;
  try {
    const fp = path.join(dir, FILE);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(`${fp}.tmp`, body, "utf8");
    await fs.rename(`${fp}.tmp`, fp);
    return true;
  } catch {
    return false;
  }
}
