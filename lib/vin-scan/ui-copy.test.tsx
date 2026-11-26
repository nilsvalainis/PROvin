import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/vin-scan",
}));

import { AdminVinScanPageClient } from "@/components/admin/AdminVinScanPageClient";
import { AdminVinScanResultCards } from "@/components/admin/AdminVinScanResultCards";
import { renderHtml } from "@/lib/test-render";

const ROOT = process.cwd();
const VIN = "WBA5R1C0XLFH42873";

const UI_FILES = [
  "app/admin/(dashboard)/vin-scan/page.tsx",
  "components/admin/AdminVinScanPageClient.tsx",
  "components/admin/AdminVinScanPanel.tsx",
  "components/admin/AdminVinScanResultCards.tsx",
] as const;

const BANNED = [
  "Avoti",
  "Serveris nolasa",
  "Ievadi 11-17",
  "Ievadi VIN",
  "Avotu skenēšana",
  "kešs vecāks",
  "Ieslēdziet PROVIN skriptu",
  "Atjauniniet PROVIN skriptu",
  "placeholder=",
  "vinScanFormatHint",
  "title={item.hint}",
  "Captcha un Cloudflare",
  "Maksas pirkums paliek",
];

/** Tas pats aizliegumu saraksts, attiecināts uz renderēto HTML (JSX specifiskie ieraksti kļūst par atribūtiem). */
function expectNoHelpCopy(html: string) {
  for (const banned of BANNED.filter((b) => !/[={]/.test(b) && b !== "vinScanFormatHint")) {
    expect(html, banned).not.toContain(banned);
  }
  expect(html).not.toMatch(/\splaceholder="/);
  expect(html).not.toMatch(/\stitle="/);
}

describe("VIN SCAN UI copy", () => {
  it("atvērta VIN SCAN lapa (forma un avotu saraksts) nerāda palīdzības tekstus, vietturus un uzvedņu title", () => {
    const html = renderHtml(<AdminVinScanPageClient initialVin={VIN} />);
    expect(html).toContain("Pārbaudīt");
    // VIN SCAN v4: avoti parādās pakāpeniski tikai pēc «Pārbaudīt» (līdz tam avotu saraksta nav).
    expect(html).not.toContain("data-vin-scan-v4");
    expectNoHelpCopy(html);
    /* Pirkums šajā rīkā nav pieejams (tikai pasūtījuma lapā pēc apstiprinājuma). */
    expect(html).not.toMatch(/pirkt/i);
  });

  it("rezultātu kartītes ar datiem nerāda palīdzības tekstus", () => {
    const html = renderHtml(
      <AdminVinScanResultCards
        rows={[
          {
            id: "stat_vin",
            label: "stat.vin",
            status: "found",
            summary: "Copart 2021, 12 foto",
            openUrl: `https://stat.vin/cars/${VIN}`,
            auctions: [{ title: "Copart · lots 50558298", venue: "Copart", date: "2021-05-02" }],
          },
          { id: "csdd", label: "CSDD", status: "found", summary: "TA līdz 2027-01", mileage: [{ date: "2025-01-10", km: 185000 }] },
          { id: "nicb", label: "NICB VINCheck", status: "none", summary: "Nav zādzības ierakstu" },
        ] as never}
      />,
    );
    expect(html).toContain("Copart");
    expectNoHelpCopy(html);
  });

  /*
   * Aizlieguma pārbaude pēc avota teksta - apzināti atstāta (tests-behavior-first.mdc to atļauj
   * aizliegumiem, ko citādi nevar pārbaudīt). Statiskais renderis augstāk redz tikai sākuma stāvokli;
   * šī rinda sargā arī zarus, kas parādās tikai pēc efektiem (ielāde, kļūda, skripta brīdinājumi).
   */
  it("formā, kartītēs un kopsavilkumā nav palīdzības tekstu", () => {
    const src = UI_FILES.map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");
    for (const banned of BANNED) {
      expect(src).not.toContain(banned);
    }
  });
});
