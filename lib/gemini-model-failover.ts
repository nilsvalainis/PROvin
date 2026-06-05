export const GEMINI_MODEL_PRO = "gemini-2.5-pro";
export const GEMINI_MODEL_FLASH = "gemini-2.5-flash";
export const GEMINI_MODEL_LEGACY_FLASH = "gemini-2.0-flash";

/** Pro → 2.5 Flash → 2.0 Flash; primārais modelis vienmēr pirmais mēģinājums. */
export function geminiFailoverModels(primary: string): string[] {
  const chain = [GEMINI_MODEL_PRO, GEMINI_MODEL_FLASH, GEMINI_MODEL_LEGACY_FLASH];
  const out: string[] = [];
  const add = (m: string) => {
    const t = m.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(primary);
  for (const m of chain) add(m);
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
  return /503|429|500|502|504|UNAVAILABLE|RESOURCE_EXHAUSTED|SERVICE_UNAVAILABLE|rate\s*limit|quota|high\s+demand|experiencing\s+high\s+demand|overloaded|temporarily\s+unavailable|timeout|DEADLINE_EXCEEDED|ECONNRESET|ETIMEDOUT|fetch\s+failed|too\s+many\s+requests/i.test(
    msg,
  );
}

export function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}
