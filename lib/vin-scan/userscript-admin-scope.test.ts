import { describe, expect, it } from "vitest";

import { FakeElement, runUserscriptAt as runAt } from "@/lib/vin-scan/test-helpers/userscript-vm";

const BRIDGE_EVENTS = [
  "provin-listing-history-request",
  "provin-browser-fetch",
  "provin-stat-vin-fetch",
  "provin-vin-scan-browser",
  "provin-userscript-ping",
];

describe("userscript admin tilts tikai PROVIN hostos", () => {
  it.each(["https://www.provin.lv/admin/vin-scan", "https://provin.lv/admin", "http://localhost:3000/admin/orders/x"])(
    "PROVIN admin (%s) reģistrē tiltu",
    (href) => {
      const { listeners } = runAt(href);
      expect(listeners.has("provin-listing-history-request")).toBe(true);
      expect(listeners.has("provin-vin-scan-browser")).toBe(true);
    },
  );

  it.each([
    "https://evil.vercel.app/admin",
    "https://provin-preview.vercel.app/admin/orders/x",
    "https://www.carvertical.com/admin/x",
    "https://provin.lv.evil.com/admin",
    "https://www.provin.lv/administrator-not-admin",
  ])("svešā lapā (%s) tilta klausītāju nav", (href) => {
    const { listeners } = runAt(href);
    for (const type of BRIDGE_EVENTS) expect(listeners.has(type), type).toBe(false);
  });

  it("listing history: http un svešs hosts netiek lasīts ar sīkdatnēm", () => {
    const { listeners, gm } = runAt("https://www.provin.lv/admin/orders/x");
    const fire = (fetchUrl: string) =>
      listeners.get("provin-listing-history-request")!.forEach((fn) => fn({ detail: { requestId: "r1", fetchUrl } }));
    fire("http://tirgusdati.lv/x");
    fire("https://evil.com/x");
    expect(gm.xhr).toHaveLength(0);
    fire("https://tirgusdati.lv/vesture?x=1");
    expect(gm.xhr).toHaveLength(1);
  });

  /** Admin poga pēc apstiprinājuma izveido šādu saiti un to nospiež (sk. openCarVerticalPurchaseTab). */
  function clickPurchaseAnchor(isTrusted: boolean) {
    const run = runAt("https://www.provin.lv/admin/orders/x");
    const anchor = new FakeElement("a", { attrs: { href: "https://www.carvertical.com/lv/precheck" } });
    anchor.dataset = { provinCarverticalPurchase: "1", provinHandoffVin: "WBA5R1C0XLFH42873" };
    const target = { closest: (sel: string) => (sel.startsWith("a") ? anchor : null) };
    const clicks = run.listeners.get("click") ?? [];
    expect(clicks.length).toBeGreaterThan(0);
    for (const fn of clicks) fn({ target, isTrusted, preventDefault() {} });
    return run;
  }

  it("sintētisks klikšķis neieslēdz CarVertical pirkumu", () => {
    const { gm } = clickPurchaseAnchor(false);
    expect(gm.set.get("provin_cv_purchase")).toBeUndefined();
    expect(gm.set.get("provin_cv_purchase_vin")).toBeUndefined();
    /* VIN hand-off (bezmaksas auto-fill) drīkst notikt arī bez pirkuma karoga. */
    expect(gm.set.get("provin_pending_vin")).toBe("WBA5R1C0XLFH42873");
  });

  it("īsts operatora klikšķis uz pirkuma saites ieslēdz karogu ar VIN", () => {
    const { gm } = clickPurchaseAnchor(true);
    expect(gm.set.get("provin_cv_purchase")).toBe("1");
    expect(gm.set.get("provin_cv_purchase_vin")).toBe("WBA5R1C0XLFH42873");
  });

  it("klikšķis uz parastas CarVertical saites (bez pirkuma atzīmes) iepriekšējo karogu nodzēš", () => {
    const run = runAt("https://www.provin.lv/admin/orders/x", { gm: { provin_cv_purchase: "1", provin_cv_purchase_vin: "X" } });
    const anchor = new FakeElement("a", { attrs: { href: "https://www.carvertical.com/lv" } });
    const target = { closest: (sel: string) => (sel.startsWith("a") ? anchor : null) };
    for (const fn of run.listeners.get("click") ?? []) fn({ target, isTrusted: true, preventDefault() {} });
    expect(run.gm.set.has("provin_cv_purchase")).toBe(false);
    expect(run.gm.set.has("provin_cv_purchase_vin")).toBe(false);
  });
});
