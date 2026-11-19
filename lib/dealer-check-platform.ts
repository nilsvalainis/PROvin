import "server-only";

import fs from "node:fs/promises";
import { renderReportHtmlToPdf } from "@/lib/report-pdf-server";
import { dzintarzemeAutoLogoFsPath } from "@/lib/dzintarzeme-logo-fs";
import {
  buildDealerCheckReportHtml,
  DEALER_CHECK_DZA_FROM_NAME,
  dealerCheckDzaEmailHtml,
  dealerCheckMentionsProvin,
  dealerCheckReportFilename,
} from "@/lib/dealer-check-report";
import { findAutoparksCarByVin, type DealerCheckRecord } from "@/lib/dealer-check";
import { readAutoparksState } from "@/lib/iriss-autoparks-store";
import { readAutoparksV2State } from "@/lib/iriss-autoparks-v2-store";
import { autoparksV2Basics, carV2Of } from "@/lib/iriss-autoparks-v2";
import { iegadeDocDropboxFileName, iegadeStockDocFolder, uploadIegadeDocumentToStock } from "@/lib/iriss-autoparks-v2-iegade-dropbox";
import { autoparksDropboxEnabled, resolveAutoparksCarFolder } from "@/lib/iriss-autoparks-files";
import { joinDropboxPath } from "@/lib/iriss-autoparks-dropbox-path";
import { getDropboxClient } from "@/lib/dropbox-client";
import { setCabinetDocumentDropboxPath, upsertCabinetDocument } from "@/lib/iriss-logistics-cabinet-store";
import { isSmtpConfigured, sendPlainBrandlessEmail, sendReportReadyEmail } from "@/lib/email/send-transactional";
import { isValidOrderEmail } from "@/lib/order-field-validation";
import { isRecipientBlocked, parseRecipientBlocklist, REPORT_RECIPIENT_BLOCKLIST_ENV } from "@/lib/report-recipient-guard";
import type { AutoparksCar } from "@/lib/iriss-autoparks";

export const DEALER_CHECK_AUTOPARKS_DOC_LABEL = "Dīlera dati";

let dzaLogo: Promise<string> | null = null;

function loadDzaLogoDataUrl(): Promise<string> {
  dzaLogo ??= fs
    .readFile(dzintarzemeAutoLogoFsPath())
    .then((b) => `data:image/png;base64,${b.toString("base64")}`)
    .catch(() => {
      dzaLogo = null;
      return "";
    });
  return dzaLogo;
}

export type DealerCheckPdf = { pdf: Buffer; filename: string };

/** Servera PDF (Chromium + Inter) - tā pati dīlera-only atskaite kā klienta pasūtījumā. */
export async function renderDealerCheckPdf(record: DealerCheckRecord): Promise<DealerCheckPdf> {
  const dzaLogoDataUrl = record.template === "dzintarzeme" ? await loadDzaLogoDataUrl() : "";
  const html = buildDealerCheckReportHtml(record, { dzaLogoDataUrl });
  const r = await renderReportHtmlToPdf(html);
  return { pdf: Buffer.from(r.pdf), filename: dealerCheckReportFilename(record) };
}

export type DealerCheckAutoparksCar = { carId: string; title: string };

/** Auto Autoparkā pēc VIN (tikai esošs ieraksts - jaunu neveido). */
export async function findDealerCheckAutoparksCar(vin: string): Promise<{ car: AutoparksCar; info: DealerCheckAutoparksCar } | null> {
  const [v1, v2] = await Promise.all([readAutoparksState(), readAutoparksV2State()]);
  const car = findAutoparksCarByVin(v1.cars, vin);
  if (!car) return null;
  const title = autoparksV2Basics(car, carV2Of(v2, car.id)).title || [car.make, car.model].filter(Boolean).join(" ");
  return { car, info: { carId: car.id, title } };
}

async function stockDocFolder(car: AutoparksCar): Promise<string | null> {
  const direct = iegadeStockDocFolder(car);
  if (direct) return direct;
  const client = autoparksDropboxEnabled() ? getDropboxClient() : null;
  if (!client) return null;
  try {
    const ref = await resolveAutoparksCarFolder(client, car, { create: false });
    return ref ? joinDropboxPath(ref.path, "doc") : null;
  } catch {
    return null;
  }
}

export type DealerCheckAutoparksResult =
  | {
      ok: true;
      car: DealerCheckAutoparksCar;
      documentId: string;
      dropboxPath: string;
      /** Dropbox fails pārbaudīts pēc augšupielādes (metadati + izmērs). */
      dropboxVerified: boolean;
      dropboxError?: "not_linked" | "upload_failed" | "verify_failed";
    }
  | { ok: false; error: "not_in_autoparks" | "save_failed" };

/** PDF -> Autoparka auto dokumenti + Dropbox /STOCK `doc/`, pēc tam pārbauda, ka fails tur ir. */
export async function deliverDealerCheckToAutoparks(
  record: DealerCheckRecord,
  uploadedBy: string,
  pdf?: DealerCheckPdf,
): Promise<DealerCheckAutoparksResult> {
  const found = await findDealerCheckAutoparksCar(record.vin);
  if (!found) return { ok: false, error: "not_in_autoparks" };
  const { car, info } = found;
  const file = pdf ?? (await renderDealerCheckPdf(record));

  let documentId = "";
  let title = DEALER_CHECK_AUTOPARKS_DOC_LABEL;
  try {
    const saved = await upsertCabinetDocument({
      carId: car.orderId || car.id,
      section: "A",
      type: "other",
      typeLabel: DEALER_CHECK_AUTOPARKS_DOC_LABEL,
      source: "upload",
      bytes: file.pdf,
      contentType: "application/pdf",
      fileName: file.filename,
      uploadedBy,
    });
    documentId = saved.document.id;
    title = saved.document.title || title;
  } catch {
    return { ok: false, error: "save_failed" };
  }

  const folder = await stockDocFolder(car);
  if (!folder) return { ok: true, car: info, documentId, dropboxPath: "", dropboxVerified: false, dropboxError: "not_linked" };
  const client = getDropboxClient();
  const dropboxPath = client
    ? await uploadIegadeDocumentToStock(folder, iegadeDocDropboxFileName(title, file.filename, "application/pdf"), file.pdf, client)
    : null;
  if (!client || !dropboxPath) {
    return { ok: true, car: info, documentId, dropboxPath: "", dropboxVerified: false, dropboxError: "upload_failed" };
  }
  const meta = await client.getMetadata(dropboxPath).catch(() => null);
  const verified = meta?.tag === "file" && meta.size === file.pdf.length;
  if (verified) await setCabinetDocumentDropboxPath(documentId, dropboxPath).catch(() => null);
  return {
    ok: true,
    car: info,
    documentId,
    dropboxPath,
    dropboxVerified: verified,
    ...(verified ? {} : { dropboxError: "verify_failed" as const }),
  };
}

export type DealerCheckEmailInput = { to: string; subject: string; text: string };

export function validateDealerCheckEmail(
  input: DealerCheckEmailInput,
  blocklistRaw: string | undefined = process.env[REPORT_RECIPIENT_BLOCKLIST_ENV],
): { ok: true; to: string; subject: string; text: string } | { ok: false; error: "invalid_email" | "recipient_blocked" | "missing_text" } {
  const to = input.to.trim();
  if (!to || !isValidOrderEmail(to)) return { ok: false, error: "invalid_email" };
  if (isRecipientBlocked(to, parseRecipientBlocklist(blocklistRaw))) return { ok: false, error: "recipient_blocked" };
  const subject = input.subject.trim().slice(0, 180);
  const text = input.text.trim().slice(0, 12_000);
  if (!subject || !text) return { ok: false, error: "missing_text" };
  return { ok: true, to, subject, text };
}

/**
 * Sūta no info@provin.lv (noklusētais SMTP) ar servera PDF pielikumā. Tikai pēc admina apstiprinājuma UI.
 * «Dzintarzeme Auto»: vienkāršs e-pasts bez PROVIN (temats/teksts ar PROVIN tiek noraidīts).
 */
export async function sendDealerCheckEmail(
  record: DealerCheckRecord,
  input: DealerCheckEmailInput,
  pdf?: DealerCheckPdf,
): Promise<{ ok: true; to: string } | { ok: false; error: string }> {
  const v = validateDealerCheckEmail(input);
  if (!v.ok) return v;
  const dza = record.template === "dzintarzeme";
  if (dza && (dealerCheckMentionsProvin(v.subject) || dealerCheckMentionsProvin(v.text))) {
    return { ok: false, error: "provin_in_dza" };
  }
  if (!isSmtpConfigured()) return { ok: false, error: "smtp_not_configured" };
  const file = pdf ?? (await renderDealerCheckPdf(record));
  const attachments = [{ filename: file.filename, content: file.pdf, contentType: "application/pdf" }];
  if (dza) {
    // Nils 19.11: DZA e-pastā nekur nav PROVIN - bez PROVIN veidnes, sūtītāja vārds «Nils Valainis».
    await sendPlainBrandlessEmail({
      to: v.to,
      subject: v.subject,
      text: v.text,
      html: dealerCheckDzaEmailHtml(v.text),
      fromName: DEALER_CHECK_DZA_FROM_NAME,
      attachments,
    });
    return { ok: true, to: v.to };
  }
  await sendReportReadyEmail({
    to: v.to,
    carVin: record.vin,
    attachments,
    custom: { subject: v.subject, text: v.text },
  });
  return { ok: true, to: v.to };
}
