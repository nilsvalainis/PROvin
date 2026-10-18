/**
 * Saraksta klientu PDF, kas ģenerēti kopš PR #277 (18.10.2026 00:29 Rīga).
 * Lietošana: npm run reports:affected-since-pr277
 * Dati: dashboard indekss (clientReportReadyAt) + Blob/FS client-reports/{sessionId}.pdf
 *       + pasūtījuma melnraksts, ja PDF nav.
 */
import { listAffectedClientReports } from "@/lib/affected-client-reports-list";

async function main() {
  const report = await listAffectedClientReports({ scanPdf: true, scanDraft: true });
  const compact = report.rows.map((r) => ({
    orderId: r.orderId,
    vin: r.vin,
    clientEmail: r.clientEmail,
    pdfGeneratedAt: r.pdfGeneratedAt,
    pdfFound: r.pdfFound,
    scanSource: r.scanSource,
    hasIncidentSection: r.hasIncidentSection,
    hasAveragedAmounts: r.hasAveragedAmounts,
    hasPilnigsZaudejums: r.hasPilnigsZaudejums,
    affected: r.affected,
    notes: r.notes,
  }));
  process.stdout.write(
    `${JSON.stringify(
      {
        cutoffIso: report.cutoffIso,
        blobConfigured: report.blobConfigured,
        listedCount: report.listedCount,
        scannedPdfCount: report.scannedPdfCount,
        scannedDraftCount: report.scannedDraftCount,
        affectedCount: report.affectedCount,
        unknownScanCount: report.unknownScanCount,
        rows: compact,
      },
      null,
      2,
    )}\n`,
  );
  if (!report.blobConfigured && report.listedCount === 0) {
    process.stderr.write(
      "BLOB_READ_WRITE_TOKEN / ADMIN_ORDER_DRAFT_BLOB_PREFIX nav iestatīti šajā vidē. Palaiž produkcijā vai ar --load-env-local.\n",
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
