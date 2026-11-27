import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { createResultCache } from "@/relay/provin-traficom/lib/cache.mjs";
import { createJobQueue } from "@/relay/provin-traficom/lib/jobs.mjs";
import { createTraficomSessionState } from "@/relay/provin-traficom/lib/session-state.mjs";
import {
  buildTraficomData,
  buildTraficomRawText,
  classifySnapshot,
  extractVerificationCode,
  isAllowedHost,
  isFeeSectionTitle,
  isFeeText,
  isValidUserNumber,
  isValidVin,
  redact,
} from "@/relay/provin-traficom/lib/traficom-page.mjs";
import { parseTraficomReport } from "@/lib/traficom-report-parse";

/** Izdomāts lietotāja numurs (nav īsts). */
const FAKE_USER = "PL000000-00000";
const VIN = "WVGZZZE2ZXX000001";

const btn = (text: string, id = "") => ({ id, text, visible: true });

describe("Traficom relejs: lapu atpazīšana", () => {
  it("Suomi.fi: ārzemnieku metodes un valsts izvēle (id no 26.11 pārbaudes)", () => {
    expect(classifySnapshot({ host: "tunnistautuminen.suomi.fi", path: "/sivut/discovery-page/", text: "Valitse tunnistustapa", buttons: [btn("Nordea", "nordea"), btn("Ulkomaalaisen tunnistustavat", "eidas_high")] })).toBe(
      "fi_choose_method",
    );
    expect(classifySnapshot({ host: "tunnistautuminen.suomi.fi", path: "/sivut/country-selection", text: "Latvia", buttons: [btn("Latvia", "LV"), btn("Viro", "EE")] })).toBe(
      "fi_choose_country",
    );
    expect(classifySnapshot({ host: "tunnistautuminen.suomi.fi", path: "/x", text: "", buttons: [btn("Continue to service")] })).toBe("fi_continue");
  });

  it("VISS: eParaksts Mobile izvēle; eParaksts: lietotāja numurs, gaidīšana, piekrišana, atteikums", () => {
    expect(classifySnapshot({ host: "vpm.viss.gov.lv", path: "/LVP.STS/Account/Login", text: "I agree to identification term", hasAgree: true, mobileChoice: true, buttons: [] })).toBe(
      "vpm_choose",
    );
    const ep = {
      host: "eidas.eparaksts.lv",
      path: "/trustedx-authserver/lvrtc-eipsign-idp/mobileIdIdentification.xhtml",
      text: "Enter your user number USER NUMBER:",
      inputs: [{ id: "identifierForm-identifier", type: "text", label: "", visible: true }],
      buttons: [btn("Confirm", "identifierForm-submitButton"), btn("Cancel", "identifierForm-cancelButton")],
    };
    expect(classifySnapshot(ep)).toBe("ep_user_number");
    expect(classifySnapshot({ ...ep, inputs: [], buttons: [], text: "Confirm the authentication in the eParaksts mobile app" })).toBe("ep_wait");
    expect(classifySnapshot({ ...ep, path: "/trustedx-authserver/userConsent", inputs: [], buttons: [btn("Agree"), btn("Cancel")], text: "Consent" })).toBe("ep_consent");
    expect(classifySnapshot({ ...ep, inputs: [], buttons: [], text: "Authentication cancelled" })).toBe("ep_failed");
  });

  it("Traficom vednis: Instructions -> Find vehicle -> Vehicle information; Payment - stop", () => {
    const tf = { host: "asiointi.traficom.fi", path: "/oma-asiointi/julkiset-tiedonhakupalvelut/julkiset-ajoneuvotiedot-ja-veron-maksu", headings: "Public vehicle data and tax payments" };
    expect(classifySnapshot({ ...tf, stepText: "1 Instructions", text: "Instructions", buttons: [btn("Next")] })).toBe("tf_instructions");
    expect(
      classifySnapshot({
        ...tf,
        stepText: "2 Find vehicle information",
        text: "Find vehicle information",
        inputs: [{ id: "vin", name: "vin", type: "text", label: "Vehicle identification number (VIN)", visible: true }],
        buttons: [btn("Search")],
      }),
    ).toBe("tf_search");
    expect(classifySnapshot({ ...tf, stepText: "3 Vehicle information", text: "Car Volkswagen", buttons: [btn("Next")] })).toBe("tf_result");
    expect(classifySnapshot({ ...tf, stepText: "4 Payment", text: "Payment", buttons: [btn("Pay")] })).toBe("tf_payment");
    // Pakalpojuma nosaukumā "veron maksu" / "tax payments" - tas nav maksājuma solis.
    expect(classifySnapshot({ ...tf, stepText: "", headings: "Julkiset ajoneuvotiedot ja veron maksu", text: "Ohjeet", buttons: [btn("Seuraava")] })).toBe("tf_instructions");
  });

  it("captcha vienmēr stop", () => {
    expect(classifySnapshot({ host: "asiointi.traficom.fi", text: "I'm not a robot", buttons: [] })).toBe("captcha");
  });

  it("maksas akordeoni un pogas atpazīti; 'Tax information and payment' ir bezmaksas", () => {
    for (const t of ["Owners and holders (information subject to a fee)", "Owner history", "Inspection history", "Insurance history", "Use history", "Decommissioning history"]) {
      expect(isFeeSectionTitle(t)).toBe(true);
    }
    for (const t of ["Tax information and payment", "Basic information", "Inspection information", "Engine details", "Special conditions"]) {
      expect(isFeeSectionTitle(t)).toBe(false);
    }
    expect(isFeeText("SERVICE PRICE 2,75 €")).toBe(true);
    expect(isFeeText("Payment")).toBe(true);
    expect(isFeeText("Next")).toBe(false);
  });

  it("navigācija tikai uz atļautajiem hostiem", () => {
    for (const h of ["asiointi.traficom.fi", "tunnistautuminen.suomi.fi", "vpm.viss.gov.lv", "eidas.eparaksts.lv", "nodefi1.eidas.tunnistus.fi"]) expect(isAllowedHost(h)).toBe(true);
    for (const h of ["evil.example", "traficom.fi.evil.example", "google.com", "tunnistus.fi.evil.example"]) expect(isAllowedHost(h)).toBe(false);
  });

  it("lietotāja numurs nekad neparādās žurnālā", () => {
    expect(redact(`fill ${FAKE_USER} ok`, [FAKE_USER])).not.toContain(FAKE_USER);
    expect(redact("PL00000000000", [FAKE_USER])).not.toContain("00000000000");
    expect(redact("kods 010101-12345", [])).toBe("kods ***");
    expect(isValidUserNumber(FAKE_USER)).toBe(true);
    expect(isValidUserNumber("")).toBe(false);
    expect(isValidVin(VIN)).toBe(true);
    expect(isValidVin("WVGZZZE2ZXX00000I")).toBe(false);
  });

  it("kontrolkods no teksta vai elementa", () => {
    expect(extractVerificationCode("Control code: 4821")).toBe("4821");
    expect(extractVerificationCode("Confirm in app", ["7731"])).toBe("7731");
    expect(extractVerificationCode("Confirm in app")).toBeNull();
  });
});

/** Izdomāta 3. soļa lapa (pēc Nila ekrānuzņēmuma struktūras, bez īstiem datiem). */
const RAW_PAGE = {
  title: "Car Volkswagen, VW ID.4 GTX 220 KW",
  banners: ["The vehicle is under a prohibition of driving or use"],
  summary: [
    ["Vehicle identification number (VIN)", VIN],
    ["Vehicle status", "Decommissioned"],
    ["Next inspection period", "8.11.2021-10.11.2025"],
    ["Tax status", "No unpaid vehicle tax / No unpaid additional tax"],
    ["SERVICE PRICE", "2,75 €"],
  ],
  remarks: [
    { text: "Periodic inspection not performed/approved", tone: "icon-red" },
    { text: "Vehicle decommissioning (Deregistrated due to a damage)", tone: "icon-red" },
    { text: "Vehicle decommissioning (Reregistration abroad)", tone: "" },
    { text: "Pending data", tone: "warning" },
    { text: "There is a notification of transfer entry for the vehicle", tone: "warning" },
  ],
  source: "SOURCE: TRANSPORT REGISTER 26.11.2026 22.38",
  sections: [
    { title: "Basic information", rows: [["Make", "Volkswagen"], ["Date of entry into service", "1.3.2021"], ["First registration in Finland", "1.3.2021"]] },
    { title: "Inspection information", rows: [["Inspection date", "2.3.2024"], ["Inspection result", "Rejected"], ["Odometer reading", "45 678 km"], ["Defects", "Brake disc corrosion"]] },
    { title: "Owners and holders (information subject to a fee)", rows: [["Owner", "SHOULD NOT APPEAR"]] },
    { title: "Owner history", rows: [["Owner", "SHOULD NOT APPEAR"]] },
  ],
};

describe("Traficom relejs: dati un teksta kopija", () => {
  it("maksas sadaļas un cenas rindas izmestas; karogi ar līmeni", () => {
    const data = buildTraficomData(RAW_PAGE, [FAKE_USER]);
    expect(JSON.stringify(data)).not.toContain("SHOULD NOT APPEAR");
    expect(JSON.stringify(data)).not.toContain("2,75");
    expect(data.sections.map((s: { title: string }) => s.title)).toEqual(["Basic information", "Inspection information"]);
    const red = data.flags.filter((f: { level: string }) => f.level === "red").map((f: { text: string }) => f.text);
    expect(red).toContain("The vehicle is under a prohibition of driving or use");
    expect(red).toContain("Vehicle decommissioning (Deregistrated due to a damage)");
    // Bez ikonas krāsas - pēc teksta (ārzemēs pārreģistrēts = sarkans).
    expect(red).toContain("Vehicle decommissioning (Reregistration abroad)");
    expect(data.flags.find((f: { text: string }) => f.text === "Pending data")?.level).toBe("yellow");
  });

  it("teksta kopiju lasa esošais Traficom parseris (tas pats, kas PDF / ielīmējumam)", () => {
    const text = buildTraficomRawText(buildTraficomData(RAW_PAGE));
    const parsed = parseTraficomReport(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.vin).toBe(VIN);
    expect(parsed!.statusRecords).toContain("noņemts no reģistra");
    expect(parsed!.statusRecords).toContain("Nākamā tehniskā apskate: 8.11.2021-10.11.2025");
    expect(parsed!.statusRecords).toContain("nav nesamaksāta transportlīdzekļa nodokļa");
    expect(parsed!.autoNotes).toContain("braukšanas / lietošanas aizliegums");
    expect(parsed!.autoNotes).toContain("bojājuma dēļ");
    expect(parsed!.autoNotes).toContain("reģistrēts ārzemēs");
    expect(parsed!.autoNotes).toContain("paziņojums par īpašuma maiņu");
    expect(parsed!.timeline.some((r) => r.event === "Pirmā reģistrācija Somijā" && r.date === "01.03.2021")).toBe(true);
  });
});

describe("Traficom relejs: rinda, kešs, sesija", () => {
  it("ne biežāk kā 1 vaicājums ik 30 s; manuālais pirms automātiskā", async () => {
    let t = Date.parse("2026-11-26T20:00:00Z");
    const ran: string[] = [];
    const sent: Array<{ state: string; jobId: string }> = [];
    const q = createJobQueue({
      run: async (job: { vin: string }) => {
        ran.push(job.vin);
        return { found: true, rawText: "x", data: { summary: [] } };
      },
      notify: async (b: { state: string; jobId: string }) => {
        sent.push(b);
      },
      now: () => new Date(t),
      minIntervalMs: 30_000,
    });
    q.enqueue({ ref: "order_aaaaaa", vin: "AAAAAAAAAAAAAAAA1", trigger: "auto" });
    q.enqueue({ ref: "order_bbbbbb", vin: "BBBBBBBBBBBBBBBB2", trigger: "manual" });
    expect(await q.tick()).toBe(true);
    expect(ran).toEqual(["BBBBBBBBBBBBBBBB2"]);
    t += 10_000;
    expect(await q.tick()).toBe(false);
    expect(q.waitMs()).toBe(20_000);
    t += 20_000;
    expect(await q.tick()).toBe(true);
    expect(ran).toEqual(["BBBBBBBBBBBBBBBB2", "AAAAAAAAAAAAAAAA1"]);
    expect(sent.filter((s) => s.state === "result")).toHaveLength(2);
  });

  it("kešs pēc VIN 7 dienas", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "traficom-cache-"));
    let t = Date.parse("2026-11-26T20:00:00Z");
    const cache = createResultCache({ dir, now: () => t });
    await cache.set(VIN, { found: true, rawText: "Vehicle information", data: { summary: [] }, pdf: Buffer.from("%PDF-1.4") });
    const hit = await cache.get(VIN);
    expect(hit?.found).toBe(true);
    expect(hit?.pdf?.subarray(0, 4).toString()).toBe("%PDF");
    t += 8 * 24 * 3_600_000;
    expect(await cache.get(VIN)).toBeNull();
    expect(await cache.prune()).toBe(1);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("sesija: gaida eParaksts -> aktīva -> beidzas pēc TTL", () => {
    let t = Date.parse("2026-11-26T20:00:00Z");
    const s = createTraficomSessionState({ ttlMs: 20 * 60_000, now: () => t });
    expect(s.view().state).toBe("logged_out");
    s.onProgress("awaiting_eparaksts", { verificationCode: "1234" });
    expect(s.view()).toMatchObject({ state: "awaiting_eparaksts", verificationCode: "1234" });
    s.onProgress("searching");
    expect(s.view().state).toBe("active");
    expect(s.probablyAlive()).toBe(true);
    t += 21 * 60_000;
    expect(s.view().state).toBe("expired");
  });
});
