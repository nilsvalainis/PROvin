import { describe, expect, it } from "vitest";
import {
  extractListingClaimedKm,
  extractListingSellerClaims,
  formatListingSellerClaimLines,
  LISTING_SELLER_CLAIMS_TITLE,
} from "@/lib/listing-seller-claims";

/** Anonimizēts sludinājuma teksts (bez VIN, numuriem, tālruņiem). */
const PASTE = `BMW 320d Touring

Pārdodu BMW. Viens īpašnieks Latvijā, pilna dīlera servisa vēsture.
Auto nav sists, bez avārijām.

Nobraukums, km: 77 400
Krāsa: Pelēka metālika
Aprīkojums: Kondicionieris, Klimata kontrole, Navigācija`;

describe("extractListingSellerClaims", () => {
  it("izvelk km, negadījumu, servisa, īpašnieku, krāsas un aprīkojuma apgalvojumus", () => {
    const c = extractListingSellerClaims(PASTE);
    expect(c.km).toBe(77_400);
    expect(c.noAccidents).toMatch(/nav sists/);
    expect(c.service).toMatch(/servisa vēsture/);
    expect(c.owners).toMatch(/Viens īpašnieks/);
    expect(c.color).toBe("Pelēka metālika");
    expect(c.equipment).toContain("Klimata kontrole");
  });

  it("«sists» bez nolieguma nav apgalvojums «nav sists»", () => {
    expect(extractListingSellerClaims("Auto ir bijis sists priekšā, salabots.").noAccidents).toBeNull();
  });

  it("krievu un lietuviešu formulējumi", () => {
    expect(extractListingSellerClaims("Машина не битая, один владелец").noAccidents).toMatch(/не\s*бит/i);
    expect(extractListingSellerClaims("Automobilis nedaužtas").noAccidents).toMatch(/nedaužt/i);
  });

  it("km no teksta un tūkstošos", () => {
    expect(extractListingClaimedKm("Nobraukums 150 000 km")).toBe(150_000);
    expect(extractListingClaimedKm("Nobraukums, tūkst. km: 167")).toBe(167_000);
    expect(extractListingClaimedKm("Cena 12 500 €")).toBeNull();
  });

  it("faktu lapas rindas; tukšs teksts - nekā", () => {
    const lines = formatListingSellerClaimLines(extractListingSellerClaims(PASTE));
    expect(lines[0]).toBe("- Nobraukums pēc pārdevēja: 77 400 km");
    expect(lines.join("\n")).toContain("„");
    expect(formatListingSellerClaimLines(extractListingSellerClaims(""))).toEqual([]);
    expect(LISTING_SELLER_CLAIMS_TITLE).toMatch(/NAV pārbaudīti/);
  });
});
