import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  LT_POLICE_SIGNATURE_KEY,
  ltPoliceOrderedJson,
  ltPoliceRequestBody,
  ltPoliceSignature,
  parseLtPoliceResponse,
} from "@/lib/vin-scan/lt-police";
import { classifyPoliceWanted } from "@/lib/vin-scan/wanted";

const VIN = "WDD2120251A120979";

describe("epolicija.lt paraksts (kā lapas crypto-js HmacSHA512)", () => {
  it("kārto atslēgas, izmet tukšās vērtības un JSON kodē vērtības", () => {
    expect(ltPoliceOrderedJson({ vin: VIN, captcha: "tok", licensePlate: "", engineNumber: null })).toBe(
      `{"captcha":"tok","vin":"${VIN}"}`,
    );
  });

  it("paraksts ir HmacSHA512 hex ar publisko lapas atslēgu", () => {
    const sig = ltPoliceSignature({ vin: VIN, captcha: "tok" });
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
    const expected = createHmac("sha512", LT_POLICE_SIGNATURE_KEY).update(`{"captcha":"tok","vin":"${VIN}"}`).digest("hex");
    expect(sig).toBe(expected);
    // Fiksācija: ja algoritms nejauši mainās, šī vērtība vairs nesakritīs.
    expect(ltPoliceSignature({ vin: VIN })).toBe(
      createHmac("sha512", LT_POLICE_SIGNATURE_KEY).update(`{"vin":"${VIN}"}`).digest("hex"),
    );
  });

  it("pieprasījuma ķermenis: { data: { vin, captcha }, signature }", () => {
    const body = JSON.parse(ltPoliceRequestBody(" wdd2120251a120979 ", "tok")) as { data: Record<string, string>; signature: string };
    expect(body.data).toEqual({ vin: VIN, captcha: "tok" });
    expect(body.signature).toBe(ltPoliceSignature({ vin: VIN, captcha: "tok" }));
  });
});

describe("epolicija.lt atbilde", () => {
  it("IESKOMA → meklēšanā ar detaļām", () => {
    const fixture = JSON.stringify({
      searchStatus: "IESKOMA",
      licensePlate: "ABC123",
      vin: VIN,
      engineNumber: "642920",
      brand: "MERCEDES-BENZ",
      country: "LTU",
      searchStarted: "2026-10-02",
      searchEnded: null,
      incident: "Vagystė",
      incidentDate: "2026-10-01T22:10:00",
      searchDateTime: "2026-11-23T11:00:00",
    });
    const r = parseLtPoliceResponse(200, fixture, VIN);
    expect(r.status).toBe("found");
    expect(r.summary).toBe(
      "Meklēšanā. MERCEDES-BENZ, numurs ABC123, notikums: Vagystė, notikuma datums 2026-10-01, meklē kopš 2026-10-02, valsts LTU",
    );
    expect(r.detail).toContain("Dzinēja nr.: 642920");
    expect(r.incidents?.[0]).toEqual({ date: "2026-10-01", summary: "LT policija: meklēšanā (Vagystė)" });
  });

  it("NEIESKOMA → nav meklēšanā", () => {
    const r = parseLtPoliceResponse(200, JSON.stringify({ searchStatus: "NEIESKOMA", searchDateTime: "2026-11-23T11:00:00" }), VIN);
    expect(r).toMatchObject({ status: "none", summary: "Nav meklēšanā", detail: "Pārbaudīts: 2026-11-23" });
  });

  it("NUTRAUKTA → nav meklēšanā (lapa rāda «NĖRA IEŠKOMA»)", () => {
    expect(parseLtPoliceResponse(200, JSON.stringify({ searchStatus: "NUTRAUKTA" }), VIN)).toMatchObject({
      status: "none",
      summary: "Nav meklēšanā (meklēšana pārtraukta)",
    });
  });

  it("422 reCAPTCHA un 500 paraksts → unknown, nevis «nav meklēšanā»", () => {
    expect(parseLtPoliceResponse(422, '{"message":"reCAPTCHA validation failed"}', VIN)).toMatchObject({
      status: "unknown",
      summary: "epolicija.lt: reCAPTCHA netika pieņemta (reCAPTCHA validation failed)",
    });
    expect(parseLtPoliceResponse(500, '{"status":500,"error":"Internal Server Error"}', VIN).status).toBe("unknown");
    expect(parseLtPoliceResponse(200, "", VIN).status).toBe("unknown");
    expect(parseLtPoliceResponse(200, "null", VIN).status).toBe("unknown");
  });
});

describe("epolicija.lt lapas teksts (pārlūka josla)", () => {
  it("jaunās lapas «NĖRA IEŠKOMA» → nav meklēšanā", () => {
    const text = `Pagal paieškos kriterijus: Kėbulo numeris - ${VIN} transporto priemonė (arba jos agregatas), valstybinis numeris NĖRA IEŠKOMA (-AS).`;
    expect(classifyPoliceWanted("lt_itpr", text, VIN)).toEqual({ status: "none", summary: "Nav meklēšanā" });
  });

  it("jaunās lapas «yra IEŠKOMA» → meklēšanā", () => {
    const text = `Ši transporto priemonė (ar jos agregatas) yra IEŠKOMA. Duomenys įtraukti į ieškomų transporto priemonių registrą! Kėbulo numeris: ${VIN}`;
    expect(classifyPoliceWanted("lt_itpr", text, VIN)?.status).toBe("found");
  });
});
