import "server-only";

import { get, put } from "@vercel/blob";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  defaultIrissCompanySettings,
  normalizeIrissCompanySettings,
  type IrissCompanySettings,
} from "@/lib/iriss-company-settings";

const DEFAULT_RELATIVE_DIR = ".data/iriss-company";
const BLOB_PREFIX = "iriss-company/";
const SETTINGS_FILENAME = "settings.json";

type ResolvedStorage =
  | { kind: "disabled" }
  | { kind: "fs"; dir: string }
  | { kind: "blob"; token: string; prefix: string };

function isNonVercelServerlessRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY);
}

function resolveStorage(): ResolvedStorage {
  const raw = process.env.ADMIN_IRISS_COMPANY_DIR?.trim() || "";
  const off = new Set(["0", "false", "no", "off", "disabled"]);
  if (raw && off.has(raw.toLowerCase())) return { kind: "disabled" };
  if (raw) return { kind: "fs", dir: path.resolve(raw) };
  if (process.env.VERCEL) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) return { kind: "disabled" };
    return { kind: "blob", token, prefix: BLOB_PREFIX };
  }
  if (isNonVercelServerlessRuntime()) {
    return { kind: "fs", dir: path.join(os.tmpdir(), "provin-iriss-company") };
  }
  return { kind: "fs", dir: path.join(process.cwd(), DEFAULT_RELATIVE_DIR) };
}

async function streamToUtf8(stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream): Promise<string> {
  if (typeof (stream as ReadableStream<Uint8Array>).getReader === "function") {
    const reader = (stream as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
  }
  const node = stream as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  for await (const chunk of node) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonFromBlob(pathname: string, token: string): Promise<unknown> {
  try {
    const res = await get(pathname, { access: "private", token, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return JSON.parse(await streamToUtf8(res.stream)) as unknown;
  } catch {
    return null;
  }
}

export function isIrissCompanySettingsStoreEnabled(): boolean {
  return resolveStorage().kind !== "disabled";
}

export async function readIrissCompanySettings(): Promise<IrissCompanySettings> {
  const r = resolveStorage();
  if (r.kind === "disabled") return defaultIrissCompanySettings();
  if (r.kind === "blob") {
    const raw = await readJsonFromBlob(`${r.prefix}${SETTINGS_FILENAME}`, r.token);
    return normalizeIrissCompanySettings(raw);
  }
  try {
    const txt = await fs.readFile(path.join(r.dir, SETTINGS_FILENAME), "utf8");
    return normalizeIrissCompanySettings(JSON.parse(txt) as unknown);
  } catch {
    return defaultIrissCompanySettings();
  }
}

export async function writeIrissCompanySettings(
  next: IrissCompanySettings,
): Promise<{ ok: true; settings: IrissCompanySettings } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  const settings = normalizeIrissCompanySettings(next);
  const body = `${JSON.stringify(settings, null, 2)}\n`;
  try {
    if (r.kind === "blob") {
      await put(`${r.prefix}${SETTINGS_FILENAME}`, body, {
        access: "private",
        token: r.token,
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true, settings };
    }
    await fs.mkdir(r.dir, { recursive: true });
    const fp = path.join(r.dir, SETTINGS_FILENAME);
    const tmp = `${fp}.tmp`;
    await fs.writeFile(tmp, body, "utf8");
    await fs.rename(tmp, fp);
    return { ok: true, settings };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function writeIrissCompanyLogo(
  bytes: Buffer,
  mimeType: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const r = resolveStorage();
  if (r.kind === "disabled") return { ok: false, error: "store_disabled" };
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const filename = `logo.${ext}`;
  try {
    if (r.kind === "blob") {
      const uploaded = await put(`${r.prefix}${filename}`, bytes, {
        access: "public",
        token: r.token,
        contentType: mimeType || "image/png",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      return { ok: true, url: uploaded.url };
    }
    await fs.mkdir(r.dir, { recursive: true });
    const fp = path.join(r.dir, filename);
    await fs.writeFile(fp, bytes);
    return { ok: true, url: `/api/admin/iriss-settings/logo?v=${Date.now()}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function readIrissCompanyLogoFile(): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const r = resolveStorage();
  if (r.kind !== "fs") return null;
  for (const [name, mime] of [
    ["logo.png", "image/png"],
    ["logo.jpg", "image/jpeg"],
    ["logo.webp", "image/webp"],
  ] as const) {
    try {
      const bytes = await fs.readFile(path.join(r.dir, name));
      return { bytes, mimeType: mime };
    } catch {
      /* try next */
    }
  }
  return null;
}
