import { describe, expect, it } from "vitest";
import { decideB2bDemoHostRequest, isB2bDemoAllowedPath, isB2bDemoHostname } from "./b2b-demo-host";

describe("b2b demo host", () => {
  it("atzīst tikai demo.provin.lv", () => {
    expect(isB2bDemoHostname("demo.provin.lv")).toBe(true);
    expect(isB2bDemoHostname("demo.provin.lv:443")).toBe(true);
    expect(isB2bDemoHostname("www.provin.lv")).toBe(false);
    expect(isB2bDemoHostname("provin.lv")).toBe(false);
  });

  it("www hostā nemaina PROVIN / ĪRISS ceļus", () => {
    expect(decideB2bDemoHostRequest("www.provin.lv", "/admin/iriss/pasutijumi")).toEqual({ action: "next" });
    expect(decideB2bDemoHostRequest("www.provin.lv", "/lv")).toEqual({ action: "next" });
    expect(decideB2bDemoHostRequest("www.provin.lv", "/b2b-demo")).toEqual({ action: "next" });
  });

  it("demo hostā laiž tikai B2B app un API", () => {
    expect(isB2bDemoAllowedPath("/b2b-demo/pasutijumi")).toBe(true);
    expect(isB2bDemoAllowedPath("/api/b2b-demo/login")).toBe(true);
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/b2b-demo")).toEqual({ action: "next" });
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/api/b2b-demo/settings")).toEqual({ action: "next" });
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/")).toEqual({ action: "redirect", pathname: "/b2b-demo" });
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/login")).toEqual({
      action: "redirect",
      pathname: "/b2b-demo/login",
    });
  });

  it("demo hostā bloķē ĪRISS admin un PROVIN API", () => {
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/admin/iriss")).toEqual({ action: "not_found" });
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/admin/iriss/pasutijumi")).toEqual({ action: "not_found" });
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/api/admin/iriss-pasutijumi")).toEqual({ action: "not_found" });
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/lv")).toEqual({ action: "not_found" });
    expect(decideB2bDemoHostRequest("demo.provin.lv", "/api/checkout")).toEqual({ action: "not_found" });
  });
});
