import { describe, expect, it } from "vitest";

import { FakeElement, runUserscriptAt } from "@/lib/vin-scan/test-helpers/userscript-vm";

/** Izdomāts VIN (anonimizēts). */
const VIN = "VF1AAAAA012345678";
const PEEK = "8e51f2ea-0000-4000-8000-000000000001";
const REPORT_URL = `https://checkcar.vin/report/check/${VIN}`;
const REPORT_TEXT = `Vehicle history report\nVIN: ${VIN}\nAuction sale history\nSOLD #1\nAUTOBID\n14/03/2025`;

const flush = async (times = 6) => {
  for (let i = 0; i < times; i += 1) await new Promise((r) => setImmediate(r));
};

class FakeFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    this.result = "data:image/jpeg;base64,/9j/AAAA";
    this.onload?.();
  }
}

function photo(src: string, label: string) {
  const img = new FakeElement("img", { attrs: { src } }) as FakeElement & { parentElement: unknown };
  img.parentElement = { innerText: label, parentElement: null };
  return img;
}

function gmJson(run: ReturnType<typeof runUserscriptAt>, key: string) {
  const raw = run.gm.set.get(key);
  return raw ? JSON.parse(String(raw)) : null;
}

function sendButton(run: ReturnType<typeof runUserscriptAt>) {
  return run.created.find((el) => el.id === "provin-ccfull-send");
}

describe("checkcar.vin pilnā atskaite: poga «Nosūtīt uz PROVIN»", () => {
  it("atskaites lapā parādās poga, bet nekas netiek sūtīts, pirkts vai pāradresēts bez klikšķa", () => {
    const run = runUserscriptAt(REPORT_URL, { bodyText: REPORT_TEXT, gm: { provin_pending_vin: VIN } });
    run.tickIntervals();
    expect(run.errors).toEqual([]);
    expect(sendButton(run)?.textContent).toBe("Nosūtīt uz PROVIN");
    expect(run.gm.set.has("provin_ccfull_job")).toBe(false);
    expect(run.gm.xhr).toEqual([]);
  });

  it("pilnā atskaite citā ceļā ar VIN tekstā netiek pāradresēta uz pārbaudes lapu", () => {
    const run = runUserscriptAt("https://checkcar.vin/report/full/abc123", {
      bodyText: REPORT_TEXT,
      gm: { provin_pending_vin: VIN },
    });
    for (let i = 0; i < 5; i += 1) run.tickIntervals();
    expect(run.assigned).toEqual([]);
    expect(sendButton(run)).toBeDefined();
  });

  it("sākumlapā bez atskaites pogas nav", () => {
    const run = runUserscriptAt("https://checkcar.vin/", { bodyText: "Check any VIN" });
    run.tickIntervals();
    expect(sendButton(run)).toBeUndefined();
  });

  it("pēc klikšķa nodod darbu adminam, lejupielādē foto savā pārlūkā un sūta partijās", async () => {
    const run = runUserscriptAt(REPORT_URL, {
      bodyText: REPORT_TEXT,
      elements: [
        photo("https://cdn.checkcar.vin/lots/1.jpg", "Autobid auction 14/03/2025"),
        photo("https://cdn.checkcar.vin/lots/2.jpg", "Autobid auction 14/03/2025"),
        photo("https://checkcar.vin/static/logo.png", "Autobid"),
      ],
      globals: { FileReader: FakeFileReader },
    });
    const btn = sendButton(run)!;
    btn.emit("click");
    const job = gmJson(run, "provin_ccfull_job");
    expect(job).toMatchObject({ vin: VIN, pageUrl: REPORT_URL });
    expect(job.text).toContain("Auction sale history");
    expect(job.groups).toEqual([
      { label: "Autobid auction 14/03/2025", urls: ["https://cdn.checkcar.vin/lots/1.jpg", "https://cdn.checkcar.vin/lots/2.jpg"] },
    ]);

    /* Admin cilne atbild: dati ielikti, viens foto jau galerijā. */
    run.gm.set.set(
      "provin_ccfull_status",
      JSON.stringify({
        jobId: job.jobId,
        stage: "ready",
        sessionId: "cs_test",
        groups: [{ title: "CheckCar.vin · Autobid · 14.03.2025", urls: job.groups[0].urls }],
        knownUrls: ["https://cdn.checkcar.vin/lots/1.jpg"],
      }),
    );
    run.tickIntervals(500);
    await flush();
    expect(run.gm.xhr.map((r) => r.url)).toEqual(["https://cdn.checkcar.vin/lots/2.jpg"]);
    expect(run.gm.xhr[0]).toMatchObject({ method: "GET", responseType: "blob" });
    run.gm.xhr[0]!.onload?.({ status: 200, response: { size: 2048 } } as never);
    await flush();
    const batch = gmJson(run, "provin_ccfull_batch");
    expect(batch).toMatchObject({ jobId: job.jobId, n: 0, last: true, downloadFailed: 0 });
    expect(batch.items).toEqual([
      { title: "CheckCar.vin · Autobid · 14.03.2025", url: "https://cdn.checkcar.vin/lots/2.jpg", dataUrl: "data:image/jpeg;base64,/9j/AAAA" },
    ]);

    run.gm.set.set("provin_ccfull_ack", JSON.stringify({ jobId: job.jobId, n: 0, uploaded: 1, failed: 0 }));
    run.gm.set.set("provin_ccfull_status", JSON.stringify({ jobId: job.jobId, stage: "done", message: "gatavs - 1 foto" }));
    for (let i = 0; i < 4; i += 1) {
      run.tickIntervals(500);
      await flush();
    }
    expect(btn.textContent).toBe("gatavs - 1 foto");
    expect(run.errors).toEqual([]);
  });

  it("ja admin cilne neatbild, atver PROVIN adminu", async () => {
    const run = runUserscriptAt(REPORT_URL, { bodyText: REPORT_TEXT });
    sendButton(run)!.emit("click");
    run.advance(7000);
    run.tickIntervals(500);
    expect(run.opened).toEqual([{ url: "https://www.provin.lv/admin", target: "_blank" }]);
  });
});

describe("PROVIN admin cilne: CheckCar darba pārsūtīšana", () => {
  it("nosūta atskaiti serverim, tad foto uz cc-vin-photo un piesaista grupām", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchMock = async (url: string, init?: { body?: unknown }) => {
      calls.push({ url, body: init?.body });
      const json = (data: unknown) => ({ status: 200, json: async () => data });
      if (init?.body instanceof FormData) return json({ ok: true, id: "ih_ph_000000000000000000000009" });
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.action === "prepare") {
        return json({
          ok: true,
          target: { kind: "quick_eval", id: PEEK },
          summary: "2 pārdošanas",
          groups: [{ title: "T", urls: ["https://cdn.checkcar.vin/lots/2.jpg"] }],
          knownUrls: [],
          alternatives: [],
        });
      }
      return json({ ok: true, added: 1 });
    };
    const run = runUserscriptAt(`https://www.provin.lv/admin/atras-vertesanas/${PEEK}`, {
      gm: { provin_ccfull_job: JSON.stringify({ jobId: "j1", vin: VIN, text: REPORT_TEXT, groups: [], at: 1 }) },
      globals: { fetch: fetchMock, FormData, Blob, Uint8Array, atob },
    });
    run.tickIntervals(1000);
    await flush();
    expect(calls[0]?.url).toBe("/api/admin/checkcar-import");
    expect(JSON.parse(String(calls[0]?.body))).toMatchObject({
      action: "prepare",
      vin: VIN,
      hint: { kind: "quick_eval", id: PEEK },
    });
    expect(run.gm.set.has("provin_ccfull_job")).toBe(false);
    expect(gmJson(run, "provin_ccfull_status")).toMatchObject({ jobId: "j1", stage: "ready", target: { kind: "quick_eval", id: PEEK } });

    run.gm.set.set(
      "provin_ccfull_batch",
      JSON.stringify({ jobId: "j1", n: 0, last: true, items: [{ title: "T", url: "https://cdn.checkcar.vin/lots/2.jpg", dataUrl: "data:image/jpeg;base64,/9j/AAAA" }] }),
    );
    run.tickIntervals(1000);
    await flush(12);
    expect(calls.some((c) => c.url.startsWith("data:"))).toBe(false);
    const upload = calls.find((c) => c.body instanceof FormData);
    expect(upload?.url).toBe("/api/admin/checkcar-import");
    expect((upload?.body as FormData).get("action")).toBe("photo");
    expect((upload?.body as FormData).get("kind")).toBe("quick_eval");
    expect((upload?.body as FormData).get("id")).toBe(PEEK);
    expect(((upload?.body as FormData).get("file") as Blob).size).toBe(6);
    const attach = calls.map((c) => (typeof c.body === "string" ? JSON.parse(c.body) : null)).find((b) => b?.action === "attach");
    expect(attach).toEqual({
      action: "attach",
      kind: "quick_eval",
      id: PEEK,
      photos: [{ id: "ih_ph_000000000000000000000009", title: "T", sourceUrl: "https://cdn.checkcar.vin/lots/2.jpg" }],
    });
    expect(gmJson(run, "provin_ccfull_ack")).toMatchObject({ jobId: "j1", n: 0, uploaded: 1, failed: 0 });
    expect(gmJson(run, "provin_ccfull_status")).toMatchObject({ stage: "done", uploaded: 1 });
    expect(run.errors).toEqual([]);
  });

  it("vispārīga admin cilne dod priekšroku atvērtai detaļu lapai (3 s), tad paņem darbu bez norādes", async () => {
    const calls: unknown[] = [];
    const run = runUserscriptAt("https://www.provin.lv/admin", {
      gm: { provin_ccfull_job: JSON.stringify({ jobId: "j3", vin: VIN, text: REPORT_TEXT, groups: [], at: Date.parse("2026-11-17T10:00:00.000Z") }) },
      globals: {
        fetch: async (_url: string, init?: { body?: unknown }) => {
          calls.push(JSON.parse(String(init?.body)));
          return { status: 200, json: async () => ({ ok: true, target: { kind: "order", id: "cs_x" }, groups: [], knownUrls: [] }) };
        },
      },
    });
    run.tickIntervals(1000);
    await flush();
    expect(calls).toEqual([]);
    run.advance(3500);
    run.tickIntervals(1000);
    await flush();
    expect(calls).toEqual([expect.objectContaining({ action: "prepare", hint: null })]);
  });

  it("SPA pāreja uz pasūtījuma lapu: norāde no dzīvā ceļa; citam VIN prasa apstiprinājumu un sūta ar confirmHint", async () => {
    const calls: Record<string, unknown>[] = [];
    const confirms: string[] = [];
    const run = runUserscriptAt("https://www.provin.lv/admin", {
      gm: { provin_ccfull_job: JSON.stringify({ jobId: "j4", vin: VIN, text: REPORT_TEXT, groups: [], at: 1 }) },
      globals: {
        fetch: async (_url: string, init?: { body?: unknown }) => {
          const body = JSON.parse(String(init?.body));
          calls.push(body);
          if (!body.confirmHint) {
            return {
              status: 409,
              json: async () => ({ ok: false, error: "hint_vin_mismatch", vin: VIN, hintVins: [], alternatives: [] }),
            };
          }
          return { status: 200, json: async () => ({ ok: true, target: { kind: "order", id: "cs_live_abc" }, groups: [], knownUrls: [] }) };
        },
      },
    });
    /* Admin ir SPA: operators no saraksta atvēra pasūtījumu bez lapas pārlādes. */
    (run.window.location as { pathname: string }).pathname = "/admin/orders/cs_live_abc";
    run.window.confirm = (msg: string) => {
      confirms.push(msg);
      return true;
    };
    run.tickIntervals(1000);
    await flush(10);
    expect(calls[0]).toMatchObject({ action: "prepare", hint: { kind: "order", id: "cs_live_abc" } });
    expect(confirms[0]).toContain(VIN);
    expect(confirms[0]).toContain("nav zināms");
    expect(calls[1]).toMatchObject({ action: "prepare", confirmHint: true, hint: { kind: "order", id: "cs_live_abc" } });
    expect(gmJson(run, "provin_ccfull_status")).toMatchObject({ jobId: "j4", stage: "ready", target: { id: "cs_live_abc" } });
  });

  it("servera kļūdu nodod checkcar cilnei latviski", async () => {
    const run = runUserscriptAt("https://www.provin.lv/admin", {
      gm: { provin_ccfull_job: JSON.stringify({ jobId: "j2", vin: VIN, text: REPORT_TEXT, groups: [] }) },
      globals: { fetch: async () => ({ status: 404, json: async () => ({ ok: false, error: "order_not_found" }) }) },
    });
    run.tickIntervals(1000);
    await flush();
    expect(gmJson(run, "provin_ccfull_status")).toMatchObject({
      jobId: "j2",
      stage: "error",
      message: "PROVIN nav pasūtījuma ar VIN VF1AAAAA012345678 - atver pasūtījuma lapu adminā un nosūti vēlreiz",
    });
  });
});
