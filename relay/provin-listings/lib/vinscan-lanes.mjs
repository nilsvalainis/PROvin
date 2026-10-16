/**
 * VIN SCAN `/listings/page` joslas.
 * car.info un bid.cars startē uzreiz. Lēnie hosti gaida īsu logu, lai viena skenēšana
 * neaizņem abas Chrome vietas, pirms ātrie pieprasījumi ir ierindā.
 * Viens hosts vienlaikus (savs profils). Tas pats URL dala vienu Chrome un īsu kešu.
 */

export const VINSCAN_PRIORITY_HOSTS = ["car.info", "bid.cars"];

const PRIORITY = new Set(VINSCAN_PRIORITY_HOSTS);

export function vinScanPageHost(raw) {
  try {
    return new URL(String(raw ?? "")).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function vinScanProfileName(host) {
  const safe = String(host || "page").replace(/[^a-z0-9.-]/gi, "_").slice(0, 48);
  return `vinscan-${safe}`;
}

export function createVinScanLanes(opts = {}) {
  const limit = Math.max(1, Number(opts.limit) || 2);
  const recentMs = Number.isFinite(opts.recentMs) ? opts.recentMs : 45_000;
  const nonPriorityDelayMs = Number.isFinite(opts.nonPriorityDelayMs) ? opts.nonPriorityDelayMs : 200;
  const now = typeof opts.now === "function" ? opts.now : () => Date.now();
  const queue = [];
  const runningHosts = new Set();
  let runningCount = 0;
  /** @type {Map<string, Promise<unknown>>} */
  const inflight = new Map();
  /** @type {Map<string, { at: number, value: unknown }>} */
  const recent = new Map();
  let timer = null;

  function fresh(url) {
    const hit = recent.get(url);
    if (!hit) return null;
    if (now() - hit.at > recentMs) {
      recent.delete(url);
      return null;
    }
    return hit.value;
  }

  function arm(delay) {
    if (timer) return;
    const fire = () => {
      timer = null;
      pump();
    };
    if (typeof opts.schedule === "function") {
      timer = opts.schedule(fire, delay) || true;
      return;
    }
    timer = setTimeout(fire, delay);
  }

  function pump() {
    while (runningCount < limit) {
      const priorityWaiting = queue.some((job) => job.priority && !runningHosts.has(job.host));
      const priorityRunning = [...runningHosts].some((host) => PRIORITY.has(host));
      let picked = -1;
      for (let i = 0; i < queue.length; i += 1) {
        const job = queue[i];
        if (runningHosts.has(job.host)) continue;
        if (job.eligibleAt > now()) continue;
        if (!job.priority && priorityWaiting && !priorityRunning && runningCount >= limit - 1) continue;
        picked = i;
        break;
      }
      if (picked < 0) {
        const waiting = queue.filter((job) => !runningHosts.has(job.host) && job.eligibleAt > now());
        if (waiting.length > 0 && runningCount < limit) {
          const soon = Math.min(...waiting.map((job) => job.eligibleAt));
          arm(Math.max(0, soon - now()));
        }
        return;
      }
      const job = queue.splice(picked, 1)[0];
      runningHosts.add(job.host);
      runningCount += 1;
      Promise.resolve()
        .then(() => job.run())
        .then(
          (value) => {
            recent.set(job.url, { at: now(), value });
            job.resolve(value);
          },
          (err) => {
            job.reject(err);
          },
        )
        .finally(() => {
          runningHosts.delete(job.host);
          runningCount -= 1;
          inflight.delete(job.url);
          pump();
        });
    }
  }

  return {
    get queueLength() {
      return queue.length;
    },
    get runningCount() {
      return runningCount;
    },
    peek(url) {
      const key = String(url ?? "");
      return Boolean(fresh(key) || inflight.get(key));
    },
    run(url, run) {
      const key = String(url ?? "");
      const cached = fresh(key);
      if (cached) return Promise.resolve(cached);
      const pending = inflight.get(key);
      if (pending) return pending;
      const host = vinScanPageHost(key);
      const priority = PRIORITY.has(host);
      const jobPromise = new Promise((resolve, reject) => {
        queue.push({
          url: key,
          host,
          priority,
          eligibleAt: priority ? now() : now() + nonPriorityDelayMs,
          run,
          resolve,
          reject,
        });
      });
      inflight.set(key, jobPromise);
      pump();
      return jobPromise;
    },
  };
}
