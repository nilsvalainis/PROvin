import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@vercel/blob", () => ({
  get: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  put: vi.fn(async () => {
    throw new Error("blob disabled in test");
  }),
  del: vi.fn(async () => undefined),
  list: vi.fn(async () => ({ blobs: [] })),
}));

const draftRef: { current: Record<string, unknown> | null } = { current: null };
vi.mock("@/lib/admin-order-draft-store", async (orig) => ({
  ...(await orig<typeof import("@/lib/admin-order-draft-store")>()),
  readOrderDraft: vi.fn(async () => draftRef.current),
}));

const SID = "cs_test_link_1";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

describe("klienta atskaites saites krātuve", () => {
  let dir = "";

  beforeEach(() => {
    dir = mkdtempSync(path.join(os.tmpdir(), "client-report-link-"));
    vi.stubEnv("ADMIN_ORDER_DRAFT_DIR", dir);
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    draftRef.current = null;
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  const load = () => import("@/lib/client-report-link-store");

  it("ģenerē 256 bitu base64url tokenu; hešs sha256; salīdzināšana", async () => {
    const s = await load();
    const a = s.newClientReportLinkToken();
    const b = s.newClientReportLinkToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
    const h = s.hashClientReportLinkToken(a);
    expect(h).toMatch(/^[a-f0-9]{64}$/);
    expect(s.clientReportLinkHashesEqual(h, h)).toBe(true);
    expect(s.clientReportLinkHashesEqual(h, s.hashClientReportLinkToken(b))).toBe(false);
    expect(s.clientReportLinkHashesEqual(h, "nav-hešs")).toBe(false);
    expect(s.clientReportLinkHashesEqual("", "")).toBe(false);
  });

  it("izveide → atrod; tokens nekur nav saglabāts (tikai hešs)", async () => {
    const s = await load();
    const r = await s.createClientReportLink(SID, { locale: "lv", pdfVersion: 2 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const found = await s.findUsableClientReportLink(r.token);
    expect(found?.sessionId).toBe(SID);
    expect(found?.record.pdfVersionAtCreate).toBe(2);
    const all = walk(dir).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(all).not.toContain(r.token);
    expect(all).toContain(s.hashClientReportLinkToken(r.token));
  });

  it("nezināms / bojāts tokens → null", async () => {
    const s = await load();
    expect(await s.findUsableClientReportLink("x")).toBeNull();
    expect(await s.findUsableClientReportLink(s.newClientReportLinkToken())).toBeNull();
    expect(await s.findUsableClientReportLink("../../etc/passwd")).toBeNull();
  });

  it("derīgums: pēc termiņa → null", async () => {
    const s = await load();
    const now = Date.parse("2026-11-01T00:00:00Z");
    const r = await s.createClientReportLink(SID, { locale: "lv", nowMs: now });
    if (!r.ok) throw new Error("create");
    expect(await s.findUsableClientReportLink(r.token, now + 29 * 86400_000)).not.toBeNull();
    expect(await s.findUsableClientReportLink(r.token, now + 30 * 86400_000 + 1)).toBeNull();
  });

  it("konfigurējams derīgums (CLIENT_REPORT_LINK_TTL_DAYS)", async () => {
    vi.stubEnv("CLIENT_REPORT_LINK_TTL_DAYS", "2");
    const s = await load();
    const now = Date.parse("2026-11-01T00:00:00Z");
    const r = await s.createClientReportLink(SID, { locale: "lv", nowMs: now });
    if (!r.ok) throw new Error("create");
    expect(Date.parse(r.record.expiresAt) - now).toBe(2 * 86400_000);
  });

  it("atsaukšana un jauna saite atsauc veco", async () => {
    const s = await load();
    const r1 = await s.createClientReportLink(SID, { locale: "lv" });
    const r2 = await s.createClientReportLink(SID, { locale: "en" });
    if (!r1.ok || !r2.ok) throw new Error("create");
    expect(await s.findUsableClientReportLink(r1.token)).toBeNull();
    expect((await s.findUsableClientReportLink(r2.token))?.record.locale).toBe("en");
    const rev = await s.revokeClientReportLinks(SID);
    expect(rev.ok).toBe(true);
    expect(await s.findUsableClientReportLink(r2.token)).toBeNull();
  });

  it("cita pasūtījuma indekss nevar «aizņemties» svešu ierakstu", async () => {
    const s = await load();
    const r = await s.createClientReportLink(SID, { locale: "lv" });
    if (!r.ok) throw new Error("create");
    const h = s.hashClientReportLinkToken(r.token);
    // Indeksu pārraksta uz citu pasūtījumu - tur nav ieraksta ar šo hešu.
    writeFileSync(path.join(dir, "client_report_link_tokens", `${h}.json`), JSON.stringify({ sessionId: "cs_other", tokenHash: h }));
    expect(await s.findUsableClientReportLink(r.token)).toBeNull();
  });

  it("PDF info: nav nosūtīts → nav pieejams", async () => {
    const s = await load();
    const info = await s.readClientReportPdfInfo(SID);
    expect(info.available).toBe(false);
  });

  it("PDF: jaunākais nosūtītais client-reports/<id>.pdf; info no melnraksta", async () => {
    draftRef.current = { clientReportReadyAt: "2026-11-20T08:00:00.000Z", clientReportFilename: "PROVIN_AUDITS_WBA.pdf" };
    mkdirSync(path.join(dir, "client-reports"), { recursive: true });
    writeFileSync(path.join(dir, "client-reports", `${SID}.pdf`), "%PDF-1.4 latest");
    const s = await load();
    const info = await s.readClientReportPdfInfo(SID);
    expect(info).toMatchObject({ available: true, filename: "PROVIN_AUDITS_WBA.pdf", sentAt: "2026-11-20T08:00:00.000Z" });
    const bytes = await s.readLatestClientReportPdf(SID);
    expect(Buffer.from(bytes!).toString()).toBe("%PDF-1.4 latest");
  });

  it("PDF rezerve: versiju arhīvs tikai šī pasūtījuma mapē (ceļa aizsardzība)", async () => {
    const s0 = await load();
    mkdirSync(path.join(dir, "client-report-sends"), { recursive: true });
    mkdirSync(path.join(dir, "client-reports", SID), { recursive: true });
    mkdirSync(path.join(dir, "client-reports", "cs_other"), { recursive: true });
    writeFileSync(path.join(dir, "client-reports", "cs_other", "v1-x.pdf"), "%PDF other");
    writeFileSync(path.join(dir, "secret.pdf"), "%PDF secret");
    const log = (archivePath: string) =>
      writeFileSync(
        path.join(dir, "client-report-sends", `${SID}.json`),
        JSON.stringify([{ version: 1, sentAt: "2026-11-20T08:00:00Z", to: "x", filename: "a.pdf", lang: "lv", bytes: 1, archivePath }]),
      );

    log(path.join(dir, "client-reports", "cs_other", "v1-x.pdf"));
    expect(await s0.readLatestClientReportPdf(SID)).toBeNull();
    log(path.join(dir, "client-reports", SID, "..", "..", "secret.pdf"));
    expect(await s0.readLatestClientReportPdf(SID)).toBeNull();

    writeFileSync(path.join(dir, "client-reports", SID, "v1-a.pdf"), "%PDF own");
    log(path.join(dir, "client-reports", SID, "v1-a.pdf"));
    expect(Buffer.from((await s0.readLatestClientReportPdf(SID))!).toString()).toBe("%PDF own");
    expect(await s0.readLatestClientReportPdf("../cs_other")).toBeNull();
  });
});
