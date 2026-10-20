import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isAllowedListingPhotoUrl } from "@/lib/iriss-listings-photos-zip";

describe("isAllowedListingPhotoUrl", () => {
  it("allows auction CDNs and rejects other hosts, http, credentials and IPs", () => {
    expect(isAllowedListingPhotoUrl("https://cdn.autobid.de/data/cars/x.jpg")).toBe(true);
    expect(isAllowedListingPhotoUrl("https://images.openlane.eu/a.jpg")).toBe(true);
    expect(isAllowedListingPhotoUrl("https://img-pa.auto1.com/x.jpg")).toBe(true);
    expect(isAllowedListingPhotoUrl("https://cdn.auto1.eu/x.jpg")).toBe(true);
    expect(isAllowedListingPhotoUrl("https://images.ecarstrade.com/x.jpg")).toBe(true);
    expect(isAllowedListingPhotoUrl("https://evil.example/x.jpg")).toBe(false);
    expect(isAllowedListingPhotoUrl("http://cdn.autobid.de/x.jpg")).toBe(false);
    expect(isAllowedListingPhotoUrl("https://user:pass@cdn.autobid.de/x.jpg")).toBe(false);
    expect(isAllowedListingPhotoUrl("https://127.0.0.1/x.jpg")).toBe(false);
  });
});
