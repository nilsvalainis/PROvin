import { describe, expect, it } from "vitest";
import { v2HistoryText } from "@/lib/iriss-autoparks-v2-history-text";

const row = { id: "h", carId: "c", at: "", actorId: "u", actorName: "Nils", field: "plate", from: "", to: "AB1234" };

describe("vēstures teksts", () => {
  it("lauks latviski, tukšs = '-', atsaukts atzīmēts", () => {
    expect(v2HistoryText(row)).toEqual({ field: "Numurzīme", change: "- -> AB1234" });
    expect(v2HistoryText({ ...row, field: "status", from: "a", to: "b", undoOf: "x" }, (v) => v.toUpperCase())).toEqual({ field: "Statuss (atsaukts)", change: "A -> B" });
  });
});
