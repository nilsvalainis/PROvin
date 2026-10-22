import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("IRISS editor default array/object props", () => {
  it("uses module EMPTY_* constants instead of inline [] / {}", () => {
    const editor = readFileSync(new URL("../components/admin/IrissPasutijumsEditor.tsx", import.meta.url), "utf8");
    expect(editor).toMatch(/const EMPTY_ROOM_HITS:\s*IrissOrderRoomHit\[\]\s*=\s*\[\]/);
    expect(editor).toMatch(/roomHits\s*=\s*EMPTY_ROOM_HITS/);
    expect(editor).toMatch(/dismissedHitIds\s*=\s*EMPTY_IDS/);
    expect(editor).toMatch(/initialOfferLinks\s*=\s*EMPTY_OFFER_LINKS/);
    expect(editor).toMatch(/initialHitStatus\s*=\s*EMPTY_HIT_STATUS/);
    expect(editor).toMatch(/duplicatesByListing\s*=\s*EMPTY_DUPLICATES/);
    expect(editor).not.toMatch(/roomHits\s*=\s*\[\]/);
    expect(editor).not.toMatch(/dismissedHitIds\s*=\s*\[\]/);
    expect(editor).not.toMatch(/initialOfferLinks\s*=\s*\[\]/);
    expect(editor).not.toMatch(/initialHitStatus\s*=\s*\{\}/);
    expect(editor).not.toMatch(/duplicatesByListing\s*=\s*\{\}/);

    const scanEditor = readFileSync(new URL("../components/admin/IrissScanEditor.tsx", import.meta.url), "utf8");
    expect(scanEditor).toMatch(/const EMPTY_FINDS:\s*IrissScanFindCard\[\]\s*=\s*\[\]/);
    expect(scanEditor).toMatch(/finds\s*=\s*EMPTY_FINDS/);
    expect(scanEditor).not.toMatch(/finds\s*=\s*\[\]/);
    expect(scanEditor).toMatch(/busy \|\| persistId/);
    expect(scanEditor).toMatch(/persistId && formatIrissScanLastRead/);

    const scanList = readFileSync(new URL("../components/admin/IrissScanListClient.tsx", import.meta.url), "utf8");
    expect(scanList).toMatch(/newHitsByScan\s*=\s*EMPTY_HITS_BY_SCAN/);
    expect(scanList).toMatch(/finds\s*=\s*EMPTY_FINDS/);
    expect(scanList).not.toMatch(/newHitsByScan\s*=\s*\{\}/);
    expect(scanList).not.toMatch(/finds\s*=\s*\[\]/);
  });
});
