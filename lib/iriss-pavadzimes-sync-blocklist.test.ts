import { describe, expect, it } from "vitest";
import {
  IRISS_PAVADZIME_SYNC_BLOCKED_NUMBER,
  isIrissPavadzimeSyncBlocked,
} from "@/lib/iriss-pavadzimes-sync-blocklist";

describe("iriss-pavadzimes-sync-blocklist", () => {
  it("bloķē P02515 un B861-6, bet ne citas pavadzīmes", () => {
    expect(
      isIrissPavadzimeSyncBlocked({
        number: IRISS_PAVADZIME_SYNC_BLOCKED_NUMBER,
        plate: "B861-6",
        fileName: "P02515_VW_TIGUAN_B861-6.pdf",
        id: "p02515",
      }),
    ).toBe(true);
    expect(isIrissPavadzimeSyncBlocked({ number: "P02787", plate: "B193-7" })).toBe(false);
  });
});
