import fs from "fs/promises";
import os from "os";
import path from "path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dir = path.join(os.tmpdir(), `dealer-store-test-${process.pid}-${Date.now()}`);
process.env.DEALER_DATA_JOB_DIR = dir;
delete process.env.BLOB_READ_WRITE_TOKEN;

import {
  claimDealerDataJobRun,
  dealerDataRunLeaseHeld,
  listUnfinishedDealerDataJobs,
  readDealerDataJob,
  upsertDealerDataJob,
} from "@/lib/dealer-data-job-store";

const VIN = "WAUZZZ4M0JD000001";

describe("dealer-data-job-store CAS", () => {
  beforeEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("divas paralēlas palaišanas - nomu iegūst tikai viena", async () => {
    await upsertDealerDataJob("s_a", { vin: VIN, status: "pending" });
    const [a, b] = await Promise.all([
      claimDealerDataJobRun({ sessionId: "s_a", vin: VIN, runId: "run_a", trigger: "cron" }),
      claimDealerDataJobRun({ sessionId: "s_a", vin: VIN, runId: "run_b", trigger: "webhook" }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    const winner = a.ok ? "run_a" : "run_b";
    expect(await dealerDataRunLeaseHeld("s_a", winner)).toBe(true);
    expect(await dealerDataRunLeaseHeld("s_a", winner === "run_a" ? "run_b" : "run_a")).toBe(false);
    expect((await readDealerDataJob("s_a"))?.attempts).toBe(1);
  });

  it("cron respektē nextRetryAt svaigā ierakstā", async () => {
    await upsertDealerDataJob("s_b", {
      vin: VIN,
      status: "failed",
      attempts: 1,
      nextRetryAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const r = await claimDealerDataJobRun({ sessionId: "s_b", vin: VIN, runId: "r", trigger: "cron", respectNextRetry: true });
    expect(r).toMatchObject({ ok: false, reason: "not_due" });
  });

  it("raksts ar svešu nomu netiek ierakstīts", async () => {
    await claimDealerDataJobRun({ sessionId: "s_c", vin: VIN, runId: "run_1", trigger: "webhook" });
    expect(await upsertDealerDataJob("s_c", { vin: VIN, status: "done" }, { expectRunId: "run_2" })).toBeNull();
    expect((await readDealerDataJob("s_c"))?.status).toBe("running");
    expect(await upsertDealerDataJob("s_c", { vin: VIN, status: "done" }, { expectRunId: "run_1" })).not.toBeNull();
  });

  it("paralēli ieraksti nepazaudē indeksu; gala kļūda ar paziņojumu izņemta", async () => {
    await Promise.all(
      ["s_1", "s_2", "s_3", "s_4"].map((id) => upsertDealerDataJob(id, { vin: VIN, status: "pending" })),
    );
    expect((await listUnfinishedDealerDataJobs()).map((j) => j.sessionId).sort()).toEqual(["s_1", "s_2", "s_3", "s_4"]);
    await upsertDealerDataJob("s_2", { vin: VIN, status: "failed", attempts: 3, alert: { key: "failed_final", at: "x" } });
    expect((await listUnfinishedDealerDataJobs()).map((j) => j.sessionId).sort()).toEqual(["s_1", "s_3", "s_4"]);
  });
});
