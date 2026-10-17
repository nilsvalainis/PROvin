import { isAiEmptyGeneratedTextError, isAiIncompleteCommentError } from "@/lib/admin-ai-incomplete";

export const GEMINI_MODEL_PRO = "gemini-2.5-pro";
/** Smart noklusējums visiem ✨ laukiem. Vecāki Gemini ID paliek tikai failover. */
export const GEMINI_MODEL_FLASH = "gemini-3.8-flash";
/** Failover, ja 3.8 nav pieejams (iepriekšējais UI primārais). */
export const GEMINI_MODEL_FLASH_PREVIEW = "gemini-3-flash-preview";
export const GEMINI_MODEL_FLASH_25 = "gemini-2.5-flash";
/** Nav UI poga. Tikai failover, ja lētākie Flash ID nav pieejami. */
export const GEMINI_MODEL_ARGON = "gemini-4-argon";
/**
 * Pēdējais lētais failover solis. `gemini-2.0-flash` Google izslēdza 2026-06-01
 * (deprecations lapa), tāpēc ķēde beidzās ar mirušu modeli. Nosaukums paliek
 * saderībai; vērtība ir dzīvs Flash-Lite. Ne 2.5 Flash-Lite: Google 2.5 saimi
 * dod tikai kontiem, kas to jau lietojuši (PROVIN atslēgai 2.5 Flash-Lite = 404).
 */
export const GEMINI_MODEL_LEGACY_FLASH = "gemini-3.5-flash-lite";

/**
 * Failover tikai uz LĒTĀKIEM modeļiem — Flash 503/404 nedrīkst pāriet uz Pro/Argon.
 * 3.8 Flash → 3 Flash preview → 2.5 Flash → 3.5 Flash-Lite.
 */
export function geminiFailoverModels(primary: string): string[] {
  const cheaper: Record<string, readonly string[]> = {
    [GEMINI_MODEL_FLASH]: [GEMINI_MODEL_FLASH_PREVIEW, GEMINI_MODEL_FLASH_25, GEMINI_MODEL_LEGACY_FLASH],
    [GEMINI_MODEL_FLASH_PREVIEW]: [GEMINI_MODEL_FLASH_25, GEMINI_MODEL_LEGACY_FLASH],
    [GEMINI_MODEL_PRO]: [GEMINI_MODEL_FLASH, GEMINI_MODEL_FLASH_25],
    [GEMINI_MODEL_ARGON]: [GEMINI_MODEL_FLASH, GEMINI_MODEL_FLASH_25],
    [GEMINI_MODEL_FLASH_25]: [GEMINI_MODEL_LEGACY_FLASH],
    [GEMINI_MODEL_LEGACY_FLASH]: [],
  };
  const out: string[] = [];
  const add = (m: string) => {
    const t = m.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(primary);
  for (const m of cheaper[primary] ?? [GEMINI_MODEL_FLASH, GEMINI_MODEL_LEGACY_FLASH]) add(m);
  return out;
}

export function geminiErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message.trim();
  return String(e).trim();
}

/** Pagaidu kļūdas — modeļa failover + atkārtots mēģinājums (503, kvota, timeout). */
export function isGeminiTransientError(e: unknown): boolean {
  const msg = geminiErrorMessage(e);
  if (!msg) return false;
  return /503|429|500|502|504|UNAVAILABLE|RESOURCE_EXHAUSTED|SERVICE_UNAVAILABLE|rate\s*limit|quota|high\s+demand|experiencing\s+high\s+demand|overloaded|temporarily\s+unavailable|timeout|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|fetch\s+failed|too\s+many\s+requests|404.*models\/gemini|is not found for API version/i.test(
    msg,
  );
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function isGeminiTimeoutError(e: unknown): boolean {
  return /timeout|ETIMEDOUT|timed\s*out|DEADLINE_EXCEEDED|aborted/i.test(geminiErrorMessage(e));
}

/**
 * Tukša samaksāta atbilde pēc tā paša modeļa thinking retry - nākamais lētākais
 * modelis, ne tukšs lauks. Timeout un daļējs teksts paliek pie pirmā modeļa.
 */
export function shouldGeminiModelFailover(e: unknown): boolean {
  if (isAiIncompleteCommentError(e)) return false;
  if (isAiEmptyGeneratedTextError(e)) return true;
  if (isGeminiTimeoutError(e)) return false;
  return isGeminiTransientError(e);
}
