import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_LOCALES } from "@/i18n/locales";

function partnerKeys(locale: (typeof APP_LOCALES)[number]): string[] {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "messages", locale, "partner.json"), "utf8"),
  ) as { Partner: Record<string, string> };
  return Object.keys(raw.Partner).sort();
}

function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
      flattenKeys(child, prefix ? `${prefix}.${key}` : key),
    );
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenKeys(item, `${prefix}[${index}]`));
  }
  return [prefix];
}

function messageKeys(locale: (typeof APP_LOCALES)[number], file: string): string[] {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "messages", locale, file), "utf8"),
  ) as unknown;
  return flattenKeys(raw).sort();
}

function partnerCopy(locale: (typeof APP_LOCALES)[number]): Record<string, string> {
  const raw = JSON.parse(
    readFileSync(join(process.cwd(), "messages", locale, "partner.json"), "utf8"),
  ) as { Partner: Record<string, string> };
  return raw.Partner;
}

describe("partner i18n", () => {
  it("keeps Partner keys in parity across lv, en, de and ru", () => {
    const lv = partnerKeys("lv");
    for (const locale of APP_LOCALES) {
      expect(partnerKeys(locale), locale).toEqual(lv);
    }
  });

  it("points VIN success copy to the Orders tab", () => {
    const lv = partnerCopy("lv");
    const en = partnerCopy("en");
    const de = partnerCopy("de");
    const ru = partnerCopy("ru");
    expect(lv.vinSubmitOk).toContain(lv.navArchive);
    expect(en.vinSubmitOk).toContain(en.navArchive);
    expect(de.vinSubmitOk).toContain(de.navArchive);
    expect(ru.vinSubmitOk).toContain(ru.navArchive);
    expect(lv.buyOk).toContain(lv.navArchive);
    expect(lv.vinDuplicateNotice).toContain("{date}");
    expect(lv.vinDuplicateNotice).toBe("Šis VIN jau pasūtīts {date}");
    expect(lv.vinDuplicateReorder).toBe("Pasūtīt jaunu (1 kr.)");
    expect(lv.bulkModeMany).toBe("Vairāki VIN");
    expect(lv.bulkCheckCta).toBe("Pārbaudīt sarakstu");
    expect(lv.bulkChipInvalid).toBe("Nederīgs - {count} zīmes");
    expect(lv.bulkReorder).toBe("Pasūtīt jaunu atskaiti - izlietos 1 kredītu");
    expect(lv.bulkShortfall).toBe("Trūkst {count} kredītu - Pirkt paku");
    expect(lv.bulkCreditsLine).toContain("{from} → {to}");
    expect(lv.archiveStatusReceived).toBe("Saņemts");
    expect(lv.archiveStatusProcessing).toBe("Procesā");
    expect(lv.archiveStatusReady).toBe("Gatavs");
    expect(lv.archiveCreditRestored).toBe("Kredīts atgriezts");
    for (const copy of [lv, en, de, ru]) {
      expect(Object.values(copy).join("\n")).not.toMatch(/[\u2013\u2014]/);
    }
  });

  it("keeps header, footer and legal key shape across lv, en, de and ru", () => {
    for (const file of ["header.json", "footer.json", "legal.json"]) {
      const lv = messageKeys("lv", file);
      for (const locale of APP_LOCALES) {
        expect(messageKeys(locale, file), `${locale}/${file}`).toEqual(lv);
      }
    }
  });
});
