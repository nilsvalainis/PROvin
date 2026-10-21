import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { adminChromeDataset } from "@/lib/admin-chrome-attrs";
import { IRISS_PWA_THEME_COLOR, IRISS_PWA_THEME_COLOR_DARK, irissPwaThemeColor } from "@/lib/iriss-pwa";
import { adminMobileThemeColor } from "@/lib/admin-mobile-collapse";

const css = readFileSync(new URL("../app/admin/admin-iriss-theme.css", import.meta.url), "utf8");
const ios = readFileSync(new URL("../app/admin/admin-ios-theme.css", import.meta.url), "utf8");
const irissAdmin = readFileSync(new URL("../app/admin/iriss/iriss-admin.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../components/admin/AdminShell.tsx", import.meta.url), "utf8");
const scan = readFileSync(new URL("../components/admin/IrissScanListClient.tsx", import.meta.url), "utf8");
const layout = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");
const irissLayout = readFileSync(new URL("../app/admin/iriss/layout.tsx", import.meta.url), "utf8");
const proLayout = readFileSync(new URL("../app/admin/(dashboard)/layout.tsx", import.meta.url), "utf8");
const proTheme = readFileSync(new URL("../app/admin/admin-pro-order-theme.css", import.meta.url), "utf8");
const indicator = readFileSync(new URL("../components/admin/IrissProjectIndicator.tsx", import.meta.url), "utf8");
const topBar = readFileSync(new URL("../components/admin/mobile/AdminMobileChrome.tsx", import.meta.url), "utf8");
const sidebar = readFileSync(new URL("../components/admin/AdminSidebar.tsx", import.meta.url), "utf8");
const vp = readFileSync(new URL("../components/admin/useAdminMobileViewport.ts", import.meta.url), "utf8");

describe("adminChromeDataset", () => {
  it("sets section and both theme attributes", () => {
    expect(adminChromeDataset("iriss", "dark")).toEqual({
      "data-section": "iriss",
      "data-theme": "dark",
      "data-admin-theme": "dark",
    });
    expect(adminChromeDataset("pro", "light")["data-section"]).toBe("pro");
  });
});

describe("IRISS 00-tema tokens", () => {
  it("scopes light tokens to data-section=iriss", () => {
    expect(css).toMatch(/\.admin-m\[data-section="iriss"\]/);
    expect(css).toMatch(/--bg-base:\s*#e9ecf1/i);
    expect(css).toMatch(/--g1:\s*rgba\(150,\s*170,\s*220,\s*0\.36\)/);
    expect(css).toMatch(/--g2:\s*rgba\(200,\s*180,\s*230,\s*0\.26\)/);
    expect(css).toMatch(/--g3:\s*rgba\(160,\s*175,\s*200,\s*0\.3/);
    expect(css).toMatch(/--s1:\s*#fff/i);
    expect(css).toMatch(/--s2:\s*#f4f5f8/i);
    expect(css).toMatch(/--ink:\s*#0b0c10/i);
    expect(css).toMatch(/--ink2:\s*#5e636e/i);
    expect(css).toMatch(/--ink3:\s*#9a9faa/i);
    expect(css).toMatch(/--acc:\s*#3d5bd9/i);
    expect(css).toMatch(/--acc-soft:\s*rgba\(61,\s*91,\s*217,\s*0\.12\)/);
    expect(css).toMatch(/--news-bg:\s*var\(--ink\)/);
    expect(css).toMatch(/--news-fg:\s*var\(--onink\)/);
    expect(irissAdmin).toMatch(/\.iriss-pas-hits/);
    expect(irissAdmin).toMatch(/:is\(button, a\)\[class\*="bg-\[#111827\]"\]/);
    expect(css).toMatch(/--warn:\s*#a86400/i);
    expect(css).toMatch(/radial-gradient\(640px 420px at 12% 0%/);
    expect(css).toMatch(/radial-gradient\(720px 520px at 92% 18%/);
    expect(css).toMatch(/radial-gradient\(900px 560px at 50% 105%/);
    expect(css).toMatch(/background-attachment:\s*scroll/);
    expect(css).not.toMatch(/background-attachment:\s*fixed/);
  });

  it("scopes dark tokens to data-theme=dark on IRISS only", () => {
    expect(css).toMatch(/\.admin-m\[data-section="iriss"\]\[data-theme="dark"\]/);
    expect(css).toMatch(/--bg-base:\s*#060607/i);
    expect(css).toMatch(/--s1:\s*#161619/i);
    expect(css).toMatch(/--ink:\s*#f3f3f5/i);
    expect(css).toMatch(/--acc:\s*#8ea6ff/i);
    expect(css).not.toMatch(/\.admin-m\[data-section="pro"\]\s*\{[^}]*--bg-base/);
  });

  it("keeps legacy aliases on the same IRISS node", () => {
    expect(css).toMatch(/--am-bg:\s*var\(--bg-base\)/);
    expect(css).toMatch(/--am-s1:\s*var\(--s1\)/);
    expect(css).toMatch(/--am-ink:\s*var\(--ink\)/);
    expect(css).toMatch(/--am-fill:\s*var\(--fill\)/);
    expect(css).toMatch(/--admin-ios-bg:\s*var\(--bg-base\)/);
    expect(css).toMatch(/--admin-ios-blue:\s*var\(--acc\)/);
    expect(css).toMatch(/--color-provin-accent:\s*var\(--acc\)/);
    expect(css).toMatch(/--chip-active-bg:\s*var\(--ink\)/);
  });

  it("uses --acc for indicator and focus, --ink for primary chip", () => {
    expect(css).toMatch(/\.iriss-proj[\s\S]*color:\s*var\(--acc\)/);
    expect(css).toMatch(/:focus-visible[\s\S]*border-color:\s*var\(--acc\)/);
    expect(css).toMatch(/--chip-active-bg:\s*var\(--ink\)/);
  });

  it("keeps glass blur on bar / tab / sheet, not on ordinary buttons", () => {
    expect(css).toMatch(/button:not\(\.am-glass\)[\s\S]*backdrop-filter:\s*none/);
    expect(css).toMatch(/\.am-glass[\s\S]*backdrop-filter:\s*blur\(26px\)/);
    expect(css).toMatch(/\.am-topbar-sticky\[data-stuck="true"\]/);
    expect(css).toMatch(/\.admin-sheet-panel\.am-glass/);
    expect(ios).toMatch(/:not\(:has\(\.admin-m\[data-section="iriss"\]\)\)[\s\S]*backdrop-filter:\s*blur\(12px\)/);
  });

  it("respects prefers-reduced-motion with transform/opacity-only admin motion", () => {
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
    const motion = readFileSync(new URL("../app/admin/admin-motion.css", import.meta.url), "utf8");
    expect(motion).not.toMatch(/transition:[^;{]*backdrop-filter/);
  });
});

describe("IRISS chrome wiring", () => {
  it("puts data-section from AdminShell workspace onto .admin-m", () => {
    expect(layout).toMatch(/admin-iriss-theme\.css/);
    expect(shell).toMatch(/adminChromeDataset\(workspace,\s*adminTheme\)/);
    expect(shell).toMatch(/useSyncAdminMobileThemeColor\(adminTheme,\s*workspace\)/);
    expect(indicator).toMatch(/iriss-proj/);
    expect(indicator).toMatch(/title="IRISS"/);
    expect(indicator).toMatch(/^\s+IRISS$/m);
    expect(topBar).toMatch(/IrissProjectIndicator/);
    expect(sidebar).toMatch(/IrissProjectIndicator/);
    expect(vp).toMatch(/prefers-color-scheme: dark/);
    expect(vp).not.toMatch(/localStorage/);
  });

  it("moves ScanList desktop hex and 1d4ed8 hacks onto tokens", () => {
    expect(scan).not.toMatch(/#F8F8F9/);
    expect(scan).not.toMatch(/bg-\[var\(--bg-base\)\]/);
    expect(css).toMatch(/padding-inline:\s*14px/);
    expect(irissAdmin).not.toMatch(/class\*="1d4ed8"/);
    expect(irissAdmin).not.toMatch(/#1d4ed8/);
    const room = readFileSync(new URL("../components/admin/IrissOrderRoom.tsx", import.meta.url), "utf8");
    expect(room).not.toMatch(/text-\[#1d4ed8\]/);
  });

  it("sets PWA themeColor to --bg-base light and dark", () => {
    expect(IRISS_PWA_THEME_COLOR).toBe("#E9ECF1");
    expect(IRISS_PWA_THEME_COLOR_DARK).toBe("#060607");
    expect(irissPwaThemeColor("light")).toBe("#E9ECF1");
    expect(irissPwaThemeColor("dark")).toBe("#060607");
    expect(irissLayout).toMatch(/IRISS_PWA_THEME_COLOR_DARK/);
    expect(adminMobileThemeColor("light")).toBe("#F2F2F7");
    expect(adminMobileThemeColor("dark")).toBe("#000000");
  });

  it("does not restyle PRO workspace", () => {
    expect(proLayout).toMatch(/workspace="pro"/);
    expect(proTheme).toMatch(/--pro-bg:\s*#f5f5f7/);
    expect(proTheme).toMatch(/\.provin-pro:not\(\.dark\)/);
    expect(css).not.toMatch(/\.admin-m\[data-section="pro"\]/);
  });
});

describe("IRISS button contrast vs admin-ios-theme", () => {
  it("scopes hardcoded black text to PRO and paints IRISS CTAs with --btn-dark-*", () => {
    expect(ios).toMatch(
      /\.admin-ios-theme:not\(:has\(\.admin-m\[data-section="iriss"\]\)\) a:not/,
    );
    expect(ios).toMatch(
      /\.admin-ios-theme:not\(:has\(\.admin-m\[data-section="iriss"\]\)\) :is\(p, span/,
    );
    expect(ios).not.toMatch(/^\.admin-ios-theme a:not/m);
    expect(ios).not.toMatch(/^\.admin-ios-theme :is\(p, span/m);
    expect(ios).toMatch(/\[class\*="chip-active-bg"\][\s\S]*--btn-dark-bg/);
    expect(ios).toMatch(/\[class\*="chip-active-bg"\][\s\S]*--btn-dark-fg/);
    expect(ios).toMatch(/a\.admin-costs-tab\[data-on="true"\][\s\S]*--btn-dark-fg/);
    expect(css).toMatch(/\.admin-ios-theme \.admin-m\[data-section="iriss"\] \{\s*color:\s*var\(--ink\);/);
    expect(css).not.toMatch(/data-section="iriss"\] :is\(p, span[\s\S]*color:\s*inherit/);
  });
});
