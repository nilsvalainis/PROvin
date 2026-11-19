import { describe, expect, it } from "vitest";
import { normalizeAutoparksCar } from "@/lib/iriss-autoparks";
import { emptyCarV2, type V2Problem } from "@/lib/iriss-autoparks-v2";
import { autoparksV2PermsFor } from "@/lib/iriss-autoparks-v2-perms";
import {
  buildServisaLapa,
  fmtRigaDateTime,
  servisaLapaAllowed,
  servisaLapaCounts,
  servisaLapaHref,
  servisaLapaPageCount,
} from "@/lib/iriss-autoparks-v2-servisa-lapa";
import { renderHtml, renderText } from "@/lib/test-render";
import { ServisaDiagSheet, ServisaLapaSheet } from "@/components/admin/iriss-autoparks-v2/ServisaLapaSheets";
import { ServissStages } from "@/components/admin/iriss-autoparks-v2/ServissPhone";
import type { V2ServissView } from "@/lib/iriss-autoparks-v2-serviss";

const NOW = new Date("2026-11-19T10:45:00Z"); // 12:45 Rīgā (UTC+2)

function car(over: Record<string, unknown> = {}) {
  return normalizeAutoparksCar({
    id: "c1",
    make: "Volvo",
    model: "XC90 2.4 D5",
    vin: "YV1CZ7146B1568808",
    year: "2010",
    color: "Balta",
    status: "in_service",
    registry: {
      makeModel: "VOLVO XC90",
      fuel: "Dīzeļdegviela",
      seats: 7,
      odometerKm: 287400,
      tradeActNo: "GDZ00218",
      tradeActDate: "2026-11-01",
      abs: "yes",
      importedAt: "x",
    },
    ...over,
  })!;
}

function problem(id: string, text: string, fixed: boolean): V2Problem {
  return { id, text, fixedByService: fixed, confirmedByUs: false, confirmedBy: "", at: "", photoIds: ["ph"] };
}

const diagFile = { id: "d1", date: "2026-11-18", contentType: "application/pdf", title: "CSDD diagnostika 18.11.2026" };

describe("Servisa darbu lapa - datu modelis", () => {
  it("tikai aizpildītie tehniskie dati, bez akta numura un datuma", () => {
    const v2 = emptyCarV2();
    v2.tech.powerKw = 136;
    const s = buildServisaLapa({ car: car(), v2, diagFiles: [], now: NOW });
    const labels = s.tech.map((t) => t.label);
    expect(s.tech).toContainEqual({ label: "Gads", value: "2010" });
    expect(s.tech).toContainEqual({ label: "Nobraukums", value: "287 400 km" });
    expect(s.tech).toContainEqual({ label: "Jauda", value: "136 kW" });
    expect(s.tech).toContainEqual({ label: "Sēdvietas", value: "7" });
    expect(s.tech).toContainEqual({ label: "ABS", value: "Ir" });
    expect(labels).not.toContain("Numurzīme");
    expect(labels).not.toContain("ESP");
    expect(labels).not.toContain("Tilpums");
    expect(JSON.stringify(s)).not.toContain("GDZ00218");
    expect(s.title).toBe("Volvo XC90 2.4 D5");
    expect(s.vin).toBe("YV1CZ7146B1568808");
    expect(s.statusLabel).toBe("Servisā");
  });

  it("problēmas: visas ar tekstu, numurētas; izdarītas pēc ķekša; skaitītāji", () => {
    const v2 = emptyCarV2();
    v2.service.problems = [
      problem("a", "Deg lampa panelī", false),
      problem("b", "   ", true),
      problem("c", "Ieeļļot bagāžnieka slēdzi", true),
      problem("d", "Kapota amortizatori netur", false),
    ];
    v2.service.notes = "  Mainīt eļļu  ";
    const s = buildServisaLapa({ car: car(), v2, diagFiles: [], now: NOW });
    expect(s.problems).toEqual([
      { n: 1, text: "Deg lampa panelī", done: false },
      { n: 2, text: "Ieeļļot bagāžnieka slēdzi", done: true },
      { n: 3, text: "Kapota amortizatori netur", done: false },
    ]);
    expect([s.doneCount, s.openCount]).toEqual([1, 2]);
    expect(s.notes).toBe("Mainīt eļļu");
    expect(servisaLapaCounts(1, 3)).toBe("1 izdarīta, 3 atlikušas");
    expect(servisaLapaCounts(2, 1)).toBe("2 izdarītas, 1 atlikusi");
  });

  it("īpašnieks pēc auto īpašnieka lauka (v2 labojums pārraksta v1)", () => {
    const iriss = buildServisaLapa({ car: car(), v2: emptyCarV2(), diagFiles: [], now: NOW });
    expect([iriss.owner, iriss.ownerName, iriss.ownerRegNo]).toEqual(["IRISS", "SIA ĪRISS", "59202001191"]);
    const dza = buildServisaLapa({ car: car({ owner: "DZA" }), v2: emptyCarV2(), diagFiles: [], now: NOW });
    expect([dza.ownerName, dza.ownerRegNo]).toEqual(["SIA DZINTARZEME AUTO", ""]);
    const v2 = emptyCarV2();
    v2.fields.owner = "DZA";
    expect(buildServisaLapa({ car: car(), v2, diagFiles: [], now: NOW }).ownerName).toBe("SIA DZINTARZEME AUTO");
  });

  it("izdrukāšanas laiks Rīgas laikā", () => {
    expect(fmtRigaDateTime(NOW)).toBe("19.11.2026 12:45");
    expect(fmtRigaDateTime(new Date("2026-07-01T21:05:00Z"))).toBe("02.07.2026 00:05");
  });

  it("2. lapa tikai, ja ir CSDD diagnostikas skenējums (ņem jaunāko)", () => {
    const none = buildServisaLapa({ car: car(), v2: emptyCarV2(), diagFiles: [], now: NOW });
    expect(none.diag).toBeNull();
    expect(servisaLapaPageCount(none, 0)).toBe(1);
    const two = buildServisaLapa({ car: car(), v2: emptyCarV2(), diagFiles: [{ ...diagFile, id: "old" }, diagFile], now: NOW });
    expect(two.diag?.id).toBe("d1");
    expect(servisaLapaPageCount(two, 0)).toBe(2);
    expect(servisaLapaPageCount(two, 2)).toBe(3);
  });
});

describe("Servisa darbu lapa - piekļuve kā Servisam (ap_serviss)", () => {
  it("administrators un darbinieks ar ap_serviss - jā; bez tās vai ar izslēgtu v2 - nē", () => {
    expect(servisaLapaAllowed(autoparksV2PermsFor({ kind: "admin" }, false))).toBe(true);
    expect(servisaLapaAllowed(autoparksV2PermsFor({ kind: "staff", sections: ["ap_serviss"] }, true))).toBe(true);
    expect(servisaLapaAllowed(autoparksV2PermsFor({ kind: "staff", sections: ["ap_pamatdati", "ap_cenu_lapa", "ap_summas"] }, true))).toBe(false);
    expect(servisaLapaAllowed(autoparksV2PermsFor({ kind: "staff", sections: ["ap_serviss"] }, false))).toBe(false);
  });
});

describe("Servisa darbu lapa - A4 renderējums", () => {
  const v2 = emptyCarV2();
  v2.service.problems = [problem("a", "Deg lampa panelī", false), problem("b", "Ieeļļot slēdzi", true)];
  const s = buildServisaLapa({ car: car(), v2, diagFiles: [diagFile], now: NOW });

  it("1. lapa: īpašnieks, virsraksts, problēmu tabula ar statusiem un ķekšiem, piezīmes, paraksti", () => {
    const text = renderText(<ServisaLapaSheet s={s} pages={2} />);
    const html = renderHtml(<ServisaLapaSheet s={s} pages={2} />);
    expect(text).toContain("Īpašnieks SIA ĪRISS Reģ. nr. 59202001191");
    expect(text).toContain("Servisa darbu lapa Izdrukāts 19.11.2026 12:45 · Autoparks · Statuss: Servisā");
    expect(text).toContain("Problēmas (2) · 1 izdarīta, 1 atlikusi");
    expect(text).toContain("1 Deg lampa panelī Neizdarīts");
    expect(text).toContain("2 Ieeļļot slēdzi ✓ Izdarīts");
    expect(html.match(/class="sq x"/g)?.length).toBe(1);
    // 2 problēmas x 1 piezīmju līnija + 12 tukšas rindas (teksts + piezīmes) = 26
    expect(html.match(/class="line"/g)?.length).toBe(2 + 12 * 2);
    expect(html.match(/class="blank"/g)?.length).toBe(12);
    expect(text).toContain("14");
    expect(text).toContain("Servisa piezīmes Nav piezīmju");
    expect(text).not.toContain("Papildu darbi");
    expect(text).toContain("Mehāniķis (vārds, uzvārds) Paraksts Datums");
    expect(text).toContain("SIA ĪRISS · Autoparks · Servisa darbu lapa 1/2");
    expect(html).not.toContain("<img");
    expect(text).not.toMatch(/€|GDZ00218/);
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });

  it("2. lapa: josla ar īpašnieku, auto + VIN; skenējums visā lapā; ja neizdodas - saite", () => {
    const ok = renderHtml(<ServisaDiagSheet s={s} page={2} pages={2} state={{ kind: "image", src: "data:image/jpeg;base64,AA" }} />);
    expect(renderText(<ServisaDiagSheet s={s} page={2} pages={2} state={{ kind: "loading" }} />)).toContain(
      "SIA ĪRISS Volvo XC90 2.4 D5 · YV1CZ7146B1568808 CSDD diagnostika",
    );
    expect(ok).toContain('src="data:image/jpeg;base64,AA"');
    expect(ok).toContain("2/2");
    const failed = renderHtml(<ServisaDiagSheet s={s} page={2} pages={2} state={{ kind: "failed", href: "/x" }} />);
    expect(failed).toContain('href="/x"');
  });
});

describe("Serviss cilne - poga «Drukāt servisa lapu» pie «Problēmas»", () => {
  const noop = () => undefined;
  const view: V2ServissView = {
    numberCheck: { files: [], date: "" },
    diag: { files: [], date: "" },
    problems: [],
    notes: "",
    invoices: [],
    totalEur: null,
    canSums: false,
    canConfirm: false,
    canDelete: false,
  };
  it("saite uz servisa lapu blakus virsrakstam, atveras jaunā cilnē", () => {
    const html = renderHtml(
      <ServissStages
        view={view}
        notesEditing={false}
        notesDraft=""
        onNotesDraft={noop}
        onNotesEdit={noop}
        onNotesSave={noop}
        onNotesCancel={noop}
        onScanDoc={noop}
        onScanInvoice={noop}
        onViewFiles={noop}
        onOpenInvoice={noop}
        onAddProblem={noop}
        onEditProblem={noop}
        onAddPhotos={noop}
        onOpenPhoto={noop}
        onDeleteProblem={noop}
        onToggleFixed={noop}
        photoUrl={(id) => id}
        printHref={servisaLapaHref("c 1")}
      />,
    );
    const problems = html.split('aria-label="Problēmas"')[1] ?? "";
    expect(problems).toMatch(/<span>Problēmas<\/span><a class="ap2-sv-print" href="\/admin\/iriss\/autoparks-v2\/c%201\/servisa-lapa" target="_blank"[^>]*>Drukāt servisa lapu<\/a>/);
  });
});

describe("servisaLapaBlankRows (19.11 tukšas rindas jaunām problēmām)", () => {
  it("kopā vismaz 14 rindas, bet vienmēr vismaz 4 tukšas", async () => {
    const { servisaLapaBlankRows } = await import("@/components/admin/iriss-autoparks-v2/ServisaLapaSheets");
    expect(servisaLapaBlankRows(0)).toBe(14);
    expect(servisaLapaBlankRows(4)).toBe(10);
    expect(servisaLapaBlankRows(12)).toBe(4);
    expect(servisaLapaBlankRows(30)).toBe(4);
  });
});
