/** Claude modeļi admin AI automatizācijai (Anthropic Messages API). */
export const CLAUDE_MODEL_OPUS = "claude-opus-5";
export const CLAUDE_MODEL_SONNET = "claude-sonnet-5";
/** Datēts ID: /v1/models neuzskaita īso `claude-haiku-4-5` aliasu. */
export const CLAUDE_MODEL_HAIKU = "claude-haiku-4-5-20251001";

/** Opus → Sonnet → Haiku; primārais modelis vienmēr pirmais mēģinājums. */
export function aiFailoverModels(primary: string): string[] {
  const chain = [CLAUDE_MODEL_OPUS, CLAUDE_MODEL_SONNET, CLAUDE_MODEL_HAIKU];
  const out: string[] = [];
  const add = (m: string) => {
    const t = m.trim();
    if (t && !out.includes(t)) out.push(t);
  };
  add(primary);
  for (const m of chain) add(m);
  return out;
}

export function aiErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message.trim();
  return String(e).trim();
}

/** Anthropic SDK kļūdām `status` ir uzticamāks par tekstu. */
function errorHttpStatus(e: unknown): number | null {
  if (!e || typeof e !== "object") return null;
  const status = (e as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

/** Pagaidu kļūdas — modeļa failover + atkārtots mēģinājums (529 overloaded, 429 kvota, timeout). */
export function isAiTransientError(e: unknown): boolean {
  const status = errorHttpStatus(e);
  if (status !== null) return isTransientHttpStatus(status);

  const msg = aiErrorMessage(e);
  if (!msg) return false;
  return /\b(429|500|502|503|504|529)\b|overloaded_error|overloaded|rate_limit_error|rate\s*limit|quota|api_error|temporarily\s+unavailable|timeout|ETIMEDOUT|ECONNRESET|EAI_AGAIN|fetch\s+failed|too\s+many\s+requests/i.test(
    msg,
  );
}

/** 529 = Anthropic `overloaded_error`. */
export function isTransientHttpStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 529
  );
}
