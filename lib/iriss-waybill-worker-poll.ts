/**
 * Hetzner pavadzīmju worker aptaujas biežums (Nils 20.11): serveris atbildē (`GET waybill-requests?scope=auto`) dod
 * `pollMs`. Ātri (2 s), kad pēdējās 15 min izveidots pieprasījums vai pēdējās 6 min atvērta Pavadzīmju lapa
 * (atzīme ik ≤3 min, sk. noteWaybillPageSeen); citādi 10 s. Bez jauniem servisiem un bez ienākošiem portiem serverī.
 */

export const WAYBILL_WORKER_POLL_FAST_MS = 2_000;
export const WAYBILL_WORKER_POLL_SLOW_MS = 10_000;
export const WAYBILL_RECENT_REQUEST_MS = 15 * 60 * 1000;
export const WAYBILL_PAGE_SEEN_HOT_MS = 6 * 60 * 1000;

export function waybillWorkerPollMs(input: {
  requests: readonly { createdAt: string }[];
  pageSeenAt?: string;
  nowMs?: number;
}): number {
  const nowMs = input.nowMs ?? Date.now();
  const recent = (iso: string | undefined, windowMs: number) => {
    const ms = Date.parse(iso || "");
    return Number.isFinite(ms) && nowMs - ms >= -60_000 && nowMs - ms < windowMs;
  };
  if (recent(input.pageSeenAt, WAYBILL_PAGE_SEEN_HOT_MS)) return WAYBILL_WORKER_POLL_FAST_MS;
  if (input.requests.some((r) => recent(r.createdAt, WAYBILL_RECENT_REQUEST_MS))) return WAYBILL_WORKER_POLL_FAST_MS;
  return WAYBILL_WORKER_POLL_SLOW_MS;
}
