/**
 * PDF atskaites identitāte: marka/modelis un VIN kopsavilkuma sākumam.
 * VIN - no klienta iesūtītā lauka. Marka/modelis - CSDD, tad dīleris, tad sludinājums.
 */

export function formatPdfReportMakeModel(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toLocaleUpperCase("lv");
}

export function extractVehicleMakeModelFromText(text: string): string | null {
  const t = text.replace(/\r/g, "");
  let m = t.match(/(?:marka|modelis)\s*[,&]?\s*(?:modelis|marka)?\s*[:\-]\s*([^\n]{2,72})/i);
  if (m) {
    const s = m[1]!.trim().split(/\n/)[0]?.trim() ?? "";
    if (s.length >= 2) return s.replace(/\s{2,}/g, " ");
  }
  m = t.match(
    /\b(BMW|Audi|Mercedes-Benz|Mercedes|VW|Volkswagen|Toyota|Volvo|Opel|Ford|Peugeot|Renault|Hyundai|Kia|Škoda|Skoda|Nissan|Mazda|Honda|Citro[ëe]n|Tesla|Land Rover|Range Rover|Jaguar|Porsche|Lexus|Mini|Jeep)\s+[A-Za-z0-9][A-Za-z0-9\s\-]{1,32}/i,
  );
  return m ? m[0]!.trim().replace(/\s{2,}/g, " ") : null;
}

/** ss.lv ceļš `/transport/cars/{marka}/{modelis}/`. */
export function extractMakeModelFromListingUrl(url: string): string | null {
  const t = url.trim();
  if (!t) return null;
  const ss = t.match(/\/transport\/cars\/([^/?#]+)\/([^/?#]+)/i);
  if (!ss) return null;
  const make = decodeURIComponent(ss[1] ?? "").replace(/[-_+]+/g, " ").trim();
  const model = decodeURIComponent(ss[2] ?? "").replace(/[-_+]+/g, " ").trim();
  if (make.length < 2 || model.length < 1) return null;
  if (/^(msg|search|filter)$/i.test(make)) return null;
  return `${make} ${model}`;
}

export function resolvePdfReportMakeModel(input: {
  csddMakeModel?: string | null;
  csddRaw?: string | null;
  dealerModel?: string | null;
  listingUrl?: string | null;
  listingText?: string | null;
  ltabMakeModel?: string | null;
}): string {
  const candidates = [
    input.csddMakeModel,
    extractVehicleMakeModelFromText(input.csddRaw ?? ""),
    input.dealerModel,
    extractMakeModelFromListingUrl(input.listingUrl ?? ""),
    extractVehicleMakeModelFromText(input.listingText ?? ""),
    input.ltabMakeModel,
  ];
  for (const raw of candidates) {
    const t = (raw ?? "").replace(/\s+/g, " ").trim();
    if (t.length >= 2) return t;
  }
  return "";
}
