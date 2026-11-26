import "server-only";

import { isSafeOrderDraftSessionId } from "@/lib/admin-order-draft-store";
import type { CsddFormFields } from "@/lib/admin-source-blocks";
import type { CarfaxPdfFileMeta } from "@/lib/carfax-report-parse";
import { readVendorAutoRaw, writeVendorAutoRaw } from "@/lib/carvertical-auto-store";
import { getDropboxClient } from "@/lib/dropbox-client";
import { orderCarFromCsdd } from "@/lib/ltab-auto";
import { saveFileToProvOrderFolder } from "@/lib/ltab-dropbox";
import { saveFileToOrderFolderOrLegacy } from "@/lib/order-dropbox";
import { normalizeVin } from "@/lib/order-field-validation";

/**
 * CARFAX oriģinālā PDF glabāšana (kā AutoDNA / LTAB PDF):
 *   carfax/{sessionId}.pdf  - privāts Blob (pasūtījuma pielikums)
 *   Dropbox pasūtījuma mapē - jaunajiem pasūtījumiem sava mape (AUDITI/...), vecajiem mape pēc VIN `/_PROv`.
 * Kļūda neaptur ielasi - atgriež, kas izdevās.
 */

const SUBDIR = "carfax";
const LOG = "[carfax-pdf]";

export function carfaxPdfBlobPath(sessionId: string): string {
  return `${SUBDIR}/${sessionId}.pdf`;
}

/** Faila nosaukums Dropbox mapē: `CARFAX - <VIN>.pdf` (bez klienta datiem). */
export function carfaxPdfFileName(vin: string): string {
  const v = normalizeVin(vin);
  return v ? `CARFAX - ${v}.pdf` : "CARFAX.pdf";
}

export async function readCarfaxPdf(sessionId: string): Promise<Uint8Array | null> {
  if (!isSafeOrderDraftSessionId(sessionId)) return null;
  return readVendorAutoRaw(carfaxPdfBlobPath(sessionId));
}

export async function saveCarfaxOriginalPdf(args: {
  sessionId: string;
  bytes: Uint8Array;
  vin: string;
  csdd: CsddFormFields;
  now?: Date;
}): Promise<{ meta: CarfaxPdfFileMeta | null; notes: string[] }> {
  const { sessionId, bytes } = args;
  const notes: string[] = [];
  if (!isSafeOrderDraftSessionId(sessionId)) return { meta: null, notes: ["Nederīgs pasūtījuma ID - PDF nav saglabāts"] };
  const name = carfaxPdfFileName(args.vin);
  const blob = await writeVendorAutoRaw(carfaxPdfBlobPath(sessionId), bytes, "application/pdf").catch(() => ({ ok: false as const }));
  if (!blob.ok) notes.push("PDF nav saglabāts krātuvē");

  let dropboxPath: string | undefined;
  const client = getDropboxClient();
  if (!client) {
    notes.push("Dropbox nav konfigurēts");
  } else {
    try {
      const car = orderCarFromCsdd(args.csdd, "", args.vin);
      const saved = await saveFileToOrderFolderOrLegacy(sessionId, name, bytes, () =>
        saveFileToProvOrderFolder(client, { ...car, vin: normalizeVin(args.vin) || car.vin }, name, bytes),
      );
      dropboxPath = saved.path;
    } catch (e) {
      console.error(`${LOG} dropbox save failed`, e instanceof Error ? e.message.slice(0, 200) : "unknown");
      notes.push("Dropbox neizdevās");
    }
  }
  if (!blob.ok && !dropboxPath) return { meta: null, notes };
  return {
    meta: {
      name,
      size: bytes.byteLength,
      savedAt: (args.now ?? new Date()).toISOString(),
      ...(blob.ok ? { blobPath: carfaxPdfBlobPath(sessionId) } : {}),
      ...(dropboxPath ? { dropboxPath } : {}),
    },
    notes,
  };
}
