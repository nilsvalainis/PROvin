import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/use-admin-is-phone", () => ({ useAdminIsPhone: () => true }));

import { AdminCollapsibleShell } from "@/components/admin/AdminCollapsibleShell";
import { AdminOrderVinScanCard } from "@/components/admin/AdminOrderVinScanCard";
import { AdminPhoneSectionCollapse } from "@/components/admin/AdminPhoneSectionCollapse";
import {
  adminUiOpenKey,
  clearAdminUiOpenMemoryForTests,
  readAdminUiOpen,
  writeAdminUiOpen,
} from "@/lib/admin-ui-open-memory";
import type { OrderVinScanRecord } from "@/lib/order-vin-scan";
import { renderHtml } from "@/lib/test-render";

describe("atvērtais stāvoklis paliek pēc atkārtotas uzstādīšanas (FLASH MAX, 24.11)", () => {
  beforeEach(() => clearAdminUiOpenMemoryForTests());

  it("atmiņa ir pa pasūtījumu un id", () => {
    writeAdminUiOpen(adminUiOpenKey("s1", "x"), true);
    expect(readAdminUiOpen(adminUiOpenKey("s1", "x"))).toBe(true);
    expect(readAdminUiOpen(adminUiOpenKey("s2", "x"))).toBeUndefined();
  });

  it("telefona bloks: bez atmiņas sakļauts, ar atmiņu (atvērts) - atvērts", () => {
    const shell = () =>
      renderHtml(
        <AdminCollapsibleShell sessionId="s1" blockId="csdd" header={<span>CSDD</span>}>
          <p>saturs-csdd</p>
        </AdminCollapsibleShell>,
      );
    expect(shell()).toContain('aria-expanded="false"');
    writeAdminUiOpen(adminUiOpenKey("s1", "shell:csdd"), false);
    expect(shell()).toContain('aria-expanded="true"');
  });

  it("telefona sadaļa atceras atvērto stāvokli", () => {
    const sec = () =>
      renderHtml(
        <AdminPhoneSectionCollapse sessionId="s1" sectionId="kopsavilkums" header={<span>K</span>}>
          <p>saturs</p>
        </AdminPhoneSectionCollapse>,
      );
    expect(sec()).toContain('aria-expanded="false"');
    writeAdminUiOpen(adminUiOpenKey("s1", "phone-section:kopsavilkums"), false);
    expect(sec()).toContain('aria-expanded="true"');
  });

  it("VIN SCAN avotu saraksts paliek izvērsts", () => {
    const record = {
      at: "2026-11-24T10:00:00.000Z",
      vin: "VXEVFAHKKM7805359",
      status: "done",
      indicators: [
        { id: "csdd", label: "csdd", country: "LV", status: "found", summary: "Ir dati", detail: "", openUrl: "https://example.test/csdd" },
      ],
    } as unknown as OrderVinScanRecord;
    const card = () =>
      renderHtml(
        <AdminOrderVinScanCard
          sessionId="s1"
          vin="VXEVFAHKKM7805359"
          listingUrl=""
          initial={record}
          onImportAuction={() => undefined}
          onImportCsdd={() => undefined}
          onImportListing={() => undefined}
        />,
      );
    writeAdminUiOpen(adminUiOpenKey("s1", "shell:vin-scan-avoti"), false);
    expect(card()).toContain("Rādīt sarakstu");
    writeAdminUiOpen(adminUiOpenKey("s1", "vin-scan-list"), true);
    expect(card()).not.toContain("Rādīt sarakstu");
  });
});
