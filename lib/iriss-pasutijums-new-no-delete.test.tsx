import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/admin/iriss/pasutijumi/new",
  useSearchParams: () => new URLSearchParams(),
}));

import { IrissPasutijumsEditor } from "@/components/admin/IrissPasutijumsEditor";
import { emptyIrissPasutijums } from "@/lib/iriss-pasutijumi-types";
import { renderText } from "@/lib/test-render";

describe("Jauns IRISS pasūtījums (audits 27.10)", () => {
  it("nesaglabātam pasūtījumam nav pogas «Dzēst pasūtījumu», bet ir «Izveidot pasūtījumu»", () => {
    const rec = emptyIrissPasutijums("00000000-0000-4000-8000-000000000001", "2026-11-18T08:00:00.000Z");
    const text = renderText(createElement(IrissPasutijumsEditor, { initialRecord: rec, unsavedDraft: true }));
    expect(text).toContain("Izveidot pasūtījumu");
    expect(text).not.toContain("Dzēst pasūtījumu");
  });
});
