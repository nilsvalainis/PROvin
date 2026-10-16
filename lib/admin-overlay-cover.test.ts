import { afterEach, describe, expect, it } from "vitest";
import {
  acquireAdminOverlayCover,
  adminOverlayCoverDepth,
  resetAdminOverlayCoverForTests,
} from "@/lib/admin-overlay-cover";

afterEach(() => {
  resetAdminOverlayCoverForTests();
});

describe("acquireAdminOverlayCover", () => {
  it("tur doku nosegtu, kamēr pēdējā atvilktne aizveras", () => {
    const releasePhrases = acquireAdminOverlayCover();
    const releaseCopilot = acquireAdminOverlayCover();
    expect(adminOverlayCoverDepth()).toBe(2);
    releasePhrases();
    expect(adminOverlayCoverDepth()).toBe(1);
    releaseCopilot();
    releaseCopilot();
    expect(adminOverlayCoverDepth()).toBe(0);
  });
});
