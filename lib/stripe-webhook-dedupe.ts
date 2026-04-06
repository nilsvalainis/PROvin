/**
 * Stripe var atkārtoti nosūtīt notikumu. Viena procesa ietvaros novērš dublikātus.
 * Serverless vairākās instancēs teorētiski iespējams dubults — pilnai garantijai vajadzīga DB/Redis.
 */

const seen = new Map<string, number>();
const MAX_AGE_MS = 72 * 60 * 60 * 1000;

function prune(now: number): void {
  for (const [id, t] of seen) {
    if (now - t > MAX_AGE_MS) seen.delete(id);
  }
}

/** Ja `false` — šis event.id jau apstrādāts; atgriezt 200 bez darbībām. */
export function tryBeginStripeEvent(eventId: string): boolean {
  const now = Date.now();
  prune(now);
  if (seen.has(eventId)) return false;
  seen.set(eventId, now);
  return true;
}

/** Ja apstrāde neizdevās (pirms veiksmīgas atbildes), atļaut Stripe atkārtot mēģinājumu. */
export function releaseStripeEvent(eventId: string): void {
  seen.delete(eventId);
}
