/**
 * Savāc un pielieto atpakaļ visus pasūtījumam specifiskos brīvā teksta laukus
 * (✨ ģenerētie komentāri, avotu piezīmes), kas jātulko ar AI uz EN/RU.
 *
 * Klienta drošs fails (bez "server-only") — izsauc gan pārlūkā (savākšana +
 * pielietošana pirms drukas), gan API maršrutā netiek importēts tieši.
 *
 * Katrai atslēgai jābūt stabilai starp izsaukumiem, lai keša hash nemainītos
 * velti. Struktūras (numuru/rindu skaits u.c.) šeit NETIEK tulkotas — tikai
 * brīvā teksta lauki.
 */
import type { ClientReportPayload } from "@/lib/client-report-html";

export type TranslatableFieldMap = Record<string, string>;

const TOP_LEVEL_TEXT_FIELDS: (keyof ClientReportPayload)[] = [
  "tehniskoRiskuAnalize",
  "apskatesPlāns",
  "cenasAtbilstiba",
  "iriss",
  "mileageComment",
  "internalComment",
  "csdd",
  "ltab",
  "tirgus",
  "citi",
];

function put(map: TranslatableFieldMap, key: string, value: string | null | undefined): void {
  const v = (value ?? "").trim();
  if (v) map[key] = v;
}

/** Savāc visus aizpildītos tulkojamos laukus vienā plakanā `{id: teksts}` objektā. */
export function collectClientReportTranslatableTexts(payload: ClientReportPayload): TranslatableFieldMap {
  const out: TranslatableFieldMap = {};

  for (const key of TOP_LEVEL_TEXT_FIELDS) {
    const v = payload[key];
    if (typeof v === "string") put(out, `main.${key}`, v);
  }

  if (payload.csddForm) put(out, "csddForm.comments", payload.csddForm.comments);
  if (payload.tirgusForm) put(out, "tirgusForm.comments", payload.tirgusForm.comments);
  if (payload.manualLtabBlock) put(out, "manualLtabBlock.comments", payload.manualLtabBlock.comments);

  if (payload.autoRecordsBlock) {
    put(out, "autoRecordsBlock.comments", payload.autoRecordsBlock.comments);
    put(out, "autoRecordsBlock.serviceHistoryNotes", payload.autoRecordsBlock.serviceHistoryNotes);
    put(out, "autoRecordsBlock.oilChangeIntervalNotes", payload.autoRecordsBlock.oilChangeIntervalNotes);
  }

  if (payload.ccVinBlock) put(out, "ccVinBlock.comments", payload.ccVinBlock.comments);
  if (payload.asvBlock) put(out, "asvBlock.comments", payload.asvBlock.comments);

  (payload.citiAvoti?.sections ?? []).forEach((section, i) => {
    put(out, `citiAvoti.${i}.comments`, section.comments);
  });

  if (payload.listingAnalysis) {
    put(out, "listingAnalysis.sellerPortrait", payload.listingAnalysis.sellerPortrait);
    put(out, "listingAnalysis.photoAnalysis", payload.listingAnalysis.photoAnalysis);
    put(out, "listingAnalysis.listingSalesContext", payload.listingAnalysis.listingSalesContext);
  }

  (payload.manualVendorBlocks ?? []).forEach((block, i) => {
    put(out, `vendor.${i}.comments`, block.comments);
    put(out, `vendor.${i}.ownersSummary`, block.ownersSummary);
    put(out, `vendor.${i}.statusRecords`, block.statusRecords);
    put(out, `vendor.${i}.autoNotes`, block.autoNotes);
  });

  (payload.manualBanners ?? []).forEach((banner, i) => {
    put(out, `banner.${i}.text`, banner.text);
    put(out, `banner.${i}.title`, banner.title);
    put(out, `banner.${i}.value`, banner.value);
  });

  return out;
}

/** Pielieto tulkoto teksta karti atpakaļ payload kopijai. Trūkstoša atslēga = oriģināls paliek. */
export function applyClientReportTranslatedTexts(
  payload: ClientReportPayload,
  texts: TranslatableFieldMap,
): ClientReportPayload {
  const get = (id: string, fallback: string): string => texts[id] ?? fallback;
  const out: ClientReportPayload = { ...payload };

  for (const key of TOP_LEVEL_TEXT_FIELDS) {
    const v = payload[key];
    if (typeof v === "string" && v.trim()) {
      (out as Record<string, unknown>)[key] = get(`main.${key}`, v);
    }
  }

  if (payload.csddForm) {
    out.csddForm = { ...payload.csddForm, comments: get("csddForm.comments", payload.csddForm.comments) };
  }
  if (payload.tirgusForm) {
    out.tirgusForm = { ...payload.tirgusForm, comments: get("tirgusForm.comments", payload.tirgusForm.comments) };
  }
  if (payload.manualLtabBlock) {
    out.manualLtabBlock = {
      ...payload.manualLtabBlock,
      comments: get("manualLtabBlock.comments", payload.manualLtabBlock.comments),
    };
  }

  if (payload.autoRecordsBlock) {
    out.autoRecordsBlock = {
      ...payload.autoRecordsBlock,
      comments: get("autoRecordsBlock.comments", payload.autoRecordsBlock.comments),
      serviceHistoryNotes: get(
        "autoRecordsBlock.serviceHistoryNotes",
        payload.autoRecordsBlock.serviceHistoryNotes,
      ),
      oilChangeIntervalNotes: get(
        "autoRecordsBlock.oilChangeIntervalNotes",
        payload.autoRecordsBlock.oilChangeIntervalNotes,
      ),
    };
  }

  if (payload.ccVinBlock) {
    out.ccVinBlock = { ...payload.ccVinBlock, comments: get("ccVinBlock.comments", payload.ccVinBlock.comments) };
  }
  if (payload.asvBlock) {
    out.asvBlock = { ...payload.asvBlock, comments: get("asvBlock.comments", payload.asvBlock.comments) };
  }

  if (payload.citiAvoti) {
    out.citiAvoti = {
      sections: payload.citiAvoti.sections.map((section, i) => ({
        ...section,
        comments: get(`citiAvoti.${i}.comments`, section.comments),
      })),
    };
  }

  if (payload.listingAnalysis) {
    out.listingAnalysis = {
      ...payload.listingAnalysis,
      sellerPortrait: get("listingAnalysis.sellerPortrait", payload.listingAnalysis.sellerPortrait),
      photoAnalysis: get("listingAnalysis.photoAnalysis", payload.listingAnalysis.photoAnalysis),
      listingSalesContext: get(
        "listingAnalysis.listingSalesContext",
        payload.listingAnalysis.listingSalesContext,
      ),
    };
  }

  if (payload.manualVendorBlocks) {
    out.manualVendorBlocks = payload.manualVendorBlocks.map((block, i) => ({
      ...block,
      comments: get(`vendor.${i}.comments`, block.comments),
      ...(block.ownersSummary != null
        ? { ownersSummary: get(`vendor.${i}.ownersSummary`, block.ownersSummary) }
        : {}),
      ...(block.statusRecords != null
        ? { statusRecords: get(`vendor.${i}.statusRecords`, block.statusRecords) }
        : {}),
      ...(block.autoNotes != null ? { autoNotes: get(`vendor.${i}.autoNotes`, block.autoNotes) } : {}),
    }));
  }

  if (payload.manualBanners) {
    out.manualBanners = payload.manualBanners.map((banner, i) => ({
      ...banner,
      text: get(`banner.${i}.text`, banner.text),
      ...(banner.title != null ? { title: get(`banner.${i}.title`, banner.title) } : {}),
      ...(banner.value != null ? { value: get(`banner.${i}.value`, banner.value) } : {}),
    }));
  }

  return out;
}

/** Vienkāršs, deterministisks hash keša derīguma pārbaudei (FNV-1a variants). Nav kriptogrāfisks. */
export function hashTranslatableTexts(texts: TranslatableFieldMap): string {
  const keys = Object.keys(texts).sort();
  const joined = keys.map((k) => `${k}=${texts[k]}`).join("\u0001");
  let h = 0x811c9dc5;
  for (let i = 0; i < joined.length; i++) {
    h ^= joined.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ":" + joined.length;
}
