import { describe, expect, it } from "vitest";
import { AutoparksV2Csdd } from "@/components/admin/iriss-autoparks-v2/AutoparksV2Csdd";
import type { AutoparksV2Basics } from "@/lib/iriss-autoparks-v2";
import { renderHtml, renderText } from "@/lib/test-render";

const basics: AutoparksV2Basics = {
  id: "ap-1",
  title: "Volkswagen Passat Variant",
  make: "Volkswagen",
  model: "Passat Variant",
  year: "2019",
  color: "Pelēka",
  vin: "WVWZZZ3CZKE012345",
  plate: "KE-1234",
  status: "in_service",
  statusLabel: "Servisā",
  owner: "IRISS",
  ownerLabel: "SIA ĪRISS",
  location: "",
  arrivedAt: "",
  archived: false,
  mileageKm: { value: 148230, csdd: true },
  firstRegDate: { value: "2019-03-14", csdd: true },
  displacementCm3: { value: 1968, csdd: true },
  powerKw: { value: 110, csdd: true },
  tyreSize: { value: "", csdd: false },
  gearbox: { value: "", csdd: false },
  engine: { value: "", csdd: false },
  registry: { status: "accepted", actNo: "A-100", actDate: "2026-10-22", known: true },
  hasPhoto: false,
};

describe("Autoparks v2 CSDD reģistrs (m03)", () => {
  it("rāda reģistra laukus kā lasāmu karti, bez Pamatdatu virsraksta", () => {
    const text = renderText(<AutoparksV2Csdd basics={basics} />);
    expect(text).toContain("Reģ. numurs");
    expect(text).toContain("KE-1234");
    expect(text).toContain("Nobraukums");
    expect(text).toContain("148 230 km");
    expect(text).toContain("Statuss");
    expect(text).toContain("Pieņemts");
    expect(text).toContain("Īpašnieks");
    expect(text).toContain("SIA ĪRISS");
    expect(text).toContain("Akts");
    expect(text).toContain("A-100 · 22.10.2026");
    expect(text).not.toContain("Akta datums");
    expect(text).not.toContain("Pamatdati");
    expect(text).not.toContain("Peļņa");
  });

  it("Īpašniekam zaļais punkts, kad CSDD reģistrs atbilst", () => {
    const ownerChunk = (html: string) => html.split("ap2-f").find((c) => c.includes("Īpašnieks")) ?? "";
    expect(ownerChunk(renderHtml(<AutoparksV2Csdd basics={basics} />))).toContain("ap2-cd on");
    const empty = renderHtml(<AutoparksV2Csdd basics={{ ...basics, registry: { status: "none", actNo: "", actDate: "", known: false } }} />);
    expect(ownerChunk(empty)).toContain("ap2-cd");
    expect(ownerChunk(empty)).not.toContain("ap2-cd on");
  });
});
