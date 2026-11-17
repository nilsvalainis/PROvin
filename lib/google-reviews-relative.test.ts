import { describe, expect, it } from "vitest";
import {
  GOOGLE_REVIEWS_SNAPSHOT_AT,
  formatGoogleReviewRelativeDate,
  googleReviewRelativeNow,
} from "@/lib/google-reviews-relative";

const snapshot = new Date(GOOGLE_REVIEWS_SNAPSHOT_AT);
const after = (days: number) => new Date(snapshot.getTime() + days * 86_400_000);

describe("googleReviewRelativeNow", () => {
  it("momentuzņēmuma brīdī atgriež to pašu vērtību", () => {
    expect(googleReviewRelativeNow({ value: 2, unit: "day" }, snapshot)).toEqual({ value: 2, unit: "day" });
    expect(googleReviewRelativeNow({ value: 4, unit: "week" }, snapshot)).toEqual({ value: 4, unit: "week" });
  });

  it("laiks iet uz priekšu: 19 stundas pēc 6 dienām kļūst par 6 dienām", () => {
    expect(googleReviewRelativeNow({ value: 19, unit: "hour" }, after(6))).toEqual({ value: 6, unit: "day" });
  });

  it("nedēļas pāriet mēnešos", () => {
    expect(googleReviewRelativeNow({ value: 4, unit: "week" }, after(30))).toEqual({ value: 1, unit: "month" });
  });

  it("formatē latviski", () => {
    expect(formatGoogleReviewRelativeDate("lv", { value: 2, unit: "day" }, after(7))).toBe("pirms 1 nedēļas");
  });
});
