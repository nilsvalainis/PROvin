/**
 * Apmaksāta pasūtījuma auto plūsmas ilgums (Stripe webhook, maxDuration 300 s):
 * `Promise.allSettled([seedPaidOrderAutoSources, runOrderFreeVinScan])`.
 *
 * Mērām viltus laikā sliktāko gadījumu, kad NEVIENS ārējais serveris neatbild: `fetch` nekad
 * neatgriežas un beidzas tikai tad, kad izsaucējs pats to pārtrauc ar AbortSignal.
 * Tīkla nav, krātuves ir aizstātas, vides atslēgas ir viltotas.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const draftWrites: Array<{ kind: string; payload: unknown }> = [];

vi.mock("@/lib/admin-order-draft-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-order-draft-store")>();
  return {
    ...actual,
    readOrderDraft: vi.fn(async () => null),
    readOrderDraftUncached: vi.fn(async () => null),
    patchOrderDraft: vi.fn(async (_id: string, payload: unknown) => {
      draftWrites.push({ kind: "patch", payload });
      return { ok: true };
    }),
    upsertOrderDraftAutoIngest: vi.fn(async (_id: string, payload: unknown) => {
      draftWrites.push({ kind: "autoIngest", payload });
      return { ok: true };
    }),
    upsertOrderDraftVinScan: vi.fn(async (_id: string, payload: unknown) => {
      draftWrites.push({ kind: "vinScan", payload });
      return { ok: true };
    }),
  };
});
vi.mock("@/lib/admin-orders", () => ({ getCheckoutSessionDetail: vi.fn(async () => null) }));
vi.mock("@/lib/source-health-store", () => ({
  readSourceHealth: vi.fn(async () => ({ sources: {} })),
  recordSourceOutcomes: vi.fn(async () => undefined),
}));
vi.mock("@/lib/vin-check-stats-store", () => ({
  recordVinCheckEvent: vi.fn(async () => undefined),
  readVinCheckDays: vi.fn(async () => []),
  csddUsage: vi.fn(async () => ({ decoderToday: 0, monthTotal: 0 })),
}));
vi.mock("@/lib/vin-scan/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/vin-scan/store")>();
  return {
    ...actual,
    readVinScanSnapshot: vi.fn(async () => null),
    writeVinScanSnapshot: vi.fn(async () => undefined),
    listVinScanHistory: vi.fn(async () => []),
    readJojVinCache: vi.fn(async () => null),
    writeJojVinCache: vi.fn(async () => undefined),
    readJojDictCache: vi.fn(async () => null),
    writeJojDictCache: vi.fn(async () => undefined),
  };
});
// LTAB un e.csdd soļi pēc sēklas palaiž atsevišķus fona darbus - šeit tos nemērām.
vi.mock("@/lib/ecsdd-auto", () => ({ startEcsddLookup: vi.fn(async () => ({ ok: true, skipped: true })) }));
vi.mock("@/lib/ltab-auto", () => ({ startLtabLookup: vi.fn(async () => ({ ok: true, skipped: true })) }));
// Pārlūks (Playwright) webhook ceļā nedrīkst startēt; ja kods to mēģina, tests krīt.
vi.mock("@/lib/iriss-playwright-extra-stealth", () => ({
  getChromiumWithStealth: () => {
    throw new Error("browser_forbidden_in_timing_test");
  },
}));

const VIN = "WVWZZZ7NZEV015204";
const LISTING_URL = "https://www.ss.lv/msg/lv/transport/cars/volkswagen/sharan/abcde.html";
const SESSION = "cs_test_timing0000000000000000000000000000000000000000000000";
const WEBHOOK_MAX_DURATION_S = 300;
const BUDGET_S = 280;

/** `aborted` = pieprasījums vairs nav dzīvs (pārtraukts vai atbildēts). */
type FetchCall = { prefix: string; hasSignal: boolean; aborted: boolean; startedAtS: number; abortedAfterS?: number };

let calls: FetchCall[] = [];
let t0 = 0;

/** Tikai hosts + pirmie ceļa posmi; bez vaicājuma un žetoniem. */
function urlPrefix(input: unknown): string {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : String((input as { url?: string })?.url ?? input);
  try {
    const u = new URL(raw);
    return `${u.host}/${u.pathname.split("/").filter(Boolean).slice(0, 2).join("/")}`;
  } catch {
    return raw.slice(0, 40);
  }
}

/** Atbilde, ko scenārijs dod konkrētam pieprasījumam; null = serveris klusē. */
type Reply = { afterMs: number; status?: number; body: string } | null;
let replyFor: (prefix: string, method: string) => Reply = () => null;

/**
 * `fetch` bez tīkla. Pēc noklusējuma nekad neatbild un beidzas tikai ar izsaucēja AbortSignal;
 * scenārijs var likt atsevišķiem hostiem atbildēt pēc noteikta (viltus) laika.
 */
function fakeFetch(input: unknown, init?: RequestInit): Promise<Response> {
  const signal = init?.signal ?? (input as { signal?: AbortSignal } | null)?.signal ?? undefined;
  const call: FetchCall = { prefix: urlPrefix(input), hasSignal: Boolean(signal), aborted: false, startedAtS: (Date.now() - t0) / 1000 };
  calls.push(call);
  const reply = replyFor(call.prefix, String(init?.method ?? "GET").toUpperCase());
  return new Promise<Response>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = () => {
      if (timer) clearTimeout(timer);
      call.aborted = true;
      call.abortedAfterS = (Date.now() - t0) / 1000 - call.startedAtS;
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    };
    if (signal?.aborted) return fail();
    signal?.addEventListener("abort", fail, { once: true });
    if (reply) {
      timer = setTimeout(() => {
        call.aborted = true; // pabeigts: vairs nav dzīvs
        call.abortedAfterS = (Date.now() - t0) / 1000 - call.startedAtS;
        resolve(new Response(reply.body, { status: reply.status ?? 200 }));
      }, reply.afterMs);
    }
  });
}

/** Griež viltus laiku pa 1 s, līdz darbs beidzas. null = nebeidzās `capS` sekundēs. */
async function measureSeconds(job: Promise<unknown>, capS = 600): Promise<number | null> {
  let settledAt: number | null = null;
  void job.then(
    () => {
      settledAt = Date.now();
    },
    () => {
      settledAt = Date.now();
    },
  );
  for (let i = 0; i < capS && settledAt == null; i += 1) await vi.advanceTimersByTimeAsync(1000);
  return settledAt == null ? null : (settledAt - t0) / 1000;
}

/**
 * Svaigi moduļi katram mērījumam (60 s dedupe kešs starp sēklu un VIN SCAN nedrīkst pāriet no
 * iepriekšējā testa). Moduļus ielādē ar īsto pulksteni, tikai pēc tam ieslēdz viltus laiku.
 */
async function loadFlow() {
  vi.resetModules();
  // Secīgi: paralēls `import()` pēc resetModules šajā moduļu grafā (cikliskas atkarības) iestrēgst.
  const { seedPaidOrderAutoSources } = await import("@/lib/admin-paid-order-source-seed");
  const { runOrderFreeVinScan } = await import("@/lib/order-vin-scan-run");
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-17T10:00:00Z"));
  t0 = Date.now();
  return { seedPaidOrderAutoSources, runOrderFreeVinScan };
}

/** Pēc darba beigām griež laiku vēl, lai atšķirtu "pārtraukts vēlu" no "nav pārtraukts nekad". */
async function drainLateAborts(extraS = 300): Promise<void> {
  for (let i = 0; i < extraS && calls.some((c) => !c.aborted); i += 1) await vi.advanceTimersByTimeAsync(1000);
}

/** Vēlākais brīdis (s no sākuma), kad vēl bija dzīvs kāds pieprasījums. */
function lastFetchEndS(): number {
  return Math.max(0, ...calls.map((c) => c.startedAtS + (c.abortedAfterS ?? Number.POSITIVE_INFINITY)));
}

function neverAborted(): string[] {
  return [...new Set(calls.filter((c) => !c.aborted).map((c) => c.prefix))].sort();
}

function slowest(): string {
  const worst = [...calls].sort((a, b) => (b.abortedAfterS ?? 0) + b.startedAtS - ((a.abortedAfterS ?? 0) + a.startedAtS))[0];
  return worst ? `${worst.prefix} (sākts ${worst.startedAtS} s, pārtraukts pēc ${worst.abortedAfterS ?? "nekad"} s)` : "nav";
}

// Pats mērījums ir ~1 s; rezerve ir moduļu grafa ielādei, kad paralēli skrien daudz testu failu.
describe("apmaksāta pasūtījuma auto plūsma: sliktākais ilgums, kad avoti neatbild", { timeout: 30_000 }, () => {
  const report: Record<string, unknown> = {};

  beforeAll(async () => {
    // Iesilda moduļu transformāciju, lai tā neietilpst testa laikā.
    await import("@/lib/admin-paid-order-source-seed");
    await import("@/lib/order-vin-scan-run");
  }, 60_000);

  beforeEach(() => {
    calls = [];
    draftWrites.length = 0;
    replyFor = () => null;
    vi.stubGlobal("fetch", fakeFetch);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    // Viss "konfigurēts" ar viltus vērtībām, lai tiek mērīti garākie ceļi (releji, CapSolver, proxy).
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CAPSOLVER_API_KEY", "x".repeat(16));
    vi.stubEnv("VIN_PROXY_URL", "http://u:p@127.0.0.1:9");
    vi.stubEnv("MNT_RELAY_URL", "http://mnt-relay.test");
    vi.stubEnv("MNT_RELAY_TOKEN", "x".repeat(16));
    vi.stubEnv("IRISS_LISTINGS_RELAY_URL", "http://listings-relay.test");
    vi.stubEnv("IRISS_LISTINGS_RELAY_TOKEN", "x".repeat(16));
    vi.stubEnv("CSDD_RELAY_URL", "http://csdd-relay.test");
    vi.stubEnv("CSDD_RELAY_TOKEN", "x".repeat(16));
    vi.stubEnv("NUMMERPLADE_API_KEY", "x".repeat(16));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  /** Kopīgā daļa: mēra darbu, tad pieprasījumus, kas palika dzīvi pēc darba beigām. */
  async function run(label: string, job: Promise<unknown>) {
    const settledS = await measureSeconds(job);
    const liveAtSettle = [...new Set(calls.filter((c) => !c.aborted).map((c) => c.prefix))].sort();
    await drainLateAborts();
    const out = {
      settledS,
      lastFetchEndS: lastFetchEndS(),
      fetches: calls.length,
      hosts: [...new Set(calls.map((c) => c.prefix.split("/")[0]))].sort(),
      slowest: slowest(),
      liveAfterSettle: liveAtSettle,
      neverAborted: neverAborted(),
      noSignal: [...new Set(calls.filter((c) => !c.hasSignal).map((c) => c.prefix))].sort(),
    };
    report[label] = out;
    return out;
  }

  it("sēkla viena pati beidzas un pārtrauc visus savus pieprasījumus", async () => {
    const { seedPaidOrderAutoSources } = await loadFlow();
    const r = await run("seed", seedPaidOrderAutoSources(SESSION, { vin: VIN, listingUrl: LISTING_URL }));
    expect(r.settledS).not.toBeNull();
    expect(r.settledS as number).toBeLessThan(BUDGET_S);
    expect(r.fetches).toBeGreaterThan(0);
    expect(r.noSignal).toEqual([]);
    expect(r.neverAborted).toEqual([]);
    expect(r.lastFetchEndS).toBeLessThan(BUDGET_S);
    expect(draftWrites.some((w) => w.kind === "autoIngest")).toBe(true);
  });

  it("VIN SCAN viens pats beidzas un pārtrauc visus savus pieprasījumus", async () => {
    const { runOrderFreeVinScan } = await loadFlow();
    const r = await run("scan", runOrderFreeVinScan(SESSION, { vin: VIN, listingUrl: LISTING_URL }));
    const done = draftWrites.filter((w) => w.kind === "vinScan").at(-1)?.payload as
      | { status: string; indicators: Array<{ id: string; status: string }> }
      | undefined;
    report.scanStatuses = done?.indicators.filter((x) => !/^(browser_only|skipped|needs_input)$/.test(x.status)).map((x) => `${x.id}:${x.status}`);
    expect(r.settledS).not.toBeNull();
    expect(r.settledS as number).toBeLessThan(BUDGET_S);
    expect(done?.status).toBe("done");
    expect(r.fetches).toBeGreaterThan(0);
    expect(r.noSignal).toEqual([]);
    expect(r.neverAborted).toEqual([]);
    expect(r.lastFetchEndS).toBeLessThan(BUDGET_S);
  });

  it("abi paralēli (kā webhook) iekļaujas 280 s ar rezervi līdz maxDuration 300 s", async () => {
    const { seedPaidOrderAutoSources, runOrderFreeVinScan } = await loadFlow();
    const both = Promise.allSettled([
      seedPaidOrderAutoSources(SESSION, { vin: VIN, listingUrl: LISTING_URL }),
      runOrderFreeVinScan(SESSION, { vin: VIN, listingUrl: LISTING_URL }),
    ]);
    const r = await run("both", both);
    if (process.env.TIMING_REPORT === "1") process.stdout.write(`\nTIMING_REPORT ${JSON.stringify(report, null, 1)}\n`);
    expect(r.settledS).not.toBeNull();
    expect(r.settledS as number).toBeLessThan(BUDGET_S);
    expect(BUDGET_S).toBeLessThan(WEBHOOK_MAX_DURATION_S);
    const [seedRes, scanRes] = await both;
    expect(seedRes.status).toBe("fulfilled");
    expect(scanRes.status).toBe("fulfilled");
    // Pieprasījums bez AbortSignal vai nekad nepārtraukts karātos līdz maxDuration.
    expect(r.noSignal).toEqual([]);
    expect(r.neverAborted).toEqual([]);
    expect(r.lastFetchEndS).toBeLessThan(BUDGET_S);
  });

  /**
   * Sēklai nav ārējā termiņa, tāpēc garākā ķēde nav "viss klusē", bet "lēni, taču atbild":
   * lkf.ee forma atnāk pēdējā brīdī (44 s no 45 s), CapSolver pieņem uzdevumu un žetonu vai nu
   * nedod nemaz, vai iedod pēdējā brīdī (`tokenAtS`), un beigās lkf.ee POST klusē līdz savai noildzei.
   * Pārējie avoti klusē.
   */
  function slowLkfScenario(tokenAtS: number | null) {
    replyFor = (prefix, method) => {
      if (prefix.startsWith("lkf.ee/") && method === "GET") {
        return { afterMs: 44_000, body: '<form><input type="hidden" name="form_build_id" value="form-abc" /></form>' };
      }
      if (prefix.startsWith("api.capsolver.com/createTask")) return { afterMs: 100, body: JSON.stringify({ errorId: 0, taskId: "t1" }) };
      if (prefix.startsWith("api.capsolver.com/getTaskResult")) {
        const ready = tokenAtS != null && (Date.now() - t0) / 1000 >= tokenAtS;
        const body = ready
          ? { errorId: 0, status: "ready", solution: { gRecaptchaResponse: "fake-token" } }
          : { errorId: 0, status: "processing" };
        return { afterMs: 100, body: JSON.stringify(body) };
      }
      return null;
    };
  }

  it.each([
    { label: "ar sticky proxy, žetona nav", withProxy: true, tokenAtS: null, expectPost: false },
    { label: "ar sticky proxy, žetons pēdējā brīdī + lkf.ee POST klusē", withProxy: true, tokenAtS: 155, expectPost: true },
    { label: "bez proxy (ProxyLess, 2 mēģinājumi), žetona nav", withProxy: false, tokenAtS: null, expectPost: false },
    { label: "bez proxy, žetons 2. mēģinājuma beigās + lkf.ee POST klusē", withProxy: false, tokenAtS: 215, expectPost: true },
  ])("lēns lkf.ee + CapSolver ($label): abi paralēli iekļaujas 280 s", async ({ label, withProxy, tokenAtS, expectPost }) => {
    if (!withProxy) vi.stubEnv("VIN_PROXY_URL", "");
    slowLkfScenario(tokenAtS);
    const { seedPaidOrderAutoSources, runOrderFreeVinScan } = await loadFlow();
    const both = Promise.allSettled([
      seedPaidOrderAutoSources(SESSION, { vin: VIN, listingUrl: LISTING_URL }),
      runOrderFreeVinScan(SESSION, { vin: VIN, listingUrl: LISTING_URL }),
    ]);
    const r = await run(`slowLkf ${label}`, both);
    if (process.env.TIMING_REPORT === "1") {
      process.stdout.write(`\nTIMING_REPORT ${JSON.stringify({ label, settledS: r.settledS, lastFetchEndS: r.lastFetchEndS, slowest: r.slowest })}\n`);
    }
    expect(calls.some((c) => c.prefix.startsWith("api.capsolver.com/getTaskResult"))).toBe(true);
    // Sēklas lkf.ee POST (pēc žetona) ir ķēdes pēdējais posms; VIN SCAN pusē CapSolver tiek izlaists agrāk.
    const lkfPosts = calls.filter((c) => c.prefix.startsWith("lkf.ee/") && c.startedAtS > 60);
    expect(lkfPosts.length > 0).toBe(expectPost);
    expect(r.settledS).not.toBeNull();
    expect(r.settledS as number).toBeLessThan(BUDGET_S);
    expect(r.noSignal).toEqual([]);
    expect(r.neverAborted).toEqual([]);
    expect(r.lastFetchEndS).toBeLessThan(BUDGET_S);
  });
});
