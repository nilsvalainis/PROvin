import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createJobQueue } from "@/relay/provin-ltab/lib/jobs.mjs";
import {
  classifySnapshot,
  extractVerificationCode,
  isAllowedHost,
  isConsentLabel,
  isNightInRiga,
  isPdfControlText,
  isSearchButtonText,
  isValidPersonalCode,
  isValidPlate,
  redact,
} from "@/relay/provin-ltab/lib/ltab-page.mjs";

const FAKE_CODE = "010101-12345";

const ltabSearch = {
  host: "services.ltab.lv",
  text: "Transportlīdzekļa zaudējumu dati. Ievadiet reģistrācijas numuru",
  checkboxes: [{ label: "Apliecinu, ka dati tiks izmantoti likumīgi", checked: false, visible: true }],
  inputs: [{ label: "Reģistrācijas numurs", type: "text", visible: true }],
  buttons: [{ text: "Meklēt", visible: true }],
  hasVdar: false,
};

describe("LTAB relejs: lapu atpazīšana", () => {
  it("recognises the LTAB start page by the #vdar consent checkbox", () => {
    expect(classifySnapshot({ host: "services.ltab.lv", text: "Piekrītu, pieslēgties ar Latvija.lv", hasVdar: true })).toBe("ltab_login");
  });

  it("treats the search form as search before submit even though the title says 'zaudējumu dati'", () => {
    expect(classifySnapshot(ltabSearch, { submitted: false })).toBe("ltab_search");
  });

  it("after submit: 'nav atrasts' is no claims, CSNg rows with a PDF button are claims", () => {
    expect(classifySnapshot({ ...ltabSearch, text: "Pēc norādītajiem datiem ieraksti nav atrasti" }, { submitted: true })).toBe("ltab_result_none");
    expect(
      classifySnapshot(
        { ...ltabSearch, text: "Negadījumu skaits: 2. CSNg 12.03.2021 Cietušais 2930,00", buttons: [{ text: "Lejupielādēt PDF", visible: true }] },
        { submitted: true },
      ),
    ).toBe("ltab_result_found");
    expect(classifySnapshot({ ...ltabSearch, text: "Negadījumu skaits: 0" }, { submitted: true })).toBe("ltab_result_none");
  });

  it("latvija.lv: method choice, personal code form, waiting for the phone with a control code", () => {
    expect(classifySnapshot({ host: "latvija.lv", text: "Izvēlieties autentifikācijas veidu", buttons: [{ text: "Smart-ID", visible: true }] })).toBe("latvija_choose");
    expect(
      classifySnapshot({ host: "www.latvija.lv", text: "Smart-ID pieteikšanās", inputs: [{ label: "Personas kods", type: "text", visible: true }] }),
    ).toBe("latvija_code_input");
    expect(classifySnapshot({ host: "latvija.lv", text: "Smart-ID. Kontroles kods: 4821. Pārbaudiet telefonā" })).toBe("latvija_wait");
  });

  it("stops on captcha on any host", () => {
    expect(classifySnapshot({ host: "services.ltab.lv", text: "Lūdzu apstipriniet, ka neesmu robots", hasVdar: true })).toBe("captcha");
  });

  it("reads the 4-digit Smart-ID control code", () => {
    expect(extractVerificationCode("Kontroles kods\n 4821 \nApstipriniet")).toBe("4821");
    expect(extractVerificationCode("Verifikācijas kods: 0193")).toBe("0193");
    expect(extractVerificationCode("Ievadiet personas kodu")).toBeNull();
  });

  it("ticks consent boxes, never payment ones; search/PDF buttons skip payment text", () => {
    expect(isConsentLabel("Esmu informēts par personas datu apstrādi")).toBe(true);
    expect(isConsentLabel("Piekrītu apmaksāt pakalpojumu")).toBe(false);
    expect(isConsentLabel("Saņemt jaunumus e-pastā")).toBe(false);
    expect(isSearchButtonText("Meklēt")).toBe(true);
    expect(isSearchButtonText("Apmaksāt un meklēt")).toBe(false);
    expect(isPdfControlText("Izziņa PDF")).toBe(true);
    expect(isPdfControlText("Pirkt izziņu")).toBe(false);
  });

  it("navigates only to LTAB and latvija.lv", () => {
    expect(isAllowedHost("services.ltab.lv")).toBe(true);
    expect(isAllowedHost("lvp.latvija.lv")).toBe(true);
    expect(isAllowedHost("evil.example.com")).toBe(false);
    expect(isAllowedHost("latvija.lv.evil.com")).toBe(false);
  });

  it("validates plates and personal-code format", () => {
    expect(isValidPlate("AB-1234")).toBe(true);
    expect(isValidPlate("WBALW3C59CC891863")).toBe(false);
    expect(isValidPersonalCode(FAKE_CODE)).toBe(true);
    expect(isValidPersonalCode("01010112345")).toBe(true);
    expect(isValidPersonalCode("40003000000")).toBe(true);
    expect(isValidPersonalCode("abc")).toBe(false);
  });
});

describe("LTAB relejs: personas kods nekad žurnālā", () => {
  it("redacts personal codes with and without dash and the configured secret", () => {
    const line = `fill ${FAKE_CODE} / 01010112345 / token=supersecrettoken123`;
    const out = redact(line, [FAKE_CODE, "supersecrettoken123"]);
    expect(out).not.toContain("010101");
    expect(out).not.toContain("supersecrettoken123");
    expect(out).toContain("***");
  });
});

describe("LTAB relejs: nakts logs (Rīga)", () => {
  it("22:00-07:00 Riga time is night, 12:00 is not", () => {
    expect(isNightInRiga(new Date("2026-10-23T20:30:00Z"))).toBe(true); // 23:30 Rīgā (UTC+3)
    expect(isNightInRiga(new Date("2026-10-23T03:30:00Z"))).toBe(true); // 06:30
    expect(isNightInRiga(new Date("2026-10-23T09:00:00Z"))).toBe(false); // 12:00
  });
});

type Sent = { state: string; jobId: string; [k: string]: unknown };

function makeQueue(opts: { night?: boolean; run?: (job: { plate: string }, p: (s: string, e: object) => Promise<boolean>) => Promise<{ found: boolean; pdf?: Buffer | null }>; maxPerHour?: number; stateFile?: string }) {
  const sent: Sent[] = [];
  const ran: string[] = [];
  const q = createJobQueue({
    run: async (job: { plate: string }, progress: (s: string, e: object) => Promise<boolean>) => {
      ran.push(job.plate);
      return opts.run ? opts.run(job, progress) : { found: false, pdf: null };
    },
    notify: async (body: Sent) => {
      sent.push(body);
    },
    isNight: () => Boolean(opts.night),
    maxPerHour: opts.maxPerHour ?? 20,
    stateFile: opts.stateFile ?? "",
  });
  return { q, sent, ran };
}

describe("LTAB relejs: rinda", () => {
  it("runs one job, reports progress, then the result with the original PDF", async () => {
    const pdf = Buffer.from("%PDF-1.4 test");
    const { q, sent } = makeQueue({
      run: async (_job, progress) => {
        await progress("awaiting_smartid", { verificationCode: "4821" });
        await progress("searching", {});
        return { found: true, pdf };
      },
    });
    const { jobId } = q.enqueue({ ref: "cs_test_123456", plate: "AB1234", trigger: "auto" });
    expect(await q.tick()).toBe(true);
    expect(sent.map((s) => s.state)).toEqual(["awaiting_smartid", "searching", "result"]);
    const result = sent[2]!;
    expect(result.jobId).toBe(jobId);
    expect(result.found).toBe(true);
    expect(Buffer.from(String(result.pdfBase64), "base64").toString()).toBe("%PDF-1.4 test");
  });

  it("does not start automatic jobs at night, but a manual one runs", async () => {
    const { q, ran } = makeQueue({ night: true });
    const auto = q.enqueue({ ref: "cs_test_aaaaaa", plate: "AB1234", trigger: "auto" });
    expect(auto.state).toBe("deferred_night");
    expect(await q.tick()).toBe(false);
    q.enqueue({ ref: "cs_test_bbbbbb", plate: "CD5678", trigger: "manual" });
    expect(await q.tick()).toBe(true);
    expect(ran).toEqual(["CD5678"]);
  });

  it("deduplicates the same order+plate while queued", () => {
    const { q } = makeQueue({ night: true });
    const a = q.enqueue({ ref: "cs_test_aaaaaa", plate: "AB1234", trigger: "auto" });
    const b = q.enqueue({ ref: "cs_test_aaaaaa", plate: "AB1234", trigger: "auto" });
    expect(b.jobId).toBe(a.jobId);
    expect(b.duplicate).toBe(true);
  });

  it("respects the hourly limit", async () => {
    const { q, ran } = makeQueue({ maxPerHour: 1 });
    q.enqueue({ ref: "cs_test_aaaaaa", plate: "AB1234", trigger: "auto" });
    q.enqueue({ ref: "cs_test_bbbbbb", plate: "CD5678", trigger: "auto" });
    await q.tick();
    expect(await q.tick()).toBe(false);
    expect(ran).toEqual(["AB1234"]);
  });

  it("reports flow errors with their code and never retries Smart-ID by itself", async () => {
    const { q, sent, ran } = makeQueue({
      run: async () => {
        throw Object.assign(new Error("timeout"), { code: "smartid_timeout" });
      },
    });
    q.enqueue({ ref: "cs_test_aaaaaa", plate: "AB1234", trigger: "auto" });
    await q.tick();
    expect(await q.tick()).toBe(false);
    expect(ran).toHaveLength(1);
    expect(sent.at(-1)).toMatchObject({ state: "error", code: "smartid_timeout" });
  });

  it("keeps queued jobs across a restart (state file, without PDFs)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ltab-q-"));
    const stateFile = path.join(dir, "jobs.json");
    const first = makeQueue({ night: true, stateFile });
    const { jobId } = first.q.enqueue({ ref: "cs_test_aaaaaa", plate: "AB1234", trigger: "auto" });
    await new Promise((r) => setTimeout(r, 50));
    const second = makeQueue({ stateFile });
    await second.q.load();
    expect(second.q.get(jobId)?.plate).toBe("AB1234");
    expect(await second.q.tick()).toBe(true);
    expect(second.ran).toEqual(["AB1234"]);
  });
});
