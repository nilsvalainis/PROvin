export type PartnerReportAttachmentPick = {
  filename: string;
  contentType: string;
};

/** PROVIN atskaite e-pasta pielikumos; citi PDF (portfelis) paliek otrajā vietā. */
export function pickClientReportPdfAttachment<T extends PartnerReportAttachmentPick>(
  attachments: T[],
): T | null {
  const pdfs = attachments.filter((a) => {
    const type = a.contentType.trim().toLowerCase();
    const name = a.filename.trim().toLowerCase();
    return type === "application/pdf" || name.endsWith(".pdf");
  });
  if (pdfs.length === 0) return null;
  const ours = pdfs.find((a) =>
    /^(PROVIN_AUDITS|PROVIN_MINI|PROVIN_BUSINESS|PROVIN_SELECT|DILERA)/i.test(a.filename.trim()),
  );
  return ours ?? pdfs[0] ?? null;
}

export function emailsMatchForPartnerArchive(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = left?.trim().toLowerCase() ?? "";
  const b = right?.trim().toLowerCase() ?? "";
  return Boolean(a && b && a === b && a.includes("@"));
}
