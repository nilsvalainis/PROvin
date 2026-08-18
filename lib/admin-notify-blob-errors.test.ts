import { describe, expect, it } from "vitest";

import {
  NOTIFY_BLOB_DISABLED_LV,
  NOTIFY_BLOB_SESSION_EXPIRED_LV,
  NOTIFY_BLOB_TOKEN_FALLBACK_LV,
  describeNotifyBlobTokenHttpError,
} from "@/lib/admin-notify-blob-errors";

describe("describeNotifyBlobTokenHttpError", () => {
  it("maps 401 to a session-expired hint", () => {
    expect(describeNotifyBlobTokenHttpError(401, {})).toBe(NOTIFY_BLOB_SESSION_EXPIRED_LV);
  });

  it("prefers the server message for a missing or invalid Blob token", () => {
    expect(
      describeNotifyBlobTokenHttpError(503, {
        error: "blob_disabled",
        message: "BLOB_READ_WRITE_TOKEN nav iestatīts.",
      }),
    ).toBe("BLOB_READ_WRITE_TOKEN nav iestatīts.");
    expect(describeNotifyBlobTokenHttpError(503, { error: "blob_token_invalid" })).toBe(
      NOTIFY_BLOB_DISABLED_LV,
    );
  });

  it("falls back when the SDK used to swallow a non-JSON body", () => {
    expect(describeNotifyBlobTokenHttpError(400, {})).toBe(NOTIFY_BLOB_TOKEN_FALLBACK_LV);
  });
});
