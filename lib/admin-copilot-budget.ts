import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

import { rigaYearMonthKey } from "@/lib/admin-riga-calendar";
import { resolveCopilotBlob, resolveCopilotDir } from "@/lib/admin-copilot-chat-store";
import {
  copilotBudgetStatus,
  parseCopilotMonthlyCap,
  type CopilotBudgetStatus,
} from "@/lib/admin-copilot-helpers";

/**
 * Copilot mēneša tēriņš (USD, pēc oficiālajām tokenu cenām no katras atbildes `usage`,
 * ieskaitot Opus pulēšanu). Viens JSON fails mēnesī: `…/copilot-costs/YYYY-MM.json`.
 * Copilot lieto reti, tāpēc vienkāršs read-modify-write ir pietiekams.
 */

type MonthDoc = { month: string; usd: number; calls: number; updatedAt: string };

const BLOB_SUBPREFIX = "copilot-costs/";

export function copilotMonthlyCapUsd(): number {
  return parseCopilotMonthlyCap(process.env.COPILOT_MONTHLY_USD_CAP);
}

function localFile(month: string): string | null {
  const dir = resolveCopilotDir();
  return dir ? path.join(dir, "..", "admin-copilot-costs", `${month}.json`) : null;
}

function normalize(raw: unknown, month: string): MonthDoc {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const usd = typeof o.usd === "number" && Number.isFinite(o.usd) ? Math.max(0, o.usd) : 0;
  const calls = typeof o.calls === "number" && Number.isFinite(o.calls) ? Math.max(0, o.calls) : 0;
  return { month, usd, calls, updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "" };
}

async function readMonth(month: string): Promise<MonthDoc> {
  const blob = resolveCopilotBlob();
  if (blob) {
    try {
      const res = await get(`${blob.prefix}${BLOB_SUBPREFIX}${month}.json`, {
        access: "private",
        token: blob.token,
        useCache: false,
      });
      if (res && res.statusCode === 200 && res.stream) {
        return normalize(JSON.parse(await new Response(res.stream).text()) as unknown, month);
      }
    } catch {
      /* failsistēma */
    }
  }
  const file = localFile(month);
  if (file) {
    try {
      return normalize(JSON.parse(await fs.readFile(file, "utf8")) as unknown, month);
    } catch {
      /* nav vēl */
    }
  }
  return { month, usd: 0, calls: 0, updatedAt: "" };
}

async function writeMonth(doc: MonthDoc): Promise<void> {
  const body = JSON.stringify(doc);
  const blob = resolveCopilotBlob();
  if (blob) {
    try {
      await put(`${blob.prefix}${BLOB_SUBPREFIX}${doc.month}.json`, body, {
        access: "private",
        token: blob.token,
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      return;
    } catch {
      /* failsistēma */
    }
  }
  const file = localFile(doc.month);
  if (!file) return;
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body, "utf8");
  } catch {
    /* nerakstāma vide */
  }
}

export async function readCopilotBudgetStatus(nowMs = Date.now()): Promise<CopilotBudgetStatus> {
  const month = rigaYearMonthKey(nowMs);
  const doc = await readMonth(month);
  return copilotBudgetStatus(doc.usd, copilotMonthlyCapUsd(), month);
}

/** Pieskaita šīs ziņas izmaksas mēneša summai un atgriež jauno statusu. */
export async function addCopilotSpend(usd: number, nowMs = Date.now()): Promise<CopilotBudgetStatus> {
  const month = rigaYearMonthKey(nowMs);
  const doc = await readMonth(month);
  const add = Number.isFinite(usd) && usd > 0 ? usd : 0;
  if (add > 0) {
    doc.usd += add;
    doc.calls += 1;
    doc.updatedAt = new Date(nowMs).toISOString();
    await writeMonth(doc);
  }
  return copilotBudgetStatus(doc.usd, copilotMonthlyCapUsd(), month);
}
