import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { classifySnapshot as classifyEcsdd } from "@/relay/provin-ecsdd/lib/ecsdd-page.mjs";
import { classifySnapshot as classifyLtab } from "@/relay/provin-ltab/lib/ltab-page.mjs";
import {
  classifySso,
  codeFromSnapshot,
  extractVerificationCode,
  isSsoHost,
  looksLikeSsoFailure,
  normalizePersonalCode,
  redactSso,
  waitForSmartId,
} from "@/relay/provin-ltab/lib/viss-sso.mjs";

/**
 * Fiksācijas: lib/__fixtures__/viss-sso/*.html - vpm.viss.gov.lv lapas 23.11.2026 (bez pieteikšanās, tokeni izņemti;
 * "code-*" ir sintētiskas, jo koda lapa pēc personas koda vēl nav redzēta). snapshots.json = releja `snapshot()`
 * (relay/provin-ltab/lib/ltab-flow.mjs) rezultāts šīm lapām Chromium pārlūkā.
 */
const FIX = path.join(__dirname, "__fixtures__", "viss-sso");
type Snap = Record<string, unknown> & { host: string; text: string };
const SNAPS = JSON.parse(fs.readFileSync(path.join(FIX, "snapshots.json"), "utf8")) as Record<string, Snap>;

const EXPECTED: Record<string, { kind: string; code: string | null }> = {
  "viss-login": { kind: "sso_choose", code: null },
  "viss-smartid-form": { kind: "sso_code_input", code: null },
  "viss-smartid-no-account": { kind: "sso_failed", code: null },
  "viss-smartid-code-labelled": { kind: "sso_wait", code: "4821" },
  "viss-smartid-code-plain": { kind: "sso_wait", code: "7305" },
  "viss-smartid-code-pending": { kind: "sso_wait", code: null },
};

describe("VISS pieteikšanās: kopīgais modulis abiem relejiem", () => {
  it("is byte-identical in the LTAB and e.csdd relays", () => {
    const a = fs.readFileSync(path.join(__dirname, "..", "relay", "provin-ltab", "lib", "viss-sso.mjs"), "utf8");
    const b = fs.readFileSync(path.join(__dirname, "..", "relay", "provin-ecsdd", "lib", "viss-sso.mjs"), "utf8");
    expect(b).toBe(a);
  });

  it("fixtures contain no personal codes", () => {
    for (const f of fs.readdirSync(FIX)) {
      const t = fs.readFileSync(path.join(FIX, f), "utf8");
      expect(t, f).not.toMatch(/(?<![\d-])\d{6}-?\d{5}(?![\d-])/);
    }
  });

  it("has a snapshot for every fixture page", () => {
    const html = fs.readdirSync(FIX).filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, "")).sort();
    expect(Object.keys(SNAPS).sort()).toEqual(html);
    expect(Object.keys(EXPECTED).sort()).toEqual(html);
  });

  for (const [name, exp] of Object.entries(EXPECTED)) {
    it(`${name}: ${exp.kind}${exp.code ? ` (kods ${exp.code})` : ""} in both relays`, () => {
      const snap = SNAPS[name];
      expect(snap.host).toBe("vpm.viss.gov.lv");
      expect(classifySso(snap)).toBe(exp.kind);
      expect(classifyLtab(snap)).toBe(exp.kind);
      expect(classifyEcsdd(snap)).toBe(exp.kind);
      expect(codeFromSnapshot(snap)).toBe(exp.code);
    });
  }

  it("the Smart-ID adapter page with a code is never mistaken for the method choice (23.11 e.csdd kļūda)", () => {
    const snap = { ...SNAPS["viss-smartid-code-pending"], text: "Smart-ID autentifikācijas adapteris EN Saņemt paziņojumu Smart-ID lietotnē" };
    expect(classifySso(snap)).toBe("sso_wait");
  });

  it("an expired QR (device link) on the personal code form is not a failure", () => {
    const snap = {
      ...SNAPS["viss-smartid-form"],
      text: `${SNAPS["viss-smartid-form"].text} Autentifikācijas sesijas derīguma termiņš ir beidzies. Sākt jaunu sesiju`,
    };
    expect(classifySso(snap)).toBe("sso_code_input");
  });

  it("recognises vpm.viss.gov.lv and latvija.lv as the login hosts, nothing else", () => {
    expect(isSsoHost("vpm.viss.gov.lv")).toBe(true);
    expect(isSsoHost("eservices.viss.gov.lv")).toBe(true);
    expect(isSsoHost("www.latvija.lv")).toBe(true);
    expect(isSsoHost("vpm.viss.gov.lv.evil.com")).toBe(false);
    expect(isSsoHost("services.ltab.lv")).toBe(false);
  });

  it("enters the personal code as xxxxxx-xxxxx", () => {
    expect(normalizePersonalCode("01010112345")).toBe("010101-12345");
    expect(normalizePersonalCode(" 010101-12345 ")).toBe("010101-12345");
  });

  it("reads the control code, never the personal code; ambiguous plain digits give no code", () => {
    expect(extractVerificationCode("Kontroles kods: 4821")).toBe("4821");
    expect(extractVerificationCode("Pārbaudes kods 0193")).toBe("0193");
    expect(extractVerificationCode("Verification code: 5512")).toBe("5512");
    expect(extractVerificationCode("Kods ir 7731")).toBe("7731");
    expect(extractVerificationCode("Personas kods 010101-12345")).toBeNull();
    expect(extractVerificationCode("Personas kods 01010112345")).toBeNull();
    expect(extractVerificationCode("Atveriet Smart-ID lietotni un noskenējiet šo QR kodu")).toBeNull();
    expect(extractVerificationCode("", [], ["2026", "4821"])).toBeNull();
    expect(extractVerificationCode("", [], ["4821", "4821"])).toBe("4821");
  });

  it("detects refusal / no account, not the plain 'Atcelt' button", () => {
    expect(looksLikeSsoFailure("Lietotājam nav konta Smart-ID sistēmā")).toBe(true);
    expect(looksLikeSsoFailure("Lietotājs atcēla autentifikāciju")).toBe(true);
    expect(looksLikeSsoFailure("Autentificēties Atcelt")).toBe(false);
  });

  it("redacts personal codes with and without dash", () => {
    expect(redactSso("kods 010101-12345 un 01010112345", ["01010112345"])).toBe("kods *** un ***");
  });
});

describe("VISS pieteikšanās: Smart-ID gaidīšana (viltots pārlūks)", () => {
  function fakePage(urls: string[], texts: string[] = []) {
    let i = 0;
    return {
      url: () => urls[Math.min(i, urls.length - 1)],
      evaluate: async () => texts[Math.min(i, texts.length - 1)] ?? "",
      tick: () => {
        i++;
      },
    };
  }
  const ADAPTER = "https://vpm.viss.gov.lv/VPM.IdP.SmartId/Account/SmartIdAuthentication";

  it("sends the code once, then returns when the browser is back at the service", async () => {
    const page = fakePage([ADAPTER, ADAPTER, "https://services.ltab.lv/VehicleInsAndAcc"]);
    const codes: (string | null)[] = [];
    const res = await waitForSmartId(page as never, {
      snapshotFn: async () => SNAPS["viss-smartid-code-labelled"],
      onCode: async (c: string | null) => {
        codes.push(c);
        page.tick();
        page.tick();
      },
      timeoutMs: 5_000,
    });
    expect(res).toEqual({ status: "left", codeSent: true });
    expect(codes).toEqual(["4821"]);
  });

  it("without a readable code still tells Nils to approve (no code) and keeps waiting", async () => {
    const page = fakePage([ADAPTER, "https://e.csdd.lv/"]);
    const codes: (string | null)[] = [];
    const res = await waitForSmartId(page as never, {
      snapshotFn: async () => SNAPS["viss-smartid-code-pending"],
      onCode: async (c: string | null) => {
        codes.push(c);
        page.tick();
      },
      timeoutMs: 5_000,
      codeWaitMs: 0,
    });
    expect(res.status).toBe("left");
    expect(codes).toEqual([null]);
  });

  it("stops on refusal and does not resend the code", async () => {
    const page = fakePage([ADAPTER], ["Lietotājs atcēla autentifikāciju"]);
    const onCode = async () => {
      throw new Error("nedrīkst sūtīt vēlreiz");
    };
    const res = await waitForSmartId(page as never, { snapshotFn: async () => SNAPS["viss-smartid-code-labelled"], onCode, codeAlreadySent: true, timeoutMs: 5_000 });
    expect(res).toEqual({ status: "refused", codeSent: true });
  });
});
