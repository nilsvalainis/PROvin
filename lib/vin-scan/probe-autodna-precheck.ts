import "server-only";

import { solveCaptcha, hasCaptchaSolverKey } from "@/lib/captcha-solver";
import { readAutodnaPrecheck, type AutodnaPrecheckDeps } from "@/lib/vin-scan/autodna-precheck";
import { scanFetch, vinScanSolverBudgetMs } from "@/lib/vin-scan/http";
import { CAPSOLVER_MIN_TIMEOUT_MS } from "@/lib/vin-scan/source-timeouts";
import { buildVinScanIndicator, type VinScanContext, type VinScanIndicator } from "@/lib/vin-scan/types";
import { isCloudflareChallengeHtml, mergeCookieHeader } from "@/lib/vin-sources/html-extract";

/**
 * CapSolver Turnstile (~0,001 $ par VIN) tikai ar skaidru `AUTODNA_PRECHECK_TURNSTILE=1` (Nila «jā»).
 * Bez tā serveris nolasa tikai jau sagatavotus priekšskatījumus (AutoDNA tos kešo pēc VIN).
 */
export function autodnaPrecheckTurnstileEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.AUTODNA_PRECHECK_TURNSTILE?.trim() === "1";
}

function defaultDeps(): AutodnaPrecheckDeps {
  const turnstile = autodnaPrecheckTurnstileEnabled() && hasCaptchaSolverKey();
  return {
    get: async (url, { cookie, xhr }) => {
      const res = await scanFetch(url, {
        headers: xhr
          ? { accept: "application/json, text/plain, */*", "x-requested-with": "XMLHttpRequest", "accept-language": "lv,en;q=0.8" }
          : { accept: "text/html,application/xhtml+xml", "accept-language": "lv,en;q=0.8" },
        cookie,
        timeoutMs: xhr ? 8_000 : 20_000,
      });
      return { status: res.status, text: res.text, cookie: res.cookie };
    },
    solveTurnstile: turnstile
      ? async (siteKey, websiteURL) => {
          const budget = vinScanSolverBudgetMs(60_000);
          if (budget < CAPSOLVER_MIN_TIMEOUT_MS) return { ok: false, reason: "avota laiks beidzies" };
          const solved = await solveCaptcha({ kind: "turnstile", websiteURL, websiteKey: siteKey }, { timeoutMs: budget, sourceLabel: "AutoDNA" });
          if (!solved.ok) return { ok: false, reason: solved.reason };
          return solved.token ? { ok: true, token: solved.token } : { ok: false, reason: "tukšs žetons" };
        }
      : null,
    isChallenge: (page) => isCloudflareChallengeHtml(page.text, page.status),
    mergeCookie: mergeCookieHeader,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    now: () => Date.now(),
  };
}

export async function probeAutodnaPrecheck(ctx: VinScanContext): Promise<VinScanIndicator> {
  try {
    const parsed = await readAutodnaPrecheck(ctx.vin, defaultDeps());
    return buildVinScanIndicator("autodna_precheck", ctx.vin, parsed, ctx.plates);
  } catch (e) {
    const timedOut = e instanceof Error && e.message === "timeout";
    return buildVinScanIndicator(
      "autodna_precheck",
      ctx.vin,
      { status: timedOut ? "timeout" : "unknown", summary: timedOut ? "Avots neatbildēja laikā" : "Avotu neizdevās nolasīt" },
      ctx.plates,
    );
  }
}
