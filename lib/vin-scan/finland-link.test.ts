import { describe, expect, it } from "vitest";

import { applyFinlandLink, detectFinlandLink, finlandLinkStatusLine, textMentionsFinland } from "@/lib/vin-scan/finland-link";

describe("textMentionsFinland", () => {
  it("atpazīst Somiju un neatpazīst Fiat, Suomi.fi un mazos fi", () => {
    expect(textMentionsFinland("Iepriekšējā valsts: Somija")).toBe(true);
    expect(textMentionsFinland("Registered in Finland")).toBe(true);
    expect(textMentionsFinland("Iepriekšējā valsts: Suomi")).toBe(true);
    expect(textMentionsFinland("en / FI")).toBe(true);
    expect(textMentionsFinland("Valsts: FI")).toBe(true);
    expect(textMentionsFinland("en / fi")).toBe(false);
    expect(textMentionsFinland("Suomi.fi")).toBe(false);
    expect(textMentionsFinland("Identify yourself Suomi.fi kirjaudu")).toBe(false);
    expect(textMentionsFinland("www.traficom.fi")).toBe(false);
    expect(textMentionsFinland("FIAT Punto")).toBe(false);
    expect(textMentionsFinland("wifi adapter")).toBe(false);
    expect(textMentionsFinland("WAUZZZ4F79N007217")).toBe(false);
  });
});

describe("detectFinlandLink", () => {
  it("FI numurs ir jā", () => {
    expect(detectFinlandLink([], { fi: "ABC123" })).toEqual({ linked: true, source: "FI numurs" });
  });

  it("Traficom ir tikai manuāla norāde, nekad found", () => {
    expect(
      detectFinlandLink([{ id: "traficom", status: "found", summary: "VOLVO V70", flags: { registrationCountry: "FI" } }]),
    ).toEqual({ linked: null, source: "" });
    expect(
      detectFinlandLink([
        {
          id: "traficom",
          status: "browser_only",
          summary: "Traficom: Suomi.fi forma pārlūkā, serveris POST nesaņem",
        },
      ]),
    ).toEqual({ linked: null, source: "" });
  });

  it("WAUZZZ4F79N007217 nav atrasts", () => {
    const vin = "WAUZZZ4F79N007217";
    expect(textMentionsFinland(vin)).toBe(false);
    expect(textMentionsFinland(`Traficom: Suomi.fi forma pārlūkā ${vin}`)).toBe(false);
    expect(
      detectFinlandLink([
        {
          id: "traficom",
          status: "browser_only",
          summary: "Traficom: Suomi.fi forma pārlūkā, serveris POST nesaņem",
          detail: vin,
        },
        { id: "carinfo", status: "found", summary: `${vin} Suomi.fi` },
      ]),
    ).toEqual({ linked: null, source: "" });
    expect(
      detectFinlandLink([
        { id: "traficom", status: "found", summary: "VOLVO V70", detail: vin, flags: { registrationCountry: "FI" } },
      ]).linked,
    ).not.toBe(true);
  });

  it("car.info Somija ir jā, ja Traficom unknown", () => {
    expect(
      detectFinlandLink([
        { id: "traficom", status: "unknown", summary: "Traficom captcha netika apieta" },
        { id: "carinfo", status: "found", detail: "Mileage 120 000 km\nSomija" },
      ]),
    ).toEqual({ linked: true, source: "car.info" });
  });

  it("CSDD iepriekšējā valsts Somija ir jā", () => {
    expect(
      detectFinlandLink([{ id: "csdd", status: "found", summary: "Iepriekšējās reģistrācijas valsts: Somija" }]),
    ).toEqual({ linked: true, source: "CSDD" });
  });

  it("nē tikai ja Traficom none un citu signālu nav", () => {
    expect(
      detectFinlandLink([
        { id: "traficom", status: "none", summary: "Traficom šo numuru neatpazina" },
        { id: "tjekbil", status: "found", summary: "VOLKSWAGEN SHARAN" },
      ]),
    ).toEqual({ linked: false, source: "Traficom" });
  });

  it("unknown Traficom bez signāla nav nē", () => {
    expect(
      detectFinlandLink([{ id: "traficom", status: "unknown", summary: "Traficom captcha netika apieta" }]),
    ).toEqual({ linked: null, source: "" });
  });

  it("Traficom none + car.info Somija paliek jā", () => {
    expect(
      detectFinlandLink([
        { id: "traficom", status: "none", summary: "Traficom šo numuru neatpazina" },
        { id: "carinfo", status: "found", detail: "Country Finland" },
      ]),
    ).toEqual({ linked: true, source: "car.info" });
  });
});

describe("applyFinlandLink", () => {
  it("liek karogu tikai Traficom rindai", () => {
    const rows = applyFinlandLink(
      [
        { id: "tjekbil", status: "found", summary: "SHARAN" },
        { id: "traficom", status: "unknown", summary: "Traficom captcha netika apieta" },
      ],
      { fi: "ABC-12" },
    );
    expect(rows[0]?.flags?.finlandLinked).toBeUndefined();
    expect(rows[1]?.flags).toMatchObject({ finlandLinked: true, finlandLinkSource: "FI numurs" });
    expect(rows[1]?.flags?.registrationCountry).toBeUndefined();
    expect(finlandLinkStatusLine(rows[1]?.flags)).toBe("Saistīts ar Somiju: jā · FI numurs");
  });

  it("numura noņemšana noņem karogu, nevis atstāj iepriekšējo jā", () => {
    const withPlate = applyFinlandLink(
      [{ id: "traficom", status: "unknown", summary: "Traficom captcha netika apieta" }],
      { fi: "ABC123" },
    );
    const without = applyFinlandLink(withPlate, { fi: "" });
    expect(without[0]?.flags?.finlandLinked).toBeUndefined();
    expect(without[0]?.flags?.finlandLinkSource).toBeUndefined();
  });
});
