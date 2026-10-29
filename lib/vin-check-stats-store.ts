import "server-only";

import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";
import { applyEvent, parseVinCheckDay, rigaDate, type VinCheckDay, type VinCheckEvent } from "@/lib/vin-check-stats";

/**
 * Skaitītāji pa dienām: Blob `site-stats/vin-checks/YYYY-MM-DD.json` (lokāli `.data/site-stats/vin-checks/`).
 * Lasi-pieskaiti-raksti: pie vienlaicīgiem pieprasījumiem var pazust atsevišķs +1 (bez Redis tas ir
 * pieņemami statistikai; CSDD dienas limitam tas nozīmē dažu zvanu pielaidi). Kļūda uzskaitē nekad
 * neaptur pašu pārbaudi.
 */

const BLOB_DIR = "site-stats/vin-checks";
const LOCAL_DIR = ".data/site-stats/vin-checks";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function token(): string | null {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || null;
}

async function readDay(date: string): Promise<VinCheckDay> {
  if (!DATE_RE.test(date)) return { date, counts: {} };
  const t = token();
  if (t) {
    try {
      const res = await get(`${BLOB_DIR}/${date}.json`, { access: "private", token: t, useCache: false });
      if (res?.statusCode === 200 && res.stream) return parseVinCheckDay(JSON.parse(await new Response(res.stream).text()), date);
    } catch {
      /* nav vēl */
    }
    if (process.env.VERCEL === "1") return { date, counts: {} };
  }
  try {
    return parseVinCheckDay(JSON.parse(await fs.readFile(path.join(process.cwd(), LOCAL_DIR, `${date}.json`), "utf8")), date);
  } catch {
    return { date, counts: {} };
  }
}

async function writeDay(day: VinCheckDay): Promise<void> {
  const body = JSON.stringify({ date: day.date, counts: day.counts });
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

/** Pieraksta notikumu; nekad nemet kļūdu. Vercel preview (testi pirms produkcijas) statistiku nepiesārņo. */
export async function recordVinCheckEvent(e: VinCheckEvent, now: Date = new Date()): Promise<void> {
  if (process.env.VERCEL_ENV === "preview") return;
  try {
    const date = rigaDate(now);
    await writeDay(applyEvent(await readDay(date), e));
  } catch (err) {
    console.warn("[vin-check-stats] neizdevās pierakstīt", err instanceof Error ? err.message : err);
  }
}

export async function readVinCheckDays(dates: string[]): Promise<VinCheckDay[]> {
  return Promise.all(dates.map((d) => readDay(d)));
}

/** Šodienas dekodera CSDD zvanu skaits (dienas limitam). */
export async function todayDecoderCsddCalls(now: Date = new Date()): Promise<number> {
  const day = await readDay(rigaDate(now));
  return Object.entries(day.counts)
    .filter(([k]) => k.startsWith("csdd:decoder:"))
    .reduce((n, [, v]) => n + v, 0);
}
