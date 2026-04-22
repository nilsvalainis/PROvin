import "server-only";

import fs from "node:fs/promises";
import path from "node:path";

import {
  getChromiumWithStealth,
  MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS,
  MOBILE_DE_PLAYWRIGHT_USER_AGENT,
} from "@/lib/iriss-mobile-playwright-stealth";

/** Relatīvs pret process.cwd(); gitignored caur .data/ */
export const MOBILE_PERSISTENT_PROFILE_REL = path.join(".data", "browser-profiles", "mobile");

export async function mobilePersistentProfileAbsPath(): Promise<string> {
  return path.join(process.cwd(), MOBILE_PERSISTENT_PROFILE_REL);
}

/**
 * Vai eksistē pabeigts Mobile.de persistent profils.
 * `scripts/auth-mobile.mjs` pēc pārlūka aizvēršanas izveido `.iriss-mobile-profile-ready`
 * kopā ar Chromium `Local State`.
 */
export async function hasUsableMobilePersistentProfile(): Promise<boolean> {
  if (process.env.IRISS_LISTINGS_MOBILE_DISABLE_PERSISTENT_PROFILE?.trim() === "1") return false;
  if (process.env.VERCEL) return false;
  const dir = await mobilePersistentProfileAbsPath();
  try {
    await fs.access(path.join(dir, ".iriss-mobile-profile-ready"));
    await fs.access(path.join(dir, "Local State"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ielādē HTML ar Playwright persistent profilu (tā pati sesija kā `scripts/auth-mobile.mjs`).
 * Katrs izsaukums atver un aizver kontekstu — izvairās no paralēlas piekļuves vienam profilam.
 */
export async function fetchUrlHtmlWithMobilePersistentProfile(
  url: string,
  timeoutMs: number,
): Promise<{ ok: true; statusCode: number; html: string } | { ok: false; statusCode: number; note: string }> {
  const dir = await mobilePersistentProfileAbsPath();
  const chromium = getChromiumWithStealth();
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  try {
    await fs.mkdir(dir, { recursive: true });
    context = await chromium.launchPersistentContext(dir, {
      headless: true,
      viewport: { width: 1280, height: 720 },
      locale: "de-DE",
      userAgent: MOBILE_DE_PLAYWRIGHT_USER_AGENT,
      args: [...MOBILE_DE_PLAYWRIGHT_EXTRA_ARGS],
    });
    const page = context.pages()[0] ?? (await context.newPage());
    const resp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const statusCode = resp?.status() ?? 0;
    const html = await page.content();
    await context.close();
    context = undefined;
    return { ok: true, statusCode, html };
  } catch (e) {
    if (context) {
      await context.close().catch(() => undefined);
    }
    return {
      ok: false,
      statusCode: 0,
      note: e instanceof Error ? e.message.slice(0, 220) : "playwright_failed",
    };
  }
}
