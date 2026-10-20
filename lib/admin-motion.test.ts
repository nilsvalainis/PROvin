import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADMIN_MOTION_D_MICRO_MS,
  ADMIN_MOTION_D_SHEET_MS,
  ADMIN_MOTION_MOVING_CLASS,
  applyMorphPill,
  isModifiedClick,
  sheetDragTranslateY,
  measureInteractionCost,
  morphPillParts,
  prefersReducedMotion,
  shouldUseAdminViewTransition,
  startAdminViewTransition,
  viewTransitionDir,
} from "@/lib/admin-motion";
import { ADMIN_MOBILE_PTR_THRESHOLD_PX } from "@/lib/admin-mobile-shell";

const motionCss = readFileSync(new URL("../app/admin/admin-motion.css", import.meta.url), "utf8");
const iosCss = readFileSync(new URL("../app/admin/admin-ios-theme.css", import.meta.url), "utf8");
const pullSrc = readFileSync(new URL("../components/admin/AdminShellMainWithMobilePull.tsx", import.meta.url), "utf8");
const adminLayout = readFileSync(new URL("../app/admin/layout.tsx", import.meta.url), "utf8");

function fakePill() {
  const mk = () => ({ style: {} as Record<string, string> });
  const kids = [mk(), mk(), mk()];
  const classes = new Set<string>();
  return {
    children: { item: (i: number) => kids[i] as unknown as HTMLElement },
    classList: {
      add: (c: string) => {
        classes.add(c);
      },
      remove: (c: string) => {
        classes.delete(c);
      },
      has: (c: string) => classes.has(c),
    },
    kids,
    classes,
  };
}

describe("admin motion tokens", () => {
  it("keeps spec durations and compositor-only transitions", () => {
    expect(ADMIN_MOTION_D_MICRO_MS).toBe(120);
    expect(ADMIN_MOTION_D_SHEET_MS).toBe(340);
    expect(motionCss).toContain("--d-micro: 120ms");
    expect(motionCss).toContain("--d-sheet: 340ms");
    expect(motionCss).toContain("--spring-bounce:");
    expect(adminLayout).toContain("./admin-motion.css");
    expect(motionCss).toMatch(/prefers-reduced-motion:\s*reduce/);
    expect(motionCss).toContain(`.${ADMIN_MOTION_MOVING_CLASS}`);
    expect(motionCss).toMatch(/\.admin-mp\.admin-moving > i[\s\S]*?will-change:\s*transform/);
    expect(motionCss).toMatch(/\.admin-sheet-panel\.admin-moving[\s\S]*?will-change:\s*transform/);
    expect(motionCss).toMatch(/\.admin-sheet-opaque/);
    expect(motionCss).toMatch(/background:\s*var\(--s1, #fff\)/);
    expect(motionCss).not.toMatch(/transition:[^;{]*backdrop-filter/);
    expect(motionCss).not.toMatch(/animation:[^;{]*backdrop-filter/);
    expect(motionCss.match(/will-change:/g)?.length ?? 0).toBe(2);
  });
});

describe("PR #313 mobile perf stays intact", () => {
  it("does not relock html/body scroll or change PTR slieksni", () => {
    expect(ADMIN_MOBILE_PTR_THRESHOLD_PX).toBe(64);
    const mobileHtmlBody = iosCss.split("@media (max-width: 767px)")[1]?.split(".admin-ios-theme main")[0] ?? "";
    expect(mobileHtmlBody).toMatch(/overflow-y:\s*auto/);
    expect(mobileHtmlBody).toMatch(/touch-action:\s*pan-y pinch-zoom/);
    expect(mobileHtmlBody).not.toMatch(/overflow:\s*hidden/);
    expect(mobileHtmlBody).not.toMatch(/touch-action:\s*(?:none|manipulation)/);
    expect(mobileHtmlBody).not.toMatch(/height:\s*100dvh/);
    expect(pullSrc).toContain("ADMIN_MOBILE_PTR_THRESHOLD_PX");
    expect(pullSrc).toContain("{ passive: true }");
    expect(pullSrc).toContain("ADMIN_MAIN_SCROLL_ID");
    expect(pullSrc).not.toContain("backdrop-filter");
    expect(pullSrc).not.toContain("startViewTransition");
  });
});

describe("morphPillParts", () => {
  it("writes only translateX / scaleX and instant cap width", () => {
    const p = morphPillParts(20, 88, 44);
    expect(p.capWidth).toBe(22);
    expect(p.left).toBe("translateX(20px)");
    expect(p.right).toBe("translateX(86px)");
    expect(p.mid).toMatch(/^translateX\(41px\) scaleX\(/);
    const fake = fakePill();
    applyMorphPill(fake as unknown as HTMLElement, 20, 88, 44);
    expect(fake.kids[0].style.transform).toBe(p.left);
    expect(fake.kids[0].style.width).toBe("22px");
    expect(fake.kids[1].style.transform).toBe(p.mid);
    expect(fake.classes.has(ADMIN_MOTION_MOVING_CLASS)).toBe(true);
  });
});

describe("view transitions", () => {
  it("classifies push/pop/tab and falls back when API or reduced-motion", () => {
    expect(viewTransitionDir("/admin/dashboard", "/admin/orders/abc")).toBe("push");
    expect(viewTransitionDir("/admin/iriss/pasutijumi/x", "/admin/iriss/pasutijumi")).toBe("pop");
    expect(viewTransitionDir("/admin/dashboard", "/admin/vin-scan")).toBe("tab");
    expect(isModifiedClick({ button: 0, metaKey: true, ctrlKey: false, shiftKey: false, altKey: false })).toBe(true);
    expect(isModifiedClick({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false })).toBe(false);

    const reduced = shouldUseAdminViewTransition(
      { getElementById: () => null, querySelector: () => null } as unknown as Document,
      () => ({ matches: true }),
    );
    expect(reduced).toBe(false);
    expect(prefersReducedMotion(() => ({ matches: true }))).toBe(true);

    const heavy = {
      startViewTransition: () => ({ finished: Promise.resolve() }),
      getElementById: (id: string) => (id === "admin-order-block-auto-records" ? {} : null),
      querySelector: () => null,
    } as unknown as Document;
    expect(shouldUseAdminViewTransition(heavy, () => ({ matches: false }))).toBe(false);

    let ran = 0;
    startAdminViewTransition(() => {
      ran += 1;
    }, "tab", { getElementById: () => null, querySelector: () => null } as unknown as Document, () => ({ matches: false }));
    expect(ran).toBe(1);
  });
});

describe("sheetDragTranslateY", () => {
  it("tur 1:1 uz leju un 0.3 pretestību virs 0", () => {
    expect(sheetDragTranslateY(40)).toBe(40);
    expect(sheetDragTranslateY(-20)).toBe(-6);
    expect(sheetDragTranslateY(0)).toBe(0);
  });
});

describe("interaction cost", () => {
  it("keeps pill math cheaper than 50ms for 4000 writes (INP budget)", () => {
    const baseline = measureInteractionCost(() => {
      let n = 0;
      for (let i = 0; i < 4000; i++) n += (i % 200) + 80;
      void n;
    });
    const after = measureInteractionCost(() => {
      for (let i = 0; i < 4000; i++) morphPillParts(i % 200, 80, 44);
    });
    expect(after).toBeLessThan(50);
    expect(after).toBeLessThan(baseline + 40);
  });
});
