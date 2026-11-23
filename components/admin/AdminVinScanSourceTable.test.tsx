import { describe, expect, it } from "vitest";

import { AdminVinScanSourceTable, sourceTableGroupOf, type SourceTableItem } from "@/components/admin/AdminVinScanSourceTable";
import { browserImportRowNote } from "@/components/admin/AdminVinScanPanel";
import { AdminAtraFreeSources, AdminAtraPaidSources } from "@/components/admin/AdminAtraParbaudeSources";
import { atraFreeGroups, atraPaidCost } from "@/lib/atra-parbaude";
import { renderHtml, renderText } from "@/lib/test-render";

const item = (p: Partial<SourceTableItem> & { id: string }): SourceTableItem => ({
  label: p.id,
  country: "LV",
  status: "found",
  summary: "",
  href: "",
  hasDetails: false,
  ...p,
});

describe("Ātrā pārbaude - avotu tabula (dators)", () => {
  it("pārlūka «page_not_ready» paliek kā rindas statuss, nevis globāls paziņojums", () => {
    expect(browserImportRowNote("page_not_ready")).toBe("Gaida lapu pārlūkā");
    expect(browserImportRowNote("vin_mismatch")).toMatch(/VIN/);
    const html = renderHtml(
      <AdminVinScanSourceTable
        items={[
          item({ id: "csdd", label: "CSDD", summary: "BMW 530 · 4 īpašnieki" }),
          item({ id: "carinfo", label: "car.info", country: "SE", status: "unknown", note: "Gaida lapu pārlūkā" }),
          item({ id: "mnt_ee", label: "mnt.ee", country: "EE", status: "checking" }),
        ]}
        busy
      />,
    );
    expect(html).not.toContain("Lapa vēl nav gatava");
    expect(html).toMatch(/data-atra-source="carinfo"[^>]*>[\s\S]*?Gaida lapu pārlūkā/);
    // Fiksēts rindas augstums un kopsavilkums vienā rindā - statusa maiņa nemaina izkārtojumu.
    expect(html).toContain("h-[38px]");
    expect(html).toContain("table-fixed");
  });

  it("grupas Reģistri / Izsoles / Atsaukumi, skaitītāji, detaļas sakļautas", () => {
    expect(sourceTableGroupOf("csdd")).toBe("registri");
    expect(sourceTableGroupOf("thecarapi_eu")).toBe("izsoles");
    expect(sourceTableGroupOf("joj_copart_iaai")).toBe("izsoles");
    expect(sourceTableGroupOf("eu_safety_gate_xyz")).toBe("citi");
    const items = [
      item({ id: "csdd", label: "CSDD", summary: "BMW 530", hasDetails: true }),
      item({ id: "thecarapi_eu", label: "EU izsoles", summary: "1 lots 2017", href: "https://example.test/a" }),
      item({ id: "wmi", label: "WMI", status: "none" }),
    ];
    const text = renderText(<AdminVinScanSourceTable items={items} details={() => <p>GARAIS TEKSTS</p>} />);
    expect(text).toContain("Reģistri");
    expect(text).toContain("Izsoles un foto");
    expect(text).toContain("Atsaukumi, drošība, citi");
    expect(text).toContain("2 atrasti");
    expect(text).toContain("1 nav ierakstu");
    expect(text).toContain("▸ Detaļas");
    expect(text).not.toContain("GARAIS TEKSTS");
    const open = renderText(<AdminVinScanSourceTable items={items} details={() => <p>GARAIS TEKSTS</p>} initialOpenId="csdd" />);
    expect(open).toContain("▾ Detaļas");
    expect(open).toContain("GARAIS TEKSTS");
  });

  it("avotu izvēle sakļauta pēc noklusējuma, noklusējumi nemainās (bezmaksas ieslēgti, maksas izslēgti)", () => {
    const groups = atraFreeGroups(true);
    const all = groups.flatMap((g) => g.items.map((i) => i.id));
    const free = renderHtml(<AdminAtraFreeSources groups={groups} selected={all} onToggle={() => undefined} onAll={() => undefined} />);
    expect(free).toMatch(/^<details(?![^>]*\sopen)[^>]*data-atra-free/);
    expect(free).toContain(`${all.length} ieslēgti`);
    expect(free).not.toContain('aria-pressed="false"');
    const paid = renderHtml(
      <AdminAtraPaidSources
        selected={[]}
        onToggle={() => undefined}
        template="dzintarzeme"
        onTemplate={() => undefined}
        cost={atraPaidCost([])}
        ledgerBar=""
        vin=""
      />,
    );
    expect(paid).toMatch(/^<details(?![^>]*\sopen)[^>]*data-atra-paid/);
    expect(paid).toContain("izslēgti");
    expect(paid).toContain("Šī pārbaude maksās");
    // Vienīgais nospiestais ir uzskaites slēdzis (Dzintarzeme Auto), neviens maksas avots.
    expect(paid.match(/aria-pressed="true"/g)?.length).toBe(1);
  });
});
