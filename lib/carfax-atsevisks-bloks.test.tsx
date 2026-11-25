import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/admin/AdminVinHandoffContext", () => ({ useAdminVinHandoff: () => ({ vin: "WBAUT31000F000004" }) }));

import { AdminCarfaxSourceBlock } from "@/components/admin/AdminCarfaxSourceBlock";
import {
  createDefaultSourceBlocks,
  emptyCarfaxBlock,
  mergeSourceBlocksWithDefaults,
  mergeVendorBlocksPlain,
  SOURCE_BLOCK_LABELS,
  toPdfCarfaxBlock,
  toPdfManualVendorBlocks,
  type WorkspaceSourceBlocks,
} from "@/lib/admin-source-blocks";
import { carfaxTrafficLevel } from "@/lib/admin-block-traffic-status";
import { applyCarfaxReportToBlock } from "@/lib/carfax-report";
import { CARFAX_FIXTURE_IT } from "@/lib/carfax-report-parse.fixtures";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import { ADMIN_MOBILE_ORDER_SECTIONS } from "@/lib/admin-mobile-ds";
import { collectUnifiedIncidentRows } from "@/lib/unified-incidents";
import { collectUnifiedMileageRows } from "@/lib/unified-mileage";
import { attachPdfTextsToVendorBlocks, parseDamageDetailsForVendorTitle } from "@/lib/vendor-damage-hydrate";
import { renderHtml, renderText } from "@/lib/test-render";
import { CARFAX_ICON_SVG } from "@/lib/pdf-source-logo-svgs";

const src = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

/** Pasūtījums ar AutoDNA, CarVertical un CARFAX datiem (izdomāti VIN fragmenti / datumi). */
function blocksWithAllThree(): WorkspaceSourceBlocks {
  const blocks = createDefaultSourceBlocks();
  const carfax = applyCarfaxReportToBlock(blocks.carfax, CARFAX_FIXTURE_IT)!.block;
  return {
    ...blocks,
    autodna: {
      ...blocks.autodna,
      serviceHistory: [{ date: "2019-06-01", odometer: "40000", country: "Vācija" }],
      incidents: [{ csngDate: "03.2018", lossAmount: "1200 €", incidentNo: "Vācija" }],
      comments: "AutoDNA komentārs",
    },
    carvertical: {
      ...blocks.carvertical,
      serviceHistory: [{ date: "2020-08-01", odometer: "70000", country: "Lietuva" }],
      incidents: [{ csngDate: "07.2020", lossAmount: "800 €", incidentNo: "Lietuva" }],
      comments: "CarVertical komentārs",
    },
    carfax: { ...carfax, comments: "CARFAX komentārs" },
  };
}

function payload(overrides: Partial<ClientReportPayload>): ClientReportPayload {
  return {
    sessionId: "cs_test",
    vin: "WBAUT31000F000004",
    created: Date.now(),
    amountTotal: 7999,
    currency: "eur",
    paymentStatus: "paid",
    listingUrl: null,
    customerEmail: null,
    customerPhone: null,
    customerName: null,
    contactMethod: null,
    notes: null,
    csdd: "",
    ltab: "",
    tirgus: "",
    citi: "",
    iriss: "",
    apskatesPlāns: "",
    tehniskoRiskuAnalize: "",
    cenasAtbilstiba: "",
    ...overrides,
  } as ClientReportPayload;
}

function pdfHtml(blocks: WorkspaceSourceBlocks, withCarfaxBlock = true): string {
  return buildClientReportDocumentHtml({
    payload: payload({
      manualVendorBlocks: toPdfManualVendorBlocks(blocks),
      ...(withCarfaxBlock ? { carfaxBlock: toPdfCarfaxBlock(blocks.carfax) } : {}),
    }),
    portfolio: [],
    pdfInsights: [],
    dateFmt: new Intl.DateTimeFormat("lv-LV"),
    formatBytes: () => "0 B",
  });
}

/** Viena avota zona klienta PDF (no `pdf-src-zone--<key>` līdz nākamajai zonai). */
function zone(html: string, key: string): string {
  const at = html.indexOf(`pdf-src-zone pdf-src-zone--${key}`);
  if (at < 0) return "";
  const start = html.lastIndexOf("<div", at);
  const next = html.indexOf('class="pdf-unified-mileage-zone pdf-surface-card', at + 10);
  return html.slice(start, next > 0 ? next : undefined);
}

describe("CARFAX - patstāvīgs avota bloks (Nila norādījums 25.11)", () => {
  it("dati: AutoDNA / CarVertical ieraksti nesatur CARFAX datus; CARFAX - savs ieraksts ar nosaukumu «CARFAX»", () => {
    const vendors = toPdfManualVendorBlocks(blocksWithAllThree());
    const byTitle = new Map(vendors.map((v) => [v.title, v]));
    const adna = byTitle.get(SOURCE_BLOCK_LABELS.autodna)!;
    const cv = byTitle.get(SOURCE_BLOCK_LABELS.carvertical)!;
    const cfx = byTitle.get("CARFAX")!;
    expect(adna.mileageRows.map((r) => r.odometer)).toEqual(["40000"]);
    expect(cv.mileageRows.map((r) => r.odometer)).toEqual(["70000"]);
    expect(adna.incidentRows).toHaveLength(1);
    expect(cv.incidentRows).toHaveLength(1);
    for (const b of [adna, cv]) {
      expect(JSON.stringify(b)).not.toMatch(/CARFAX|194280|Itālija/i);
      expect(b.damageDetails ?? []).toHaveLength(0);
    }
    expect(cfx.mileageRows.some((r) => r.odometer === "194280")).toBe(true);
    expect(cfx.incidentRows.length).toBeGreaterThan(0);
    // CARFAX zonas nāk tikai no CARFAX parsētāja - nav AutoDNA / CarVertical RAW apstrādes.
    expect(cfx.sourceRaw).toBeUndefined();
  });

  it("kopējās nobraukuma / negadījumu tabulas: CARFAX rindas ar avotu «CARFAX», ne CarVertical / AutoDNA", () => {
    const vendors = toPdfManualVendorBlocks(blocksWithAllThree());
    const mileage = collectUnifiedMileageRows({ manualVendorBlocks: vendors });
    const m194 = mileage.filter((r) => r.odometer.replace(/\D/g, "") === "194280");
    expect(m194.length).toBeGreaterThan(0);
    expect(m194.every((r) => r.sourceLabel === "CARFAX")).toBe(true);
    const incidents = collectUnifiedIncidentRows({ manualVendorBlocks: vendors });
    const italy = incidents.filter((r) => /Itālija/i.test(r.country));
    expect(italy.length).toBeGreaterThan(0);
    expect(italy.every((r) => r.sourceLabel === "CARFAX")).toBe(true);
    expect(incidents.filter((r) => r.sourceLabel === SOURCE_BLOCK_LABELS.carvertical).map((r) => r.date)).toEqual(["07.2020"]);
    expect(incidents.filter((r) => r.sourceLabel === SOURCE_BLOCK_LABELS.autodna).map((r) => r.date)).toEqual(["03.2018"]);
  });

  it("AI / vecais plakanais teksts: CARFAX sava sadaļa 【CARFAX】, AutoDNA / CarVertical sadaļās nav CARFAX", () => {
    const plain = mergeVendorBlocksPlain(blocksWithAllThree());
    const sections = plain.split(/\n\n(?=【)/);
    const adna = sections.find((s) => s.startsWith(`【${SOURCE_BLOCK_LABELS.autodna}】`))!;
    const cv = sections.find((s) => s.startsWith(`【${SOURCE_BLOCK_LABELS.carvertical}】`))!;
    const cfx = sections.find((s) => s.startsWith("【CARFAX】"))!;
    expect(adna).not.toMatch(/CARFAX/);
    expect(cv).not.toMatch(/CARFAX/);
    expect(cfx).toContain("CARFAX atskaite");
    expect(cfx).toContain("CARFAX komentārs");
  });

  it("CARFAX PDF teksts nekad nenonāk AutoDNA / CarVertical bojājumu zonās; CARFAX nelieto to parsētājus", () => {
    const vendors = toPdfManualVendorBlocks(blocksWithAllThree());
    const attached = attachPdfTextsToVendorBlocks(vendors, [{ fileName: "carfax.pdf", text: CARFAX_FIXTURE_IT }]);
    for (const b of attached) {
      if (b.title === "CARFAX") continue;
      expect(b.damageDetails ?? []).toHaveLength(0);
    }
    expect(parseDamageDetailsForVendorTitle(SOURCE_BLOCK_LABELS.carvertical, CARFAX_FIXTURE_IT)).toEqual([]);
    expect(parseDamageDetailsForVendorTitle("CARFAX", "Damaged area: front left bumper 2021")).toEqual([]);
  });

  it("migrācija lasīšanas brīdī: #1204 (AutoDNA/CarVertical formas) CARFAX dati nepazūd", () => {
    const applied = applyCarfaxReportToBlock(createDefaultSourceBlocks().carfax, CARFAX_FIXTURE_IT)!.block;
    const legacy = {
      ...applied,
      serviceHistory: [{ date: "", odometer: "", country: "" }, ...applied.serviceHistory],
      incidents: [{ incidentNo: "", csngDate: "", lossAmount: "" }, ...applied.incidents],
      comments: "Operatora komentārs",
      mileagePasteRaw: "RAW 194280",
      pdfChecklist: { incidents: true, mileageHistory: false, mileageLine: false },
      photoGroups: [],
      photos: [],
    };
    const raw = JSON.parse(JSON.stringify({ carfax: legacy }));
    const b = mergeSourceBlocksWithDefaults(raw).carfax;
    expect(b.report?.vin).toBe(applied.report!.vin);
    expect(b.report?.damages.length).toBe(applied.report!.damages.length);
    const pick = (rows: { date: string; odometer: string; country: string }[]) =>
      rows.map((r) => `${r.date}|${r.odometer}|${r.country}`);
    expect(pick(b.serviceHistory)).toEqual(pick(applied.serviceHistory));
    expect(b.incidents).toHaveLength(applied.incidents.length);
    expect(b.vehicleHistoryTimeline?.length).toBe(applied.vehicleHistoryTimeline?.length);
    expect(b.damageDetails?.length).toBe(applied.damageDetails?.length);
    expect(b.comments).toContain("Operatora komentārs");
    expect(b.comments.length).toBeGreaterThan("Operatora komentārs".length);
    expect(b.aiContextRaw).toContain("RAW 194280");
    expect("pdfChecklist" in b).toBe(false);
    expect("mileagePasteRaw" in b).toBe(false);
    // Atkārtota lasīšana nemaina datus (idempotenti).
    expect(mergeSourceBlocksWithDefaults(JSON.parse(JSON.stringify({ carfax: b }))).carfax).toEqual(b);
  });

  it("statuss: tukšs / daļēji (atskaite bez komentāra) / pilns", () => {
    expect(carfaxTrafficLevel(emptyCarfaxBlock())).toBe("empty");
    const applied = applyCarfaxReportToBlock(emptyCarfaxBlock(), CARFAX_FIXTURE_IT)!.block;
    expect(carfaxTrafficLevel(applied)).toBe("partial");
    expect(carfaxTrafficLevel({ ...applied, comments: "Kopsavilkums" })).toBe("complete");
  });
});

describe("CARFAX klienta PDF - sava sadaļa", () => {
  it("sava zona ar logo un savām tabulām; AutoDNA / CarVertical zonās nav CARFAX", () => {
    const html = pdfHtml(blocksWithAllThree());
    const cfx = zone(html, "carfax");
    expect(cfx).toContain("pdf-carfax-zone");
    // Oriģinālā CARFAX logo zīme sadaļas galvā.
    expect(cfx).toContain(encodeURIComponent(CARFAX_ICON_SVG));
    expect(cfx).toContain("Ātrā pārbaude");
    expect(cfx).toContain("pdf-carfax-table--mileage");
    expect(cfx).toContain("194 280");
    expect(cfx).toContain("pdf-carfax-table--history");
    // Bojājumi tajās pašās kartītēs kā CarVertical (siluets, zonas), avots «CARFAX».
    expect(cfx).toContain("pdf-incident-card--with-dmg");
    expect(cfx).toContain("Tehniskie dati");
    expect(cfx).toContain("CARFAX komentārs");
    for (const key of ["autodna", "carvertical"]) {
      const z = zone(html, key);
      expect(z.length).toBeGreaterThan(0);
      expect(z).not.toMatch(/CARFAX|194 280/);
    }
  });

  it("vecs PDF ceļš bez `carfaxBlock` - sadaļa joprojām atsevišķa (no CARFAX ieraksta)", () => {
    const cfx = zone(pdfHtml(blocksWithAllThree(), false), "carfax");
    expect(cfx).toContain("pdf-carfax-zone");
    expect(cfx).toContain("pdf-carfax-table--mileage");
  });

  it("izslēgts PDF ķeksis - CARFAX sadaļas nav", () => {
    const blocks = blocksWithAllThree();
    const html = buildClientReportDocumentHtml({
      payload: payload({
        manualVendorBlocks: toPdfManualVendorBlocks(blocks),
        carfaxBlock: toPdfCarfaxBlock(blocks.carfax),
        pdfVisibility: { carfax: false } as ClientReportPayload["pdfVisibility"],
      }),
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html).not.toContain("pdf-carfax-zone");
  });
});

describe("CARFAX admin - patstāvīgs bloks", () => {
  const applied = applyCarfaxReportToBlock(emptyCarfaxBlock(), CARFAX_FIXTURE_IT)!.block;
  const el = (value = applied) => (
    <AdminCarfaxSourceBlock value={value} onChange={() => undefined} sessionId="cs_test" trafficFillLevel="partial" />
  );

  it("savs bloks: virsraksts, «Pirkt CARFAX», atskaite, tabulas - bez AutoDNA / CarVertical komponentes", () => {
    const html = renderHtml(el());
    const text = renderText(el());
    expect(html).toContain('data-provin-block="carfax"');
    expect(text).toContain("CARFAX");
    expect(text).toContain("Pirkt CARFAX");
    expect(html).toContain("data-provin-carfax-report");
    expect(html).toContain("data-provin-carfax-damages");
    expect(html).toContain("data-provin-carfax-mileage");
    expect(html).toContain("data-provin-carfax-history");
    expect(text).toContain("Bojātā puse");
    // AutoDNA / CarVertical bloka pazīmes (vienotā nobraukuma tabula ar ievades laukiem) nav.
    expect(html).not.toContain("data-provin-mileage-table");
    expect(html).not.toContain('data-provin-block="autodna"');
    expect(html).not.toContain('data-provin-block="carvertical"');
  });

  it("tukšs bloks: «CARFAX atskaite nav ielasīta»", () => {
    expect(renderText(el(emptyCarfaxBlock()))).toContain("CARFAX atskaite nav ielasīta");
  });

  it("darba vietā CARFAX ir sava cilne un savs ieraksts telefonā (ne «Datu serv.» / «Negadījumi» režģī)", () => {
    const ws = src("components/admin/OrderDetailWorkspace.tsx");
    const negStart = ws.indexOf('id="admin-m-sec-negadijumi"');
    const negEnd = ws.indexOf(") : null}", negStart);
    expect(negStart).toBeGreaterThan(0);
    expect(ws.slice(negStart, negEnd)).not.toContain("carfax");
    expect(ws).toContain('{(phoneStack || wizardStep === WIZARD_CARFAX_STEP) ? (');
    expect(ws).toContain('<div id="admin-order-block-carfax" className="min-w-0 amx amx-src">');
    expect(ws).toContain('{ label: "CARFAX", Icon: FileText, row: 1 as const }');
    expect(ws).not.toContain("<AdminVendorAvotuSourceBlock\n                blockKey=\"carfax\"");
    expect(src("components/admin/AdminCarfaxSourceBlock.tsx")).not.toContain("AdminVendorAvotuSourceBlock");
    expect(src("components/admin/AdminVendorAvotuSourceBlock.tsx")).not.toMatch(/carfax/i);
    expect(ADMIN_MOBILE_ORDER_SECTIONS.find((s) => s.label === "CARFAX")).toEqual({
      id: "admin-order-block-carfax",
      label: "CARFAX",
      wizard: 14,
    });
  });
});
