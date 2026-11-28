import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { getOrderDraftBlobConfig, getOrderDraftStorageDir } from "@/lib/admin-order-draft-store";
import {
  AUTO_DOWNGRADE_WINDOW_DAYS,
  autoDowngradedRuleKeys,
  buildDismissedFeedbackDigest,
  computeRuleFeedbackStats,
  contradictionFeedbackLogPath,
  type ContradictionFeedbackEntry,
  type ContradictionFeedbackLogLine,
  type DismissedFeedbackDigest,
  type RuleFeedbackStats,
} from "@/lib/contradiction-feedback";

/**
 * Pretrunu lēmumu žurnāls: {blobPrefix}admin-contradiction-feedback/YYYY-MM.jsonl (viena rinda = viens lēmums).
 * Bez personas datiem (VIN, pasūtījuma id, noteikums, avotu pāris, lēmums). Ieraksts ir «best effort» -
 * nekad nemet kļūdu un nebloķē admin darbu; paralēli ieraksti var pārrakstīt viens otru (pieņemami).
 */

async function readRel(rel: string): Promise<string> {
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  try {
    if (blob) {
      const res = await get(`${blob.prefix}${rel}`, { access: "private", token: blob.token, useCache: false });
      if (res?.statusCode === 200 && res.stream) return await new Response(res.stream).text();
    } else if (dir && process.env.VERCEL !== "1") {
      return await fs.readFile(path.join(dir, rel), "utf8");
    }
  } catch {
    /* nav faila */
  }
  return "";
}

async function writeRel(rel: string, body: string): Promise<void> {
  const blob = getOrderDraftBlobConfig();
  const dir = getOrderDraftStorageDir();
  if (blob) {
    await put(`${blob.prefix}${rel}`, body, {
      access: "private",
      token: blob.token,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/x-ndjson",
    });
  } else if (dir && process.env.VERCEL !== "1") {
    const fp = path.join(dir, rel);
    await fs.mkdir(path.dirname(fp), { recursive: true });
    await fs.writeFile(fp, body, "utf8");
  }
}

function parseLines(text: string): ContradictionFeedbackLogLine[] {
  const out: ContradictionFeedbackLogLine[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as ContradictionFeedbackLogLine;
      if (o && typeof o.fp === "string" && typeof o.rule === "string") out.push(o);
    } catch {
      /* bojāta rinda */
    }
  }
  return out;
}

export async function appendContradictionFeedbackLog(line: ContradictionFeedbackLogLine): Promise<boolean> {
  try {
    const rel = contradictionFeedbackLogPath(line.at);
    const prev = await readRel(rel);
    const body = `${prev}${prev && !prev.endsWith("\n") ? "\n" : ""}${JSON.stringify(line)}\n`;
    await writeRel(rel, body);
    return true;
  } catch (e) {
    console.warn("[contradiction-feedback] log failed", e instanceof Error ? e.message : e);
    return false;
  }
}

/** Žurnāla rindas pēdējās `days` dienās (lasa vajadzīgos mēnešu failus). */
export async function readContradictionFeedbackLog(days: number, nowMs: number = Date.now()): Promise<ContradictionFeedbackLogLine[]> {
  const months = new Set<string>();
  for (let d = 0; d <= days; d += 1) {
    months.add(new Date(nowMs - d * 86_400_000).toISOString().slice(0, 7));
  }
  const since = nowMs - days * 86_400_000;
  const all: ContradictionFeedbackLogLine[] = [];
  for (const ym of [...months].sort()) {
    all.push(...parseLines(await readRel(`admin-contradiction-feedback/${ym}.jsonl`)));
  }
  return all.filter((l) => {
    const t = Date.parse(l.at);
    return Number.isFinite(t) && t >= since;
  });
}

export type ContradictionFeedbackSummary = {
  stats: RuleFeedbackStats[];
  downgraded: string[];
  lines: number;
};

export async function loadContradictionFeedbackSummary(days: number = AUTO_DOWNGRADE_WINDOW_DAYS): Promise<ContradictionFeedbackSummary> {
  const now = Date.now();
  const lines = await readContradictionFeedbackLog(Math.max(days, AUTO_DOWNGRADE_WINDOW_DAYS), now);
  const window = computeRuleFeedbackStats(lines, now, AUTO_DOWNGRADE_WINDOW_DAYS);
  const stats = days === AUTO_DOWNGRADE_WINDOW_DAYS ? window : computeRuleFeedbackStats(lines, now, days);
  return { stats, downgraded: autoDowngradedRuleKeys(window), lines: lines.length };
}

/** Šī VIN lēmumi (jaunākais katram fp) - citos pasūtījumos par to pašu VIN brīdinājums ir pelēks. */
export async function loadVinContradictionFeedback(vin: string, days = 365): Promise<ContradictionFeedbackEntry[]> {
  const v = vin.trim().toUpperCase();
  if (!/^[A-HJ-NPR-Z0-9]{11,17}$/.test(v)) return [];
  const lines = (await readContradictionFeedbackLog(days)).filter((l) => (l.vin ?? "").toUpperCase() === v);
  const byFp = new Map<string, ContradictionFeedbackEntry>();
  for (const l of lines.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    byFp.set(l.fp, { fp: l.fp, rule: l.rule, origin: l.origin, verdict: l.verdict, at: l.at, ...(l.pair ? { pair: l.pair } : {}) });
  }
  return [...byFp.values()];
}

/** 28.11: «Nav pretruna» nedēļas kopsavilkums (bez personas datiem) - admin un cron maršrutiem. */
export async function loadDismissedFeedbackDigest(days = 7, nowMs: number = Date.now()): Promise<DismissedFeedbackDigest> {
  const d = Math.min(Math.max(Math.floor(days) || 7, 1), 31);
  return buildDismissedFeedbackDigest(await readContradictionFeedbackLog(d, nowMs), nowMs, d);
}
