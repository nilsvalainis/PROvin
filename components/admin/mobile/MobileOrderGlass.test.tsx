import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { AdminMobileActionDock } from "@/components/admin/mobile/AdminMobileChrome";
import { AdminMobileGlassSaveStatus } from "@/components/admin/mobile/AdminMobileGlass";
import { MobileOrderMoreList, type MobileOrderMoreGroup } from "@/components/admin/mobile/MobileOrderMoreSheet";
import { renderHtml, renderText } from "@/lib/test-render";

const src = (f: string) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");

describe("Pasūtījuma apakšējā stikla josla (22.11 makets v2)", () => {
  const dock = (glass: boolean) => (
    <AdminMobileActionDock
      glass={glass}
      actions={[
        { id: "vin", label: "Kopēt VIN", icon: "kopet" },
        { id: "scan", label: "VIN SCAN", icon: "vinParbaude" },
        { id: "pdf", label: "PDF", icon: "pdf" },
        { id: "send", label: "Sūtīt", icon: "sutit", primary: true },
      ]}
      more={() => undefined}
    />
  );

  it("5 vietas vienā joslā: Kopēt VIN · VIN SCAN · PDF · Sūtīt · Vairāk; «Sūtīt» zils", () => {
    const html = renderHtml(dock(true));
    expect(html).toContain('class="amx-dock5 pointer-events-auto min-w-0 flex-1"');
    expect(renderText(dock(true))).toBe("Kopēt VIN VIN SCAN PDF Sūtīt Vairāk");
    expect(html).toMatch(/aria-label="Sūtīt" class="am-press" data-amx-primary="true"/);
    // Nav melnā apļa ārpus joslas.
    expect(html).not.toContain("h-14 w-14");
    expect(html).toContain("md:hidden amx");
  });

  it("bez `glass` vecais izskats nemainās (citas lapas)", () => {
    const html = renderHtml(dock(false));
    expect(html).not.toContain("amx-dock5");
    expect(html).toContain("h-14 w-14");
  });

  it("pasūtījuma doks lieto stikla joslu ar «Sūtīt», «Sludinājums» - «Vairāk» lapā", () => {
    const d = src("components/admin/AdminOrderMobileDock.tsx");
    expect(d).toContain('{ id: "send", label: "Sūtīt", icon: "sutit" as const, onClick: onSend, primary: true }');
    expect(d).toMatch(/\n\s+glass\n/);
    const ws = src("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toContain("onSend={mobileSend}");
    expect(ws).toContain('{ id: "listing", label: "Sludinājums", href: listingBarHref ?? undefined, disabled: !listingBarHref }');
    expect(ws).toContain("setSendReportOpen(true);");
  });
});

describe("«Vairāk» lapa - saraksts ar nosaukumiem", () => {
  const groups: MobileOrderMoreGroup[] = [
    {
      id: "report",
      label: "Atskaite",
      items: [
        { id: "pdf", label: "Ģenerēt PDF", sub: "LV · EN · RU · DE", onClick: () => undefined },
        { id: "send-report", label: "Sūtīt atskaiti", onClick: () => undefined },
      ],
    },
    {
      id: "tools",
      label: "Rīki",
      items: [
        { id: "listing", label: "Sludinājums", href: "https://www.ss.com/x", disabled: false },
        { id: "plate", label: "Kopēt reģ. numuru", disabled: true, onClick: () => undefined },
        { id: "gone", label: "Paslēpts", hidden: true },
      ],
    },
    { id: "empty", label: "Tukša", items: [{ id: "x", label: "X", hidden: true }] },
  ];

  it("grupas ar virsrakstiem, rindas ar nosaukumiem; paslēptās un tukšās grupas nerāda", () => {
    const t = renderText(<MobileOrderMoreList groups={groups} />);
    expect(t).toBe("Atskaite Ģenerēt PDF LV · EN · RU · DE Sūtīt atskaiti Rīki Sludinājums Kopēt reģ. numuru");
    const html = renderHtml(<MobileOrderMoreList groups={groups} />);
    expect(html).toContain('class="amx amx-more"');
    expect(html).toContain('href="https://www.ss.com/x" target="_blank"');
    expect(html).toMatch(/data-more-item="plate" disabled=""/);
  });

  it("darba vietas «Vairāk» satur visas iepriekšējās izvēlnes darbības", () => {
    const ws = src("components/admin/OrderDetailWorkspace.tsx");
    for (const label of [
      "Ģenerēt PDF",
      "Sūtīt atskaiti",
      "Nosūtīt klientam",
      "Drukājamā versija",
      "FLASH MAX",
      "Copilot",
      "Biežās frāzes",
      "WhatsApp klientam",
      "Sludinājums",
      "Kopēt reģ. numuru",
      "Pāriet uz kopsavilkumu",
      "Saglabāt tagad",
      "OneAuto / dīlera dati",
      "ASV vēsture",
      "JoJ",
      "Speckr",
    ]) {
      expect(ws).toContain(`label: "${label}"`);
    }
    expect(ws).toContain("<MobileOrderMoreSheet open={mobileMore}");
  });
});

describe("Galvenes saglabāšanas statuss", () => {
  it("Saglabāts / Saglabā… / Nav saglabāts (sarkans)", () => {
    expect(renderText(<AdminMobileGlassSaveStatus saved />)).toBe("Saglabāts");
    expect(renderText(<AdminMobileGlassSaveStatus saved={false} busy />)).toBe("Saglabā…");
    const err = renderHtml(<AdminMobileGlassSaveStatus saved={false} failed />);
    expect(err).toContain("amx-save amx-save--err");
    expect(err).toContain("Nav saglabāts");
    expect(err).not.toContain("disabled");
  });

  it("galvene nav sticky un ir tikai telefonā", () => {
    const ws = src("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toContain('<div className="amx amx-ws md:hidden" data-amx-order-head>');
    const css = src("app/admin/mobile/order-glass.css");
    expect(css).not.toMatch(/position:\s*sticky/);
    expect(css.trim().startsWith("/*")).toBe(true);
    // Visi noteikumi telefona media vaicājumā.
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    expect(body.startsWith("@media (max-width: 767px) {")).toBe(true);
    expect(src("app/admin/layout.tsx")).toContain('import "./mobile/order-glass.css";');
  });
});
