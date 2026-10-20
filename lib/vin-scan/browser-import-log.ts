/**
 * Pārlūka VIN SCAN importa diagnostika. Bez atslēgām, bez HTML ķermeņa.
 * 400 (page_not_ready / vin_mismatch) līdz šim nebija logā.
 */

const CHALLENGE_RE =
  /just a moment|performing security verification|security verification|checking your browser|verify you are human|cf-browser-verification|access blocked/i;

export function vinScanPageUrlForLog(raw: string | undefined): string {
  const t = (raw || "").trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    return `${u.hostname}${u.pathname}`.slice(0, 180);
  } catch {
    return t.replace(/\?.*$/, "").slice(0, 180);
  }
}

export function vinScanHtmlLooksLikeChallenge(html: string): boolean {
  return CHALLENGE_RE.test(html.slice(0, 8000));
}

export type VinScanBrowserImportLog = {
  vinScanBrowser: true;
  route: "vin-scan" | "order-vin-scan";
  event: "import_rejected" | "import_saved" | "snapshot_write_failed";
  error?: string;
  id: string;
  httpStatus?: number;
  finalUrl: string;
  htmlLen: number;
  challenge: boolean;
};

export function vinScanBrowserImportLog(input: {
  route: VinScanBrowserImportLog["route"];
  event: VinScanBrowserImportLog["event"];
  error?: string;
  id: string;
  httpStatus?: number;
  pageUrl?: string;
  html?: string;
}): VinScanBrowserImportLog {
  const html = input.html ?? "";
  return {
    vinScanBrowser: true,
    route: input.route,
    event: input.event,
    ...(input.error ? { error: input.error.slice(0, 80) } : {}),
    id: input.id.slice(0, 40),
    ...(typeof input.httpStatus === "number" && Number.isFinite(input.httpStatus)
      ? { httpStatus: input.httpStatus }
      : {}),
    finalUrl: vinScanPageUrlForLog(input.pageUrl),
    htmlLen: html.length,
    challenge: vinScanHtmlLooksLikeChallenge(html),
  };
}

export function logVinScanBrowserImport(input: Parameters<typeof vinScanBrowserImportLog>[0]): void {
  const row = vinScanBrowserImportLog(input);
  if (row.event === "import_saved") {
    console.info(JSON.stringify(row));
    return;
  }
  console.warn(JSON.stringify(row));
}
