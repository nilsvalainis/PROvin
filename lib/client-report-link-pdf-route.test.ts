import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const rl = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => rl(...(a as [])) }));
const find = vi.fn();
const readPdf = vi.fn();
const info = vi.fn();
vi.mock("@/lib/client-report-link-store", () => ({
  findUsableClientReportLink: (t: string) => find(t),
  readLatestClientReportPdf: (s: string) => readPdf(s),
  readClientReportPdfInfo: (s: string) => info(s),
}));

import { GET } from "@/app/api/atskaite/[token]/route";

const TOKEN = "p".repeat(43);
const call = (q = "", token = TOKEN) =>
  GET(new Request(`https://www.provin.lv/api/atskaite/${token}${q}`), { params: Promise.resolve({ token }) });

describe("klienta atskaites PDF maršruts", () => {
  beforeEach(() => {
    rl.mockResolvedValue({ ok: true });
    find.mockReset();
    readPdf.mockReset();
    info.mockReset();
    info.mockResolvedValue({ available: true, version: 1, sentAt: null, filename: "PROVIN_AUDITS_WBA.pdf", lang: "lv" });
  });

  it("nederīgs tokens → 404 neitrāls teksts, noindex, no-store, no-referrer", async () => {
    find.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.text()).toContain("info@provin.lv");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
    expect(readPdf).not.toHaveBeenCalled();
  });

  it("rate limit → 429, krātuvi nelasa", async () => {
    rl.mockResolvedValue({ ok: false });
    expect((await call()).status).toBe(429);
    expect(find).not.toHaveBeenCalled();
  });

  it("derīgs: PDF inline; ceļu nosaka tikai ieraksta sessionId", async () => {
    find.mockResolvedValue({ sessionId: "cs_owner", record: {} });
    readPdf.mockResolvedValue(new TextEncoder().encode("%PDF-1.4"));
    const res = await call("?path=../../cs_other.pdf&sessionId=cs_other");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('inline; filename="PROVIN_AUDITS_WBA.pdf"');
    expect(res.headers.get("cache-control")).toContain("private");
    expect(res.headers.get("x-robots-tag")).toContain("noindex");
    expect(readPdf).toHaveBeenCalledWith("cs_owner");
    expect(new TextDecoder().decode(await res.arrayBuffer())).toBe("%PDF-1.4");
  });

  it("?dl=1 → attachment", async () => {
    find.mockResolvedValue({ sessionId: "cs_owner", record: {} });
    readPdf.mockResolvedValue(new TextEncoder().encode("%PDF-1.4"));
    const res = await call("?dl=1");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment;/);
  });

  it("PDF nav atrasts → 404", async () => {
    find.mockResolvedValue({ sessionId: "cs_owner", record: {} });
    readPdf.mockResolvedValue(null);
    expect((await call()).status).toBe(404);
  });
});
