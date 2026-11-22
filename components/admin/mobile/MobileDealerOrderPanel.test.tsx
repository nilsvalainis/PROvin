import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MobileDealerOrderPanelView,
  mobileDealerRecordsFromWorks,
  mobileDealerStatusSub,
  type MobileDealerOrderPanelViewProps,
} from "@/components/admin/mobile/MobileDealerOrderPanel";
import { AmxStatusIcon } from "@/components/admin/mobile/AdminMobileGlass";
import { adminIngestFromDealerJob } from "@/lib/admin-mobile-ingest";
import { renderHtml, renderText } from "@/lib/test-render";

const noop = () => undefined;
const src = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", "..", rel), "utf8");

function props(p: Partial<MobileDealerOrderPanelViewProps> = {}): MobileDealerOrderPanelViewProps {
  return {
    ingest: adminIngestFromDealerJob({ status: "done", serviceEventCount: 14 }, false),
    statusSub: "šodien 09:12 · OneAuto",
    sentLabel: "Nav nosūtīts",
    records: [
      { date: "03.2024", works: "Eļļas maiņa, filtri", km: "78 410 km" },
      { date: "04.2023", works: "Bremžu diski", km: "61 200 km" },
      { date: "11.2022", works: "Plānotā apkope", km: "64 900 km" },
      { date: "12.2021", works: "Plānotā apkope", km: "31 050 km" },
    ],
    aiFields: [
      { key: "service", title: "Servisa vēsture", text: "Apkopes veiktas regulāri." },
      { key: "comment", title: "Komentāri", text: "" },
    ],
    busy: null,
    pdfDisabled: false,
    sendDisabled: false,
    refundEnabled: false,
    refundLabel: "Atmaksa",
    rerunEnabled: true,
    rerunLabel: "Ielasīt vēlreiz",
    notice: null,
    onPdf: noop,
    onSend: noop,
    onRefund: noop,
    onRerun: noop,
    onShowAllRecords: noop,
    onEditAi: noop,
    ...p,
  };
}

describe("Dīlera pasūtījums telefonā - B1 «Darbību režģis»", () => {
  it("statusa kartīte: ielasīts · N ieraksti · laiks · OneAuto + Nav nosūtīts", () => {
    const t = renderText(<MobileDealerOrderPanelView {...props()} />);
    expect(t).toContain("Ielasīts · 14 ieraksti");
    expect(t).toContain("šodien 09:12 · OneAuto");
    expect(t).toContain("Nav nosūtīts");
    expect(renderHtml(<MobileDealerOrderPanelView {...props()} />)).toContain('class="amx-st amx-st--ok"');
  });

  it("2×2 pogas secībā: Pārbaudīt PDF, Sūtīt klientam (zila), Atmaksa (sarkans teksts), Ielasīt vēlreiz", () => {
    const html = renderHtml(<MobileDealerOrderPanelView {...props()} />);
    const grid = html.slice(html.indexOf("amx-grid2"));
    const variants = [...grid.matchAll(/data-amx-variant="(\w+)"/g)].slice(0, 4).map((m) => m[1]);
    expect(variants).toEqual(["secondary", "primary", "danger", "secondary"]);
    const t = renderText(<MobileDealerOrderPanelView {...props()} />);
    expect(t.indexOf("Pārbaudīt PDF")).toBeLessThan(t.indexOf("Sūtīt klientam"));
    expect(t.indexOf("Sūtīt klientam")).toBeLessThan(t.indexOf("Atmaksa"));
    expect(t.indexOf("Atmaksa")).toBeLessThan(t.indexOf("Ielasīt vēlreiz"));
    expect(grid).toMatch(/amx-btn amx-btn--primary/);
    expect(grid).toMatch(/amx-btn amx-btn--danger/);
  });

  it("Atmaksa nepieejama, ja esošais noteikums neļauj; pieejama, ja ļauj", () => {
    const off = renderHtml(<MobileDealerOrderPanelView {...props({ refundEnabled: false })} />);
    expect(off).toMatch(/data-amx-variant="danger" disabled=""/);
    const on = renderHtml(<MobileDealerOrderPanelView {...props({ refundEnabled: true })} />);
    expect(on).not.toMatch(/data-amx-variant="danger" disabled=""/);
  });

  it("servisa ieraksti: pirmie 3 + «Visi N ieraksti»; 2 AI lauki ar «Labot»", () => {
    const t = renderText(<MobileDealerOrderPanelView {...props()} />);
    expect(t).toContain("Eļļas maiņa, filtri");
    expect(t).toContain("Plānotā apkope");
    expect(t).not.toContain("31 050 km");
    expect(t).toContain("Visi 4 ieraksti");
    expect(t.match(/Labot/g)?.length).toBe(2);
    expect(t).toContain("Servisa vēsture");
    expect(t).toContain("Nav teksta");
  });

  it("datu nav: sarkans statuss, «Servisa ierakstu nav», PDF neaktīvs", () => {
    const html = renderHtml(
      <MobileDealerOrderPanelView
        {...props({ ingest: adminIngestFromDealerJob({ status: "no_data" }, false), records: [], pdfDisabled: true })}
      />,
    );
    expect(html).toContain('class="amx-st amx-st--err"');
    expect(renderText(<MobileDealerOrderPanelView {...props({ records: [] })} />)).toContain("Servisa ierakstu nav");
    expect(html).toMatch(/data-amx-variant="secondary" disabled=""><svg[^]*?Pārbaudīt PDF/);
  });

  it("ieraksti no servisa tabulas: datums MM.GGGG, km ar atstarpēm, tukšās rindas izlaiž", () => {
    expect(
      mobileDealerRecordsFromWorks([
        { date: "12.03.2024", odometer: "78410", location: "", works: "Eļļas maiņa" },
        { date: "", odometer: "", location: "", works: "" },
      ]),
    ).toEqual([{ date: "03.2024", works: "Eļļas maiņa", km: "78 410 km" }]);
  });

  it("statusa laiks Rīgas laikā: šodien HH:MM · OneAuto", () => {
    const now = Date.parse("2026-11-22T10:00:00Z");
    const sub = mobileDealerStatusSub(
      {
        sessionId: "cs_1",
        vin: "X",
        status: "done",
        attempts: 1,
        createdAt: "2026-11-22T07:00:00Z",
        updatedAt: "2026-11-22T07:12:00Z",
        finishedAt: "2026-11-22T07:12:00Z",
      },
      now,
    );
    expect(sub).toBe("šodien 09:12 · OneAuto");
    expect(mobileDealerStatusSub(null, now)).toBe("");
  });

  it("statusa ikona aplī: ķeksis / krusts / griežas / punkti", () => {
    expect(renderHtml(<AmxStatusIcon state="done" />)).toContain('class="amx-sti amx-sti--done"');
    expect(renderHtml(<AmxStatusIcon state="error" />)).toContain('aria-label="Kļūda"');
    expect(renderHtml(<AmxStatusIcon state="running" />)).toContain("amx-sti--running");
    expect(renderHtml(<AmxStatusIcon state="idle" label="Nav palaists" />)).toContain('aria-label="Nav palaists"');
  });

  it("darba zona: B1 bloks tikai telefonā un tikai dīlera pasūtījumam, lapas augšā", () => {
    const w = src("components/admin/OrderDetailWorkspace.tsx");
    expect(w).toContain("{phoneStack && isDealerOrderForMobilePanel ? (");
    expect(w.indexOf("<MobileDealerOrderPanel")).toBeLessThan(w.indexOf("<AdminOrderCountryTimelineStrip"));
    // Atmaksa - tas pats noteikums kā dīlera blokā.
    expect(w).toContain("canDealerRefund={dealerCanRefund}");
    expect(w).toContain("canRefund={dealerCanRefund}");
  });

  it("stila pamats darbojas tikai telefonā (<768 px)", () => {
    const css = src("app/admin/mobile/glass.css");
    const rules = css.replace(/\/\*[^]*?\*\//g, "");
    // Visas .amx klases ir media vaicājumā; ārpus tā - tikai @keyframes.
    const outside = rules.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "").replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outside.trim()).toBe("");
    expect(css).toContain("@media (max-width: 767px)");
    expect(src("app/admin/layout.tsx")).toContain('import "./mobile/glass.css";');
  });
});
