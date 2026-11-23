import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  AUTODNA_PENDING_SUMMARY,
  autodnaPrecheckUrl,
  formatAutodnaPrecheckDetail,
  parseAutodnaPrecheckDetail,
  parseAutodnaPrecheckHtml,
  readAutodnaPrecheck,
  type AutodnaHttp,
  type AutodnaPrecheckDeps,
} from "@/lib/vin-scan/autodna-precheck";

const VIN = "WAUZZZ8K4EA139196";
const fx = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");
const READY = fx("autodna-precheck-ready.html");
const PENDING = fx("autodna-precheck-pending.html");

describe("AutoDNA priekšskatījuma parseris", () => {
  it("nolasa kopskaitu, auto un visas sadaļas ar skaitu", () => {
    const page = parseAutodnaPrecheckHtml(READY);
    expect(page.state).toBe("ready");
    if (page.state !== "ready") return;
    expect(page.data.total).toBe(31);
    expect(page.data.vehicle).toBe("Audi A4 Allroad");
    expect(page.data.sections).toEqual([
      { name: "Transportlīdzekļa tehniskie dati", available: true, count: 10 },
      { name: "Transportlīdzekļa vēsture", available: true, count: 5 },
      { name: "Auto arhīva fotogrāfijas", available: false, count: 0 },
      { name: "Auto zādzības pārbaude", available: true, count: 14, of: 14 },
      { name: "Aprīkojums", available: false, count: 0 },
      { name: "Ražotāju atsaukumi", available: false, count: 0 },
      { name: "Iepriekšējie meklējumi", available: false, count: 0 },
      { name: "VIN koda pārbaude", available: true, count: null },
    ]);
  });

  it("gaidīšanas lapa (Turnstile) → pending ar sitekey", () => {
    const page = parseAutodnaPrecheckHtml(PENDING);
    expect(page).toEqual({ state: "pending", siteKey: "0x4AAAAAABhgcxYkqg6rrD7o" });
  });

  it("sveša lapa → unknown", () => {
    expect(parseAutodnaPrecheckHtml("<html><body>Kaut kas cits</body></html>").state).toBe("unknown");
  });

  it("detail formāts iet turp un atpakaļ", () => {
    const page = parseAutodnaPrecheckHtml(READY);
    if (page.state !== "ready") throw new Error("ready");
    const detail = formatAutodnaPrecheckDetail(page.data);
    expect(detail).toContain("Transportlīdzekļa vēsture: ir · 5");
    expect(detail).toContain("Auto zādzības pārbaude: ir · 14/14");
    expect(detail).toContain("VIN koda pārbaude: ir");
    expect(parseAutodnaPrecheckDetail(detail)).toEqual(page.data);
    expect(parseAutodnaPrecheckDetail("")).toBeNull();
  });
});

function deps(pages: Record<string, AutodnaHttp | AutodnaHttp[]>, over: Partial<AutodnaPrecheckDeps> = {}) {
  const calls: string[] = [];
  let t = 0;
  const d: AutodnaPrecheckDeps = {
    get: async (url) => {
      calls.push(url);
      const key = Object.keys(pages).find((k) => url.startsWith(k) && (k.includes("?") || !url.includes("?")));
      const v = key ? pages[key]! : { status: 404, text: "" };
      if (Array.isArray(v)) return v.length > 1 ? v.shift()! : v[0]!;
      return v;
    },
    solveTurnstile: null,
    isChallenge: (p) => /Just a moment/i.test(p.text),
    mergeCookie: (a, b) => [a, b].filter(Boolean).join("; "),
    sleep: async (ms) => {
      t += ms;
    },
    now: () => t,
    ...over,
  };
  return { d, calls };
}

describe("AutoDNA ielases plūsma", () => {
  const url = autodnaPrecheckUrl(VIN);

  it("gatava lapa: viens pieprasījums, found ar kopsavilkumu", async () => {
    const { d, calls } = deps({ [url]: { status: 200, text: READY } });
    const r = await readAutodnaPrecheck(VIN, d);
    expect(calls).toEqual([url]);
    expect(r.status).toBe("found");
    expect(r.summary).toBe("AutoDNA priekšskatījums: 31 ieraksti · vēsture 5 · arhīva foto 0");
    expect(r.openUrl).toBe("https://www.autodna.lv/vin/WAUZZZ8K4EA139196");
  });

  it("gaidīšanas lapa bez Turnstile: neko nemaksā, unknown ar norādi", async () => {
    const { d, calls } = deps({ [url]: { status: 200, text: PENDING } });
    const r = await readAutodnaPrecheck(VIN, d);
    expect(calls).toHaveLength(1);
    expect(r.status).toBe("unknown");
    expect(r.summary).toBe(AUTODNA_PENDING_SUMMARY);
  });

  it("ar Turnstile: žetons → gaida progresu → nolasa gatavo lapu", async () => {
    const { d, calls } = deps(
      {
        [`${url}?cf-turnstile-response=`]: { status: 200, text: "ok", cookie: "s=1" },
        "https://www.autodna.lv/ajax/get_precheck_progress?": [
          { status: 200, text: '{"count":3,"count_completed":0}' },
          { status: 200, text: '{"count":11,"count_completed":1}' },
        ],
        [url]: [
          { status: 200, text: PENDING, cookie: "a=1" },
          { status: 200, text: READY },
        ],
      },
      { solveTurnstile: async (key) => (key === "0x4AAAAAABhgcxYkqg6rrD7o" ? { ok: true, token: "TOK" } : { ok: false, reason: "key" }) },
    );
    const r = await readAutodnaPrecheck(VIN, d);
    expect(r.status).toBe("found");
    expect(calls[1]).toBe(`${url}?cf-turnstile-response=TOK`);
    expect(calls.filter((c) => c.includes("get_precheck_progress"))).toHaveLength(2);
    expect(calls.at(-1)).toBe(url);
  });

  it("Cloudflare izaicinājums → blocked", async () => {
    const { d } = deps({ [url]: { status: 403, text: "<title>Just a moment...</title>" } });
    expect((await readAutodnaPrecheck(VIN, d)).status).toBe("blocked");
  });
});
