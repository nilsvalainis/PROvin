import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {}, refresh: () => {}, push: () => {} }),
  usePathname: () => "/admin/iriss/autoparks-v2/ap-1",
  useSearchParams: () => new URLSearchParams(),
}));

import { AutoparksV2Cabinet } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Cabinet";
import { AutoparksV2TitlePhotoModal, titlePhotoSrc } from "@/components/admin/iriss-autoparks-v2/AutoparksV2TitlePhoto";
import { CarImg } from "@/components/admin/iriss-autoparks-v2/ui";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { renderHtml, renderText } from "@/lib/test-render";

const basics: AutoparksV2Basics = {
  id: "ap-1",
  title: "Volkswagen Golf",
  make: "Volkswagen",
  model: "Golf",
  year: "2020",
  color: "Melns",
  vin: "WVWZZZ1KZAW000001",
  plate: "AB-1234",
  status: "for_sale",
  statusLabel: "Pārdošanā",
  owner: "IRISS",
  ownerLabel: "SIA ĪRISS",
  clientOrder: false,
  location: "",
  arrivedAt: "",
  archived: false,
  mileageKm: { value: null, csdd: false },
  firstRegDate: { value: "", csdd: false },
  displacementCm3: { value: null, csdd: false },
  powerKw: { value: null, csdd: false },
  tyreSize: { value: "", csdd: false },
  gearbox: { value: "", csdd: false },
  engine: { value: "", csdd: false },
  registry: { status: "none", actNo: "", actDate: "", known: false },
  hasPhoto: true,
};

const perms = {
  admin: false,
  pamatdati: true,
  iegade: false,
  serviss: false,
  izdevumi: false,
  cenuLapa: false,
  summas: false,
  pasizmaksa: false,
  vesture: false,
};

describe("Autoparks v2 titulbilde (LAW 30.10)", () => {
  it("popup rāda galveno bildi un aizvēršanas ×", () => {
    const html = renderHtml(<AutoparksV2TitlePhotoModal src="/foto" onClose={() => undefined} />);
    const text = renderText(<AutoparksV2TitlePhotoModal src="/foto" onClose={() => undefined} />);
    expect(text).toContain("Galvenā bilde");
    expect(html).toContain('aria-label="Aizvērt"');
    expect(html).toContain("×");
    expect(html).toContain('src="/foto"');
    expect(html).toContain('role="dialog"');
  });

  it("kabineta sīktēls ar onOpenPhoto ir poga Atvērt galveno bildi", () => {
    const html = renderHtml(<CarImg carId="ap-1" onOpenPhoto={() => undefined} />);
    expect(html).toContain('aria-label="Atvērt galveno bildi"');
    expect(html).toContain("ap2-img-open");
  });

  it("saraksta sīktēls bez onOpenPhoto nav popup poga", () => {
    const html = renderHtml(<CarImg carId="ap-1" />);
    expect(html).not.toContain("Atvērt galveno bildi");
    expect(html).not.toContain("ap2-img-open");
  });

  it("kameras poga paliek atsevišķa no popup", () => {
    const html = renderHtml(<CarImg carId="ap-1" onOpenPhoto={() => undefined} onEditPhoto={() => undefined} />);
    expect(html).toContain('aria-label="Atvērt galveno bildi"');
    expect(html).toContain('aria-label="Mainīt galveno bildi"');
  });

  it("src iet caur esošo galvenās bildes API", () => {
    expect(titlePhotoSrc("ap-1")).toBe("/api/admin/iriss-autoparks-v2/pamatdati/ap-1/foto");
    expect(titlePhotoSrc("ap-1", 3)).toBe("/api/admin/iriss-autoparks-v2/pamatdati/ap-1/foto?v=3");
  });

  it("kabineta galvene pieslēdz Atvērt galveno bildi (popup vēl nav atvērts)", () => {
    const html = renderHtml(<AutoparksV2Cabinet initialBasics={basics} perms={perms} />);
    expect(html).toContain('aria-label="Atvērt galveno bildi"');
    expect(html).not.toContain('aria-label="Galvenā bilde"');
  });
});
