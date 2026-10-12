import { describe, expect, it } from "vitest";
import {
  applyListingDismissPatch,
  applyListingDismissPatches,
  dismissedHiddenIds,
  listingIsDismissed,
  normalizeDismissedView,
  parseDismissPatches,
  uniqueListingIds,
} from "@/lib/iriss-listings-dismiss";

const CAR = { id: "abc123def4567890ab", platform: "auto1" as const, externalId: "42" };
const AT = "2026-10-12T12:00:00.000Z";

describe("IRISS LIST dismiss persist", () => {
  it("hides by stable id and platform+externalId, and survives a latest.json rewrite without dismissed", () => {
    const entries = applyListingDismissPatch([], { hidden: true, id: CAR.id, platform: CAR.platform, externalId: CAR.externalId }, AT);

    expect(listingIsDismissed(CAR, entries)).toBe(true);
    expect(dismissedHiddenIds(entries, [CAR])).toEqual([CAR.id]);

    // Sync/relejs pārraksta latest.json (vehicles/sources), dismissed.json paliek.
    const latestAfterSync = { version: 2, vehicles: [CAR], sources: [] };
    expect("dismissed" in latestAfterSync).toBe(false);
    expect(listingIsDismissed(CAR, entries)).toBe(true);

    // Id hash mainījies, bet Auto1 car.id / platform paliek: joprojām paslēpts.
    const renamed = { ...CAR, id: "ffffffffffffffffff" };
    expect(listingIsDismissed(renamed, entries)).toBe(true);
    expect(dismissedHiddenIds(entries, [renamed])).toEqual(expect.arrayContaining([CAR.id, renamed.id]));
  });

  it("unhide removes the entry so the listing can reappear", () => {
    const hidden = applyListingDismissPatch([], { hidden: true, id: CAR.id, platform: "auto1", externalId: "42" }, AT);
    const shown = applyListingDismissPatch(hidden, { hidden: false, id: CAR.id }, "2026-10-12T13:00:00.000Z");
    expect(shown).toEqual([]);
    expect(listingIsDismissed(CAR, shown)).toBe(false);
  });

  it("hide is idempotent and fills missing platform/externalId on a second click", () => {
    const once = applyListingDismissPatch([], { hidden: true, id: CAR.id }, AT);
    const twice = applyListingDismissPatch(once, { hidden: true, id: CAR.id, platform: "auto1", externalId: "42" }, "2026-10-12T13:00:00.000Z");
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ id: CAR.id, platform: "auto1", externalId: "42" });
  });

  it("parses PATCH body as one item or items[] and ignores junk", () => {
    expect(parseDismissPatches({ id: CAR.id, platform: "auto1", externalId: "42", hidden: true })).toEqual([
      { hidden: true, id: CAR.id, platform: "auto1", externalId: "42" },
    ]);
    expect(
      parseDismissPatches({
        items: [
          { id: "a", hidden: true },
          { hidden: false },
          { id: "b", hidden: false, platform: "nope" },
        ],
      }),
    ).toEqual([
      { hidden: true, id: "a" },
      { hidden: false, id: "b", platform: "nope" },
    ]);
    expect(parseDismissPatches(null)).toEqual([]);
  });

  it("normalizes dismissed.json and drops entries without id or platform+externalId", () => {
    const view = normalizeDismissedView({
      version: 1,
      updatedAt: AT,
      entries: [
        { id: CAR.id, platform: "auto1", externalId: "42", at: AT },
        { platform: "auto1" },
        { foo: 1 },
        null,
      ],
    });
    expect(view.entries).toEqual([{ id: CAR.id, platform: "auto1", externalId: "42", at: AT }]);
  });

  it("applies a localStorage migration batch without dropping prior dismissals", () => {
    const existing = applyListingDismissPatch([], { hidden: true, id: "old", platform: "autobid", externalId: "1" }, AT);
    const merged = applyListingDismissPatches(
      existing,
      [
        { hidden: true, id: CAR.id, platform: "auto1", externalId: "42" },
        { hidden: true, id: "old" },
      ],
      "2026-10-12T14:00:00.000Z",
    );
    expect(merged).toHaveLength(2);
    expect(listingIsDismissed({ id: "old", platform: "autobid", externalId: "1" }, merged)).toBe(true);
    expect(listingIsDismissed(CAR, merged)).toBe(true);
  });

  it("uniqueListingIds keeps order and drops blanks", () => {
    expect(uniqueListingIds(["a", "a", "", "b"])).toEqual(["a", "b"]);
  });
});
