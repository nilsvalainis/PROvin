import "server-only";

import { get, put } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import {
  defaultIrissTameCommissionSettings,
  parseIrissTameCommissionSettings,
  type IrissTameCommissionSettings,
} from "@/lib/iriss-tame-commission";

const BLOB_PATH = "iriss-settings/tame-commission.json";
const FILE_NAME = "tame-commission.json";

function overrideDir(): string {
  return process.env.IRISS_TAME_COMMISSION_DIR?.trim() ?? "";
}

function blobToken(): string {
  if (overrideDir()) return "";
  if (process.env.NODE_ENV === "test" && process.env.IRISS_TAME_COMMISSION_ALLOW_BLOB !== "1") return "";
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
}

function fsDir(): string | null {
  const override = overrideDir();
  if (override) return override;
  if (blobToken()) return null;
  if (process.env.VERCEL === "1") return null;
  return path.join(process.cwd(), ".data", "iriss-settings");
}

async function readRaw(): Promise<unknown | null> {
  const token = blobToken();
  if (token) {
    try {
      const res = await get(BLOB_PATH, { access: "private", token, useCache: false });
      if (res?.statusCode === 200 && res.stream) {
        return JSON.parse(await new Response(res.stream).text()) as unknown;
      }
    } catch {
      return null;
    }
    return null;
  }
  const dir = fsDir();
  if (!dir) return null;
  try {
    return JSON.parse(await fs.readFile(path.join(dir, FILE_NAME), "utf8")) as unknown;
  } catch {
    return null;
  }
}

export async function readIrissTameCommissionSettings(): Promise<IrissTameCommissionSettings> {
  const raw = await readRaw();
  if (!raw) return defaultIrissTameCommissionSettings();
  return parseIrissTameCommissionSettings(raw);
}

export async function writeIrissTameCommissionSettings(raw: unknown): Promise<IrissTameCommissionSettings> {
  const next = parseIrissTameCommissionSettings(raw, new Date().toISOString());
  next.updatedAt = new Date().toISOString();
  const payload = JSON.stringify(next);
  const token = blobToken();
  if (token) {
    await put(BLOB_PATH, payload, {
      access: "private",
      token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return next;
  }
  const dir = fsDir();
  if (!dir) {
    throw new Error("Iestatījumus nevar saglabāt: nav diska un nav Blob.");
  }
  await fs.mkdir(dir, { recursive: true });
  const fp = path.join(dir, FILE_NAME);
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, fp);
  return next;
}
