import { describe, expect, it } from "vitest";
import { AdminSaveButton } from "@/components/admin/AdminSaveButton";
import { adminSaveLabel, isAdminSaveShortcut } from "@/lib/admin-save-state";
import { renderHtml, renderText } from "@/lib/test-render";

describe("vienotā saglabāšanas poga", () => {
  it("katram stāvoklim savs teksts, viena poga", () => {
    expect(renderText(<AdminSaveButton onSave={() => undefined} state="idle" />)).toBe("Saglabāt");
    expect(renderText(<AdminSaveButton onSave={() => undefined} state="saving" />)).toBe("Saglabā…");
    expect(renderText(<AdminSaveButton onSave={() => undefined} state="saved" />)).toBe("Saglabāts");
    expect(renderText(<AdminSaveButton onSave={() => undefined} state="error" />)).toBe("Mēģināt vēlreiz");
  });

  it("saglabājot poga ir atslēgta, nesaglabātām izmaiņām zils tonis", () => {
    expect(renderHtml(<AdminSaveButton onSave={() => undefined} state="saving" />)).toContain("disabled");
    expect(renderHtml(<AdminSaveButton onSave={() => undefined} state="idle" dirty />)).toContain("bg-[#1a73e8]");
    expect(renderHtml(<AdminSaveButton onSave={() => undefined} state="saved" />)).toContain("bg-[#34c759]");
  });

  it("⌘S / Ctrl+S, bet ne ⌘⇧S", () => {
    expect(isAdminSaveShortcut({ key: "s", metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true);
    expect(isAdminSaveShortcut({ key: "S", metaKey: false, ctrlKey: true, shiftKey: false, altKey: false })).toBe(true);
    expect(isAdminSaveShortcut({ key: "s", metaKey: true, ctrlKey: false, shiftKey: true, altKey: false })).toBe(false);
    expect(adminSaveLabel("idle", false, "Saglabāt piedāvājumu")).toBe("Saglabāt piedāvājumu");
  });
});
