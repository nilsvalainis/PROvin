import "server-only";

import { extractPdfTextOnServer } from "@/lib/pdf-text-extract-server";
import { parseTransportInvoiceAmount, type TransportInvoiceParseResult } from "@/lib/iriss-logistics-transport-invoice-amount";

/** Auto1 Transport Invoice PDF -> mēģina nolasīt kopsummu Pašizmaksas transporta laukam. */
export async function parseTransportInvoicePdf(buffer: ArrayBuffer, fileName?: string): Promise<TransportInvoiceParseResult> {
  const text = await extractPdfTextOnServer(buffer, { fileName });
  return parseTransportInvoiceAmount(text);
}
