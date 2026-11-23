import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4" }) }));
const rl = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => rl(...(a as [])) }));
const find = vi.fn();
vi.mock("@/lib/client-report-link-store", () => ({ findUsableClientReportLink: (t: string) => find(t) }));
const loadView = vi.fn();
vi.mock("@/lib/client-report-link-page", () => ({ loadClientReportLinkView: (a: unknown) => loadView(a) }));

import Page, { generateMetadata } from "@/app/klienta-atskaite/[locale]/[token]/page";

const TOKEN = "k".repeat(43);
const params = (locale = "lv", token = TOKEN) => ({ params: Promise.resolve({ locale, token }) });

const VIEW = {
  locale: "lv" as const,
  product: "dealer" as const,
  vin: "WBA5R1C0XLFH42873",
  date: "20.11.2026",
  facts: [
    { value: "14", label: "servisa ieraksti" },
    { value: "2024", label: "pēdējais ieraksts" },
  ],
  pdfHref: `/api/atskaite/${TOKEN}`,
  downloadHref: `/api/atskaite/${TOKEN}?dl=1`,
  offer: {
    href: "/lv/papildinajums/0123456789abcdef0123456789abcdef",
    priorLabel: "24,99 €",
    chargeLabel: "75,00 €",
    totalLabel: "99,99 €",
    validUntil: "20.12.2026",
  },
};

describe("klienta atskaites lapa (SSR)", () => {
  beforeEach(() => {
    rl.mockClear();
    rl.mockResolvedValue({ ok: true });
    find.mockReset();
    loadView.mockReset();
  });

  it("metadati: noindex, nofollow, no-referrer", async () => {
    const m = await generateMetadata(params());
    expect(m.robots).toMatchObject({ index: false, follow: false });
    expect(m.referrer).toBe("no-referrer");
  });

  it("nederīgs / beidzies / atsaukts → neitrāla lapa bez pasūtījuma informācijas", async () => {
    find.mockResolvedValue(null);
    const html = renderToStaticMarkup(await Page(params()));
    expect(html).toContain("Saite vairs nav derīga");
    expect(html).toContain("info@provin.lv");
    expect(html).not.toMatch(/\bVIN\b/);
    expect(loadView).not.toHaveBeenCalled();
  });

  it("rate limit → neitrāla lapa, krātuvi nelasa", async () => {
    rl.mockResolvedValue({ ok: false });
    const html = renderToStaticMarkup(await Page(params()));
    expect(html).toContain("Saite vairs nav derīga");
    expect(find).not.toHaveBeenCalled();
  });

  it("PDF vairs nav → neitrāla lapa", async () => {
    find.mockResolvedValue({ sessionId: "cs_1", record: {} });
    loadView.mockResolvedValue(null);
    expect(renderToStaticMarkup(await Page(params()))).toContain("Saite vairs nav derīga");
  });

  it("derīga saite: statuss, fakti, PDF pogas, AUDITS piedāvājums, kontakti; bez personas datiem", async () => {
    find.mockResolvedValue({ sessionId: "cs_1", record: {} });
    loadView.mockResolvedValue(VIEW);
    const html = renderToStaticMarkup(await Page(params()));
    expect(html).toContain("Oficiālā dīlera dati");
    expect(html).toContain("Atskaite gatava");
    expect(html).toContain("WBA5R1C0XLFH42873");
    expect(html).toContain("20.11.2026");
    expect(html).toContain("servisa ieraksti");
    expect(html).toContain(`href="/api/atskaite/${TOKEN}"`);
    expect(html).toContain(`href="/api/atskaite/${TOKEN}?dl=1"`);
    expect(html).toContain("Atvērt PDF");
    expect(html).toContain("Lejupielādēt PDF");
    expect(html).toContain("/lv/papildinajums/0123456789abcdef0123456789abcdef");
    expect(html).toContain("Pasūtīt pilno auditu par 75,00 €");
    expect(html).toContain("+371 29 502 039");
    expect(html).not.toMatch(/Sagatavots klientam/);
    expect(html).not.toContain("cs_1");
    expect(find).toHaveBeenCalledWith(TOKEN);
  });

  it("bez piedāvājuma un bez faktiem - bloku nerāda; angļu valoda", async () => {
    find.mockResolvedValue({ sessionId: "cs_1", record: {} });
    loadView.mockResolvedValue({ ...VIEW, locale: "en", product: "audits", facts: [], offer: null });
    const html = renderToStaticMarkup(await Page(params("en")));
    expect(html).toContain("Open PDF");
    expect(html).toContain("PROVIN AUDITS");
    expect(html).not.toContain("data-report-offer");
    expect(html).not.toContain("data-report-facts");
  });

  it("kļūda krātuvē → neitrāla lapa", async () => {
    find.mockRejectedValue(new Error("boom"));
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(renderToStaticMarkup(await Page(params()))).toContain("Saite vairs nav derīga");
    expect(String(err.mock.calls[0]?.join(" "))).not.toContain(TOKEN);
    err.mockRestore();
  });
});
