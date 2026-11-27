/**
 * Iekšēja admina piezīme (Nils 27.11, makets B): parsēšana, laiks, un ka teksts NEKAD nenonāk klienta atskaitē.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildClientReportDocumentHtml, type ClientReportPayload } from "@/lib/client-report-html";
import {
  formatOrderAdminNoteTime,
  orderAdminNoteOneLine,
  parseOrderAdminNote,
} from "@/lib/order-admin-note";
import { serializeAdminOrderTableRows } from "@/lib/serialize-admin-order-table";

const SECRET = "IEKSEJA-PIEZIME-NEKAD-KLIENTAM-7f3a";

describe("parseOrderAdminNote", () => {
  it("derīga piezīme", () => {
    expect(
      parseOrderAdminNote({ text: "Dīlera dati netika ielasīti", color: "yellow", resolved: true, updatedAt: "2026-11-27T12:32:00.000Z" }),
    ).toEqual({ text: "Dīlera dati netika ielasīti", color: "yellow", resolved: true, updatedAt: "2026-11-27T12:32:00.000Z" });
  });

  it("nezināma krāsa -> sarkana; resolved tikai true", () => {
    const n = parseOrderAdminNote({ text: "x", color: "blue", resolved: "yes", updatedAt: "2026-11-27T12:32:00.000Z" });
    expect(n?.color).toBe("red");
    expect(n?.resolved).toBe(false);
  });

  it("tukšs teksts, bez laika vai ne objekts -> null", () => {
    expect(parseOrderAdminNote({ text: "   ", color: "red", updatedAt: "2026-11-27T12:32:00.000Z" })).toBeNull();
    expect(parseOrderAdminNote({ text: "x", color: "red" })).toBeNull();
    expect(parseOrderAdminNote("x")).toBeNull();
    expect(parseOrderAdminNote(null)).toBeNull();
    expect(parseOrderAdminNote([])).toBeNull();
  });

  it("garumu ierobežo un vadības simbolus izmet", () => {
    const n = parseOrderAdminNote({ text: `a\u0000b${"c".repeat(5000)}`, color: "green", updatedAt: "2026-11-27T12:32:00.000Z" });
    expect(n!.text.startsWith("ab")).toBe(true);
    expect(n!.text.length).toBe(2000);
  });
});

describe("laiks un viena rinda", () => {
  it("«DD.MM. HH:MM» Rīgas laikā", () => {
    expect(formatOrderAdminNoteTime("2026-11-27T12:32:00.000Z")).toBe("27.11. 14:32");
    expect(formatOrderAdminNoteTime("2026-07-01T06:05:00.000Z")).toBe("01.07. 09:05");
    expect(formatOrderAdminNoteTime("nav")).toBe("");
  });

  it("vairākas rindas -> viena", () => {
    expect(orderAdminNoteOneLine({ text: " a\n\n b  c " })).toBe("a b c");
    expect(orderAdminNoteOneLine(null)).toBe("");
  });
});

describe("pasūtījumu saraksts", () => {
  it("serializācija nodod piezīmi rindai, nederīgu izmet", () => {
    const base = { id: "cs_1", created: 1, amountTotal: 100, currency: "eur", paymentStatus: "paid", customerEmail: null, vin: null };
    const note = { text: "Gaidu izdruku", color: "yellow", resolved: false, updatedAt: "2026-11-27T12:32:00.000Z" };
    const [a, b] = serializeAdminOrderTableRows([
      { ...base, adminNote: note },
      { ...base, id: "cs_2", adminNote: { text: "" } },
    ]);
    expect(a!.adminNote).toEqual(note);
    expect(b!.adminNote).toBeUndefined();
  });
});

describe("piezīme nekad nenonāk klientam", () => {
  it("klienta atskaites HTML nesatur piezīmes tekstu, pat ja tas iejaukts payload", () => {
    const note = { text: SECRET, color: "red", resolved: false, updatedAt: "2026-11-27T12:32:00.000Z" };
    const payload = {
      sessionId: "cs_test_note",
      isDemo: false,
      vin: "WBA5R1C0XLFH42873",
      created: Date.UTC(2026, 10, 27) / 1000,
      amountTotal: 9999,
      currency: "eur",
      paymentStatus: "paid",
      listingUrl: null,
      customerEmail: null,
      customerPhone: null,
      customerName: "Jānis Bērziņš",
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
      adminNote: note,
      orderEdits: { adminNote: note },
    } as unknown as ClientReportPayload;
    const html = buildClientReportDocumentHtml({
      payload,
      portfolio: [],
      pdfInsights: [],
      dateFmt: new Intl.DateTimeFormat("lv-LV"),
      formatBytes: () => "0 B",
    });
    expect(html.length).toBeGreaterThan(1000);
    expect(html).not.toContain(SECRET);
  });

  it("`adminNote` lieto tikai admina glabāšana, saraksts un galvene (nav PDF, e-pastu, AI, klienta saišu kodā)", () => {
    const root = path.resolve(__dirname, "..");
    const allowed = new Set([
      "lib/order-admin-note.ts",
      "lib/admin-order-draft-types.ts",
      "lib/admin-order-draft-store.ts",
      "lib/admin-dashboard-draft-index.ts",
      "lib/admin-order-draft-summaries.ts",
      "lib/serialize-admin-order-table.ts",
      "app/api/admin/order-draft/route.ts",
      "app/admin/(dashboard)/dashboard/page.tsx",
      "components/admin/AdminOrderDetailView.tsx",
      "components/admin/AdminOrderNote.tsx",
      "components/admin/AdminOrdersTable.tsx",
    ]);
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
        const rel = path.posix.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (ent.name === "node_modules" || ent.name.startsWith(".")) continue;
          walk(rel);
        } else if (/\.(ts|tsx|js|mjs)$/.test(ent.name) && !/\.test\.(ts|tsx)$/.test(ent.name)) {
          if (/\badminNote\b/.test(fs.readFileSync(path.join(root, rel), "utf8"))) hits.push(rel);
        }
      }
    };
    for (const d of ["lib", "app", "components", "hooks"]) {
      if (fs.existsSync(path.join(root, d))) walk(d);
    }
    expect(hits.filter((h) => !allowed.has(h))).toEqual([]);
    for (const f of [
      "lib/client-report-html.ts",
      "components/admin/OrderDetailWorkspace.tsx",
      "lib/admin-ai-order-context.ts",
      "lib/admin-ai-historical-context.ts",
    ]) {
      expect(hits).not.toContain(f);
    }
  });
});
