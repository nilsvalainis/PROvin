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

  it("points VIN success copy to Profile, not Orders", () => {
    const lv = partnerCopy("lv");
    const en = partnerCopy("en");
    const de = partnerCopy("de");
    const ru = partnerCopy("ru");
    expect(lv.vinSubmitOk).toContain("Profils");
    expect(lv.vinSubmitOk).not.toContain("Pasūtījumi");
    expect(en.vinSubmitOk).toContain("Profile");
    expect(en.vinSubmitOk).not.toMatch(/\bOrders\b/);
    expect(de.vinSubmitOk).toContain("Profil");
    expect(de.vinSubmitOk).not.toContain("Bestellungen");
    expect(ru.vinSubmitOk).toContain("Профиль");
    expect(ru.vinSubmitOk).not.toContain("Заказы");
    expect(lv.vinDuplicateNotice).toContain("{date}");
    expect(lv.vinDuplicateNotice).toBe("Šis VIN jau pasūtīts {date}");
    expect(lv.vinDuplicateReorder).toBe("Pasūtīt jaunu (1 kr.)");
    expect(lv.archiveStatusReceived).toBe("Saņemts");
    expect(lv.archiveStatusProcessing).toBe("Procesā");
    expect(lv.archiveStatusReady).toBe("Gatavs");
    expect(lv.archiveCreditRestored).toBe("Kredīts atgriezts");
    for (const copy of [lv, en, de, ru]) {
      expect(`${copy.vinSubmitOk}${copy.vinDuplicateNotice}${copy.archiveStatusReceived}`).not.toMatch(
        /[\u2013\u2014]/,
      );
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
