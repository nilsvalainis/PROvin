/** Apify klients. Bez APIFY_TOKEN nedrīkst veikt tīkla izsaukumu. */

export function readApifyToken(): string | null {
  const token = process.env.APIFY_TOKEN?.trim() ?? "";
  return token || null;
}

export function marketplaceUseFixtures(): boolean {
  return /^(1|true|yes)$/i.test(process.env.MARKETPLACE_USE_FIXTURES ?? "");
}

export function marketplaceActorId(envName: string): string {
  return process.env[envName]?.trim() ?? "";
}

export type ApifyRunResult = {
  ok: boolean;
  items: unknown[];
  chargedUsd: number;
  error?: string;
};

export type ApifyActorRunner = (input: {
  actorId: string;
  token: string;
  payload: Record<string, unknown>;
  maxItems: number;
  maxUsd: number;
}) => Promise<ApifyRunResult>;

/** Tests un fixtures var ielikt savu runneri. Noklusējums neizsauc tīklu bez token. */
let runnerOverride: ApifyActorRunner | null = null;

export function setMarketplaceApifyRunner(runner: ApifyActorRunner | null): void {
  runnerOverride = runner;
}

export async function runMarketplaceApifyActor(input: {
  actorId: string;
  payload: Record<string, unknown>;
  maxItems: number;
  maxUsd: number;
}): Promise<ApifyRunResult> {
  const token = readApifyToken();
  if (!token) return { ok: false, items: [], chargedUsd: 0, error: "token_missing" };
  if (!input.actorId.trim()) return { ok: false, items: [], chargedUsd: 0, error: "actor_not_configured" };
  if (runnerOverride) {
    return runnerOverride({
      actorId: input.actorId,
      token,
      payload: input.payload,
      maxItems: input.maxItems,
      maxUsd: input.maxUsd,
    });
  }
  return { ok: false, items: [], chargedUsd: 0, error: "apify_runner_unavailable" };
}
