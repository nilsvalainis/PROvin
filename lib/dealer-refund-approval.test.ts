/**
 * Nils 26.11: dīlera datu atmaksa nekad automātiski - tikai pēc loga ar redzamu, labojamu tekstu.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { buildDealerStripeRefundBody, submitDealerStripeRefund } from "@/lib/admin-dealer-refund-submit";
import {
  DEALER_REFUND_AWAITING_LABEL,
  DEALER_REFUND_LOCK_MS,
  dealerDataAlertText,
  dealerDataListAlertLabel,
  decideDealerDataAlert,
  decideDealerRefundLock,
  describeDealerDataJob,
  normalizeDealerDataJob,
} from "@/lib/dealer-data-job-types";
import { dealerDataOperatorMessageEmailHtml } from "@/lib/email/html-templates";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe("nav automātiskas atmaksas", () => {
  it("Stripe atmaksu izveido TIKAI admina atmaksas API (loga poga), ne webhook / cron / ielase", () => {
    const root = process.cwd();
    const hits = ["app", "lib", "components"]
      .flatMap((d) => walk(join(root, d)))
      .filter((f) => /refunds\.create\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(root.length + 1));
    expect(hits).toEqual(["app/api/admin/dealer-data/refund/route.ts"]);
  });

  it("ielase un cron neizsauc atmaksas API un neliek klienta atmaksas e-pastu", () => {
    for (const f of ["lib/dealer-data-job.ts", "app/api/cron/dealer-data-sweep/route.ts", "app/api/webhooks/stripe/route.ts"]) {
      const src = readFileSync(join(process.cwd(), f), "utf8");
      expect(src, f).not.toContain("dealer-data/refund");
      expect(src, f).not.toContain("trySendDealerDataRefundEmail");
      expect(src, f).not.toContain("sendDealerDataRefundEmail");
    }
  });

  it("datu nav + nav atmaksāts -> «Gaida atmaksas apstiprinājumu» (sarkans sarakstā) un paziņojums Nilam", () => {
    const job = { status: "no_data" as const, attempts: 1, vin: "WAUZZZ4F87N058349" };
    expect(dealerDataListAlertLabel(job)).toBe(DEALER_REFUND_AWAITING_LABEL);
    expect(DEALER_REFUND_AWAITING_LABEL).toBe("Gaida atmaksas apstiprinājumu");
    expect(decideDealerDataAlert({ job, trigger: "webhook" })).toBe("no_data");
    const alert = dealerDataAlertText("no_data", job, { amountLabel: "17,49 €" });
    expect(alert.body).toMatch(/Gaida atmaksas apstiprinājumu/);
    expect(alert.body).toMatch(/«Atgriezt maksājumu»/);
    const full = normalizeDealerDataJob({ ...job, sessionId: "cs_x" }, "cs_x");
    expect(describeDealerDataJob(full)).toMatch(/Gaida atmaksas apstiprinājumu/);
  });

  it("jau atmaksātam - vairs nav atzīmes", () => {
    const refund = { at: "2026-11-26T18:00:00Z", amountCents: 1749, stripeRefundId: "re_1", by: "admin", reason: "r" };
    expect(dealerDataListAlertLabel({ status: "no_data", attempts: 1, refund })).toBeNull();
  });
});

describe("dubulta atmaksa nav iespējama (slēdzene)", () => {
  const now = Date.parse("2026-11-26T18:00:00.000Z");
  it("jau atmaksāts - vienmēr atteikums", () => {
    expect(decideDealerRefundLock({ refund: { at: "x", amountCents: 1, stripeRefundId: "re", by: "", reason: "" } }, now)).toEqual({
      ok: false,
      reason: "already_refunded",
    });
  });
  it("svaiga slēdzene - atteikums; veca (funkcija nogalināta) - atkal drīkst", () => {
    expect(decideDealerRefundLock({ refundPendingAt: new Date(now - 5_000).toISOString() }, now)).toEqual({
      ok: false,
      reason: "refund_in_progress",
    });
    expect(decideDealerRefundLock({ refundPendingAt: new Date(now - DEALER_REFUND_LOCK_MS - 1).toISOString() }, now)).toEqual({ ok: true });
    expect(decideDealerRefundLock(null, now)).toEqual({ ok: true });
  });
  it("slēdzene saglabājas nolasot", () => {
    const j = normalizeDealerDataJob({ vin: "X", status: "no_data", refundPendingAt: "2026-11-26T18:00:00.000Z" }, "cs_1");
    expect(j?.refundPendingAt).toBe("2026-11-26T18:00:00.000Z");
  });
});

describe("atmaksas logs sūta Nila rediģēto tekstu", () => {
  const input = {
    sessionId: "cs_live_1",
    channel: "email" as const,
    subject: "  Labots temats ",
    text: "Labots teksts\n\nAr cieņu,\nPROVIN.LV\n",
    lang: "en" as const,
    customerEmail: " klients@example.com ",
  };

  it("API ķermenī ir tieši rediģētais temats un teksts", () => {
    expect(buildDealerStripeRefundBody(input)).toEqual({
      sessionId: "cs_live_1",
      channel: "email",
      subject: "Labots temats",
      text: "Labots teksts\n\nAr cieņu,\nPROVIN.LV",
      lang: "en",
      customerEmail: "klients@example.com",
    });
  });

  it("submit: POST uz atmaksas API ar rediģēto tekstu; veiksme -> emailSent", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, emailSent: true, to: "klients@example.com", job: null }) }));
    const r = await submitDealerStripeRefund(input, fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/admin/dealer-data/refund");
    expect(JSON.parse(String(init.body))).toMatchObject({ subject: "Labots temats", text: "Labots teksts\n\nAr cieņu,\nPROVIN.LV" });
    expect(r).toMatchObject({ ok: true, emailSent: true });
  });

  it("Stripe kļūda -> ok:false ar skaidru tekstu (e-pasts nav nosūtīts)", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 502, json: async () => ({ error: "refund_failed", detail: "card", emailSent: false }) }));
    const r = await submitDealerStripeRefund(input, fetchImpl);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/e-pasts NAV nosūtīts/);
  });

  it("jau atmaksāts -> ok:false «otrreiz atmaksāt nevar»", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: "already_refunded" }) }));
    const r = await submitDealerStripeRefund(input, fetchImpl);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/otrreiz atmaksāt nevar/);
  });

  it("e-pastā nav «nosūtīts automātiski», jo to sūta cilvēks", () => {
    const html = dealerDataOperatorMessageEmailHtml({ text: "Labdien!\n\nAr cieņu,\nPROVIN.LV", lang: "en", humanSent: true, context: { situation: "no_data", productKind: "dealer" } });
    expect(html).not.toContain("sent automatically");
    const auto = dealerDataOperatorMessageEmailHtml({ text: "Labdien!", lang: "en" });
    expect(auto).toContain("This email was sent automatically.");
  });

  it("dialogs pēc veiksmes atgriežas uz pasūtījumu sarakstu", () => {
    const src = readFileSync(join(process.cwd(), "components/admin/AdminDealerRefundDialog.tsx"), "utf8");
    expect(src).toContain('DEALER_REFUND_DONE_HREF = "/admin/dashboard"');
    expect(src).toContain("window.location.assign(DEALER_REFUND_DONE_HREF)");
  });
});
