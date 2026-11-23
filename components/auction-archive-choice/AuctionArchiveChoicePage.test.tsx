import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuctionArchiveOfferDoc } from "@/lib/auction-archive-offer";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }) }));
const rl = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => rl(...(a as [])) }));
const find = vi.fn();
const preview = vi.fn();
vi.mock("@/lib/auction-archive-offer-store", () => ({
  findAuctionArchiveOfferByToken: (t: string) => find(t),
  readAuctionArchivePreview: (s: string, n: number) => preview(s, n),
}));
const record = vi.fn();
vi.mock("@/lib/auction-archive-offer-service", () => ({ recordAuctionArchiveChoice: (a: unknown) => record(a) }));

import Page, { generateMetadata } from "@/app/izsoles-izvele/[locale]/[token]/page";
import { POST, GET } from "@/app/api/izvele/[token]/route";
import { GET as FOTO } from "@/app/api/izvele/[token]/foto/[n]/route";

const TOKEN = "k".repeat(43);
const NOW = Date.now();
const ph = (n: number) => `ih_ph_${String(n).padStart(24, "0")}`;

function doc(over: Partial<AuctionArchiveOfferDoc> = {}): AuctionArchiveOfferDoc {
  return {
    sessionId: "cs_test_1",
    status: "pending",
    tokenHash: "a".repeat(64),
    createdAt: new Date(NOW).toISOString(),
    expiresAt: new Date(NOW + 864e5).toISOString(),
    locale: "lv",
    channel: "email",
    paidCents: 2499,
    summary: {
      vin: "WAUZZZF43PA018831",
      title: "Audi A4 Avant 40 TDI",
      auctions: [
        { key: "openlane:1", date: "2026-10-21", platform: "Openlane", country: "Itālija", km: 193320, priceEur: 13070, photos: 84 },
        { key: "bca:2", date: "2026-10-21", platform: "BCA", country: "Itālija", km: 193320, priceEur: 12410, photos: 0 },
      ],
      photoCount: 84,
      manualSources: [],
    },
    photos: [],
    photosMissing: 0,
    previewIds: [ph(1)],
    marks: [],
    history: [],
    ...over,
  };
}

const params = (locale = "lv", token = TOKEN, sp: Record<string, string> = {}) => ({
  params: Promise.resolve({ locale, token }),
  searchParams: Promise.resolve(sp),
});

async function html(p = params()) {
  return renderToStaticMarkup(await Page(p));
}

describe("izvēles lapa (SSR)", () => {
  beforeEach(() => {
    rl.mockClear();
    rl.mockImplementation(async () => ({ ok: true }));
    find.mockReset();
    record.mockReset();
    preview.mockReset();
  });

  it("noindex + no-referrer", async () => {
    const m = await generateMetadata(params());
    expect(m.robots).toMatchObject({ index: false, follow: false });
    expect(m.referrer).toBe("no-referrer");
  });

  it("forma ar divām opcijām un «Apstiprināt» (POST), bez personas datiem", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc() });
    const out = await html();
    expect(out).toContain("Izvēlieties, kā turpināt");
    expect(out).toContain(`action="/api/izvele/${TOKEN}"`);
    expect(out).toContain('method="post"');
    expect(out).toContain("Bez piemaksas · 2 izsoles · 84 bildes");
    expect(out).toContain("24,99 € uz karti");
    expect(out).toContain("Apstiprināt");
    expect(out).not.toContain("cs_test_1");
    // GET neko nemaina.
    expect(record).not.toHaveBeenCalled();
  });

  it("pēc izvēles - «Paldies» + «Mainīt izvēli»; ar ?mainit=1 - forma ar iepriekšējo izvēli", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc({ status: "chose_refund", choice: "refund" }) });
    const thanks = await html();
    expect(thanks).toContain("Atmaksa pieteikta");
    expect(thanks).toContain("24,99 € atgriezīsim");
    expect(thanks).toContain(`/lv/izvele/${TOKEN}?mainit=1`);
    const form = await html(params("lv", TOKEN, { mainit: "1" }));
    expect(form).toMatch(/checked="" value="refund"/);
    expect(form).not.toMatch(/checked="" value="archive"/);
  });

  it("PDF nosūtīts → noslēgts; beigusies / nav / rate limit → neitrāla lapa", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc({ status: "archive_sent", choice: "archive" }) });
    expect(await html()).toContain("jau nosūtīts");
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc({ expiresAt: new Date(NOW - 1).toISOString() }) });
    expect(await html()).toContain("Saite vairs nav derīga");
    find.mockResolvedValue(null);
    expect(await html()).toContain("Saite vairs nav derīga");
    rl.mockImplementation(async () => ({ ok: false }));
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc() });
    expect(await html()).toContain("Saite vairs nav derīga");
  });

  it("e-pasta poga iepriekš atzīmē variantu (?v=), bet neko nesaglabā", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc() });
    expect(await html(params("lv", TOKEN, { v: "refund" }))).toMatch(/checked="" value="refund"/);
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc({ status: "chose_archive", choice: "archive" }) });
    expect(await html(params("lv", TOKEN, { v: "refund" }))).toContain("Apstiprināt");
    expect(record).not.toHaveBeenCalled();
  });

  it("angliski", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc({ locale: "en" }) });
    expect(await html(params("en"))).toContain("Choose how to continue");
  });
});

function form(body: Record<string, string>, headers: Record<string, string> = {}) {
  const fd = new URLSearchParams(body);
  return new Request(`https://www.provin.lv/api/izvele/${TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://www.provin.lv", ...headers },
    body: fd.toString(),
  });
}
const ctx = { params: Promise.resolve({ token: TOKEN }) };

describe("izvēles POST", () => {
  beforeEach(() => {
    rl.mockImplementation(async () => ({ ok: true }));
    find.mockReset();
    record.mockReset();
  });

  it("apstiprinājums saglabā izvēli un 303 atpakaļ uz lapu", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc() });
    record.mockResolvedValue({ ok: true, doc: doc(), changed: true });
    const res = await POST(form({ choice: "archive", locale: "lv" }), ctx);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`https://www.provin.lv/lv/izvele/${TOKEN}?r=ok`);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(record).toHaveBeenCalledWith({ sessionId: "cs_test_1", choice: "archive", via: "link" });
  });

  it("bez izvēles / svešs avots / beigusies saite - neko nesaglabā", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc() });
    expect((await POST(form({ locale: "lv" }), ctx)).headers.get("location")).toContain("?r=pick");
    expect((await POST(form({ choice: "archive" }, { origin: "https://evil.example" }), ctx)).headers.get("location")).toContain("?r=err");
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc({ expiresAt: new Date(NOW - 1).toISOString() }) });
    await POST(form({ choice: "refund" }), ctx);
    expect(record).not.toHaveBeenCalled();
  });

  it("GET uz API neko nemaina (skeneri)", async () => {
    const res = await GET(new Request(`https://www.provin.lv/api/izvele/${TOKEN}?choice=archive`), ctx);
    expect(res.status).toBe(303);
    expect(record).not.toHaveBeenCalled();
    expect(find).not.toHaveBeenCalled();
  });
});

describe("izplūdinātās bildes", () => {
  it("tikai 0..N-1 no priekšskatījumiem, derīga saite", async () => {
    find.mockResolvedValue({ sessionId: "cs_test_1", doc: doc() });
    preview.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    const ok = await FOTO(new Request("https://x/"), { params: Promise.resolve({ token: TOKEN, n: "0" }) });
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/jpeg");
    const second = await FOTO(new Request("https://x/"), { params: Promise.resolve({ token: TOKEN, n: "1" }) });
    expect(second.status).toBe(404);
    const bad = await FOTO(new Request("https://x/"), { params: Promise.resolve({ token: TOKEN, n: "../0" }) });
    expect(bad.status).toBe(404);
  });
});
