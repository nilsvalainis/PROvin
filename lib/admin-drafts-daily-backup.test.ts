import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { shouldIncludeIrissFromBlob } from "@/lib/admin-drafts-daily-backup";

describe("admin drafts daily backup", () => {
  it("includes IRISS Blob by default", () => {
    const prev = process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB;
    delete process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB;
    expect(shouldIncludeIrissFromBlob()).toBe(true);
    if (prev !== undefined) process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB = prev;
    else delete process.env.ADMIN_DRAFT_DAILY_BACKUP_INCLUDE_IRISS_BLOB;
  });

  it("runs the backup cron at least daily", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    const job = vercel.crons.find((c) => c.path === "/api/cron/admin-drafts-daily-backup");
    expect(job?.schedule).toBe("0 2 * * *");
  });

  it("backs up IRISS scan and pavadzīmes prefixes", () => {
    const src = readFileSync(path.join(process.cwd(), "lib/admin-drafts-daily-backup.ts"), "utf8");
    expect(src).toContain("iriss-scan-fs");
    expect(src).toContain("iriss-pavadzimes-fs");
    expect(src).toContain("iriss-scan-blob");
    expect(src).toContain("iriss-pavadzimes-blob");
  });
});

describe("backup cron vārti", () => {
  it("pieņem Vercel CRON_SECRET un ADMIN_DRAFT_BACKUP_CRON_SECRET, citus atraida", async () => {
    vi.resetModules();
    vi.doMock("@/lib/admin-drafts-daily-backup", () => ({ runDailyAdminDraftBackup: async () => ({ ok: true }) }));
    const { GET } = await import("@/app/api/cron/admin-drafts-daily-backup/route");
    vi.stubEnv("CRON_SECRET", "vercel-cron");
    vi.stubEnv("ADMIN_DRAFT_BACKUP_CRON_SECRET", "manual");
    const call = (auth: string) =>
      GET(new Request("http://x/api/cron/admin-drafts-daily-backup", { headers: { authorization: auth } }));
    expect((await call("Bearer nope")).status).toBe(403);
    expect((await call("Bearer vercel-cron")).status).toBe(200);
    expect((await call("Bearer manual")).status).toBe(200);
    vi.unstubAllEnvs();
    vi.doUnmock("@/lib/admin-drafts-daily-backup");
  });
});
