import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isAdminApiSessionExemptPath } from "@/lib/admin-api-gate";

const API_DIR = path.resolve(__dirname, "../app/api");

function listRoutes(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listRoutes(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

function routePathname(file: string): string {
  const rel = path.relative(path.join(API_DIR, "admin"), file).replace(/\\/g, "/");
  return `/api/admin/${rel.replace(/\/route\.ts$/, "")}`.replace(/\/\[.+?\]/g, "/x");
}

const HANDLER_GUARD =
  /getAdminSession\(|getAdminOrStaffActor\(|requireLogisticsApi\(|requireIrissLogisticsApi\(|requireIrissSectionApi\(|requireAdminOnlyApi\(|requireB2bDemoPlatformAdmin\(|requireAdminPage\(|requireAutoparksV2Api\(/;

describe("admin API handlers check a session", () => {
  const files = listRoutes(path.join(API_DIR, "admin"));

  it("finds the admin API routes", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it.each(files.map((f) => [path.relative(API_DIR, f), f]))("%s", (_rel, file) => {
    const src = fs.readFileSync(file, "utf8");
    const pathname = routePathname(file);
    if (isAdminApiSessionExemptPath(pathname) || isAdminApiSessionExemptPath(pathname.replace(/\/x$/, ""))) {
      return;
    }
    if (pathname.includes("/login") || pathname.includes("/logout") || pathname.includes("/accept-invite")) {
      return;
    }
    expect(src).toMatch(HANDLER_GUARD);
  });
});

describe("non-admin APIs that touch admin data still check admin session", () => {
  it("gates /api/ai/analyze", () => {
    const src = fs.readFileSync(path.join(API_DIR, "ai/analyze/route.ts"), "utf8");
    expect(src).toMatch(/getAdminSession\(/);
  });
});
