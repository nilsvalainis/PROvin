import { describe, expect, it } from "vitest";
import {
  compactEngineCode,
  engineFamilyLearningKeys,
  engineLearningKey,
} from "@/lib/admin-audit-learning-keys";

describe("admin-audit-learning-keys", () => {
  it("compacts dotted Mercedes codes", () => {
    expect(compactEngineCode("OM651.913")).toBe("OM651913");
    expect(engineLearningKey("OM651.913")).toBe("ENGINE|OM651913");
  });

  it("adds OM family key so .913 and .911 share memory", () => {
    expect(engineFamilyLearningKeys("OM651.913")).toEqual([
      "ENGINE|OM651913",
      "ENGINE|OM651",
    ]);
    expect(engineFamilyLearningKeys("OM651")).toEqual(["ENGINE|OM651"]);
  });

  it("adds BMW M/N family without mixing Volvo D5244 turbo classes", () => {
    expect(engineFamilyLearningKeys("N47D20")).toEqual(["ENGINE|N47D20", "ENGINE|N47"]);
    expect(engineFamilyLearningKeys("M57/T2")).toEqual(["ENGINE|M57T2", "ENGINE|M57"]);
    expect(engineFamilyLearningKeys("D5244T11")).toEqual(["ENGINE|D5244T11"]);
  });
});
