import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const blobs = new Map<string, string>();
const puts: string[] = [];

vi.mock("@vercel/blob", () => ({
  list: async ({ prefix }: { prefix: string }) => ({
    blobs: [...blobs.keys()].filter((k) => k.startsWith(prefix)).map((pathname) => ({ pathname })),
    hasMore: false,
  }),
  get: async (pathname: string) => {
    const body = blobs.get(pathname);
    if (body === undefined) return null;
    return { statusCode: 200, stream: new Response(body).body };
  },
  put: async (pathname: string, body: string) => {
    blobs.set(pathname, body);
    puts.push(pathname);
    return { pathname };
  },
}));

vi.mock("@/lib/iriss-pasutijumi-store", () => ({
  getIrissPasutijumiStorageDir: () => null,
  getIrissPasutijumiStorageState: () => ({ enabled: false, reason: "test" }),
}));
vi.mock("@/lib/iriss-scan-store", () => ({
  getIrissScanStorageDir: () => null,
  getIrissScanStorageState: () => ({ enabled: false }),
  IRISS_SCAN_BLOB_PREFIX: "iriss-scan/",
}));
vi.mock("@/lib/iriss-pavadzimes-store", () => ({
  getIrissPavadzimesStorageDir: () => null,
  IRISS_PAVADZIMES_BLOB_PREFIX: "iriss-pavadzimes/",
}));

import { runDailyAdminDraftBackup } from "@/lib/admin-drafts-daily-backup";
import { normalizeSnapshot, planRestore } from "../scripts/admin-daily-backup-restore.mjs";

const ENV_KEYS = [
  "VERCEL",
  "BLOB_READ_WRITE_TOKEN",
  "ADMIN_ORDER_DRAFT_BLOB_PREFIX",
  "ADMIN_ORDER_DRAFT_DIR",
  "ADMIN_CONSULTATION_DRAFT_DIR",
  "ADMIN_DRAFT_BACKUP_FS_ROOT",
  "ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB",
  "ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB",
] as const;

const ORDER = { sessionId: "cs_test_a1B2c3", vin: "WVWZZZ7NZEV015204", invoiceNumber: "PV-2026-0042" };

let tmp = "";
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  blobs.clear();
  puts.length = 0;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "provin-backup-test-"));
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  /** Fails, nevis mape - `mkdir` zem tā krīt kā Vercel read-only `/var/task`. */
  const blocker = path.join(tmp, "readonly");
  fs.writeFileSync(blocker, "");
  process.env.VERCEL = "1";
  process.env.BLOB_READ_WRITE_TOKEN = "test-token";
  process.env.ADMIN_ORDER_DRAFT_BLOB_PREFIX = "admin-order-drafts";
  process.env.ADMIN_ORDER_DRAFT_DIR = "off";
  process.env.ADMIN_CONSULTATION_DRAFT_DIR = "off";
  process.env.ADMIN_DRAFT_BACKUP_FS_ROOT = path.join(blocker, "backups");

  blobs.set(`admin-order-drafts/${ORDER.sessionId}.json`, JSON.stringify(ORDER));
  blobs.set("admin-order-drafts/manual_order_1700000000000_ab12.json", JSON.stringify({ manual: true }));
  blobs.set("admin-order-drafts/_meta/invoice-year-sequence.json", JSON.stringify({ year: 2026, seq: 42 }));
  blobs.set("admin-order-drafts/order_upsell/cs_test_a1B2c3.json", JSON.stringify({ parentSessionId: ORDER.sessionId }));
  blobs.set("admin-order-drafts/invoices/cs_test_a1B2c3.pdf", "%PDF-binary");
  blobs.set("admin-order-drafts/admin-stripe-paid-index.json", JSON.stringify({ rows: [{ id: ORDER.sessionId }] }));
  blobs.set("b2b-partner-credits/partner_1.json", JSON.stringify({ balanceCents: 5000 }));
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("daily backup on Vercel (read-only FS)", () => {
  it("still uploads the Blob snapshot with orders, invoice counter and partner credits", async () => {
    process.env.ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB = "1";
    process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB = "1";
    const res = await runDailyAdminDraftBackup();
    expect(res.persisted).toBe(true);
    expect(res.backupBlobPath).toMatch(/^admin-daily-backups\/\d{4}-\d{2}-\d{2}\.json$/);
    const stored = JSON.parse(blobs.get(res.backupBlobPath!)!) as {
      snapshotPayload: Record<string, Record<string, string>>;
    };
    const orders = stored.snapshotPayload["order-drafts-blob"]!;
    expect(Object.keys(orders).sort()).toEqual([
      "_meta/invoice-year-sequence.json",
      "admin-stripe-paid-index.json",
      "cs_test_a1B2c3.json",
      "manual_order_1700000000000_ab12.json",
      "order_upsell/cs_test_a1B2c3.json",
    ]);
    expect(stored.snapshotPayload["b2b-partner-credits-blob"]).toEqual({
      "partner_1.json": JSON.stringify({ balanceCents: 5000 }),
    });
  });

  it("reports not persisted (instead of silent ok) when Blob upload is off", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await runDailyAdminDraftBackup();
    expect(res.ok).toBe(true);
    expect(res.persisted).toBe(false);
    expect(puts).toEqual([]);
    expect(res.warnings.join("\n")).toContain("No durable backup was written");
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("PRO pasūtījumi dienas backupā", () => {
  it("pēc noklusējuma iekļauj PRO pasūtījumus (bez INCLUDE_ORDER_BLOB env)", async () => {
    process.env.ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB = "1";
    delete process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB;
    const res = await runDailyAdminDraftBackup();
    const stored = JSON.parse(blobs.get(res.backupBlobPath!)!) as {
      snapshotPayload: Record<string, Record<string, string>>;
    };
    const orders = stored.snapshotPayload["order-drafts-blob"]!;
    expect(JSON.parse(orders[`${ORDER.sessionId}.json`]!)).toEqual(ORDER);
    expect(orders["admin-stripe-paid-index.json"]).toBeDefined();
    expect(orders["manual_order_1700000000000_ab12.json"]).toBeDefined();
    expect(res.reports.find((r) => r.source === "order-drafts-blob")?.files).toBe(5);
    expect(res.warnings.join("\n")).not.toContain("Order drafts in Blob are NOT in this snapshot");
  });

  it("izslēdz PRO pasūtījumus tikai ar INCLUDE_ORDER_BLOB=0 un brīdina", async () => {
    process.env.ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB = "1";
    process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB = "0";
    const res = await runDailyAdminDraftBackup();
    const stored = JSON.parse(blobs.get(res.backupBlobPath!)!) as {
      snapshotPayload: Record<string, Record<string, string>>;
    };
    expect(stored.snapshotPayload["order-drafts-blob"]).toBeUndefined();
    expect(res.warnings.join("\n")).toContain("Order drafts in Blob are NOT in this snapshot");
  });
});

describe("admin-daily-backup-restore", () => {
  async function makeBackupFile(): Promise<string> {
    process.env.ADMIN_DRAFT_DAILY_BACKUP_TO_BLOB = "1";
    process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_ORDER_BLOB = "1";
    const res = await runDailyAdminDraftBackup();
    const file = path.join(tmp, "backup.json");
    fs.writeFileSync(file, blobs.get(res.backupBlobPath!)!);
    return file;
  }

  it("plans the same layout as the live stores and counts orders", async () => {
    const file = await makeBackupFile();
    const { payload } = normalizeSnapshot(JSON.parse(fs.readFileSync(file, "utf8")));
    const { files, report } = planRestore(payload);
    expect(files.get(`admin-order-drafts/${ORDER.sessionId}.json`)).toBe(JSON.stringify(ORDER));
    expect(report.orderSessions).toBe(2);
    expect(report.manualOrderSessions).toBe(1);
    expect(report.hasInvoiceCounter).toBe(true);
    expect(report.invalidJson).toEqual([]);
  });

  it("rejects path traversal keys", () => {
    const { files, report } = planRestore({ "order-drafts-blob": { "../../etc/x.json": "{}", "ok.json": "{}" } });
    expect([...files.keys()]).toEqual(["admin-order-drafts/ok.json"]);
    expect(report.unsafePaths).toEqual(["order-drafts-blob:../../etc/x.json"]);
  });

  it("CLI restores into an isolated dir and refuses live .data or a non-empty dir", async () => {
    const file = await makeBackupFile();
    const script = path.join(process.cwd(), "scripts/admin-daily-backup-restore.mjs");
    const out = path.join(tmp, "restore");
    execFileSync(process.execPath, [script, "--file", file, "--out", out], { cwd: tmp, stdio: "pipe" });
    const restored = JSON.parse(fs.readFileSync(path.join(out, "admin-order-drafts", `${ORDER.sessionId}.json`), "utf8"));
    expect(restored).toEqual(ORDER);
    expect(fs.existsSync(path.join(out, "admin-order-drafts/_meta/invoice-year-sequence.json"))).toBe(true);
    expect(fs.existsSync(path.join(out, "b2b-partner-credits/partner_1.json"))).toBe(true);
    expect(fs.existsSync(path.join(out, "restore-report.json"))).toBe(true);

    expect(() => execFileSync(process.execPath, [script, "--file", file, "--out", out], { cwd: tmp, stdio: "pipe" })).toThrow();
    const live = path.join(tmp, ".data", "admin-order-drafts");
    expect(() => execFileSync(process.execPath, [script, "--file", file, "--out", live], { cwd: tmp, stdio: "pipe" })).toThrow();
    expect(fs.existsSync(live)).toBe(false);
  });
});
