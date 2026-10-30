/**
 * Drošā saglabāšana Autoparkā (Nils 29.10).
 * Lauku saglabāšana ir «uzliec vērtību» (atkārtot droši): tīkla kļūdas / 5xx / 429 gadījumā mēģina vēlreiz
 * (1 s, 3 s, 8 s). Kamēr kāda saglabāšana notiek, pārlūks brīdina, aizverot lapu.
 */

export const AP2_RETRY_DELAYS_MS = [1_000, 3_000, 8_000] as const;

let pending = 0;
let guardOn = false;

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (pending <= 0) return;
  e.preventDefault();
  e.returnValue = "Saglabāšana vēl notiek.";
}

function track(delta: number) {
  pending = Math.max(0, pending + delta);
  if (typeof window === "undefined") return;
  if (pending > 0 && !guardOn) {
    window.addEventListener("beforeunload", onBeforeUnload);
    guardOn = true;
  } else if (pending === 0 && guardOn) {
    window.removeEventListener("beforeunload", onBeforeUnload);
    guardOn = false;
  }
}

/** Vai atbildi vērts atkārtot: nav atbildes (tīkls), servera kļūda vai pārslodze. 4xx (validācija) - nē. */
export function ap2ShouldRetry(status: number | null): boolean {
  return status === null || status >= 500 || status === 429 || status === 408;
}

export type Ap2PatchResult<T> = { ok: boolean; status: number | null; data: T | null };

export async function ap2PatchJson<T>(
  url: string,
  body: unknown,
  opts?: { delays?: readonly number[]; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> },
): Promise<Ap2PatchResult<T>> {
  const delays = opts?.delays ?? AP2_RETRY_DELAYS_MS;
  const doFetch = opts?.fetchImpl ?? fetch;
  const sleep = opts?.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  track(1);
  try {
    for (let attempt = 0; ; attempt++) {
      const res = await doFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      const status = res ? res.status : null;
      const data = res ? ((await res.json().catch(() => null)) as T | null) : null;
      if (res?.ok) return { ok: true, status, data };
      if (!ap2ShouldRetry(status) || attempt >= delays.length) return { ok: false, status, data };
      await sleep(delays[attempt]!);
    }
  } finally {
    track(-1);
  }
}
