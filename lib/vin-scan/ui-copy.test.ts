import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

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

describe("VIN SCAN UI copy", () => {
  it("formā, kartītēs un kopsavilkumā nav palīdzības tekstu", () => {
    const src = UI_FILES.map((file) => readFileSync(join(ROOT, file), "utf8")).join("\n");
    for (const banned of BANNED) {
      expect(src).not.toContain(banned);
    }
  });
});
