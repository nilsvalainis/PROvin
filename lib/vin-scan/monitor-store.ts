import "server-only";

import { after } from "next/server";

import { createJsonDocStore } from "@/lib/b2b-json-doc-store";
import {
  applyVinScanBrowserUsage,
  emptyVinScanBrowserUsageDoc,
  parseVinScanBrowserUsageDoc,
  type VinScanBrowserUsageDoc,
} from "@/lib/vin-scan/browser-usage";
import { logVinScanBrowserImport, vinScanHtmlLooksLikeChallenge } from "@/lib/vin-scan/browser-import-log";
import { emptyVinScanCanaryDoc, parseVinScanCanaryDoc, type VinScanCanaryDoc } from "@/lib/vin-scan/canary-alert";

/**
 * VIN SCAN uzraudzības dokumenti (Blob ar ifMatch CAS vai lokālais fails):
 * `vin-scan-monitor/canary.json` - ikdienas zelta VIN palaišanas + paziņotie avoti;
 * `vin-scan-monitor/browser-usage.json` - pārlūka importu skaitītāji pa dienām.
 */
const KEYS = new Set(["canary", "browser-usage"]);

const canaryStore = createJsonDocStore<VinScanCanaryDoc>({
  blobPrefix: "vin-scan-monitor/",
  dirName: "vin-scan-monitor",
  isSafeKey: (key) => KEYS.has(key),
  parse: parseVinScanCanaryDoc,
  empty: emptyVinScanCanaryDoc,
});

const usageStore = createJsonDocStore<VinScanBrowserUsageDoc>({
  blobPrefix: "vin-scan-monitor/",
  dirName: "vin-scan-monitor",
  isSafeKey: (key) => KEYS.has(key),
  parse: parseVinScanBrowserUsageDoc,
  empty: emptyVinScanBrowserUsageDoc,
});

export function readVinScanCanaryDoc(): Promise<VinScanCanaryDoc> {
  return canaryStore.read("canary");
}

export function updateVinScanCanaryDoc<R>(
  mutate: (current: VinScanCanaryDoc) => { value: R; next?: VinScanCanaryDoc },
): Promise<R> {
  return canaryStore.update("canary", mutate);
}

export function readVinScanBrowserUsage(): Promise<VinScanBrowserUsageDoc> {
  return usageStore.read("browser-usage");
}

export async function recordVinScanBrowserUsage(event: { id: string; ok: boolean; challenge?: boolean }): Promise<void> {
  try {
    const now = Date.now();
    await usageStore.update("browser-usage", (current) => ({
      value: undefined,
      next: applyVinScanBrowserUsage(current, event, now),
    }));
  } catch (e) {
    console.warn("[vin-scan-monitor] browser usage write failed", e instanceof Error ? e.message : e);
  }
}

/**
 * Žurnāla rinda + pārlūka lietošanas skaitītājs (pēc atbildes, nebloķē importu).
 * import_saved = izdevās; import_rejected = kļūda/challenge. snapshot_write_failed nav avota vaina.
 */
export function trackVinScanBrowserImport(input: Parameters<typeof logVinScanBrowserImport>[0]): void {
  logVinScanBrowserImport(input);
  if (input.event === "snapshot_write_failed") return;
  const event = {
    id: input.id,
    ok: input.event === "import_saved",
    challenge: input.event === "import_rejected" && vinScanHtmlLooksLikeChallenge(input.html ?? ""),
  };
  try {
    after(() => recordVinScanBrowserUsage(event));
  } catch {
    void recordVinScanBrowserUsage(event);
  }
}
