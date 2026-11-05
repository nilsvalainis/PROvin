import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import {
  applyBusinessPogaEvent,
  emptyBusinessPogaDay,
  parseBusinessPogaDay,
  type BusinessPogaDay,
  type BusinessPogaEvent,
} from "@/lib/business-poga-stats";
import { rigaDate } from "@/lib/vin-check-stats";

/**
 * Blob `site-stats/business-poga/YYYY-MM-DD.json` (lokāli `.data/site-stats/business-poga/`).
 * Lasi-pieskaiti-raksti kā VIN pārbaužu statistikai: pie vienlaicīgiem klikšķiem var pazust atsevišķs +1.
 * Kļūda uzskaitē nekad neaptur pašu klikšķi vai apmaksu.
 */

const BLOB_DIR = "site-stats/business-poga";
const LOCAL_DIR = ".data/site-stats/business-poga";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function token(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

async function readDay(date: string): Promise<BusinessPogaDay> {
  if (!DATE_RE.test(date)) return emptyBusinessPogaDay(date);
  const t = token();
  if (t) {
    try {
      const res = await get(`${BLOB_DIR}/${date}.json`, { access: "private", token: t, useCache: false });
      if (res?.statusCode === 200 && res.stream) return parseBusinessPogaDay(JSON.parse(await new Response(res.stream).text()), date);
    } catch {
      /* nav vēl */
    }
    if (process.env.VERCEL === "1") return emptyBusinessPogaDay(date);
  }
  try {
    return parseBusinessPogaDay(JSON.parse(await fs.readFile(path.join(process.cwd(), LOCAL_DIR, `${date}.json`), "utf8")), date);
  } catch {
    return emptyBusinessPogaDay(date);
  }
}

async function writeDay(day: BusinessPogaDay): Promise<void> {
  const body = JSON.stringify(day);
  const t = token();
  if (t) {
    await put(`${BLOB_DIR}/${day.date}.json`, body, {
      access: "private",
      token: t,
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  if (process.env.VERCEL === "1") return;
  const fp = path.join(process.cwd(), LOCAL_DIR, `${day.date}.json`);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  await fs.writeFile(fp, body, "utf8");
}

/** Pieraksta notikumu; nekad nemet kļūdu. Vercel preview statistiku nepiesārņo. */
export async function recordBusinessPogaEvent(e: BusinessPogaEvent, now: Date = new Date()): Promise<void> {
  if (process.env.VERCEL_ENV === "preview") return;
  try {
    const date = rigaDate(now);
    await writeDay(applyBusinessPogaEvent(await readDay(date), e));
  } catch (err) {
    console.warn("[business-poga-stats] neizdevās pierakstīt", err instanceof Error ? err.message : err);
  }
}

export async function readBusinessPogaDays(dates: string[]): Promise<BusinessPogaDay[]> {
  return Promise.all(dates.map((d) => readDay(d)));
}
