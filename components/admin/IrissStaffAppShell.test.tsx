import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { IrissStaffAppShell } from "@/components/admin/IrissStaffAppShell";
import { renderHtml } from "@/lib/test-render";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/iriss/pavadzimes",
  useRouter: () => ({ replace: () => {}, refresh: () => {} }),
}));

function shell(sections: Parameters<typeof IrissStaffAppShell>[0]["sections"], autoparksV2Visible = true): string {
  return renderHtml(
    <IrissStaffAppShell name="Jānis Bērziņš" sections={sections} autoparksV2Visible={autoparksV2Visible}>
      <p>saturs</p>
    </IrissStaffAppShell>,
  );
}

function tabbar(html: string): string {
  const m = html.match(/<nav[^>]*data-iriss-staff-tabbar[\s\S]*?<\/nav>/);
  if (!m) throw new Error("apakšējā josla nav atrasta");
  return m[0];
}

describe("IRISS darbinieka čaula telefonā (j69, vecāks iOS)", () => {
  it("apakšējā josla ir piesprausta ekrāna apakšā, nevis plūsmā aiz h-dvh konteinera", () => {
    const html = shell(["pavadzimes", "logistika"]);
    const nav = tabbar(html);
    expect(nav).toMatch(/class="[^"]*\bfixed\b[^"]*\bbottom-0\b/);
    expect(nav).toMatch(/class="[^"]*\bmd:hidden\b/);
    // Telefonā čaula nav fiksēta augstuma (h-dvh tikai datorā), lai saturs aug un dokuments ritina.
    const root = html.match(/<div data-iriss-staff-shell=""[^>]*>/)?.[0] ?? "";
    expect(root).toContain("iriss-staff-shell");
    expect(root).not.toMatch(/class="[^"]*(?<![:\w-])h-dvh/);
    expect(root).toContain("md:h-dvh");
    // Saturs nepaliek zem joslas (josla + home indicator).
    expect(html).toMatch(/<main[^>]*pb-\[calc\(64px\+env\(safe-area-inset-bottom\)\)\]/);
  });

  it("cilnes ir 44 px un Loģistika/Autoparks paliek virs home indicator", () => {
    const nav = tabbar(shell(["pavadzimes", "logistika", "ap_serviss"]));
    expect(nav).toMatch(/iriss-staff-tab/);
    expect(nav).toMatch(/min-h-11/);
    expect(nav).toMatch(/min-w-11/);
    expect(nav).toContain('href="/admin/iriss/logistika"');
    expect(nav).toContain('href="/admin/iriss/autoparks-v2"');
    expect(nav).not.toMatch(/rounded-full bg-white/);
  });

  it("josla rāda tikai piešķirtās sadaļas, ne visiem vienādu komplektu", () => {
    const onlyLog = tabbar(shell(["logistika"]));
    expect(onlyLog).toContain(">Loģistika<");
    expect(onlyLog).not.toContain("Pavadzīmes");
    expect(onlyLog).not.toContain("Autoparks");
    expect(onlyLog).not.toContain("Pasūtījumi");
    const pzAp = tabbar(shell(["pavadzimes", "ap_serviss"]));
    expect(pzAp).toContain(">Pavadzīmes<");
    expect(pzAp).toContain(">Autoparks<");
    expect(pzAp).not.toContain("Loģistika");
    expect(pzAp).not.toContain("Pasūtījumi");
  });

  it("Pavadzīmes, Autoparks un Iziet ir vienā joslā; Autoparks ved uz v2 sarakstu", () => {
    const nav = tabbar(shell(["pavadzimes", "ap_serviss", "ap_summas"]));
    expect(nav).toContain(">Pavadzīmes<");
    expect(nav).toContain('href="/admin/iriss/autoparks-v2"');
    expect(nav).toContain(">Autoparks<");
    expect(nav).toContain("Iziet");
    expect(nav.match(/>Autoparks</g)?.length).toBe(1);
  });

  it("bez v2 karoga Autoparks cilnes nav", () => {
    expect(tabbar(shell(["pavadzimes", "ap_serviss"], false))).not.toContain("autoparks-v2");
  });

  it("partnerim (tikai Pavadzīmes) joslas nav vispār", () => {
    expect(shell(["pavadzimes"])).not.toContain("data-iriss-staff-tabbar");
  });
});

describe("IRISS darbinieka čaulas CSS (j69)", () => {
  const css = readFileSync(new URL("../../app/admin/admin-ios-theme.css", import.meta.url), "utf8");
  const rule = (selector: RegExp) => css.match(new RegExp(`${selector.source}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it("augstumam ir 100vh rezerve pirms 100dvh, fons ir gaišs (ne body #121418)", () => {
    const body = rule(/\.admin-ios-theme \.iriss-staff-shell/);
    expect(body.indexOf("min-height: 100vh")).toBeGreaterThanOrEqual(0);
    expect(body.indexOf("min-height: 100vh")).toBeLessThan(body.indexOf("min-height: 100dvh"));
    expect(body).toContain("background-color: var(--admin-ios-bg)");
    expect(rule(/html:has\(\.iriss-staff-shell\),\s*html:has\(\.iriss-staff-shell\) body/)).toMatch(/background-color:\s*var\(--admin-ios-bg, #ffffff\)/);
  });

  it("joslas poga Iziet nemanto vispārējo pogu rāmi un stiklu", () => {
    const body = rule(/\.admin-ios-theme \.iriss-staff-tabbar button,\s*\.admin-ios-theme \.iriss-staff-shell \[data-iriss-nav\] button/);
    expect(body).toMatch(/border:\s*0/);
    expect(body).toMatch(/-webkit-backdrop-filter:\s*none/);
  });

  it("josla stāv virs home indicator un cilnēm ir 44 px mērķis", () => {
    const bar = rule(/\.admin-ios-theme \.iriss-staff-tabbar/);
    expect(bar).toMatch(/position:\s*fixed/);
    expect(bar).toMatch(/bottom:\s*0/);
    expect(bar).toContain("safe-area-inset-bottom");
    expect(bar).toMatch(/z-index:\s*30/);
    const tab = rule(/\.admin-ios-theme \.iriss-staff-tabbar \.iriss-staff-tab,\s*\.admin-ios-theme \.iriss-staff-tabbar a,\s*\.admin-ios-theme \.iriss-staff-tabbar button/);
    expect(tab).toMatch(/min-height:\s*44px/);
    expect(tab).toMatch(/min-width:\s*44px/);
  });
  it("daudz sadaļu: joslā 5 punkti ar «Vairāk», «Iziet» joslā nav", () => {
    const nav = tabbar(shell(["pasutijumi", "sludinajumi", "radars", "logistika", "pavadzimes", "vin"]));
    expect(nav).toContain("Vairāk");
    expect(nav).not.toContain("Iziet");
    expect(nav.match(/iriss-staff-tab\b/g)).toHaveLength(5);
  });
});
