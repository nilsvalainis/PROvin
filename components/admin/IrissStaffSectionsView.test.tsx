import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Barlow_Condensed: () => ({ className: "font", style: {} }) }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/iriss",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined, prefetch: () => undefined }),
}));

import { IrissMobileMenuHome } from "@/components/admin/IrissMobileMenuHome";
import { IrissStaffAppShell } from "@/components/admin/IrissStaffAppShell";
import { IRISS_SECTIONS, type IrissSection } from "@/lib/staff-roles";
import { renderHtml, renderText } from "@/lib/test-render";

const home = (sections: IrissSection[], isAdmin = false) => renderText(<IrissMobileMenuHome sections={sections} isAdmin={isAdmin} />);
const shell = (sections: IrissSection[]) =>
  renderText(
    <IrissStaffAppShell name="Testa Kolēģis" sections={sections}>
      <p>SATURS</p>
    </IrissStaffAppShell>,
  );

const OTHER_APPS = ["Pasūtījumi", "Sludinājumi", "Radars", "Loģistika", "VIN pārbaude", "Autoparks", "Kravas", "Kravas un karte", "Iestatījumi"];

describe("IRISS sākums pēc piešķirtajām sadaļām", () => {
  it("partneris (tikai Pavadzīmes): pavadzīmju logrīks, poga 'Izveidot pavadzīmi', Arhīvs un Iziet - nekā cita", () => {
    const html = renderHtml(<IrissMobileMenuHome sections={["pavadzimes"]} isAdmin={false} />);
    const text = home(["pavadzimes"]);
    expect(html).toContain('aria-label="Pavadzīmes"');
    expect(html).not.toContain("Visas ›");
    expect(text).toContain("Izveidot pavadzīmi");
    expect(text.indexOf("Arhīvs")).toBeGreaterThan(text.indexOf("Izveidot pavadzīmi"));
    expect(text.indexOf("Iziet")).toBeGreaterThan(text.indexOf("Arhīvs"));
    for (const app of OTHER_APPS) expect(text).not.toContain(app);
    expect(text).not.toContain("PRO");
    expect(text).not.toContain("VPN");
    expect(text).not.toContain("Visas ›");
    expect(text).not.toContain("Nospied un tur");
  });

  it("partnerim nav navigācijas (ne Sākums, ne sadaļu saites), tikai lapas saturs", () => {
    const text = shell(["pavadzimes"]);
    expect(text).toBe("SATURS");
  });

  it("ja atzīmē vairāk sadaļu, atgriežas parastā navigācija tikai ar tām sadaļām", () => {
    const text = shell(["pavadzimes", "logistika"]);
    expect(text).toContain("Sākums");
    expect(text).toContain("Pavadzīmes");
    expect(text).toContain("Loģistika");
    expect(text).not.toContain("Pasūtījumi");
    expect(text).not.toContain("Sludinājumi");
  });

  it("tikai Loģistika: nav pavadzīmju logrīka, nav citu sadaļu flīžu un nav PRO pārslēga", () => {
    const text = home(["logistika"]);
    expect(text).not.toContain("Izveidot pavadzīmi");
    expect(text).not.toContain("Pavadzīm");
    for (const app of ["Pasūtījumi", "Sludinājumi", "Radars", "VIN pārbaude", "Iestatījumi"]) expect(text).not.toContain(app);
    expect(text).not.toContain("PRO");
  });

  it("visa IRISS bez PRO: visas IRISS flīzes, bez Iestatījumiem un bez PRO pārslēga", () => {
    const text = home([...IRISS_SECTIONS]);
    for (const app of ["Pasūtījumi", "Sludinājumi", "Radars", "Loģistika", "Kravas", "Pavadzīmes", "VIN pārbaude"]) expect(text).toContain(app);
    expect(text).not.toContain("Iestatījumi");
    expect(text).not.toContain("PRO");
    expect(text).not.toContain("Izveidot pavadzīmi");
  });

  it("administratora sākums nemainās: flīzes paliek, nav partnera pogas", () => {
    const text = home([...IRISS_SECTIONS], true);
    expect(text).toContain("Pasūtījumi");
    expect(text).toContain("Loģistika");
    expect(text).not.toContain("Izveidot pavadzīmi");
    expect(text).not.toContain("Iziet");
  });
});
