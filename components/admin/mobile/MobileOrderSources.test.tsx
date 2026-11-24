import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

vi.mock("@/components/admin/AdminVinHandoffContext", () => ({ useAdminVinHandoff: () => ({ vin: "WBA5R1C0XLFH42873" }) }));

import { AdminSourceBlockHeader, sourceBlockPhoneStatus } from "@/components/admin/AdminSourceBlockHeader";
import { AdminAiGenerateWithPrefill } from "@/components/admin/AdminAiGenerateWithPrefill";
import { renderHtml, renderText } from "@/lib/test-render";

const src = (f: string) => readFileSync(new URL(`../../../${f}`, import.meta.url), "utf8");

describe("Avotu saraksts telefonā - statuss labajā pusē (22.11 makets v2)", () => {
  it("punkts + teksts: ielasīts / daļēji / nav ielasīts / kļūda / nav datu (sarkans)", () => {
    expect(sourceBlockPhoneStatus("complete", undefined)).toEqual({ label: "Ielasīts", tone: "ok" });
    expect(sourceBlockPhoneStatus("partial", undefined)).toEqual({ label: "Daļēji", tone: "warn" });
    expect(sourceBlockPhoneStatus("empty", undefined)).toEqual({ label: "Nav ielasīts", tone: "muted" });
    expect(sourceBlockPhoneStatus("complete", { label: "Auto: kļūda", tone: "failed" })).toEqual({ label: "Kļūda", tone: "err" });
    expect(sourceBlockPhoneStatus("empty", { label: "Auto: nav datu", tone: "no_data" })).toEqual({ label: "Nav datu", tone: "err" });
    expect(sourceBlockPhoneStatus(undefined, undefined)).toBeNull();
  });

  it("telefonā bez krāsainās malas, ar statusu; datorā - kā līdz šim", () => {
    const phone = renderHtml(<AdminSourceBlockHeader blockKey="ltab" trafficFillLevel="empty" phone />);
    expect(phone).not.toContain("border-l-[5px]");
    expect(phone).toContain('<span class="amx-st amx-st--muted">Nav ielasīts</span>');
    const desk = renderHtml(<AdminSourceBlockHeader blockKey="ltab" trafficFillLevel="empty" phone={false} />);
    expect(desk).toContain("border-l-[5px]");
    expect(desk).not.toContain("amx-st");
  });

  it("darba vietā avoti, negadījumi un meta rindas - stikla saraksti; AI kartītes stiklā", () => {
    const ws = src("components/admin/OrderDetailWorkspace.tsx");
    expect(ws).toContain('id="admin-m-sec-avoti" className="grid min-h-0 min-w-0 grid-cols-1 gap-5 lg:grid-cols-2 amx amx-src"');
    expect(ws).toContain('id="admin-m-sec-negadijumi" className="grid min-h-0 min-w-0 grid-cols-1 gap-5 lg:grid-cols-2 amx amx-src"');
    expect(ws).toContain('<div className="amx amx-meta">{dashboardSlot}</div>');
    expect(ws).toContain('className="amx amx-ai mt-1.5');
    // 23.11: visi avotu bloki vienā izskatā (arī atsevišķie - dīlera dati, citi avoti, ASV u.c.).
    for (const id of ["auto-records", "citi-avoti", "cc-vin", "asv", "tjekbil", "finnik", "estonia", "carinfo", "traficom-fi"]) {
      expect(ws).toContain(`id="admin-order-block-${id}" className="min-w-0 amx amx-src"`);
    }
  });

  it("23.11: telefonā atverot pasūtījumu visi bloki un sadaļas sakļauti (bez localStorage); datorā kā līdz šim", () => {
    const shell = src("components/admin/AdminCollapsibleShell.tsx");
    // 24.11: noklusējums sakļauts; atvērtais paliek tikai atmiņā, kamēr lapa atvērta (ne localStorage).
    expect(shell).toMatch(/if \(phone\) \{\s*setCollapsed\(readAdminUiOpen\([^)]*\)\) \?\? true\);\s*return;/);
    expect(shell).toContain("if (phone) return;");
    const sec = src("components/admin/AdminPhoneSectionCollapse.tsx");
    expect(sec).toContain("readAdminUiOpen(memKey) ?? true");
    expect(sec).not.toContain("localStorage");
  });

  it("23.11: visiem avotiem ikona, ielasītie zaļi (ikona, nosaukums, čips)", () => {
    const css = src("components/admin/mobile/order-sources-glass.css");
    expect(css).toContain('.provin-card-head:has([data-source-status="ok"])');
    expect(css).toMatch(/\.amx-meta \[data-admin-block\][^{]*> svg:first-child \{\s*display: none;/);
    expect(css).not.toMatch(/\.amx-src[^{]*> svg:first-child \{\s*display: none;/);
  });

  it("CSS tikai telefonā, bez backdrop-filter konteineriem (pilnekrāna bloki paliek fixed)", () => {
    const css = src("components/admin/mobile/order-sources-glass.css");
    const body = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
    expect(body.startsWith("@media (max-width: 767px) {")).toBe(true);
    expect(body).not.toContain("backdrop-filter");
    expect(body).toContain(':not([class*="max-md:fixed"])');
  });
});

describe("AI «Ģenerēt» telefonā - viena stikla poga", () => {
  const el = (phone: boolean) => (
    <AdminAiGenerateWithPrefill label="Sagatavot atbildi" recommendedTier="gemini-flash" phone={phone} onGenerate={() => undefined} />
  );

  it("telefonā viena poga «Ģenerēt» bez krāsām; modeļa izvēle logā", () => {
    const html = renderHtml(el(true));
    expect(renderText(el(true))).toBe("Ģenerēt");
    expect(html).toContain('class="amx-pill"');
    expect(html).not.toMatch(/bg-(violet|emerald|teal)-600/);
    expect(src("components/admin/AdminAiGenerateWithPrefill.tsx")).toContain('<div className="amx-seg" role="tablist" aria-label="Modelis">');
  });

  it("datorā pogas kā līdz šim (Smart + PRO)", () => {
    const html = renderHtml(el(false));
    expect(html).not.toContain("amx-pill");
    expect(html).toContain('data-ai-tier="gemini-flash"');
    expect(html).toContain('data-ai-tier="pro"');
  });
});
