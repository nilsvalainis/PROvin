import { describe, expect, it } from "vitest";
import { freeEvalPrefillHref } from "@/lib/free-eval-prefill";
import { heroPrefillHref } from "@/lib/hero-prefill";

describe("VIN nodošana no bezmaksas pārbaudes", () => {
  it("pasūtījums no /vin-dekoders: VIN un pakete uz sākumlapas HERO", () => {
    expect(heroPrefillHref("/lv", { vin: "TMBJG7NE1J0123456", plan: "audits" })).toBe("/lv?vin=TMBJG7NE1J0123456&plan=audits#home-hero");
  });

  it("numurzīme tiek nodota kā numurzīme (slēptais VIN netiek atklāts)", () => {
    expect(heroPrefillHref("/lv", { vin: "AB1234", plan: "mini" })).toBe("/lv?vin=AB1234&plan=mini#home-hero");
  });

  it("sludinājums no /vin-dekoders: saite un VIN uz bezmaksas formu", () => {
    const href = freeEvalPrefillHref("/lv", { listingUrl: "https://www.ss.lv/msg/1.html", vin: "AB1234" });
    expect(href).toBe("/lv?listing=https%3A%2F%2Fwww.ss.lv%2Fmsg%2F1.html&vin=AB1234#bezmaksas-novertejums");
    expect(freeEvalPrefillHref("/lv", { listingUrl: "" })).toBe("/lv#bezmaksas-novertejums");
  });
});
